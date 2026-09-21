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

// These tests exercise the real reference data seeded by
// cmd/import-locations (regions/cities/districts are deliberately
// excluded from testutil.SetupDB's truncateAll — see
// docs/LOCATION_IMPLEMENTATION.md Stage 3) — they require that importer
// to have been run against the test database at least once (20 regions,
// 89 cities, 18 urban districts as of Stage 3B). If it hasn't, the count
// assertions below fail with a clear mismatch rather than a panic.

func newLocationsTestServer(pool *pgxpool.Pool) *httptest.Server {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	repo := repository.New(pool)
	locationRepo := repository.NewLocationRepository(repo)
	h := handlers.NewLocationsHandler(locationRepo)
	api := router.Group("/api")
	handlers.RegisterLocationsRoutes(api, h)
	return httptest.NewServer(router)
}

type regionItem struct {
	ID        string `json:"id"`
	NameRU    string `json:"nameRu"`
	NameKZ    string `json:"nameKz"`
	Kind      string `json:"kind"`
	IsSpecial bool   `json:"isSpecial"`
}

type cityItem struct {
	ID       string `json:"id"`
	RegionID string `json:"regionId"`
	NameRU   string `json:"nameRu"`
	NameKZ   string `json:"nameKz"`
}

type districtItem struct {
	ID       string  `json:"id"`
	Kind     string  `json:"kind"`
	CityID   *string `json:"cityId"`
	RegionID *string `json:"regionId"`
	NameRU   string  `json:"nameRu"`
	NameKZ   string  `json:"nameKz"`
}

func getJSON[T any](t *testing.T, server *httptest.Server, path string) (int, T) {
	t.Helper()
	resp, err := http.Get(server.URL + path)
	if err != nil {
		t.Fatalf("GET %s: %v", path, err)
	}
	defer resp.Body.Close()
	var out T
	if resp.StatusCode == http.StatusOK {
		if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
			t.Fatalf("decode %s: %v", path, err)
		}
	}
	return resp.StatusCode, out
}

func regionIDByName(t *testing.T, pool *pgxpool.Pool, nameRU string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(),
		`SELECT id FROM regions WHERE name_ru = $1`, nameRU,
	).Scan(&id); err != nil {
		t.Fatalf("look up region %q: %v", nameRU, err)
	}
	return id
}

func cityIDOfRepublicanCity(t *testing.T, pool *pgxpool.Pool, regionNameRU string) string {
	t.Helper()
	var id string
	if err := pool.QueryRow(context.Background(), `
		SELECT c.id FROM cities c JOIN regions r ON r.id = c.region_id WHERE r.name_ru = $1
	`, regionNameRU).Scan(&id); err != nil {
		t.Fatalf("look up city for region %q: %v", regionNameRU, err)
	}
	return id
}

// 1. Every region loads, and the 3 republican-significance cities are
// correctly flagged isSpecial (computed from kind).
func TestLocations_ListRegions(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newLocationsTestServer(pool)
	defer server.Close()

	status, body := getJSON[struct {
		Items []regionItem `json:"items"`
	}](t, server, "/api/regions")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if len(body.Items) != 20 {
		t.Fatalf("regions = %d, want 20 (has cmd/import-locations been run against this test DB?)", len(body.Items))
	}

	special := map[string]bool{}
	for _, r := range body.Items {
		if r.IsSpecial != (r.Kind == "republican_city") {
			t.Errorf("region %q: isSpecial=%v inconsistent with kind=%q", r.NameRU, r.IsSpecial, r.Kind)
		}
		if r.IsSpecial {
			special[r.NameRU] = true
		}
	}
	for _, want := range []string{"город Алматы", "город Астана", "город Шымкент"} {
		if !special[want] {
			t.Errorf("%q not returned with isSpecial=true", want)
		}
	}
}

// 2 & 11. Almaty Region's cities are exactly its own — no foreign city
// (e.g. from Akmola Region) leaks into the response.
func TestLocations_CitiesOfAlmatyRegion(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newLocationsTestServer(pool)
	defer server.Close()

	regionID := regionIDByName(t, pool, "Алматинская область")
	status, body := getJSON[struct {
		Items []cityItem `json:"items"`
	}](t, server, "/api/regions/"+regionID+"/cities")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if len(body.Items) == 0 {
		t.Fatal("expected at least one city for Алматинская область")
	}
	for _, c := range body.Items {
		if c.RegionID != regionID {
			t.Errorf("city %q has regionId %q, want %q (leaked from another region)", c.NameRU, c.RegionID, regionID)
		}
	}
	names := map[string]bool{}
	for _, c := range body.Items {
		names[c.NameRU] = true
	}
	if names["Кокшетау"] {
		t.Error("Кокшетау (an Akmola Region city) leaked into Алматинская область's response")
	}
}

// 3. Akmola Region's cities.
func TestLocations_CitiesOfAkmolaRegion(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newLocationsTestServer(pool)
	defer server.Close()

	regionID := regionIDByName(t, pool, "Акмолинская область")
	status, body := getJSON[struct {
		Items []cityItem `json:"items"`
	}](t, server, "/api/regions/"+regionID+"/cities")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if len(body.Items) != 11 {
		t.Errorf("Акмолинская область cities = %d, want 11", len(body.Items))
	}
}

// 4, 5, 6. Districts of Almaty / Astana / Shymkent — each republican city
// is one `cities` row (no duplicate), reached via GET /api/cities/:id/districts.
func TestLocations_DistrictsOfRepublicanCities(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newLocationsTestServer(pool)
	defer server.Close()

	cases := []struct {
		region string
		want   int
	}{
		{"город Алматы", 8},
		{"город Астана", 5},
		{"город Шымкент", 5},
	}
	for _, tc := range cases {
		t.Run(tc.region, func(t *testing.T) {
			cityID := cityIDOfRepublicanCity(t, pool, tc.region)
			status, body := getJSON[struct {
				Items []districtItem `json:"items"`
			}](t, server, "/api/cities/"+cityID+"/districts")
			if status != http.StatusOK {
				t.Fatalf("status = %d, want 200", status)
			}
			if len(body.Items) != tc.want {
				t.Errorf("%s districts = %d, want %d", tc.region, len(body.Items), tc.want)
			}
			for _, d := range body.Items {
				if d.Kind != "urban" || d.CityID == nil || *d.CityID != cityID || d.RegionID != nil {
					t.Errorf("district %q not a clean urban/city-scoped row: kind=%q cityId=%v regionId=%v",
						d.NameRU, d.Kind, d.CityID, d.RegionID)
				}
			}
		})
	}
}

// 7. A malformed id is rejected before it ever reaches Postgres.
func TestLocations_InvalidID(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newLocationsTestServer(pool)
	defer server.Close()

	for _, path := range []string{
		"/api/regions/not-a-uuid/cities",
		"/api/cities/not-a-uuid/districts",
	} {
		resp, err := http.Get(server.URL + path)
		if err != nil {
			t.Fatalf("GET %s: %v", path, err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("%s -> %d, want 400", path, resp.StatusCode)
		}
	}
}

// 8. A well-formed but nonexistent region id.
func TestLocations_NonexistentRegion(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newLocationsTestServer(pool)
	defer server.Close()

	resp, err := http.Get(server.URL + "/api/regions/11111111-1111-1111-1111-111111111111/cities")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("status = %d, want 404", resp.StatusCode)
	}
}

// 9 & 10. A well-formed but nonexistent city id is 404; a real city with
// no districts (every city except the 3 republican ones today) returns
// 200 with an empty array, not an error.
func TestLocations_NonexistentCityAndCityWithNoDistricts(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newLocationsTestServer(pool)
	defer server.Close()

	resp, err := http.Get(server.URL + "/api/cities/11111111-1111-1111-1111-111111111111/districts")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Errorf("nonexistent city status = %d, want 404", resp.StatusCode)
	}

	var cityID string
	if err := pool.QueryRow(context.Background(), `SELECT id FROM cities WHERE name_ru = 'Кокшетау'`).Scan(&cityID); err != nil {
		t.Fatalf("look up Кокшетау: %v", err)
	}
	status, body := getJSON[struct {
		Items []districtItem `json:"items"`
	}](t, server, "/api/cities/"+cityID+"/districts")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if body.Items == nil || len(body.Items) != 0 {
		t.Errorf("Кокшетау districts = %v, want an empty array, not null or non-empty", body.Items)
	}
}

// 12. Administrative (oblast-level) districts must never appear in a
// city's district list, and vice versa — the two kinds are never mixed.
// A synthetic administrative district is inserted for this one check and
// removed immediately after, since regions/cities/districts are reference
// data outside testutil.SetupDB's truncation.
func TestLocations_NeverMixesAdministrativeAndUrbanDistricts(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newLocationsTestServer(pool)
	defer server.Close()
	ctx := context.Background()

	regionID := regionIDByName(t, pool, "Акмолинская область")
	var adminDistrictID string
	if err := pool.QueryRow(ctx, `
		INSERT INTO districts (kind, region_id, name_ru, name_kz, slug)
		VALUES ('administrative', $1, 'Тестовый район', 'Тестовый район', 'test-admin-district-locations-test')
		RETURNING id
	`, regionID).Scan(&adminDistrictID); err != nil {
		t.Fatalf("insert synthetic administrative district: %v", err)
	}
	t.Cleanup(func() {
		if _, err := pool.Exec(ctx, `DELETE FROM districts WHERE id = $1`, adminDistrictID); err != nil {
			t.Fatalf("cleanup synthetic administrative district: %v", err)
		}
	})

	var kokshetauID string
	if err := pool.QueryRow(ctx, `SELECT id FROM cities WHERE name_ru = 'Кокшетау'`).Scan(&kokshetauID); err != nil {
		t.Fatalf("look up Кокшетау: %v", err)
	}
	status, body := getJSON[struct {
		Items []districtItem `json:"items"`
	}](t, server, "/api/cities/"+kokshetauID+"/districts")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	for _, d := range body.Items {
		if d.ID == adminDistrictID {
			t.Fatalf("administrative district %q leaked into a city's urban district list", d.NameRU)
		}
	}
}
