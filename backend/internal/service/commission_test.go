package service

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"

	"avtobirzhasi/backend/internal/testutil"
)

// The Match commission is 0.1% of the final price, paid by each side.
func TestCommissionAmount(t *testing.T) {
	cases := []struct {
		price int64
		want  int64
	}{
		{5_000_000, 5_000},
		{6_000_000, 6_000},
		{10_000_000, 10_000},
		{7_920_000, 7_920},
		{1_234_567, 1_235}, // rounded to whole tenge
	}
	for _, c := range cases {
		if got := commissionAmount(c.price); got != c.want {
			t.Errorf("commissionAmount(%d) = %d, want %d (0.1%%)", c.price, got, c.want)
		}
	}
}

// The 0.1% commission and the ±1% daily price movement are two different
// business rules — a global 0.01 -> 0.001 replace must never touch the
// latter.
func TestCommissionRateIsSeparateFromDailyRate(t *testing.T) {
	if commissionRate != 0.001 {
		t.Errorf("commissionRate = %v, want 0.001 (0.1%%)", commissionRate)
	}
	if dailyRate != 0.01 {
		t.Errorf("dailyRate = %v, want 0.01 (±1%% per day)", dailyRate)
	}
}

// capturePgAmountServer is a fake FreedomPay init_payment.php that records
// every pg_amount/pg_description it is sent.
func capturePgAmountServer(t *testing.T) (*httptest.Server, func() []map[string]string) {
	t.Helper()
	var mu sync.Mutex
	var calls []map[string]string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Errorf("parse form: %v", err)
		}
		mu.Lock()
		calls = append(calls, map[string]string{
			"pg_amount":      r.PostForm.Get("pg_amount"),
			"pg_currency":    r.PostForm.Get("pg_currency"),
			"pg_description": r.PostForm.Get("pg_description"),
		})
		n := len(calls)
		mu.Unlock()
		w.Header().Set("Content-Type", "application/xml")
		fmt.Fprintf(w, `<response><pg_status>ok</pg_status><pg_payment_id>%d</pg_payment_id><pg_redirect_url>https://pay.freedompay.kz/%d</pg_redirect_url></response>`, n, n)
	}))
	t.Cleanup(server.Close)
	return server, func() []map[string]string {
		mu.Lock()
		defer mu.Unlock()
		return append([]map[string]string(nil), calls...)
	}
}

// FreedomPay must be charged the 0.1% commission in whole tenge
// (5 000 000 ₸ -> "5000.00"), never the old 1% (50 000 ₸).
func TestFreedomPayProvider_CreatePayment_SendsCommissionAmount(t *testing.T) {
	server, calls := capturePgAmountServer(t)
	provider := testFreedomPayProvider(t, server.URL)

	cases := []struct {
		price      int64
		wantAmount string
	}{
		{5_000_000, "5000.00"},
		{6_000_000, "6000.00"},
		{10_000_000, "10000.00"},
	}
	for i, c := range cases {
		if _, err := provider.CreatePayment(context.Background(), fmt.Sprintf("deposit-%d", i), commissionAmount(c.price), ""); err != nil {
			t.Fatalf("CreatePayment(%d): %v", c.price, err)
		}
		got := calls()[i]
		if got["pg_amount"] != c.wantAmount {
			t.Errorf("price %d: pg_amount = %q, want %q (0.1%% commission)", c.price, got["pg_amount"], c.wantAmount)
		}
		if got["pg_currency"] != "KZT" {
			t.Errorf("pg_currency = %q, want KZT", got["pg_currency"])
		}
		if got["pg_description"] != "Комиссия avtobirzhasi.kz" {
			t.Errorf("pg_description = %q, want «Комиссия avtobirzhasi.kz»", got["pg_description"])
		}
	}
}

// Daily movement is unchanged by the commission change: -1% for sellers
// (10 000 000 -> 9 900 000, NOT 9 990 000) and +1% for buyers.
func TestExchangeService_DailyMovementStaysOnePercent(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	svc := NewExchangeService(pool, NewMockPaymentProvider())

	sellerID := testutil.InsertUser(t, pool, "+77029900001")
	buyerID := testutil.InsertUser(t, pool, "+77029900002")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2021, Price: 10_000_000, IsExchange: true, Status: "active",
	})
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: buyerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2019, YearTo: 2023, CurrentOffer: 5_000_000, // far apart: no match
		Status: "active",
	})

	if _, err := svc.RunDailyTick(ctx); err != nil {
		t.Fatalf("RunDailyTick: %v", err)
	}

	var price, offer int64
	pool.QueryRow(ctx, `SELECT price FROM listings WHERE id = $1`, listingID).Scan(&price)
	pool.QueryRow(ctx, `SELECT current_offer FROM buyer_requests WHERE id = $1`, requestID).Scan(&offer)
	if price != 9_900_000 {
		t.Errorf("seller price after one day = %d, want 9900000 (-1%%)", price)
	}
	if offer != 5_050_000 {
		t.Errorf("buyer offer after one day = %d, want 5050000 (+1%%)", offer)
	}
}

// End to end: a Match created by the daily tick stores the 0.1% commission
// on the match and both deposit rows, and that exact amount is what
// FreedomPay's init_payment.php receives.
func TestCommission_MatchToFreedomPayFlow(t *testing.T) {
	pool := testutil.SetupDB(t)
	ctx := context.Background()
	server, calls := capturePgAmountServer(t)
	provider := testFreedomPayProvider(t, server.URL)
	exchange := NewExchangeService(pool, provider)
	deposits := NewDepositService(pool, provider)

	sellerID := testutil.InsertUser(t, pool, "+77029900003")
	buyerID := testutil.InsertUser(t, pool, "+77029900004")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Kia", Model: "K5", Region: "Астана",
		Year: 2022, Price: 5_000_000, IsExchange: true, Status: "active",
	})
	testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: buyerID, Make: "Kia", Model: "K5", Region: "Астана",
		YearFrom: 2020, YearTo: 2024, CurrentOffer: 4_930_000,
		Status: "active",
	})

	result, err := exchange.RunDailyTick(ctx)
	if err != nil {
		t.Fatalf("RunDailyTick: %v", err)
	}
	if result.MatchesCreated != 1 {
		t.Fatalf("MatchesCreated = %d, want 1", result.MatchesCreated)
	}

	// Decay runs before matching: final price is 5 000 000 * 0.99.
	const wantFinalPrice = 4_950_000
	const wantCommission = 4_950

	var finalPrice, matchAmount int64
	if err := pool.QueryRow(ctx,
		`SELECT final_price, deposit_amount FROM matches WHERE listing_id = $1`, listingID,
	).Scan(&finalPrice, &matchAmount); err != nil {
		t.Fatalf("load match: %v", err)
	}
	if finalPrice != wantFinalPrice || matchAmount != wantCommission {
		t.Fatalf("match final_price/deposit_amount = %d/%d, want %d/%d", finalPrice, matchAmount, wantFinalPrice, wantCommission)
	}

	rows, err := pool.Query(ctx,
		`SELECT id, user_id, amount FROM deposits WHERE match_id = (SELECT id FROM matches WHERE listing_id = $1) ORDER BY role`, listingID)
	if err != nil {
		t.Fatalf("load deposits: %v", err)
	}
	type dep struct {
		id, userID string
		amount     int64
	}
	var deps []dep
	for rows.Next() {
		var d dep
		if err := rows.Scan(&d.id, &d.userID, &d.amount); err != nil {
			t.Fatalf("scan deposit: %v", err)
		}
		deps = append(deps, d)
	}
	rows.Close()
	if len(deps) != 2 {
		t.Fatalf("deposit rows = %d, want 2", len(deps))
	}

	for _, d := range deps {
		if d.amount != wantCommission {
			t.Errorf("deposit %s amount = %d, want %d (0.1%%)", d.id, d.amount, wantCommission)
		}
		if _, err := deposits.InitiatePay(ctx, d.id, d.userID); err != nil {
			t.Fatalf("InitiatePay: %v", err)
		}
	}

	got := calls()
	if len(got) != 2 {
		t.Fatalf("FreedomPay init_payment calls = %d, want 2", len(got))
	}
	for _, c := range got {
		if c["pg_amount"] != "4950.00" {
			t.Errorf("FreedomPay pg_amount = %q, want \"4950.00\" (0.1%% of 4 950 000)", c["pg_amount"])
		}
	}
}
