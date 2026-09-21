package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"avtobirzhasi/backend/internal/testutil"
)

// These tests exercise the Stage 5В location fields on PATCH
// /api/listings/:id, against the real regions/cities/districts seeded by
// cmd/import-locations (see locations_test.go's note on this dependency).

func TestListingsUpdate_SetsRegionCityDistrictOnLegacyListing(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77061000001")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)

	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID, "districtId": districtID,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var gotRegionID, gotCityID, gotDistrictID string
	if err := pool.QueryRow(context.Background(),
		`SELECT region_id, city_id, district_id FROM listings WHERE id = $1`, id,
	).Scan(&gotRegionID, &gotCityID, &gotDistrictID); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if gotRegionID != almatyRegionID || gotCityID != almatyCityID || gotDistrictID != districtID {
		t.Errorf("got %q/%q/%q, want %q/%q/%q", gotRegionID, gotCityID, gotDistrictID, almatyRegionID, almatyCityID, districtID)
	}
}

func TestListingsUpdate_ChangingRegionClearsOldCityAndDistrict(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77061000002")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)
	patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID, "districtId": districtID,
	}).Body.Close()

	akmolaRegionID := regionIDByName(t, pool, "Акмолинская область")
	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"regionId": akmolaRegionID, // no cityId, no districtId this time
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var gotRegionID string
	var gotCityID, gotDistrictID *string
	if err := pool.QueryRow(context.Background(),
		`SELECT region_id, city_id, district_id FROM listings WHERE id = $1`, id,
	).Scan(&gotRegionID, &gotCityID, &gotDistrictID); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if gotRegionID != akmolaRegionID {
		t.Errorf("region_id = %q, want %q", gotRegionID, akmolaRegionID)
	}
	if gotCityID != nil || gotDistrictID != nil {
		t.Errorf("city_id/district_id = %v/%v, want both nil after a region change", gotCityID, gotDistrictID)
	}
}

func TestListingsUpdate_ChangingCityClearsOldDistrict(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77061000003")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	districtID := firstDistrictOfCity(t, pool, almatyCityID)
	patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID, "districtId": districtID,
	}).Body.Close()

	// Same region, same (only) city, but no districtId this time.
	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var gotDistrictID *string
	if err := pool.QueryRow(context.Background(),
		`SELECT district_id FROM listings WHERE id = $1`, id,
	).Scan(&gotDistrictID); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if gotDistrictID != nil {
		t.Errorf("district_id = %v, want nil after a city (re)selection without a district", gotDistrictID)
	}
}

func TestListingsUpdate_RejectsCityFromAnotherRegionOnUpdate(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77061000004")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	var kokshetauID string
	if err := pool.QueryRow(context.Background(), `SELECT id FROM cities WHERE name_ru = 'Кокшетау'`).Scan(&kokshetauID); err != nil {
		t.Fatalf("look up Кокшетау: %v", err)
	}
	otherRegionID := regionIDByName(t, pool, "Актюбинская область")

	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"regionId": otherRegionID, "cityId": kokshetauID,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestListingsUpdate_RejectsDistrictFromAnotherCityOnUpdate(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77061000005")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	astanaCityID := cityIDOfRepublicanCity(t, pool, "город Астана")
	astanaDistrictID := firstDistrictOfCity(t, pool, astanaCityID)

	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID, "districtId": astanaDistrictID,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

// Section 6's core rule: once regionId/cityId are present, the stored
// `region` text comes from the reference data, not from whatever text
// string the client happened to send alongside the ids.
func TestListingsUpdate_RegionTextDerivedFromStructuredLocationNotClientText(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77061000006")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")

	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID,
		"region": "Совершенно другое название", // must be ignored
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var region string
	if err := pool.QueryRow(context.Background(), `SELECT region FROM listings WHERE id = $1`, id).Scan(&region); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if region != "Алматы" {
		t.Errorf("region text = %q, want the reference city name %q, not the client's arbitrary text", region, "Алматы")
	}
}

// Ownership stays enforced exactly as before — a location-only PATCH from
// a different user must still 403, same as any other field.
func TestListingsUpdate_LocationChangeStillRequiresOwnership(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	ownerID := testutil.InsertUser(t, pool, "+77061000007")
	otherID := testutil.InsertUser(t, pool, "+77061000008")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: ownerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	otherToken := testutil.IssueTestToken(t, testJWTSecret, otherID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	resp := patchJSON(t, server, "/api/listings/"+id, otherToken, map[string]any{"regionId": almatyRegionID})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}
}

// Changing only the location must not touch unrelated fields.
func TestListingsUpdate_LocationChangeDoesNotAffectOtherFields(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77061000009")
	id := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2018, Price: 9_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	almatyRegionID := regionIDByName(t, pool, "город Алматы")
	almatyCityID := cityIDOfRepublicanCity(t, pool, "город Алматы")
	resp := patchJSON(t, server, "/api/listings/"+id, token, map[string]any{
		"regionId": almatyRegionID, "cityId": almatyCityID,
	})
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}

	var make, model string
	var price int64
	var year int
	if err := pool.QueryRow(context.Background(),
		`SELECT make, model, price, year FROM listings WHERE id = $1`, id,
	).Scan(&make, &model, &price, &year); err != nil {
		t.Fatalf("reload: %v", err)
	}
	if make != "Toyota" || model != "Camry" || price != 9_000_000 || year != 2018 {
		t.Errorf("unrelated fields changed: make=%q model=%q price=%d year=%d", make, model, price, year)
	}
}
