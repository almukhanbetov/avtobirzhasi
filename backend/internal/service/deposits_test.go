package service

import (
	"context"
	"errors"
	"testing"

	"avtobirzhasi/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

// deriveMatchStatus is pure — see SKILL.md's Matches state machine.
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

// failingProvider lets tests exercise the "charge fails" path without a
// real payment gateway.
type failingProvider struct{}

func (failingProvider) Name() string { return "failing" }
func (failingProvider) Charge(ctx context.Context, depositID string, amount int64) (string, error) {
	return "", errors.New("declined")
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

func TestDepositService_Pay_FullFlowToConfirmed(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, NewMockPaymentProvider())

	matchID, sellerDepositID, buyerDepositID, sellerUserID, buyerUserID := seedMatchFixture(t, pool)

	result, err := svc.Pay(ctx, sellerDepositID, sellerUserID)
	if err != nil {
		t.Fatalf("seller Pay: %v", err)
	}
	if result.MatchStatus != "seller_deposit_paid" {
		t.Errorf("after seller pays, match status = %q, want seller_deposit_paid", result.MatchStatus)
	}

	result, err = svc.Pay(ctx, buyerDepositID, buyerUserID)
	if err != nil {
		t.Fatalf("buyer Pay: %v", err)
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

func TestDepositService_Pay_RejectsDoublePay(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, NewMockPaymentProvider())

	_, sellerDepositID, _, sellerUserID, _ := seedMatchFixture(t, pool)

	if _, err := svc.Pay(ctx, sellerDepositID, sellerUserID); err != nil {
		t.Fatalf("first Pay: %v", err)
	}

	_, err := svc.Pay(ctx, sellerDepositID, sellerUserID)
	if !errors.Is(err, ErrDepositNotPending) {
		t.Errorf("second Pay error = %v, want ErrDepositNotPending", err)
	}
}

func TestDepositService_Pay_RejectsWrongUser(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, NewMockPaymentProvider())

	_, sellerDepositID, _, _, buyerUserID := seedMatchFixture(t, pool)

	_, err := svc.Pay(ctx, sellerDepositID, buyerUserID)
	if !errors.Is(err, ErrDepositForbidden) {
		t.Errorf("Pay by non-owner error = %v, want ErrDepositForbidden", err)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM deposits WHERE id = $1`, sellerDepositID).Scan(&status); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "pending" {
		t.Errorf("deposit status after forbidden Pay = %q, want still pending (untouched)", status)
	}
}

func TestDepositService_Pay_RejectsUnknownDeposit(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, NewMockPaymentProvider())

	_, err := svc.Pay(ctx, "00000000-0000-0000-0000-000000000000", "00000000-0000-0000-0000-000000000000")
	if !errors.Is(err, ErrDepositNotFound) {
		t.Errorf("Pay on unknown deposit error = %v, want ErrDepositNotFound", err)
	}
}

func TestDepositService_Pay_ProviderFailureLeavesDepositUntouched(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewDepositService(pool, failingProvider{})

	_, sellerDepositID, _, sellerUserID, _ := seedMatchFixture(t, pool)

	_, err := svc.Pay(ctx, sellerDepositID, sellerUserID)
	if !errors.Is(err, ErrPaymentFailed) {
		t.Fatalf("Pay error = %v, want ErrPaymentFailed", err)
	}

	var status string
	if err := pool.QueryRow(ctx, `SELECT status FROM deposits WHERE id = $1`, sellerDepositID).Scan(&status); err != nil {
		t.Fatalf("reload deposit: %v", err)
	}
	if status != "pending" {
		t.Errorf("deposit status after failed charge = %q, want still pending (transaction rolled back)", status)
	}
}
