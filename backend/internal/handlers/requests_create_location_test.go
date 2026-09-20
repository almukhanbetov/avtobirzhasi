package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"avtobirzhasi/backend/internal/testutil"
)

// These tests exercise the Stage 6А location fields on POST /api/requests
// against the real regions/cities/districts reference data seeded by
// cmd/import-locations (regionIDByName/cityIDOfRepublicanCity/
// firstDistrictOfCity are defined in locations_test.go /
// listings_create_location_test.go, same package).

func postRequestJSON(t *testing.T, server *httptest.Server, token string, body map[string]any) *http.Response {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, server.URL+"/api/requests", bytes.NewReader(payload))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	return resp
}

func baseRequestBody() map[string]any {
	return map[string]any{
		"make": "Toyota", "model": "Camry", "yearFrom": 2015, "yearTo": 2020,
		"region": "Алматы", "initialOffer": 8_000_000,
	}
}

func TestRequestsCreate_RegionOnlyNoCity(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77062000001")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	regionID := regionIDByName(t, pool, "Акмолинская область")
	body := baseRequestBody()
	body["regionId"] = regionID

	resp := postRequestJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 201; body %s", resp.StatusCode, b)
	}

	var gotRegionID string
	var cityID, districtID *string
	var make_, model string
	if err := pool.QueryRow(context.Background(),
		`SELECT region_id, city_id, district_id, make, model FROM buyer_requests WHERE make = 'Toyota' AND model = 'Camry'`,
	).Scan(&gotRegionID, &cityID, &districtID, &make_, &model); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if gotRegionID != regionID || cityID != nil || districtID != nil {
		t.Errorf("region_id=%q city_id=%v district_id=%v, want region_id=%q, both nil", gotRegionID, cityID, districtID, regionID)
	}
}

func TestRequestsCreate_RegionCityDistrict(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77062000002")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)

	body := baseRequestBody()
	body["regionId"] = almatyRegionID
	body["cityId"] = almatyCityID
	body["districtId"] = districtID

	resp := postRequestJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 201; body %s", resp.StatusCode, b)
	}

	var gotRegionID, gotCityID, gotDistrictID string
	var yearFrom, yearTo int
	var initialOffer, currentOffer int64
	if err := pool.QueryRow(context.Background(), `
		SELECT region_id, city_id, district_id, year_from, year_to, initial_offer, current_offer
		FROM buyer_requests WHERE make = 'Toyota' AND model = 'Camry'
	`).Scan(&gotRegionID, &gotCityID, &gotDistrictID, &yearFrom, &yearTo, &initialOffer, &currentOffer); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if gotRegionID != almatyRegionID || gotCityID != almatyCityID || gotDistrictID != districtID {
		t.Errorf("got region=%q city=%q district=%q, want %q/%q/%q",
			gotRegionID, gotCityID, gotDistrictID, almatyRegionID, almatyCityID, districtID)
	}
	// Unrelated fields (years, offer) must be exactly what was submitted —
	// the location fields must not interfere with the rest of the request.
	if yearFrom != 2015 || yearTo != 2020 || initialOffer != 8_000_000 || currentOffer != 8_000_000 {
		t.Errorf("unrelated fields changed: yearFrom=%d yearTo=%d initialOffer=%d currentOffer=%d",
			yearFrom, yearTo, initialOffer, currentOffer)
	}
}

func TestRequestsCreate_RejectsCityFromAnotherRegion(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77062000003")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	var kokshetauID string
	if err := pool.QueryRow(context.Background(), `SELECT id FROM cities WHERE name_ru = 'Кокшетау'`).Scan(&kokshetauID); err != nil {
		t.Fatalf("look up Кокшетау: %v", err)
	}
	otherRegionID := regionIDByName(t, pool, "Актюбинская область")

	body := baseRequestBody()
	body["regionId"] = otherRegionID
	body["cityId"] = kokshetauID

	resp := postRequestJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestRequestsCreate_RejectsDistrictFromAnotherCity(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77062000004")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	astanaCityID := cityIDOfRepublicanCity(t, pool, "город Астана")
	astanaDistrictID := firstDistrictOfCity(t, pool, astanaCityID)

	body := baseRequestBody()
	body["regionId"] = almatyRegionID
	body["cityId"] = almatyCityID
	body["districtId"] = astanaDistrictID

	resp := postRequestJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestRequestsCreate_RejectsCityWithoutRegion(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77062000005")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	body := baseRequestBody()
	body["cityId"] = almatyCityID

	resp := postRequestJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

// Section: the stored `region` text must come from the reference data,
// not whatever text the client sends alongside the ids.
func TestRequestsCreate_RegionTextDerivedFromStructuredLocationNotClientText(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77062000006")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")

	body := baseRequestBody()
	body["region"] = "Совершенно другое название"
	body["regionId"] = almatyRegionID
	body["cityId"] = almatyCityID

	resp := postRequestJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 201; body %s", resp.StatusCode, b)
	}

	var region string
	if err := pool.QueryRow(context.Background(),
		`SELECT region FROM buyer_requests WHERE make = 'Toyota' AND model = 'Camry'`,
	).Scan(&region); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if region != "Алматы" {
		t.Errorf("region text = %q, want the reference city name %q, not the client's arbitrary text", region, "Алматы")
	}
}

// Backward compatibility: a pre-Stage-6А client that only ever sends the
// text `region` must keep working exactly as before.
func TestRequestsCreate_OldClientWithoutLocationUUIDsStillWorks(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77062000007")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	body := baseRequestBody() // region text only, exactly the old contract
	resp := postRequestJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 201; body %s", resp.StatusCode, b)
	}

	var region string
	var regionID, cityID, districtID *string
	if err := pool.QueryRow(context.Background(),
		`SELECT region, region_id, city_id, district_id FROM buyer_requests WHERE make = 'Toyota' AND model = 'Camry'`,
	).Scan(&region, &regionID, &cityID, &districtID); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if region != "Алматы" {
		t.Errorf("region text = %q, want unchanged %q", region, "Алматы")
	}
	if regionID != nil || cityID != nil || districtID != nil {
		t.Errorf("region_id/city_id/district_id = %v/%v/%v, want all nil for an old client", regionID, cityID, districtID)
	}
}
