package service

import (
	"context"
	"testing"
	"time"

	"avtobirzhasi/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

func TestFormatTenge(t *testing.T) {
	cases := []struct {
		amount int64
		want   string
	}{
		{999, "999 ₸"},
		{1000, "1 000 ₸"},
		{11_682_000, "11 682 000 ₸"},
	}
	for _, tc := range cases {
		if got := formatTenge(tc.amount); got != tc.want {
			t.Errorf("formatTenge(%d) = %q, want %q", tc.amount, got, tc.want)
		}
	}
}

// This is the exact regression Stage 2 fixed: a user with both a matching
// listing and a matching buyer request of their own must never trade with
// themselves, even when the price gap is already inside the 2% tolerance.
// See STAGE2_CORE_BUSINESS_SAFETY_REPORT.md.
func TestExchangeService_SelfMatchIsNeverCreated(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewExchangeService(pool, NewMockPaymentProvider())

	userID := testutil.InsertUser(t, pool, "+77020000001")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "SelfMatchCar", Region: "Алматы",
		Year: 2021, Price: 10_000_000, IsExchange: true, Status: "active",
	})
	testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "SelfMatchCar", Region: "Алматы",
		YearFrom: 2019, YearTo: 2023, CurrentOffer: 9_950_000, // 0.5% gap, well within 2% tolerance
		Status: "active",
	})

	result, err := svc.RunDailyTick(ctx)
	if err != nil {
		t.Fatalf("RunDailyTick: %v", err)
	}
	if result.MatchesCreated != 0 {
		t.Errorf("MatchesCreated = %d, want 0 (self-match must be suppressed)", result.MatchesCreated)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM listings WHERE id = $1`, listingID).Scan(&status); err != nil {
		t.Fatalf("reload listing: %v", err)
	}
	if status != "active" {
		t.Errorf("listing status = %q, want still active (never frozen by a self-match)", status)
	}

	var matchCount int
	if err := pool.QueryRow(ctx, `SELECT count(*) FROM matches WHERE listing_id = $1`, listingID).Scan(&matchCount); err != nil {
		t.Fatalf("count matches: %v", err)
	}
	if matchCount != 0 {
		t.Errorf("matches for this listing = %d, want 0", matchCount)
	}
}

// Regression check alongside the self-match guard: an unrelated buyer
// matching the exact same listing must still succeed normally.
func TestExchangeService_GenuineMatchIsCreated(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewExchangeService(pool, NewMockPaymentProvider())

	sellerID := testutil.InsertUser(t, pool, "+77020000002")
	buyerID := testutil.InsertUser(t, pool, "+77020000003")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Kia", Model: "Rio", Region: "Астана",
		Year: 2020, Price: 8_000_000, IsExchange: true, Status: "active",
	})
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: buyerID, Make: "Kia", Model: "Rio", Region: "Астана",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 7_960_000, // 0.5% gap
		Status: "active",
	})

	result, err := svc.RunDailyTick(ctx)
	if err != nil {
		t.Fatalf("RunDailyTick: %v", err)
	}
	if result.MatchesCreated != 1 {
		t.Fatalf("MatchesCreated = %d, want 1", result.MatchesCreated)
	}

	var listingStatus, requestStatus string
	if err := pool.QueryRow(ctx, `SELECT status FROM listings WHERE id = $1`, listingID).Scan(&listingStatus); err != nil {
		t.Fatalf("reload listing: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT status FROM buyer_requests WHERE id = $1`, requestID).Scan(&requestStatus); err != nil {
		t.Fatalf("reload buyer request: %v", err)
	}
	if listingStatus != "frozen" || requestStatus != "frozen" {
		t.Errorf("listing/request status = %q/%q, want frozen/frozen", listingStatus, requestStatus)
	}

	var finalPrice, depositAmount int64
	var matchStatus string
	if err := pool.QueryRow(ctx, `
		SELECT final_price, deposit_amount, status FROM matches WHERE listing_id = $1
	`, listingID).Scan(&finalPrice, &depositAmount, &matchStatus); err != nil {
		t.Fatalf("load created match: %v", err)
	}
	// RunDailyTick decays the price *before* matching in the same pass, so
	// the match's final_price is the listing's post-decay price (8,000,000
	// * 0.99), not its price when the test seeded it.
	const wantFinalPrice = 7_920_000
	const wantDepositAmount = 79_200
	if finalPrice != wantFinalPrice {
		t.Errorf("final_price = %d, want the listing's post-decay price at match time (%d)", finalPrice, wantFinalPrice)
	}
	if depositAmount != wantDepositAmount {
		t.Errorf("deposit_amount = %d, want round(finalPrice * 0.01) = %d", depositAmount, wantDepositAmount)
	}
	if matchStatus != "awaiting_deposit" {
		t.Errorf("match status = %q, want awaiting_deposit", matchStatus)
	}

	var depositCount, notificationCount int
	pool.QueryRow(ctx, `SELECT count(*) FROM deposits WHERE match_id = (SELECT id FROM matches WHERE listing_id = $1)`, listingID).Scan(&depositCount)
	pool.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE type = 'match_found'`).Scan(&notificationCount)
	if depositCount != 2 {
		t.Errorf("deposits created = %d, want 2 (one per role)", depositCount)
	}
	if notificationCount != 2 {
		t.Errorf("match_found notifications = %d, want 2 (one per party)", notificationCount)
	}
}

func TestExchangeService_DecayAndGrowApplyDailyRate(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewExchangeService(pool, NewMockPaymentProvider())

	sellerID := testutil.InsertUser(t, pool, "+77020000004")
	buyerID := testutil.InsertUser(t, pool, "+77020000005")
	// Deliberately far apart so this pair never matches — isolates the
	// decay/grow math from the matching pass.
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "BMW", Model: "X5", Region: "Алматы",
		Year: 2020, Price: 20_000_000, IsExchange: true, Status: "active",
	})
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: buyerID, Make: "BMW", Model: "X5", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 1_000_000,
		Status: "active",
	})

	decayed, err := svc.decayListingPrices(ctx)
	if err != nil {
		t.Fatalf("decayListingPrices: %v", err)
	}
	if decayed != 1 {
		t.Errorf("listings decayed = %d, want 1", decayed)
	}
	grown, err := svc.growBuyerOffers(ctx)
	if err != nil {
		t.Fatalf("growBuyerOffers: %v", err)
	}
	if grown != 1 {
		t.Errorf("requests grown = %d, want 1", grown)
	}

	var price, offer int64
	pool.QueryRow(ctx, `SELECT price FROM listings WHERE id = $1`, listingID).Scan(&price)
	pool.QueryRow(ctx, `SELECT current_offer FROM buyer_requests WHERE id = $1`, requestID).Scan(&offer)

	if price != 19_800_000 {
		t.Errorf("price after one day's decay = %d, want 19800000 (20000000 * 0.99)", price)
	}
	if offer != 1_010_000 {
		t.Errorf("current_offer after one day's growth = %d, want 1010000 (1000000 * 1.01)", offer)
	}
}

func seedFrozenMatchPastDeadline(t *testing.T, pool *pgxpool.Pool, payDeposit bool) (matchID string, listingID string, requestID string) {
	t.Helper()
	ctx := context.Background()

	sellerID := testutil.InsertUser(t, pool, "+77020000006")
	buyerID := testutil.InsertUser(t, pool, "+77020000007")
	listingID = testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Hyundai", Model: "Tucson", Region: "Шымкент",
		Year: 2019, Price: 9_000_000, IsExchange: true, Status: "frozen",
	})
	requestID = testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: buyerID, Make: "Hyundai", Model: "Tucson", Region: "Шымкент",
		YearFrom: 2017, YearTo: 2021, CurrentOffer: 8_950_000, Status: "frozen",
	})
	matchID, sellerDepositID, _ := testutil.InsertMatch(t, pool, testutil.MatchFixture{
		ListingID: listingID, BuyerRequestID: requestID,
		FinalPrice: 9_000_000, DepositAmount: 90_000,
		Deadline: time.Now().Add(-time.Hour), // already overdue
	})

	if payDeposit {
		if _, err := pool.Exec(ctx, `UPDATE deposits SET status = 'paid', paid_at = now() WHERE id = $1`, sellerDepositID); err != nil {
			t.Fatalf("mark deposit paid: %v", err)
		}
	}

	return matchID, listingID, requestID
}

func TestExchangeService_ExpireOverdueMatches_ReactivatesAndRefunds(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewExchangeService(pool, NewMockPaymentProvider())

	matchID, listingID, requestID := seedFrozenMatchPastDeadline(t, pool, true)

	result, err := svc.RunDailyTick(ctx)
	if err != nil {
		t.Fatalf("RunDailyTick: %v", err)
	}
	if result.MatchesExpired != 1 {
		t.Fatalf("MatchesExpired = %d, want 1", result.MatchesExpired)
	}

	var matchStatus, listingStatus, requestStatus string
	pool.QueryRow(ctx, `SELECT status FROM matches WHERE id = $1`, matchID).Scan(&matchStatus)
	pool.QueryRow(ctx, `SELECT status FROM listings WHERE id = $1`, listingID).Scan(&listingStatus)
	pool.QueryRow(ctx, `SELECT status FROM buyer_requests WHERE id = $1`, requestID).Scan(&requestStatus)

	if matchStatus != "expired" {
		t.Errorf("match status = %q, want expired", matchStatus)
	}
	if listingStatus != "active" || requestStatus != "active" {
		t.Errorf("listing/request status = %q/%q, want active/active (unfrozen on expiry)", listingStatus, requestStatus)
	}

	var refundedCount int
	pool.QueryRow(ctx, `SELECT count(*) FROM deposits WHERE match_id = $1 AND status = 'refunded'`, matchID).Scan(&refundedCount)
	if refundedCount != 1 {
		t.Errorf("refunded deposits = %d, want 1 (the one that was paid before expiry)", refundedCount)
	}

	var expiredNotifications int
	pool.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE related_match_id = $1 AND type = 'match_expired'`, matchID).Scan(&expiredNotifications)
	if expiredNotifications != 2 {
		t.Errorf("match_expired notifications = %d, want 2 (one per party)", expiredNotifications)
	}
}

// RunDailyTick must be safe to call twice for the same overdue match — the
// second pass should find nothing left to expire, not double-refund or
// error. See SKILL.md: "write it so the job is idempotent."
func TestExchangeService_RunDailyTick_IdempotentOnOverdueMatch(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewExchangeService(pool, NewMockPaymentProvider())

	seedFrozenMatchPastDeadline(t, pool, false)

	if _, err := svc.RunDailyTick(ctx); err != nil {
		t.Fatalf("first RunDailyTick: %v", err)
	}
	result, err := svc.RunDailyTick(ctx)
	if err != nil {
		t.Fatalf("second RunDailyTick: %v", err)
	}
	if result.MatchesExpired != 0 {
		t.Errorf("second tick's MatchesExpired = %d, want 0 (already expired, nothing left to do)", result.MatchesExpired)
	}
}

// trackingRefundProvider lets tests assert a real gateway's Refund is
// actually called (with the right provider payment id and amount) instead
// of the deposit just being flipped to 'refunded' locally.
type trackingRefundProvider struct {
	*MockPaymentProvider
	calls []struct {
		providerPaymentID string
		amount            int64
	}
	failRefund bool
}

func (p *trackingRefundProvider) Refund(ctx context.Context, providerPaymentID string, amount int64) (string, error) {
	p.calls = append(p.calls, struct {
		providerPaymentID string
		amount            int64
	}{providerPaymentID, amount})
	if p.failRefund {
		return "", context.DeadlineExceeded
	}
	return "real-refund-" + providerPaymentID, nil
}

// TestExchangeService_ExpireOverdueMatches_RefundsThroughRealProvider is
// the Stage 11 regression for expiry refunds: a deposit charged through a
// real (non-mock) provider must be reversed via PaymentProvider.Refund,
// not just flipped to 'refunded' in the database.
func TestExchangeService_ExpireOverdueMatches_RefundsThroughRealProvider(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := &trackingRefundProvider{MockPaymentProvider: NewMockPaymentProvider()}
	svc := NewExchangeService(pool, provider)

	matchID, _, _ := seedFrozenMatchPastDeadline(t, pool, false)
	var sellerDepositID string
	if err := pool.QueryRow(ctx, `SELECT id FROM deposits WHERE match_id = $1 AND role = 'seller'`, matchID).Scan(&sellerDepositID); err != nil {
		t.Fatalf("find seller deposit: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`UPDATE deposits SET status = 'paid', paid_at = now(), provider = 'real-gateway', provider_payment_id = $2 WHERE id = $1`,
		sellerDepositID, "pp-"+sellerDepositID,
	); err != nil {
		t.Fatalf("mark deposit paid via real provider: %v", err)
	}

	if _, err := svc.RunDailyTick(ctx); err != nil {
		t.Fatalf("RunDailyTick: %v", err)
	}

	if len(provider.calls) != 1 {
		t.Fatalf("Refund calls = %d, want 1", len(provider.calls))
	}
	if provider.calls[0].providerPaymentID != "pp-"+sellerDepositID || provider.calls[0].amount != 90_000 {
		t.Errorf("Refund called with (%q, %d), want (%q, 90000)", provider.calls[0].providerPaymentID, provider.calls[0].amount, "pp-"+sellerDepositID)
	}

	var status, reference string
	if err := pool.QueryRow(ctx, `SELECT status, provider_reference FROM deposits WHERE id = $1`, sellerDepositID).Scan(&status, &reference); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "refunded" {
		t.Errorf("deposit status = %q, want refunded", status)
	}
	if reference != "real-refund-pp-"+sellerDepositID {
		t.Errorf("provider_reference = %q, want the gateway's own refund id", reference)
	}
}

// TestExchangeService_ExpireOverdueMatches_RefundFailureAbortsExpiry
// guards the "never mark refunded before the provider confirms it" rule:
// if the gateway's Refund call fails, the deposit must stay 'paid' and the
// match must stay non-expired, not be silently marked refunded anyway.
func TestExchangeService_ExpireOverdueMatches_RefundFailureAbortsExpiry(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := &trackingRefundProvider{MockPaymentProvider: NewMockPaymentProvider(), failRefund: true}
	svc := NewExchangeService(pool, provider)

	matchID, _, _ := seedFrozenMatchPastDeadline(t, pool, false)
	var sellerDepositID string
	if err := pool.QueryRow(ctx, `SELECT id FROM deposits WHERE match_id = $1 AND role = 'seller'`, matchID).Scan(&sellerDepositID); err != nil {
		t.Fatalf("find seller deposit: %v", err)
	}
	if _, err := pool.Exec(ctx,
		`UPDATE deposits SET status = 'paid', paid_at = now(), provider = 'real-gateway', provider_payment_id = $2 WHERE id = $1`,
		sellerDepositID, "pp-"+sellerDepositID,
	); err != nil {
		t.Fatalf("mark deposit paid via real provider: %v", err)
	}

	if _, err := svc.RunDailyTick(ctx); err == nil {
		t.Fatalf("RunDailyTick succeeded, want an error from the failed refund")
	}

	var status, matchStatus string
	pool.QueryRow(ctx, `SELECT status FROM deposits WHERE id = $1`, sellerDepositID).Scan(&status)
	pool.QueryRow(ctx, `SELECT status FROM matches WHERE id = $1`, matchID).Scan(&matchStatus)
	if status != "paid" {
		t.Errorf("deposit status after failed refund = %q, want still paid (never marked refunded before the provider confirms it)", status)
	}
	if matchStatus == "expired" {
		t.Errorf("match status after failed refund = %q, want NOT expired (whole expiry transaction rolled back)", matchStatus)
	}
}
