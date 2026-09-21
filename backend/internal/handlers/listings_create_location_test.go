package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"avtobirzhasi/backend/internal/testutil"

	"github.com/jackc/pgx/v5/pgxpool"
)

// These tests exercise the Stage 5Б location fields on POST /api/listings
// against the real regions/cities/districts reference data seeded by
// cmd/import-locations (regionIDByName/cityIDOfRepublicanCity are
// defined in locations_test.go, same package — see its own note on this
// test-DB dependency).

func postListingJSON(t *testing.T, server *httptest.Server, token string, body map[string]any) *http.Response {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}
	req, err := http.NewRequest(http.MethodPost, server.URL+"/api/listings", bytes.NewReader(payload))
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

func firstDistrictOfCity(t *testing.T, pool *pgxpool.Pool, cityID string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(),
		`SELECT id FROM districts WHERE city_id = $1 LIMIT 1`, cityID,
	).Scan(&id); err != nil {
		t.Fatalf("look up a district of city %q: %v", cityID, err)
	}
	return id
}

func baseListingBody() map[string]any {
	return map[string]any{
		"make": "Toyota", "model": "Camry", "year": 2020, "price": 9_500_000,
		"mileageKm": 10000, "region": "Алматы",
		"transmission": "automatic", "fuelType": "petrol", "bodyType": "sedan",
		"drivetrain": "fwd", "engineVolume": 2.5, "enginePower": 180, "color": "белый",
		"images": []string{"https://x/car.jpg"},
	}
}

func TestListingsCreate_RegionOnlyNoCity(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77060000001")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	regionID := regionIDByName(t, pool, "Акмолинская область")
	body := baseListingBody()
	body["regionId"] = regionID

	resp := postListingJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 201; body %s", resp.StatusCode, b)
	}

	var gotRegionID string
	var cityID, districtID *string
	if err := pool.QueryRow(context.Background(),
		`SELECT region_id, city_id, district_id FROM listings WHERE make = 'Toyota' AND model = 'Camry'`,
	).Scan(&gotRegionID, &cityID, &districtID); err != nil {
		t.Fatalf("reload listing: %v", err)
	}
	if gotRegionID != regionID || cityID != nil || districtID != nil {
		t.Errorf("region_id=%q city_id=%v district_id=%v, want region_id=%q, both nil", gotRegionID, cityID, districtID, regionID)
	}
}

func TestListingsCreate_RegionCityDistrict(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77060000002")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)

	body := baseListingBody()
	body["regionId"] = almatyRegionID
	body["cityId"] = almatyCityID
	body["districtId"] = districtID

	resp := postListingJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 201; body %s", resp.StatusCode, b)
	}

	var gotRegionID, gotCityID, gotDistrictID string
	if err := pool.QueryRow(context.Background(),
		`SELECT region_id, city_id, district_id FROM listings WHERE make = 'Toyota' AND model = 'Camry'`,
	).Scan(&gotRegionID, &gotCityID, &gotDistrictID); err != nil {
		t.Fatalf("reload listing: %v", err)
	}
	if gotRegionID != almatyRegionID || gotCityID != almatyCityID || gotDistrictID != districtID {
		t.Errorf("got region=%q city=%q district=%q, want %q/%q/%q",
			gotRegionID, gotCityID, gotDistrictID, almatyRegionID, almatyCityID, districtID)
	}
}

func TestListingsCreate_RejectsCityFromAnotherRegion(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77060000003")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	var kokshetauID string
	if err := pool.QueryRow(context.Background(), `SELECT id FROM cities WHERE name_ru = 'Кокшетау'`).Scan(&kokshetauID); err != nil {
		t.Fatalf("look up Кокшетау: %v", err)
	}
	otherRegionID := regionIDByName(t, pool, "Актюбинская область")

	body := baseListingBody()
	body["regionId"] = otherRegionID // Kokshetau belongs to Akmola, not Aktobe
	body["cityId"] = kokshetauID

	resp := postListingJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestListingsCreate_RejectsDistrictFromAnotherCity(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77060000004")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	astanaCityID := cityIDOfRepublicanCity(t, pool, "город Астана")
	astanaDistrictID := firstDistrictOfCity(t, pool, astanaCityID)

	body := baseListingBody()
	body["regionId"] = almatyRegionID
	body["cityId"] = almatyCityID
	body["districtId"] = astanaDistrictID // belongs to Astana, not Almaty

	resp := postListingJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestListingsCreate_RejectsCityWithoutRegion(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77060000005")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	body := baseListingBody()
	body["cityId"] = almatyCityID // no regionId

	resp := postListingJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestListingsCreate_RejectsDistrictWithoutCity(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77060000006")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)

	body := baseListingBody()
	body["regionId"] = almatyRegionID
	body["districtId"] = districtID // no cityId

	resp := postListingJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

// A pre-Stage-5Б client that never sends regionId/cityId/districtId at
// all must keep working exactly as before — this is the backward-
// compatibility requirement.
func TestListingsCreate_OldClientWithoutLocationUUIDsStillWorks(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77060000007")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	body := baseListingBody() // region text only, exactly the old contract
	resp := postListingJSON(t, server, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		b := new(bytes.Buffer)
		b.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 201; body %s", resp.StatusCode, b)
	}

	var region string
	var regionID, cityID, districtID *string
	if err := pool.QueryRow(context.Background(),
		`SELECT region, region_id, city_id, district_id FROM listings WHERE make = 'Toyota' AND model = 'Camry'`,
	).Scan(&region, &regionID, &cityID, &districtID); err != nil {
		t.Fatalf("reload listing: %v", err)
	}
	if region != "Алматы" {
		t.Errorf("region text = %q, want unchanged %q", region, "Алматы")
	}
	if regionID != nil || cityID != nil || districtID != nil {
		t.Errorf("region_id/city_id/district_id = %v/%v/%v, want all nil for an old client", regionID, cityID, districtID)
	}
}
