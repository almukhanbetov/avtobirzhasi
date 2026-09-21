package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"avtobirzhasi/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Stage 8В-2: POST /api/listings used to always start a new listing in
// "moderation" — nothing published until an admin approved it via
// ModerationHandler. That mandatory pre-publication queue is removed: a
// successfully created listing now starts "active" immediately (the
// existing status value, not a new one — see migrations/00002 and
// internal/handlers/moderation.go, both untouched). These tests exercise
// the real HTTP handlers end to end (create -> dashboard/catalog reads),
// not just the DB row, and reuse listings_create_location_test.go's
// baseListingBody/postListingJSON and cars_location_filter_test.go's
// newCarsFilterTestServer/getCars — no duplicated server setup.

func listingIDByMakeModel(t *testing.T, pool *pgxpool.Pool, make, model string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(),
		`SELECT id FROM listings WHERE make = $1 AND model = $2`, make, model,
	).Scan(&id); err != nil {
		t.Fatalf("look up listing %s %s: %v", make, model, err)
	}
	return id
}

func TestListingsCreate_NewListingIsImmediatelyActive(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77070000001")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := postListingJSON(t, server, token, baseListingBody())
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 201; body %s", resp.StatusCode, b)
	}

	var status string
	if err := pool.QueryRow(context.Background(),
		`SELECT status FROM listings WHERE make = 'Toyota' AND model = 'Camry'`,
	).Scan(&status); err != nil {
		t.Fatalf("reload listing: %v", err)
	}
	if status != "active" {
		t.Fatalf("status = %q, want %q", status, "active")
	}
}

func TestListingsCreate_AppearsInCatalogImmediately(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77070000002")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := postListingJSON(t, server, token, baseListingBody())
	resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d, want 201", resp.StatusCode)
	}
	newID := listingIDByMakeModel(t, pool, "Toyota", "Camry")

	status, list := getCars(t, server, "")
	if status != http.StatusOK {
		t.Fatalf("GET /api/cars status = %d, want 200", status)
	}
	if !containsID(list.Items, newID) {
		t.Fatalf("new listing %s not present in unfiltered catalog, want it there immediately (no moderation wait)", newID)
	}
}

func TestListingsCreate_IsSearchableByMakeAndModel(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77070000003")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := postListingJSON(t, server, token, baseListingBody())
	resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d, want 201", resp.StatusCode)
	}
	newID := listingIDByMakeModel(t, pool, "Toyota", "Camry")

	status, list := getCars(t, server, "make=Toyota&model=Camry")
	if status != http.StatusOK {
		t.Fatalf("GET /api/cars status = %d, want 200", status)
	}
	if !containsID(list.Items, newID) {
		t.Fatalf("new listing %s not found by make+model search — search only ever returns status='active' rows", newID)
	}
}

func TestListingsCreate_OwnerSeesActiveStatusInDashboard(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77070000004")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := postListingJSON(t, server, token, baseListingBody())
	resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d, want 201", resp.StatusCode)
	}

	req, err := http.NewRequest(http.MethodGet, server.URL+"/api/dashboard/listings", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Authorization", "Bearer "+token)
	dashResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET /api/dashboard/listings: %v", err)
	}
	defer dashResp.Body.Close()
	if dashResp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", dashResp.StatusCode)
	}

	var listings []struct {
		Status string `json:"status"`
		Car    struct {
			Make  string `json:"make"`
			Model string `json:"model"`
		} `json:"car"`
	}
	if err := json.NewDecoder(dashResp.Body).Decode(&listings); err != nil {
		t.Fatalf("decode: %v", err)
	}
	found := false
	for _, l := range listings {
		if l.Car.Make == "Toyota" && l.Car.Model == "Camry" {
			found = true
			if l.Status != "active" {
				t.Fatalf("owner-visible status = %q, want %q", l.Status, "active")
			}
		}
	}
	if !found {
		t.Fatal("new listing not present in owner's own dashboard listing list")
	}
}

func TestListingsCreate_InvalidListingIsRejectedNotPublished(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77070000005")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	body := baseListingBody()
	delete(body, "make") // required field missing

	resp := postListingJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 — an invalid listing must never publish, moderation or not", resp.StatusCode)
	}

	var count int
	if err := pool.QueryRow(context.Background(),
		`SELECT count(*) FROM listings WHERE model = 'Camry'`,
	).Scan(&count); err != nil {
		t.Fatalf("count listings: %v", err)
	}
	if count != 0 {
		t.Fatalf("a rejected listing was inserted anyway (count=%d)", count)
	}
}

func TestListingsCreate_RequiresAuthentication(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	resp := postListingJSON(t, server, "", baseListingBody())
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 — creation must still require auth", resp.StatusCode)
	}
}

// A pre-existing listing already sitting in "moderation" (from before
// Stage 8В-2, or routed there by an admin) must be completely unaffected
// by a new, unrelated listing being created — no mass UPDATE, no
// migration of old rows. See internal/repository's Create: it only ever
// inserts a new row, never touches others.
func TestListingsCreate_DoesNotTouchExistingModerationListings(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	sellerID := testutil.InsertUser(t, pool, "+77070000006")
	token := testutil.IssueTestToken(t, testJWTSecret, sellerID)

	var oldListingID string
	if err := pool.QueryRow(context.Background(), `
		INSERT INTO listings (
			user_id, make, model, year, price, mileage_km, region, transmission,
			fuel_type, body_type, drivetrain, engine_volume, engine_power, color, status
		) VALUES ($1, 'Kia', 'Rio', 2019, 5000000, 40000, 'Алматы', 'automatic',
			'petrol', 'sedan', 'fwd', 1.6, 123, 'белый', 'moderation')
		RETURNING id
	`, sellerID).Scan(&oldListingID); err != nil {
		t.Fatalf("seed pre-existing moderation listing: %v", err)
	}

	resp := postListingJSON(t, server, token, baseListingBody())
	resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("create status = %d, want 201", resp.StatusCode)
	}

	var status string
	if err := pool.QueryRow(context.Background(),
		`SELECT status FROM listings WHERE id = $1`, oldListingID,
	).Scan(&status); err != nil {
		t.Fatalf("reload old listing: %v", err)
	}
	if status != "moderation" {
		t.Fatalf("pre-existing listing's status changed to %q, want it left at %q", status, "moderation")
	}
}

// Pairs with internal/service/exchange_test.go's unchanged
// TestExchangeService_GenuineMatchIsCreated: that test proves the Match
// query (l.status = 'active' AND l.is_exchange = true AND l.price > 0)
// is untouched; this one proves a freshly created Auto Exchange listing
// already satisfies every one of those conditions the moment it's
// created — together, a new listing is match-eligible immediately,
// under exactly the same rules Match always used.
func TestListingsCreate_ExchangeListingImmediatelyMatchEligible(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77070000007")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	body := baseListingBody()
	body["isExchange"] = true

	resp := postListingJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 201; body %s", resp.StatusCode, b)
	}

	var status string
	var isExchange bool
	var price int64
	var initialPrice *int64
	var exchangeStartedAt *time.Time
	if err := pool.QueryRow(context.Background(), `
		SELECT status, is_exchange, price, initial_price, exchange_started_at
		FROM listings WHERE make = 'Toyota' AND model = 'Camry'
	`).Scan(&status, &isExchange, &price, &initialPrice, &exchangeStartedAt); err != nil {
		t.Fatalf("reload listing: %v", err)
	}
	if status != "active" || !isExchange || price <= 0 {
		t.Fatalf("listing does not satisfy Match's admission query: status=%q is_exchange=%v price=%d", status, isExchange, price)
	}
	if initialPrice == nil || exchangeStartedAt == nil {
		t.Fatal("initial_price/exchange_started_at not set — Auto Exchange participation didn't start")
	}
}
