package handlers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"

	"avtobirzhasi/backend/internal/testutil"
)

// These tests exercise the Stage 6Б location fields on
// PATCH /api/requests/:id and GET /api/dashboard/requests, against the
// real regions/cities/districts seeded by cmd/import-locations (see
// locations_test.go's note on this test-DB dependency).

func TestRequestsUpdate_SetsRegionCityDistrictOnLegacyRequest(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77063000001")
	id := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)

	resp := patchJSON(t, server, "/api/requests/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID, "districtId": districtID,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var gotRegionID, gotCityID, gotDistrictID, region string
	if err := pool.QueryRow(context.Background(),
		`SELECT region_id, city_id, district_id, region FROM buyer_requests WHERE id = $1`, id,
	).Scan(&gotRegionID, &gotCityID, &gotDistrictID, &region); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if gotRegionID != almatyRegionID || gotCityID != almatyCityID || gotDistrictID != districtID {
		t.Errorf("got %q/%q/%q, want %q/%q/%q", gotRegionID, gotCityID, gotDistrictID, almatyRegionID, almatyCityID, districtID)
	}
	if region != "Алматы" {
		t.Errorf("region text = %q, want %q", region, "Алматы")
	}
}

func TestRequestsUpdate_ChangingRegionClearsOldCityAndDistrict(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77063000002")
	id := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)
	patchJSON(t, server, "/api/requests/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID, "districtId": districtID,
	}).Body.Close()

	akmolaRegionID := regionIDByName(t, pool, "Акмолинская область")
	resp := patchJSON(t, server, "/api/requests/"+id, token, map[string]any{"regionId": akmolaRegionID})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var gotRegionID string
	var gotCityID, gotDistrictID *string
	if err := pool.QueryRow(context.Background(),
		`SELECT region_id, city_id, district_id FROM buyer_requests WHERE id = $1`, id,
	).Scan(&gotRegionID, &gotCityID, &gotDistrictID); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if gotRegionID != akmolaRegionID || gotCityID != nil || gotDistrictID != nil {
		t.Errorf("region_id=%q city_id=%v district_id=%v, want %q / nil / nil", gotRegionID, gotCityID, gotDistrictID, akmolaRegionID)
	}
}

func TestRequestsUpdate_ChangingCityClearsOldDistrict(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77063000003")
	id := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)
	patchJSON(t, server, "/api/requests/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID, "districtId": districtID,
	}).Body.Close()

	resp := patchJSON(t, server, "/api/requests/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID, // no districtId this time
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var gotDistrictID *string
	if err := pool.QueryRow(context.Background(),
		`SELECT district_id FROM buyer_requests WHERE id = $1`, id,
	).Scan(&gotDistrictID); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if gotDistrictID != nil {
		t.Errorf("district_id = %v, want nil after a city (re)selection without a district", gotDistrictID)
	}
}

func TestRequestsUpdate_RejectsCityFromAnotherRegion(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77063000004")
	id := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	var kokshetauID string
	if err := pool.QueryRow(context.Background(), `SELECT id FROM cities WHERE name_ru = 'Кокшетау'`).Scan(&kokshetauID); err != nil {
		t.Fatalf("look up Кокшетау: %v", err)
	}
	otherRegionID := regionIDByName(t, pool, "Актюбинская область")

	resp := patchJSON(t, server, "/api/requests/"+id, token, map[string]any{
		"regionId": otherRegionID, "cityId": kokshetauID,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestRequestsUpdate_RejectsDistrictFromAnotherCity(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77063000005")
	id := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	astanaCityID := cityIDOfRepublicanCity(t, pool, "город Астана")
	astanaDistrictID := firstDistrictOfCity(t, pool, astanaCityID)

	resp := patchJSON(t, server, "/api/requests/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID, "districtId": astanaDistrictID,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestRequestsUpdate_RegionTextDerivedFromStructuredLocationNotClientText(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77063000006")
	id := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")

	resp := patchJSON(t, server, "/api/requests/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID,
		"region": "Совершенно другое название",
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var region string
	if err := pool.QueryRow(context.Background(), `SELECT region FROM buyer_requests WHERE id = $1`, id).Scan(&region); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if region != "Алматы" {
		t.Errorf("region text = %q, want the reference city name %q, not the client's arbitrary text", region, "Алматы")
	}
}

func TestRequestsUpdate_LocationChangeStillRequiresOwnership(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	ownerID := testutil.InsertUser(t, pool, "+77063000007")
	otherID := testutil.InsertUser(t, pool, "+77063000008")
	id := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: ownerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	otherToken := testutil.IssueTestToken(t, testJWTSecret, otherID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	resp := patchJSON(t, server, "/api/requests/"+id, otherToken, map[string]any{"regionId": almatyRegionID})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}
}

// A PATCH that never mentions regionId at all (e.g. one that only ever
// touches some other field) must never clear an existing location.
func TestRequestsUpdate_PartialUpdateWithoutRegionIdDoesNotClearLocation(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77063000009")
	id := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	patchJSON(t, server, "/api/requests/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID,
	}).Body.Close()

	// An empty-ish PATCH that never mentions regionId/cityId/districtId.
	resp := patchJSON(t, server, "/api/requests/"+id, token, map[string]any{})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var gotRegionID, gotCityID *string
	if err := pool.QueryRow(context.Background(),
		`SELECT region_id, city_id FROM buyer_requests WHERE id = $1`, id,
	).Scan(&gotRegionID, &gotCityID); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if gotRegionID == nil || *gotRegionID != almatyRegionID || gotCityID == nil || *gotCityID != almatyCityID {
		t.Errorf("location was cleared by a PATCH that didn't mention it: region_id=%v city_id=%v", gotRegionID, gotCityID)
	}
}

// GET /api/dashboard/requests must return the structured location fields
// so the edit UI can restore them.
func TestRequestsListMine_ReturnsLocationFields(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77063000010")
	id := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	patchJSON(t, server, "/api/requests/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID,
	}).Body.Close()

	resp := getWithToken(t, server.URL+"/api/dashboard/requests", token)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var items []struct {
		ID       string `json:"id"`
		RegionID string `json:"regionId"`
		CityID   string `json:"cityId"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&items); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(items) != 1 || items[0].RegionID != almatyRegionID || items[0].CityID != almatyCityID {
		t.Errorf("GET /api/dashboard/requests items = %+v, want regionId=%q cityId=%q", items, almatyRegionID, almatyCityID)
	}
}
