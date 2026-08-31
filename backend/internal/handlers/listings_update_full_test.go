package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"avtobirzhasi/backend/internal/testutil"
)

func patchNoAuth(t *testing.T, url string, body map[string]any) *http.Response {
	t.Helper()
	payload, _ := json.Marshal(body)
	req, err := http.NewRequest(http.MethodPatch, url, bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	return resp
}

func TestListingsUpdate_OwnerFullFieldEdit(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77031000001")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, IsExchange: false, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"make": "Kia", "model": "K5", "year": 2021,
		"mileageKm": 25000, "region": "Астана",
		"transmission": "manual", "fuelType": "diesel", "bodyType": "suv",
		"drivetrain": "awd", "engineVolume": 2.2, "enginePower": 200,
		"color": "чёрный", "steeringWheel": "right", "description": "обновлено",
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 200; body %s", resp.StatusCode, b)
	}

	var row struct {
		Make, Model, Region, Transmission, FuelType, BodyType, Drivetrain, Color, Steering string
		Year, EnginePower                                                                  int
		EngineVolume                                                                       float64
		Mileage                                                                            int
	}
	err := pool.QueryRow(context.TODO(), `
		SELECT make, model, region, transmission, fuel_type, body_type, drivetrain,
		       color, steering_wheel, year, engine_power, engine_volume, mileage_km
		FROM listings WHERE id = $1`, id,
	).Scan(&row.Make, &row.Model, &row.Region, &row.Transmission, &row.FuelType, &row.BodyType,
		&row.Drivetrain, &row.Color, &row.Steering, &row.Year, &row.EnginePower, &row.EngineVolume, &row.Mileage)
	if err != nil {
		t.Fatalf("reload: %v", err)
	}
	if row.Make != "Kia" || row.Model != "K5" || row.Year != 2021 || row.Region != "Астана" ||
		row.Transmission != "manual" || row.FuelType != "diesel" || row.BodyType != "suv" ||
		row.Drivetrain != "awd" || row.Color != "чёрный" || row.Steering != "right" ||
		row.EnginePower != 200 || row.EngineVolume != 2.2 || row.Mileage != 25000 {
		t.Errorf("row not fully updated: %+v", row)
	}
}

func TestListingsUpdate_IgnoresSystemFields(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77031000002")
	otherID := testutil.InsertUser(t, pool, "+77031000003")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, IsExchange: false, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"color":         "синий", // one real change so the request isn't a no-op
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
	if status != "active" {
		t.Errorf("status = %q, want unchanged 'active'", status)
	}
	if owner != userID {
		t.Errorf("user_id changed to %q", owner)
	}
	if isExchange {
		t.Errorf("is_exchange flipped to true")
	}
	if initialPrice != nil {
		t.Errorf("initial_price set to %v via request", *initialPrice)
	}
}

func TestListingsUpdate_PriceEditRecordsManualHistoryRow(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77031000004")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Lada", Model: "Vesta", Region: "Караганда",
		Year: 2019, Price: 5_000_000, IsExchange: false, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{"price": 4_200_000})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var price int64
	pool.QueryRow(context.TODO(), `SELECT price FROM listings WHERE id = $1`, id).Scan(&price)
	if price != 4_200_000 {
		t.Errorf("price = %d, want 4200000", price)
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

	// Re-sending the same price must NOT add another history row.
	patchJSON(t, server, "/api/listings/"+id, token, map[string]any{"price": 4_200_000}).Body.Close()
	var n int
	pool.QueryRow(context.TODO(), `SELECT count(*) FROM listing_price_history WHERE listing_id = $1`, id).Scan(&n)
	if n != 1 {
		t.Errorf("history rows = %d, want 1 (unchanged price adds nothing)", n)
	}
}

func TestListingsUpdate_ReplacesImages(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77031000005")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, IsExchange: false, Status: "active",
	})
	pool.Exec(context.TODO(), `INSERT INTO listing_images (listing_id, url, position) VALUES ($1,'https://x/old1.jpg',0),($1,'https://x/old2.jpg',1)`, id)
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
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

func TestListingsUpdate_Unauthenticated401(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77031000006")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})

	resp := patchNoAuth(t, server.URL+"/api/listings/"+id, map[string]any{"color": "серый"})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestListingsUpdate_NonexistentListing404(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77031000007")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/listings/11111111-1111-1111-1111-111111111111", token,
		map[string]any{"color": "серый"})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func TestListingsUpdate_InvalidPayload400(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77031000008")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	for _, bad := range []map[string]any{
		{"transmission": "rocket"},
		{"year": 1000},
		{"drivetrain": "6wd"},
		{"images": []string{"not-a-url"}},
		{"price": 0},
	} {
		resp := patchJSON(t, server, "/api/listings/"+id, token, bad)
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("payload %v -> status %d, want 400", bad, resp.StatusCode)
		}
		resp.Body.Close()
	}
}
