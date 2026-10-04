package service

import (
	"context"
	"errors"
	"fmt"
	"testing"
	"time"

	"avtobirzhasi/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Every provider-confirmed payment is checked against the stored
// commission (deposits.amount) in whole KZT before anything is marked
// paid. These fixtures use a 5 000 000 ₸ match → 5 000 ₸ commission.
const (
	amountTestFinalPrice = 5_000_000
	amountTestCommission = 5_000
)

func seedCommissionMatch(t *testing.T, pool *pgxpool.Pool) (matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID string) {
	t.Helper()
	sellerUserID = testutil.InsertUser(t, pool, "+77013000001")
	buyerUserID = testutil.InsertUser(t, pool, "+77013000002")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerUserID, Make: "Hyundai", Model: "Elantra", Region: "Алматы",
		Year: 2021, Price: amountTestFinalPrice, IsExchange: true, Status: "frozen",
	})
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: buyerUserID, Make: "Hyundai", Model: "Elantra", Region: "Алматы",
		YearFrom: 2019, YearTo: 2023, CurrentOffer: 4_980_000, Status: "frozen",
	})
	matchID, sellerDepositID, buyerDepositID = testutil.InsertMatch(t, pool, testutil.MatchFixture{
		ListingID: listingID, BuyerRequestID: requestID,
		FinalPrice: amountTestFinalPrice, DepositAmount: amountTestCommission,
	})
	return matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID
}

type depositSnapshot struct {
	Status            string
	Amount            int64
	ProviderPaymentID string
	PaidAt            *time.Time
	ReportedAmount    *int64
	ReportedCurrency  *string
	MismatchAt        *time.Time
}

func loadDeposit(t *testing.T, pool *pgxpool.Pool, id string) depositSnapshot {
	t.Helper()
	var d depositSnapshot
	if err := pool.QueryRow(context.Background(), `
		SELECT status, amount, coalesce(provider_payment_id, ''), paid_at,
		       mismatch_reported_amount, mismatch_reported_currency, mismatch_at
		FROM deposits WHERE id = $1`, id,
	).Scan(&d.Status, &d.Amount, &d.ProviderPaymentID, &d.PaidAt, &d.ReportedAmount, &d.ReportedCurrency, &d.MismatchAt); err != nil {
		t.Fatalf("load deposit: %v", err)
	}
	return d
}

type matchSnapshot struct {
	Status                string
	SellerPaid, BuyerPaid bool
	DepositReceived       int
	ContactsOpen          int
}

func loadMatch(t *testing.T, pool *pgxpool.Pool, id string) matchSnapshot {
	t.Helper()
	ctx := context.Background()
	var m matchSnapshot
	if err := pool.QueryRow(ctx,
		`SELECT status, seller_deposit_paid, buyer_deposit_paid FROM matches WHERE id = $1`, id,
	).Scan(&m.Status, &m.SellerPaid, &m.BuyerPaid); err != nil {
		t.Fatalf("load match: %v", err)
	}
	pool.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE related_match_id = $1 AND type = 'deposit_received'`, id).Scan(&m.DepositReceived)
	pool.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE related_match_id = $1 AND type = 'contacts_open'`, id).Scan(&m.ContactsOpen)
	return m
}

func successEvent(depositID string, amount int64) WebhookEvent {
	return WebhookEvent{
		ProviderPaymentID: "pp-" + depositID, Status: PaymentStatusSucceeded,
		AmountTenge: amount, Currency: "KZT",
	}
}

// assertBlocked checks a mismatched payment was parked for manual review
// and nothing else moved: deposit in amount_mismatch at its stored amount
// with the reported amount and provider payment id kept, match not
// advanced, no notifications, contacts closed.
func assertBlocked(t *testing.T, pool *pgxpool.Pool, matchID, depositID string, reported int64) {
	t.Helper()
	d := loadDeposit(t, pool, depositID)
	if d.Status != "amount_mismatch" || d.PaidAt != nil {
		t.Errorf("deposit status/paid_at = %q/%v, want amount_mismatch/nil", d.Status, d.PaidAt)
	}
	if d.Amount != amountTestCommission {
		t.Errorf("deposit amount = %d, want stored %d untouched", d.Amount, amountTestCommission)
	}
	if d.ProviderPaymentID == "" {
		t.Errorf("provider_payment_id was cleared — the transaction must stay traceable")
	}
	if d.ReportedAmount == nil || *d.ReportedAmount != reported || d.ReportedCurrency == nil || *d.ReportedCurrency != "KZT" || d.MismatchAt == nil {
		t.Errorf("mismatch record = %v/%v/%v, want %d/KZT/set", d.ReportedAmount, d.ReportedCurrency, d.MismatchAt, reported)
	}
	m := loadMatch(t, pool, matchID)
	if m.Status != "awaiting_deposit" || m.SellerPaid || m.BuyerPaid {
		t.Errorf("match = %+v, want awaiting_deposit with no side paid", m)
	}
	if m.DepositReceived != 0 || m.ContactsOpen != 0 {
		t.Errorf("notifications deposit_received/contacts_open = %d/%d, want 0/0", m.DepositReceived, m.ContactsOpen)
	}
}

func TestVerifyChargedAmount(t *testing.T) {
	cases := []struct {
		name               string
		stored, match, got int64
		currency           string
		wantOK             bool
	}{
		{"exact", 5000, 5000, 5000, "KZT", true},
		{"old 1% amount", 5000, 5000, 50000, "KZT", false},
		{"one tenge short", 5000, 5000, 4999, "KZT", false},
		{"one tenge over", 5000, 5000, 5001, "KZT", false},
		{"zero", 5000, 5000, 0, "KZT", false},
		{"wrong currency", 5000, 5000, 5000, "USD", false},
		{"missing currency", 5000, 5000, 5000, "", false},
		{"deposit disagrees with match", 5000, 50000, 5000, "KZT", false},
	}
	for _, c := range cases {
		err := verifyChargedAmount("dep", c.stored, c.match, c.got, c.currency)
		if c.wantOK && err != nil {
			t.Errorf("%s: unexpected error %v", c.name, err)
		}
		if !c.wantOK && !errors.Is(err, ErrPaymentAmountMismatch) {
			t.Errorf("%s: error = %v, want ErrPaymentAmountMismatch", c.name, err)
		}
	}
}

// Expected 5000 — only exactly 5000 KZT is accepted.
func TestConfirmWebhook_VerifiesAmountAgainstStoredCommission(t *testing.T) {
	cases := []struct {
		reported int64
		wantPaid bool
	}{
		{5_000, true},
		{50_000, false},
		{4_999, false},
		{5_001, false},
	}
	for _, c := range cases {
		t.Run(fmt.Sprintf("provider_%d", c.reported), func(t *testing.T) {
			pool := testutil.SetupDB(t)
			ctx := context.Background()
			svc := NewDepositService(pool, newStubAsyncProvider())
			matchID, sellerDepositID, _, sellerUserID, _ := seedCommissionMatch(t, pool)
			if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
				t.Fatalf("InitiatePay: %v", err)
			}

			err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, c.reported))

			if c.wantPaid {
				if err != nil {
					t.Fatalf("ConfirmWebhook: %v", err)
				}
				if d := loadDeposit(t, pool, sellerDepositID); d.Status != "paid" || d.ReportedAmount != nil {
					t.Errorf("deposit = %+v, want paid with no mismatch record", d)
				}
				if m := loadMatch(t, pool, matchID); m.Status != "seller_deposit_paid" || !m.SellerPaid {
					t.Errorf("match = %+v, want seller_deposit_paid", m)
				}
				return
			}
			if !errors.Is(err, ErrPaymentAmountMismatch) {
				t.Fatalf("ConfirmWebhook error = %v, want ErrPaymentAmountMismatch", err)
			}
			assertBlocked(t, pool, matchID, sellerDepositID, c.reported)
		})
	}
}

// A valid callback retried by the gateway is a no-op: no second state
// transition, no duplicate notification, paid_at unchanged — and a late
// mismatched callback can't alter the historical payment either.
func TestConfirmWebhook_ValidCallbackRepeatedIsIdempotent(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, newStubAsyncProvider())
	matchID, sellerDepositID, _, sellerUserID, _ := seedCommissionMatch(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, amountTestCommission)); err != nil {
		t.Fatalf("first ConfirmWebhook: %v", err)
	}
	paidBefore := loadDeposit(t, pool, sellerDepositID)
	matchBefore := loadMatch(t, pool, matchID)

	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, amountTestCommission)); err != nil {
		t.Fatalf("retried valid ConfirmWebhook: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, 50_000)); err != nil {
		t.Fatalf("late mismatched ConfirmWebhook on a paid deposit: %v", err)
	}

	paidAfter := loadDeposit(t, pool, sellerDepositID)
	if paidAfter.Status != "paid" || paidAfter.Amount != amountTestCommission || paidAfter.ReportedAmount != nil {
		t.Errorf("deposit = %+v, want still paid at %d with no mismatch record", paidAfter, amountTestCommission)
	}
	if paidBefore.PaidAt == nil || paidAfter.PaidAt == nil || !paidAfter.PaidAt.Equal(*paidBefore.PaidAt) {
		t.Errorf("paid_at changed: %v -> %v", paidBefore.PaidAt, paidAfter.PaidAt)
	}
	if matchAfter := loadMatch(t, pool, matchID); matchAfter != matchBefore {
		t.Errorf("match changed on retry: %+v -> %+v", matchBefore, matchAfter)
	}
	if matchBefore.DepositReceived != 1 {
		t.Errorf("deposit_received notifications = %d, want exactly 1", matchBefore.DepositReceived)
	}
}

// The same invalid callback delivered again stays blocked and keeps the
// first recorded values.
func TestConfirmWebhook_InvalidCallbackRepeatedStaysBlocked(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, newStubAsyncProvider())
	matchID, sellerDepositID, _, sellerUserID, _ := seedCommissionMatch(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, 50_000)); !errors.Is(err, ErrPaymentAmountMismatch) {
		t.Fatalf("first ConfirmWebhook error = %v, want ErrPaymentAmountMismatch", err)
	}
	first := loadDeposit(t, pool, sellerDepositID)

	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, 50_000)); err != nil {
		t.Fatalf("repeated ConfirmWebhook on an amount_mismatch deposit: %v", err)
	}
	assertBlocked(t, pool, matchID, sellerDepositID, 50_000)
	if again := loadDeposit(t, pool, sellerDepositID); !again.MismatchAt.Equal(*first.MismatchAt) {
		t.Errorf("mismatch_at rewritten on retry: %v -> %v", first.MismatchAt, again.MismatchAt)
	}
}

// Decided behaviour: once a transaction has been reported with a wrong
// amount, a later callback for the SAME transaction claiming the correct
// amount is NOT trusted — one payment reported with two amounts needs a
// human to decide. It stays blocked; contacts stay closed.
func TestConfirmWebhook_MismatchThenValidCallbackStaysBlocked(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, newStubAsyncProvider())
	matchID, sellerDepositID, _, sellerUserID, _ := seedCommissionMatch(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, 50_000)); !errors.Is(err, ErrPaymentAmountMismatch) {
		t.Fatalf("mismatched ConfirmWebhook error = %v, want ErrPaymentAmountMismatch", err)
	}

	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, amountTestCommission)); err != nil {
		t.Fatalf("later valid ConfirmWebhook: %v", err)
	}
	assertBlocked(t, pool, matchID, sellerDepositID, 50_000)

	// …and the user can't start a second charge for it either.
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); !errors.Is(err, ErrDepositNotPending) {
		t.Errorf("InitiatePay on amount_mismatch deposit error = %v, want ErrDepositNotPending", err)
	}
}

// Seller pays correctly, buyer's payment comes back with the wrong
// amount: the match is not confirmed and contacts stay closed.
func TestAmountMismatch_SellerPaidBuyerMismatchKeepsContactsClosed(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, newStubAsyncProvider())
	matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID := seedCommissionMatch(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("seller InitiatePay: %v", err)
	}
	if _, err := svc.InitiatePay(ctx, buyerDepositID, buyerUserID); err != nil {
		t.Fatalf("buyer InitiatePay: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, amountTestCommission)); err != nil {
		t.Fatalf("seller ConfirmWebhook: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, successEvent(buyerDepositID, 50_000)); !errors.Is(err, ErrPaymentAmountMismatch) {
		t.Fatalf("buyer ConfirmWebhook error = %v, want ErrPaymentAmountMismatch", err)
	}

	if d := loadDeposit(t, pool, buyerDepositID); d.Status != "amount_mismatch" {
		t.Errorf("buyer deposit status = %q, want amount_mismatch", d.Status)
	}
	m := loadMatch(t, pool, matchID)
	if m.Status != "seller_deposit_paid" || !m.SellerPaid || m.BuyerPaid {
		t.Errorf("match = %+v, want seller_deposit_paid with buyer unpaid", m)
	}
	if m.ContactsOpen != 0 {
		t.Errorf("contacts_open notifications = %d, want 0 — contacts must stay closed", m.ContactsOpen)
	}
}

// The status API can't verify the charged amount, so a "succeeded" poll
// never marks anything paid — only the signed webhook does.
func TestCheckStatus_ProviderSucceededNeverMarksPaid(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := newStubAsyncProvider()
	svc := NewDepositService(pool, provider)
	matchID, sellerDepositID, _, sellerUserID, _ := seedCommissionMatch(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}
	provider.statuses["pp-"+sellerDepositID] = PaymentStatusSucceeded

	session, err := svc.CheckStatus(ctx, sellerDepositID, sellerUserID)
	if err != nil {
		t.Fatalf("CheckStatus: %v", err)
	}
	if session.Status != "pending" || session.MatchStatus != "awaiting_deposit" {
		t.Errorf("session = %+v, want pending / awaiting_deposit until the webhook verifies the amount", session)
	}
	if m := loadMatch(t, pool, matchID); m.DepositReceived != 0 || m.SellerPaid {
		t.Errorf("match = %+v, want untouched", m)
	}

	// The signed webhook with the right amount is what confirms it.
	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, amountTestCommission)); err != nil {
		t.Fatalf("ConfirmWebhook: %v", err)
	}
	session, err = svc.CheckStatus(ctx, sellerDepositID, sellerUserID)
	if err != nil {
		t.Fatalf("CheckStatus after webhook: %v", err)
	}
	if session.Status != "paid" || session.MatchStatus != "seller_deposit_paid" {
		t.Errorf("session = %+v, want paid / seller_deposit_paid", session)
	}
}

// Polling an amount_mismatch deposit reports that state and never asks
// the provider again or changes it.
func TestCheckStatus_ReportsAmountMismatchWithoutChangingIt(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := newStubAsyncProvider()
	svc := NewDepositService(pool, provider)
	matchID, sellerDepositID, _, sellerUserID, _ := seedCommissionMatch(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, 4_999)); !errors.Is(err, ErrPaymentAmountMismatch) {
		t.Fatalf("ConfirmWebhook error = %v, want ErrPaymentAmountMismatch", err)
	}
	provider.statuses["pp-"+sellerDepositID] = PaymentStatusSucceeded

	session, err := svc.CheckStatus(ctx, sellerDepositID, sellerUserID)
	if err != nil {
		t.Fatalf("CheckStatus: %v", err)
	}
	if session.Status != "amount_mismatch" {
		t.Errorf("session status = %q, want amount_mismatch", session.Status)
	}
	assertBlocked(t, pool, matchID, sellerDepositID, 4_999)
}

// The provider is asked to charge exactly deposits.amount — and if that
// stored amount disagrees with the match's, no session is created and a
// webhook for an existing session is not applied.
func TestInitiatePay_ChargesStoredAmountAndRejectsInconsistentRows(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	server, calls := capturePgAmountServer(t)
	svc := NewDepositService(pool, testFreedomPayProvider(t, server.URL))
	matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID := seedCommissionMatch(t, pool)

	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("seller InitiatePay: %v", err)
	}
	if got := calls(); len(got) != 1 || got[0]["pg_amount"] != "5000.00" {
		t.Fatalf("FreedomPay calls = %v, want one with pg_amount 5000.00 (= deposits.amount)", got)
	}

	if _, err := pool.Exec(ctx, `UPDATE matches SET deposit_amount = 50000 WHERE id = $1`, matchID); err != nil {
		t.Fatalf("corrupt match amount: %v", err)
	}
	if _, err := svc.InitiatePay(ctx, buyerDepositID, buyerUserID); !errors.Is(err, ErrPaymentAmountMismatch) {
		t.Fatalf("buyer InitiatePay error = %v, want ErrPaymentAmountMismatch", err)
	}
	if got := calls(); len(got) != 1 {
		t.Errorf("FreedomPay init_payment calls = %d, want still 1 — no session for inconsistent rows", len(got))
	}

	// capturePgAmountServer numbers payments from 1, so the seller's
	// session is payment "1".
	err := svc.ConfirmWebhook(ctx, WebhookEvent{
		ProviderPaymentID: "1", Status: PaymentStatusSucceeded, AmountTenge: amountTestCommission, Currency: "KZT",
	})
	if !errors.Is(err, ErrPaymentAmountMismatch) {
		t.Fatalf("ConfirmWebhook error = %v, want ErrPaymentAmountMismatch", err)
	}
	if d := loadDeposit(t, pool, sellerDepositID); d.Status != "amount_mismatch" || d.PaidAt != nil {
		t.Errorf("seller deposit = %+v, want amount_mismatch, not paid", d)
	}
}

// refundRecorder records the amount each refund was issued for.
type refundRecorder struct {
	*stubAsyncProvider
	refunds map[string]int64 // providerPaymentID -> refunded amount
}

func (r *refundRecorder) Refund(ctx context.Context, providerPaymentID string, amount int64) (string, error) {
	r.refunds[providerPaymentID] = amount
	return "refund-" + providerPaymentID, nil
}

// On expiry, the correctly paid side is refunded exactly the stored amount
// it paid — not 0.1% of a later listing price — and the amount_mismatch
// side is left untouched for manual review (no automatic refund).
func TestExpiry_RefundsStoredAmountAndLeavesMismatchForReview(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := &refundRecorder{stubAsyncProvider: newStubAsyncProvider(), refunds: map[string]int64{}}
	svc := NewDepositService(pool, provider)
	matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID := seedCommissionMatch(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("seller InitiatePay: %v", err)
	}
	if _, err := svc.InitiatePay(ctx, buyerDepositID, buyerUserID); err != nil {
		t.Fatalf("buyer InitiatePay: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, successEvent(sellerDepositID, amountTestCommission)); err != nil {
		t.Fatalf("seller ConfirmWebhook: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, successEvent(buyerDepositID, 50_000)); !errors.Is(err, ErrPaymentAmountMismatch) {
		t.Fatalf("buyer ConfirmWebhook error = %v, want ErrPaymentAmountMismatch", err)
	}

	// The listing price changes after the match; refunds must ignore it.
	if _, err := pool.Exec(ctx, `
		UPDATE listings SET price = 9000000 WHERE id = (SELECT listing_id FROM matches WHERE id = $1)`, matchID); err != nil {
		t.Fatalf("change listing price: %v", err)
	}
	if _, err := pool.Exec(ctx, `UPDATE matches SET deadline = now() - interval '1 hour' WHERE id = $1`, matchID); err != nil {
		t.Fatalf("move deadline: %v", err)
	}

	result, err := NewExchangeService(pool, provider).RunDailyTick(ctx)
	if err != nil {
		t.Fatalf("RunDailyTick: %v", err)
	}
	if result.MatchesExpired != 1 {
		t.Fatalf("MatchesExpired = %d, want 1", result.MatchesExpired)
	}

	if got := provider.refunds["pp-"+sellerDepositID]; got != amountTestCommission {
		t.Errorf("seller refund amount = %d, want the stored/paid %d", got, amountTestCommission)
	}
	if d := loadDeposit(t, pool, sellerDepositID); d.Status != "refunded" || d.Amount != amountTestCommission {
		t.Errorf("seller deposit = %+v, want refunded at %d", d, amountTestCommission)
	}
	if _, refunded := provider.refunds["pp-"+buyerDepositID]; refunded {
		t.Errorf("amount_mismatch deposit was refunded automatically — must be left for manual review")
	}
	if d := loadDeposit(t, pool, buyerDepositID); d.Status != "amount_mismatch" || d.ReportedAmount == nil || *d.ReportedAmount != 50_000 {
		t.Errorf("buyer deposit = %+v, want untouched amount_mismatch with reported 50000", d)
	}
}
