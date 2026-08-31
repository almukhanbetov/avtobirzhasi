package service

import (
	"context"
	"testing"

	"avtobirzhasi/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

// nextCalendarDay simulates a new day arriving: the per-day claim in
// daily_tick_runs is keyed on the calendar date, so clearing the table is
// exactly what "it's tomorrow now" looks like to RunDailyTick.
func nextCalendarDay(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	if _, err := pool.Exec(context.Background(), `DELETE FROM daily_tick_runs`); err != nil {
		t.Fatalf("advance calendar day: %v", err)
	}
}

func listingPrice(t *testing.T, pool *pgxpool.Pool, id string) int64 {
	t.Helper()
	var p int64
	if err := pool.QueryRow(context.Background(), `SELECT price FROM listings WHERE id = $1`, id).Scan(&p); err != nil {
		t.Fatalf("read listing price: %v", err)
	}
	return p
}

// A + B + F: every active listing loses exactly 1% on one daily tick —
// an ordinary marketplace listing and an Auto Exchange listing alike —
// and each records one daily_decay history row.
func TestDailyTick_EveryActiveListing_DecaysOnePercent(t *testing.T) {
	pool := testutil.SetupDB(t)
	svc := NewExchangeService(pool, NewMockPaymentProvider())
	uid := testutil.InsertUser(t, pool, "+77025000001")

	normal := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: uid, Make: "Toyota", Model: "NormalCar", Region: "Алматы",
		Year: 2021, Price: 10_000_000, IsExchange: false, Status: "active",
	})
	exchange := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: uid, Make: "Toyota", Model: "ExchangeCar", Region: "Алматы",
		Year: 2021, Price: 10_000_000, IsExchange: true, Status: "active",
	})

	res, err := svc.RunDailyTick(context.Background())
	if err != nil {
		t.Fatalf("RunDailyTick: %v", err)
	}
	if res.ListingsDecayed != 2 {
		t.Errorf("ListingsDecayed = %d, want 2 (normal + exchange)", res.ListingsDecayed)
	}

	for name, id := range map[string]string{"normal": normal, "exchange": exchange} {
		if got := listingPrice(t, pool, id); got != 9_900_000 {
			t.Errorf("%s active listing price after one tick = %d, want 9900000 (10000000 * 0.99)", name, got)
		}
		var prev, next int64
		var reason string
		err := pool.QueryRow(context.Background(), `
			SELECT previous_price, new_price, reason FROM listing_price_history WHERE listing_id = $1
		`, id).Scan(&prev, &next, &reason)
		if err != nil {
			t.Fatalf("%s: no price-history row: %v", name, err)
		}
		if prev != 10_000_000 || next != 9_900_000 || reason != "daily_decay" {
			t.Errorf("%s history = (%d -> %d, %q), want (10000000 -> 9900000, daily_decay)", name, prev, next, reason)
		}
	}
}

// 2. A second tick on the same calendar day does NOT decay again.
func TestDailyTick_SecondRunSameDay_DoesNotDecayAgain(t *testing.T) {
	pool := testutil.SetupDB(t)
	svc := NewExchangeService(pool, NewMockPaymentProvider())
	uid := testutil.InsertUser(t, pool, "+77025000002")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: uid, Make: "Toyota", Model: "TickCar", Region: "Алматы",
		Year: 2021, Price: 10_000_000, IsExchange: true, Status: "active",
	})

	if _, err := svc.RunDailyTick(context.Background()); err != nil {
		t.Fatalf("first RunDailyTick: %v", err)
	}
	res, err := svc.RunDailyTick(context.Background())
	if err != nil {
		t.Fatalf("second RunDailyTick: %v", err)
	}
	if res.ListingsDecayed != 0 {
		t.Errorf("second same-day tick ListingsDecayed = %d, want 0", res.ListingsDecayed)
	}
	if got := listingPrice(t, pool, id); got != 9_900_000 {
		t.Errorf("price after a repeated same-day tick = %d, want still 9900000", got)
	}

	var runRows int
	pool.QueryRow(context.Background(), `SELECT count(*) FROM daily_tick_runs`).Scan(&runRows)
	if runRows != 1 {
		t.Errorf("daily_tick_runs rows = %d, want 1 (one per calendar day)", runRows)
	}
	var histRows int
	pool.QueryRow(context.Background(), `SELECT count(*) FROM listing_price_history WHERE listing_id = $1`, id).Scan(&histRows)
	if histRows != 1 {
		t.Errorf("price history rows = %d, want 1 (not doubled by the repeat run)", histRows)
	}
}

// 3. The next calendar day's tick decays again, compounding.
func TestDailyTick_NextDay_DecaysAgain(t *testing.T) {
	pool := testutil.SetupDB(t)
	svc := NewExchangeService(pool, NewMockPaymentProvider())
	uid := testutil.InsertUser(t, pool, "+77025000003")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: uid, Make: "Toyota", Model: "TickCar", Region: "Алматы",
		Year: 2021, Price: 10_000_000, IsExchange: true, Status: "active",
	})

	if _, err := svc.RunDailyTick(context.Background()); err != nil {
		t.Fatalf("day 1 RunDailyTick: %v", err)
	}
	if got := listingPrice(t, pool, id); got != 9_900_000 {
		t.Fatalf("after day 1 = %d, want 9900000", got)
	}

	nextCalendarDay(t, pool)

	if _, err := svc.RunDailyTick(context.Background()); err != nil {
		t.Fatalf("day 2 RunDailyTick: %v", err)
	}
	if got := listingPrice(t, pool, id); got != 9_801_000 {
		t.Errorf("after day 2 = %d, want 9801000 (9900000 * 0.99)", got)
	}
}

// E: only status = 'active' decays. The status model is
// active/frozen/moderation/archived (migrations/00002) — there is no
// 'sold'/'expired'/'inactive'; frozen is "locked into a match", moderation
// is "not live yet", archived is "soft-deleted". None of those move.
func TestDailyTick_OnlyActiveStatusDecays(t *testing.T) {
	pool := testutil.SetupDB(t)
	svc := NewExchangeService(pool, NewMockPaymentProvider())
	uid := testutil.InsertUser(t, pool, "+77025000004")

	mk := func(status string, isExchange bool) string {
		return testutil.InsertListing(t, pool, testutil.ListingFixture{
			UserID: uid, Make: "Kia", Model: "Skip", Region: "Астана",
			Year: 2020, Price: 5_000_000, IsExchange: isExchange, Status: status,
		})
	}
	activeNormal := mk("active", false)   // decays
	activeExchange := mk("active", true)  // decays
	moderation := mk("moderation", false) // not live yet — unchanged
	frozen := mk("frozen", true)          // locked into a match — unchanged
	archived := mk("archived", false)     // soft-deleted — unchanged

	if _, err := svc.RunDailyTick(context.Background()); err != nil {
		t.Fatalf("RunDailyTick: %v", err)
	}

	for name, id := range map[string]string{"activeNormal": activeNormal, "activeExchange": activeExchange} {
		if got := listingPrice(t, pool, id); got != 4_950_000 {
			t.Errorf("%s price = %d, want 4950000 (decayed)", name, got)
		}
	}
	for name, id := range map[string]string{
		"moderation": moderation, "frozen": frozen, "archived": archived,
	} {
		if got := listingPrice(t, pool, id); got != 5_000_000 {
			t.Errorf("%s price = %d, want unchanged 5000000", name, got)
		}
		var n int
		pool.QueryRow(context.Background(), `SELECT count(*) FROM listing_price_history WHERE listing_id = $1`, id).Scan(&n)
		if n != 0 {
			t.Errorf("%s has %d price-history rows, want 0", name, n)
		}
	}
}

// 5. Each decay writes a price-history row with the right previous/new.
func TestDailyTick_RecordsPriceHistory(t *testing.T) {
	pool := testutil.SetupDB(t)
	svc := NewExchangeService(pool, NewMockPaymentProvider())
	uid := testutil.InsertUser(t, pool, "+77025000005")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: uid, Make: "Toyota", Model: "HistCar", Region: "Алматы",
		Year: 2021, Price: 10_000_000, IsExchange: true, Status: "active",
	})

	if _, err := svc.RunDailyTick(context.Background()); err != nil {
		t.Fatalf("day 1: %v", err)
	}
	nextCalendarDay(t, pool)
	if _, err := svc.RunDailyTick(context.Background()); err != nil {
		t.Fatalf("day 2: %v", err)
	}

	rows, err := pool.Query(context.Background(), `
		SELECT previous_price, new_price, reason
		FROM listing_price_history WHERE listing_id = $1 ORDER BY changed_at
	`, id)
	if err != nil {
		t.Fatalf("query history: %v", err)
	}
	defer rows.Close()

	type h struct {
		prev, next int64
		reason     string
	}
	var got []h
	for rows.Next() {
		var e h
		if err := rows.Scan(&e.prev, &e.next, &e.reason); err != nil {
			t.Fatalf("scan: %v", err)
		}
		got = append(got, e)
	}
	want := []h{
		{10_000_000, 9_900_000, "daily_decay"},
		{9_900_000, 9_801_000, "daily_decay"},
	}
	if len(got) != len(want) {
		t.Fatalf("history rows = %d, want %d: %+v", len(got), len(want), got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Errorf("history[%d] = %+v, want %+v", i, got[i], want[i])
		}
	}
}

// 6. A DB failure during the tick leaves nothing partially applied, and
// the day stays unclaimed so the next tick still works.
func TestDailyTick_DbErrorLeavesNoPartialUpdate(t *testing.T) {
	pool := testutil.SetupDB(t)
	svc := NewExchangeService(pool, NewMockPaymentProvider())
	uid := testutil.InsertUser(t, pool, "+77025000006")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: uid, Make: "Toyota", Model: "AtomicCar", Region: "Алматы",
		Year: 2021, Price: 10_000_000, IsExchange: true, Status: "active",
	})

	// An already-expired context makes the price-movement transaction
	// fail partway (or at Begin) — either way nothing must persist.
	deadCtx, cancel := context.WithCancel(context.Background())
	cancel()
	if _, err := svc.RunDailyTick(deadCtx); err == nil {
		t.Fatal("RunDailyTick with a cancelled context returned nil error")
	}

	if got := listingPrice(t, pool, id); got != 10_000_000 {
		t.Errorf("price after a failed tick = %d, want unchanged 10000000", got)
	}
	var runRows, histRows int
	pool.QueryRow(context.Background(), `SELECT count(*) FROM daily_tick_runs`).Scan(&runRows)
	pool.QueryRow(context.Background(), `SELECT count(*) FROM listing_price_history`).Scan(&histRows)
	if runRows != 0 {
		t.Errorf("daily_tick_runs rows after a failed tick = %d, want 0 (day not claimed)", runRows)
	}
	if histRows != 0 {
		t.Errorf("price history rows after a failed tick = %d, want 0", histRows)
	}

	// And a normal tick afterwards still applies the day's decay.
	if _, err := svc.RunDailyTick(context.Background()); err != nil {
		t.Fatalf("recovery RunDailyTick: %v", err)
	}
	if got := listingPrice(t, pool, id); got != 9_900_000 {
		t.Errorf("price after recovery tick = %d, want 9900000", got)
	}
}
