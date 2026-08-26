package service

import (
	"context"
	"errors"
	"net/http"
	"testing"

	"avtobirzhasi/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

// deriveMatchStatus is pure — see SKILL.md's Matches section.
func TestDeriveMatchStatus(t *testing.T) {
	cases := []struct {
		seller, buyer bool
		want          string
	}{
		{false, false, "awaiting_deposit"},
		{true, false, "seller_deposit_paid"},
		{false, true, "buyer_deposit_paid"},
		{true, true, "confirmed"},
	}
	for _, tc := range cases {
		got := deriveMatchStatus(tc.seller, tc.buyer)
		if got != tc.want {
			t.Errorf("deriveMatchStatus(%v, %v) = %q, want %q", tc.seller, tc.buyer, got, tc.want)
		}
	}
}

// failingProvider lets tests exercise the "payment fails to start" path
// without a real payment gateway.
type failingProvider struct{}

func (failingProvider) Name() string { return "failing" }
func (failingProvider) CreatePayment(ctx context.Context, depositID string, amount int64, idempotencyKey string) (CreatePaymentResult, error) {
	return CreatePaymentResult{}, errors.New("declined")
}
func (failingProvider) GetPaymentStatus(ctx context.Context, providerPaymentID string) (PaymentStatus, error) {
	return "", errors.New("declined")
}
func (failingProvider) VerifyWebhook(headers http.Header, body []byte) (WebhookEvent, error) {
	return WebhookEvent{}, errors.New("no webhook")
}
func (failingProvider) Refund(ctx context.Context, providerPaymentID string, amount int64) (string, error) {
	return "", errors.New("declined")
}

// stubAsyncProvider simulates a real, asynchronous gateway (like
// FreedomPay): CreatePayment returns a redirect and stays pending until
// something explicitly resolves it (a webhook or a status poll), instead
// of finalizing immediately like MockPaymentProvider.
type stubAsyncProvider struct {
	statuses map[string]PaymentStatus // providerPaymentID -> status, for GetPaymentStatus
}

func newStubAsyncProvider() *stubAsyncProvider {
	return &stubAsyncProvider{statuses: map[string]PaymentStatus{}}
}

func (s *stubAsyncProvider) Name() string { return "stub-gateway" }

func (s *stubAsyncProvider) CreatePayment(ctx context.Context, depositID string, amount int64, idempotencyKey string) (CreatePaymentResult, error) {
	providerPaymentID := "pp-" + depositID
	s.statuses[providerPaymentID] = PaymentStatusPending
	return CreatePaymentResult{
		ProviderPaymentID: providerPaymentID,
		RedirectURL:       "https://gateway.example/pay/" + providerPaymentID,
		Status:            PaymentStatusPending,
	}, nil
}

func (s *stubAsyncProvider) GetPaymentStatus(ctx context.Context, providerPaymentID string) (PaymentStatus, error) {
	if status, ok := s.statuses[providerPaymentID]; ok {
		return status, nil
	}
	return PaymentStatusPending, nil
}

func (s *stubAsyncProvider) VerifyWebhook(headers http.Header, body []byte) (WebhookEvent, error) {
	return WebhookEvent{}, errors.New("not used directly in these tests — ConfirmWebhook is called with a pre-built event")
}

func (s *stubAsyncProvider) Refund(ctx context.Context, providerPaymentID string, amount int64) (string, error) {
	return "refund-" + providerPaymentID, nil
}

func seedMatchFixture(t *testing.T, pool *pgxpool.Pool) (matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID string) {
	t.Helper()
	sellerUserID = testutil.InsertUser(t, pool, "+77010000001")
	buyerUserID = testutil.InsertUser(t, pool, "+77010000002")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerUserID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2020, Price: 10_000_000, IsExchange: true, Status: "frozen",
	})
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: buyerUserID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_900_000, Status: "frozen",
	})
	matchID, sellerDepositID, buyerDepositID = testutil.InsertMatch(t, pool, testutil.MatchFixture{
		ListingID: listingID, BuyerRequestID: requestID,
		FinalPrice: 10_000_000, DepositAmount: 100_000,
	})
	return matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID
}

func TestDepositService_InitiatePay_MockFullFlowToConfirmed(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, NewMockPaymentProvider())

	matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID := seedMatchFixture(t, pool)

	result, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID)
	if err != nil {
		t.Fatalf("seller InitiatePay: %v", err)
	}
	if result.RedirectURL != "" {
		t.Errorf("mock provider redirectUrl = %q, want empty (resolves synchronously)", result.RedirectURL)
	}
	if result.MatchStatus != "seller_deposit_paid" {
		t.Errorf("after seller pays, match status = %q, want seller_deposit_paid", result.MatchStatus)
	}

	result, err = svc.InitiatePay(ctx, buyerDepositID, buyerUserID)
	if err != nil {
		t.Fatalf("buyer InitiatePay: %v", err)
	}
	if result.MatchStatus != "confirmed" {
		t.Errorf("after both pay, match status = %q, want confirmed", result.MatchStatus)
	}

	var contactsOpenCount int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM notifications WHERE related_match_id = $1 AND type = 'contacts_open'
	`, matchID).Scan(&contactsOpenCount); err != nil {
		t.Fatalf("count contacts_open notifications: %v", err)
	}
	if contactsOpenCount != 2 {
		t.Errorf("contacts_open notifications = %d, want 2 (one per party)", contactsOpenCount)
	}

	var depositReceivedCount int
	if err := pool.QueryRow(ctx, `
		SELECT count(*) FROM notifications WHERE related_match_id = $1 AND type = 'deposit_received'
	`, matchID).Scan(&depositReceivedCount); err != nil {
		t.Fatalf("count deposit_received notifications: %v", err)
	}
	if depositReceivedCount != 2 {
		t.Errorf("deposit_received notifications = %d, want 2 (one per payment)", depositReceivedCount)
	}
}

func TestDepositService_InitiatePay_RejectsDoublePay(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, NewMockPaymentProvider())

	_, sellerDepositID, _, sellerUserID, _ := seedMatchFixture(t, pool)

	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("first InitiatePay: %v", err)
	}

	_, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID)
	if !errors.Is(err, ErrDepositNotPending) {
		t.Errorf("second InitiatePay error = %v, want ErrDepositNotPending", err)
	}
}

func TestDepositService_InitiatePay_RejectsWrongUser(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, NewMockPaymentProvider())

	_, sellerDepositID, _, _, buyerUserID := seedMatchFixture(t, pool)

	_, err := svc.InitiatePay(ctx, sellerDepositID, buyerUserID)
	if !errors.Is(err, ErrDepositForbidden) {
		t.Errorf("InitiatePay by non-owner error = %v, want ErrDepositForbidden", err)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM deposits WHERE id = $1`, sellerDepositID).Scan(&status); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "pending" {
		t.Errorf("deposit status after forbidden InitiatePay = %q, want still pending (untouched)", status)
	}
}

func TestDepositService_InitiatePay_RejectsUnknownDeposit(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, NewMockPaymentProvider())

	_, err := svc.InitiatePay(ctx, "00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000000")
	if !errors.Is(err, ErrDepositNotFound) {
		t.Errorf("InitiatePay on unknown deposit error = %v, want ErrDepositNotFound", err)
	}
}

func TestDepositService_InitiatePay_ProviderFailureLeavesDepositUntouched(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, failingProvider{})

	_, sellerDepositID, _, sellerUserID, _ := seedMatchFixture(t, pool)

	_, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID)
	if !errors.Is(err, ErrPaymentFailed) {
		t.Fatalf("InitiatePay error = %v, want ErrPaymentFailed", err)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM deposits WHERE id = $1`, sellerDepositID).Scan(&status); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "pending" {
		t.Errorf("deposit status after failed charge = %q, want still pending (transaction rolled back)", status)
	}
}

// TestDepositService_InitiatePay_AsyncProviderReturnsRedirectAndStaysPending
// is the core Stage 11 regression: a real gateway must never be marked
// paid by the initiate call itself — only a later ConfirmWebhook can do
// that.
func TestDepositService_InitiatePay_AsyncProviderReturnsRedirectAndStaysPending(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := newStubAsyncProvider()
	svc := NewDepositService(pool, provider)

	_, sellerDepositID, _, sellerUserID, _ := seedMatchFixture(t, pool)

	result, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID)
	if err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}
	if result.RedirectURL == "" {
		t.Fatalf("async provider redirectUrl is empty, want a hosted-page URL")
	}
	if result.Status != "pending" {
		t.Errorf("Status = %q, want pending (must not resolve until ConfirmWebhook)", result.Status)
	}

	var status, providerName, providerPaymentID string
	if err := pool.QueryRow(ctx, `SELECT status, provider, provider_payment_id FROM deposits WHERE id = $1`, sellerDepositID).
		Scan(&status, &providerName, &providerPaymentID); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "pending" {
		t.Errorf("deposit status = %q, want still pending until webhook confirms it", status)
	}
	if providerName != "stub-gateway" {
		t.Errorf("provider = %q, want stub-gateway", providerName)
	}
	if providerPaymentID == "" {
		t.Errorf("provider_payment_id was not stored — webhook lookup would never find this deposit")
	}
}

func TestDepositService_ConfirmWebhook_MarksPaidAndUnlocksContacts(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := newStubAsyncProvider()
	svc := NewDepositService(pool, provider)

	matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID := seedMatchFixture(t, pool)

	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("seller InitiatePay: %v", err)
	}
	if _, err := svc.InitiatePay(ctx, buyerDepositID, buyerUserID); err != nil {
		t.Fatalf("buyer InitiatePay: %v", err)
	}

	if err := svc.ConfirmWebhook(ctx, WebhookEvent{
		ProviderPaymentID: "pp-" + sellerDepositID, Status: PaymentStatusSucceeded, AmountTenge: 100_000, Currency: "KZT",
	}); err != nil {
		t.Fatalf("ConfirmWebhook (seller): %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, WebhookEvent{
		ProviderPaymentID: "pp-" + buyerDepositID, Status: PaymentStatusSucceeded, AmountTenge: 100_000, Currency: "KZT",
	}); err != nil {
		t.Fatalf("ConfirmWebhook (buyer): %v", err)
	}

	var matchStatus string
	if err := pool.QueryRow(ctx, `SELECT status FROM matches WHERE id = $1`, matchID).Scan(&matchStatus); err != nil {
		t.Fatalf("reload match: %v", err)
	}
	if matchStatus != "confirmed" {
		t.Errorf("match status = %q, want confirmed", matchStatus)
	}

	var contactsOpenCount int
	pool.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE related_match_id = $1 AND type = 'contacts_open'`, matchID).Scan(&contactsOpenCount)
	if contactsOpenCount != 2 {
		t.Errorf("contacts_open notifications = %d, want 2", contactsOpenCount)
	}
}

// TestDepositService_ConfirmWebhook_AmountMismatchRejected is the core
// server-side integrity check: a webhook claiming a different amount than
// the deposit's own server-computed amount must never be applied.
func TestDepositService_ConfirmWebhook_AmountMismatchRejected(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := newStubAsyncProvider()
	svc := NewDepositService(pool, provider)

	_, sellerDepositID, _, sellerUserID, _ := seedMatchFixture(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}

	err := svc.ConfirmWebhook(ctx, WebhookEvent{
		ProviderPaymentID: "pp-" + sellerDepositID, Status: PaymentStatusSucceeded, AmountTenge: 1, Currency: "KZT",
	})
	if !errors.Is(err, ErrWebhookAmountMismatch) {
		t.Fatalf("ConfirmWebhook error = %v, want ErrWebhookAmountMismatch", err)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM deposits WHERE id = $1`, sellerDepositID).Scan(&status); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "pending" {
		t.Errorf("deposit status after mismatched webhook = %q, want still pending (rejected, not applied)", status)
	}
}

// TestDepositService_ConfirmWebhook_ReplayIsIdempotent guards against a
// gateway retrying webhook delivery (documented as expected behavior for
// this family of providers) double-processing a deposit.
func TestDepositService_ConfirmWebhook_ReplayIsIdempotent(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := newStubAsyncProvider()
	svc := NewDepositService(pool, provider)

	matchID, sellerDepositID, _, sellerUserID, _ := seedMatchFixture(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}

	event := WebhookEvent{ProviderPaymentID: "pp-" + sellerDepositID, Status: PaymentStatusSucceeded, AmountTenge: 100_000, Currency: "KZT"}
	if err := svc.ConfirmWebhook(ctx, event); err != nil {
		t.Fatalf("first ConfirmWebhook: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, event); err != nil {
		t.Fatalf("replayed ConfirmWebhook: %v", err)
	}

	var depositReceivedCount int
	pool.QueryRow(ctx, `SELECT count(*) FROM notifications WHERE related_match_id = $1 AND type = 'deposit_received'`, matchID).Scan(&depositReceivedCount)
	if depositReceivedCount != 1 {
		t.Errorf("deposit_received notifications after a replayed webhook = %d, want 1 (not double-applied)", depositReceivedCount)
	}
}

func TestDepositService_ConfirmWebhook_FailedStatusMarksFailed(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := newStubAsyncProvider()
	svc := NewDepositService(pool, provider)

	_, sellerDepositID, _, sellerUserID, _ := seedMatchFixture(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}

	if err := svc.ConfirmWebhook(ctx, WebhookEvent{
		ProviderPaymentID: "pp-" + sellerDepositID, Status: PaymentStatusFailed, AmountTenge: 100_000, Currency: "KZT",
	}); err != nil {
		t.Fatalf("ConfirmWebhook: %v", err)
	}

	var status string
	var failedAt *string
	if err := pool.QueryRow(ctx, `SELECT status, failed_at::text FROM deposits WHERE id = $1`, sellerDepositID).Scan(&status, &failedAt); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "failed" {
		t.Errorf("deposit status = %q, want failed", status)
	}
	if failedAt == nil {
		t.Errorf("failed_at was not set")
	}
}

// TestDepositService_InitiatePay_AllowsRetryAfterFailure covers the retry
// UX: a deposit that failed must be payable again, not stuck forever.
func TestDepositService_InitiatePay_AllowsRetryAfterFailure(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	provider := newStubAsyncProvider()
	svc := NewDepositService(pool, provider)

	_, sellerDepositID, _, sellerUserID, _ := seedMatchFixture(t, pool)
	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("InitiatePay: %v", err)
	}
	if err := svc.ConfirmWebhook(ctx, WebhookEvent{
		ProviderPaymentID: "pp-" + sellerDepositID, Status: PaymentStatusFailed, AmountTenge: 100_000, Currency: "KZT",
	}); err != nil {
		t.Fatalf("ConfirmWebhook: %v", err)
	}

	if _, err := svc.InitiatePay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("retry InitiatePay after failure: %v", err)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM deposits WHERE id = $1`, sellerDepositID).Scan(&status); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "pending" {
		t.Errorf("deposit status after retry = %q, want pending again", status)
	}
}
