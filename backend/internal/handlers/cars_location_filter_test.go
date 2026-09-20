package handlers_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"avtobirzhasi/backend/internal/handlers"
	"avtobirzhasi/backend/internal/repository"
	"avtobirzhasi/backend/internal/testutil"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// These tests exercise the Stage 7А location filter on GET /api/cars
// against the real regions/cities/districts reference data seeded by
// cmd/import-locations (see locations_test.go's note on this test-DB
// dependency). newCarsFilterTestServer mounts both the write routes
// (POST/PATCH /api/listings, used only to set up fixtures — e.g. giving
// a listing a real regionId/cityId via the already-working PATCH from
// Stage 5В) and the public read routes (GET /api/cars) together.

func newCarsFilterTestServer(pool *pgxpool.Pool) *httptest.Server {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	repo := repository.New(pool)
	listingRepo := repository.NewListingRepository(repo)
	locationRepo := repository.NewLocationRepository(repo)
	api := router.Group("/api")
	handlers.RegisterListingsWriteRoutes(api, handlers.NewListingsHandler(listingRepo, locationRepo), testJWTSecret)
	handlers.RegisterCarsRoutes(api, handlers.NewCarsHandler(listingRepo, locationRepo))
	return httptest.NewServer(router)
}

type carsListResult struct {
	Items []struct {
		ID     string `json:"id"`
		Make   string `json:"make"`
		Region string `json:"region"`
	} `json:"items"`
	Total int `json:"total"`
}

func getCars(t *testing.T, server *httptest.Server, query string) (int, carsListResult) {
	t.Helper()
	resp, err := http.Get(server.URL + "/api/cars?" + query)
	if err != nil {
		t.Fatalf("GET /api/cars?%s: %v", query, err)
	}
	defer resp.Body.Close()
	var body carsListResult
	if resp.StatusCode == http.StatusOK {
		if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
			t.Fatalf("decode: %v", err)
		}
	}
	return resp.StatusCode, body
}

func containsID(items []struct {
	ID     string `json:"id"`
	Make   string `json:"make"`
	Region string `json:"region"`
}, id string) bool {
	for _, it := range items {
		if it.ID == id {
			return true
		}
	}
	return false
}

// setListingLocation uses the real, already-tested owner PATCH endpoint
// (Stage 5В) to give a listing a structured regionId/cityId/districtId —
// the same path a real user's edit would take, not a shortcut.
func setListingLocation(t *testing.T, server *httptest.Server, token, listingID string, body map[string]any) {
	t.Helper()
	resp := patchJSON(t, server, "/api/listings/"+listingID, token, body)
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("setListingLocation PATCH status = %d, want 200", resp.StatusCode)
	}
}

func TestCarsList_NoLocationFilterReturnsEverythingActive(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77064000001")
	id1 := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active"})
	id2 := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Kia", Model: "K5", Region: "Кокшетау", Year: 2020, Price: 9_000_000, Status: "active"})

	status, result := getCars(t, server, "")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, id1) || !containsID(result.Items, id2) {
		t.Errorf("expected both listings without a location filter, got %+v", result.Items)
	}
}

func TestCarsList_FilterByRegionIncludesModernAndLegacyListings(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77064000002")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")

	// Modern: has region_id/city_id set via a real PATCH.
	modernID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active"})
	setListingLocation(t, server, token, modernID, map[string]any{"regionId": almatyRegionID, "cityId": almatyCityID})

	// Legacy: only the free-text region, never backfilled.
	legacyID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Kia", Model: "K5", Region: "Алматы", Year: 2019, Price: 8_000_000, Status: "active"})

	// A listing from a different region must not appear.
	otherID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "BMW", Model: "X5", Region: "Кокшетау", Year: 2021, Price: 15_000_000, Status: "active"})

	status, result := getCars(t, server, "regionId="+almatyRegionID)
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, modernID) {
		t.Error("modern (region_id-backed) listing missing from region filter")
	}
	if !containsID(result.Items, legacyID) {
		t.Error("legacy (text-only) listing missing from region filter — backward compatibility broken")
	}
	if containsID(result.Items, otherID) {
		t.Error("a listing from a different region leaked into the region filter")
	}
}

func TestCarsList_FilterByCityIsStrictNoLegacyFallback(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77064000003")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")

	modernID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active"})
	setListingLocation(t, server, token, modernID, map[string]any{"regionId": almatyRegionID, "cityId": almatyCityID})

	// Same free text, but never backfilled with a city_id — must NOT
	// match a city-level filter (rule: only reliably-known cities count).
	legacyID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Kia", Model: "K5", Region: "Алматы", Year: 2019, Price: 8_000_000, Status: "active"})

	status, result := getCars(t, server, "regionId="+almatyRegionID+"&cityId="+almatyCityID)
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, modernID) {
		t.Error("modern (city_id-backed) listing missing from city filter")
	}
	if containsID(result.Items, legacyID) {
		t.Error("a legacy text-only listing (no city_id) leaked into the strict city filter")
	}
}

func TestCarsList_FilterByDistrict(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77064000004")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)

	inDistrictID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active"})
	setListingLocation(t, server, token, inDistrictID, map[string]any{"regionId": almatyRegionID, "cityId": almatyCityID, "districtId": districtID})

	// Same city, but no district set — must not appear in a district filter.
	cityOnlyID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Kia", Model: "K5", Region: "Алматы", Year: 2019, Price: 8_000_000, Status: "active"})
	setListingLocation(t, server, token, cityOnlyID, map[string]any{"regionId": almatyRegionID, "cityId": almatyCityID})

	status, result := getCars(t, server, "regionId="+almatyRegionID+"&cityId="+almatyCityID+"&districtId="+districtID)
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, inDistrictID) {
		t.Error("listing with the matching district_id missing from the district filter")
	}
	if containsID(result.Items, cityOnlyID) {
		t.Error("a listing with no district_id leaked into the district filter")
	}
}

func TestCarsList_RejectsCityFromAnotherRegion(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()

	var kokshetauID string
	if err := pool.QueryRow(context.Background(), `SELECT id FROM cities WHERE name_ru = 'Кокшетау'`).Scan(&kokshetauID); err != nil {
		t.Fatalf("look up Кокшетау: %v", err)
	}
	otherRegionID := regionIDByName(t, pool, "Актюбинская область")

	status, _ := getCars(t, server, "regionId="+otherRegionID+"&cityId="+kokshetauID)
	if status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", status)
	}
}

func TestCarsList_RejectsDistrictFromAnotherCity(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	astanaCityID := cityIDOfRepublicanCity(t, pool, "город Астана")
	astanaDistrictID := firstDistrictOfCity(t, pool, astanaCityID)

	status, _ := getCars(t, server, "regionId="+almatyRegionID+"&cityId="+almatyCityID+"&districtId="+astanaDistrictID)
	if status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", status)
	}
}

func TestCarsList_InvalidUUIDIsRejectedNot500(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()

	status, _ := getCars(t, server, "regionId=not-a-uuid")
	if status != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400 (never 500 for a malformed user-supplied id)", status)
	}
}

func TestCarsList_RegionIdTakesPriorityOverMismatchedRegionText(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77064000005")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")

	modernID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active"})
	setListingLocation(t, server, token, modernID, map[string]any{"regionId": almatyRegionID, "cityId": almatyCityID})

	// A mismatched `region` text sent alongside a valid regionId must be
	// ignored entirely — regionId wins outright (documented priority rule).
	status, result := getCars(t, server, "region=Кокшетау&regionId="+almatyRegionID)
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, modernID) {
		t.Error("regionId filter was not honored when a mismatched region text was also present")
	}
}

func TestCarsList_OldTextOnlyURLStillWorksUnchanged(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77064000006")
	legacyID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active"})
	otherID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Kia", Model: "K5", Region: "Кокшетау", Year: 2019, Price: 8_000_000, Status: "active"})

	status, result := getCars(t, server, "region="+"Алматы")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, legacyID) || containsID(result.Items, otherID) {
		t.Errorf("old ?region= text param behavior changed: got %+v", result.Items)
	}
}

func TestCarsList_CombinesLocationWithMakeAndPrice(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77064000007")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")

	matchID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active"})
	setListingLocation(t, server, token, matchID, map[string]any{"regionId": almatyRegionID})

	// Same region, wrong make — must be excluded by the make filter.
	wrongMakeID := testutil.InsertListing(t, pool, testutil.ListingFixture{UserID: userID, Make: "Kia", Model: "K5", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active"})
	setListingLocation(t, server, token, wrongMakeID, map[string]any{"regionId": almatyRegionID})

	status, result := getCars(t, server, "regionId="+almatyRegionID+"&make=Toyota&priceFrom=5000000&priceTo=10000000")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, matchID) {
		t.Error("listing matching region+make+price missing")
	}
	if containsID(result.Items, wrongMakeID) {
		t.Error("a listing with the wrong make leaked in despite the make filter")
	}
}
