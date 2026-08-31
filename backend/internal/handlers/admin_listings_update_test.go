package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"avtobirzhasi/backend/internal/testutil"
)

func adminPatch(t *testing.T, url, token string, body map[string]any) *http.Response {
	t.Helper()
	payload, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPatch, url, bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	return resp
}

// The admin edit page prefills its form from GET /api/admin/listings/:id —
// same {id, car, status, updatedAt, sellerName} shape as a List row.
func TestAdminListingGet_ReturnsPrefillShape(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77052000001")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2019, Price: 7_000_000, Status: "active",
	})
	pool.Exec(context.TODO(), `INSERT INTO listing_images (listing_id, url, position) VALUES ($1,'https://x/a.jpg',0)`, id)
	adminToken := testutil.IssueTestToken(t, testJWTSecret, testutil.InsertAdminUser(t, pool, "+77052000002"))

	resp := getWithToken(t, server.URL+"/api/admin/listings/"+id, adminToken)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var body struct {
		ID         string `json:"id"`
		SellerName string `json:"sellerName"`
		Status     string `json:"status"`
		Car        struct {
			Make   string   `json:"make"`
			Images []string `json:"images"`
		} `json:"car"`
	}
	json.NewDecoder(resp.Body).Decode(&body)
	if body.ID != id || body.Status != "active" || body.Car.Make != "Toyota" ||
		len(body.Car.Images) != 1 || body.SellerName != "Test User" {
		t.Errorf("unexpected prefill body: %+v", body)
	}
}

// An admin can edit a listing owned by someone else — every user field,
// no ownership check.
func TestAdminListingUpdate_EditsAnyOwnersListing(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77052000010")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, IsExchange: false, Status: "active",
	})
	adminToken := testutil.IssueTestToken(t, testJWTSecret, testutil.InsertAdminUser(t, pool, "+77052000011"))

	resp := adminPatch(t, server.URL+"/api/admin/listings/"+id, adminToken, map[string]any{
		"make": "Kia", "model": "K5", "year": 2021, "mileageKm": 25000,
		"region": "Астана", "transmission": "manual", "color": "чёрный",
		"description": "обновлено админом",
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 200; body %s", resp.StatusCode, b)
	}

	var make, model, region, owner string
	var year int
	pool.QueryRow(context.TODO(),
		`SELECT make, model, region, year, user_id FROM listings WHERE id = $1`, id,
	).Scan(&make, &model, &region, &year, &owner)
	if make != "Kia" || model != "K5" || region != "Астана" || year != 2021 {
		t.Errorf("listing not updated: make=%q model=%q region=%q year=%d", make, model, region, year)
	}
	if owner != sellerID {
		t.Errorf("owner changed to %q", owner)
	}
}

func TestAdminListingUpdate_Unauthenticated401(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77052000020")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})

	resp := adminPatch(t, server.URL+"/api/admin/listings/"+id, "", map[string]any{"color": "серый"})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestAdminListingUpdate_NonAdmin403(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77052000030")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	// The listing's own owner is still not an admin — no self-service here.
	ownerToken := testutil.IssueTestToken(t, testJWTSecret, sellerID)

	resp := adminPatch(t, server.URL+"/api/admin/listings/"+id, ownerToken, map[string]any{"color": "серый"})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}
}

func TestAdminListingUpdate_Nonexistent404(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	adminToken := testutil.IssueTestToken(t, testJWTSecret, testutil.InsertAdminUser(t, pool, "+77052000040"))

	resp := adminPatch(t, server.URL+"/api/admin/listings/11111111-1111-1111-1111-111111111111", adminToken,
		map[string]any{"color": "серый"})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestAdminListingUpdate_InvalidPayload400(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77052000050")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	adminToken := testutil.IssueTestToken(t, testJWTSecret, testutil.InsertAdminUser(t, pool, "+77052000051"))

	for _, bad := range []map[string]any{
		{"transmission": "rocket"},
		{"year": 1000},
		{"images": []string{"not-a-url"}},
		{"price": 0},
	} {
		resp := adminPatch(t, server.URL+"/api/admin/listings/"+id, adminToken, bad)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("payload %v -> %d, want 400", bad, resp.StatusCode)
		}
		resp.Body.Close()
	}
}

func TestAdminListingUpdate_IgnoresSystemFields(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77052000060")
	otherID := testutil.InsertUser(t, pool, "+77052000061")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, IsExchange: false, Status: "active",
	})
	adminToken := testutil.IssueTestToken(t, testJWTSecret, testutil.InsertAdminUser(t, pool, "+77052000062"))

	resp := adminPatch(t, server.URL+"/api/admin/listings/"+id, adminToken, map[string]any{
		"color":         "синий",
		"status":        "archived",
		"is_exchange":   true,
		"isExchange":    true,
		"user_id":       otherID,
		"userId":        otherID,
		"initial_price": 1,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var status, owner string
	var isExchange bool
	var initialPrice *int64
	pool.QueryRow(context.TODO(),
		`SELECT status, user_id, is_exchange, initial_price FROM listings WHERE id = $1`, id,
	).Scan(&status, &owner, &isExchange, &initialPrice)
	if status != "active" || owner != sellerID || isExchange || initialPrice != nil {
		t.Errorf("system fields mutated: status=%q owner=%q isExchange=%v initialPrice=%v",
			status, owner, isExchange, initialPrice)
	}
}

func TestAdminListingUpdate_PriceEditRecordsManualHistory(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77052000070")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Lada", Model: "Vesta", Region: "Караганда",
		Year: 2019, Price: 5_000_000, IsExchange: false, Status: "active",
	})
	adminToken := testutil.IssueTestToken(t, testJWTSecret, testutil.InsertAdminUser(t, pool, "+77052000071"))

	resp := adminPatch(t, server.URL+"/api/admin/listings/"+id, adminToken, map[string]any{"price": 4_200_000})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var prev, next int64
	var reason string
	if err := pool.QueryRow(context.TODO(), `
		SELECT previous_price, new_price, reason FROM listing_price_history WHERE listing_id = $1
	`, id).Scan(&prev, &next, &reason); err != nil {
		t.Fatalf("no history row: %v", err)
	}
	if prev != 5_000_000 || next != 4_200_000 || reason != "manual_edit" {
		t.Errorf("history = (%d -> %d, %q), want (5000000 -> 4200000, manual_edit)", prev, next, reason)
	}
}

func TestAdminListingUpdate_ReplacesImages(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77052000080")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	pool.Exec(context.TODO(), `INSERT INTO listing_images (listing_id, url, position) VALUES ($1,'https://x/old1.jpg',0),($1,'https://x/old2.jpg',1)`, id)
	adminToken := testutil.IssueTestToken(t, testJWTSecret, testutil.InsertAdminUser(t, pool, "+77052000081"))

	resp := adminPatch(t, server.URL+"/api/admin/listings/"+id, adminToken, map[string]any{
		"images": []string{"https://x/old1.jpg", "https://x/new.jpg"},
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	rows, _ := pool.Query(context.TODO(), `SELECT url FROM listing_images WHERE listing_id = $1 ORDER BY position`, id)
	defer rows.Close()
	var urls []string
	for rows.Next() {
		var u string
		rows.Scan(&u)
		urls = append(urls, u)
	}
	if len(urls) != 2 || urls[0] != "https://x/old1.jpg" || urls[1] != "https://x/new.jpg" {
		t.Errorf("images after replace = %v, want [old1, new]", urls)
	}
}

func TestAdminListingUpdate_PriceBlockedWhenExchangeManaged(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77052000090")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, IsExchange: true, Status: "active",
	})
	adminToken := testutil.IssueTestToken(t, testJWTSecret, testutil.InsertAdminUser(t, pool, "+77052000091"))

	resp := adminPatch(t, server.URL+"/api/admin/listings/"+id, adminToken, map[string]any{"price": 4_200_000})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("status = %d, want 409", resp.StatusCode)
	}
}
