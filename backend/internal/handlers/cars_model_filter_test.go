package handlers_test

import (
	"net/http"
	"net/url"
	"testing"

	"avtobirzhasi/backend/internal/testutil"
)

// These tests exercise GET /api/cars's `model` filter — see
// backend/internal/repository/listings.go's List, `model = $%d`. Before
// this fix, the filter was `(make || ' ' || model) ILIKE '%model%'`,
// which matched any listing whose model *contains* the selected model as
// a substring — e.g. selecting Toyota "Land Cruiser" also returned
// "Land Cruiser Prado" listings, and Mazda "3" also returned "CX-3"/
// "CX-30" listings. Wrong once `model` became a curated <select> bound to
// frontend/lib/mock/cars.ts's modelsByMake (Stage 8Б-5) instead of free
// text: a user picking one specific model from that list expects exactly
// that model back, not every model whose name happens to contain it.

func TestCarsList_ModelFilterIsExactNotSubstring(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77064100001")

	landCruiserID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Land Cruiser", Region: "Алматы", Year: 2020, Price: 20_000_000, Status: "active",
	})
	landCruiserPradoID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Land Cruiser Prado", Region: "Алматы", Year: 2020, Price: 18_000_000, Status: "active",
	})
	mazda3ID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Mazda", Model: "3", Region: "Алматы", Year: 2019, Price: 6_000_000, Status: "active",
	})
	mazdaCX3ID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Mazda", Model: "CX-3", Region: "Алматы", Year: 2019, Price: 7_000_000, Status: "active",
	})
	mazdaCX30ID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Mazda", Model: "CX-30", Region: "Алматы", Year: 2021, Price: 9_000_000, Status: "active",
	})

	status, result := getCars(t, server, "make=Toyota&model="+url.QueryEscape("Land Cruiser"))
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, landCruiserID) {
		t.Errorf("expected the exact 'Land Cruiser' listing in results, got %+v", result.Items)
	}
	if containsID(result.Items, landCruiserPradoID) {
		t.Errorf("'Land Cruiser Prado' must not match a 'Land Cruiser' model filter, got %+v", result.Items)
	}

	status, result = getCars(t, server, "make=Mazda&model=3")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, mazda3ID) {
		t.Errorf("expected the exact Mazda '3' listing in results, got %+v", result.Items)
	}
	if containsID(result.Items, mazdaCX3ID) || containsID(result.Items, mazdaCX30ID) {
		t.Errorf("'CX-3'/'CX-30' must not match a '3' model filter, got %+v", result.Items)
	}
}

// Make selected, model left as "Любая модель" (any) — must return every
// listing of that make, unfiltered by model.
func TestCarsList_MakeOnlyAnyModelReturnsAllModelsOfThatMake(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77064100002")

	camryID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active",
	})
	corollaID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Corolla", Region: "Алматы", Year: 2020, Price: 7_000_000, Status: "active",
	})
	kiaID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Kia", Model: "Rio", Region: "Алматы", Year: 2020, Price: 6_000_000, Status: "active",
	})

	status, result := getCars(t, server, "make=Toyota")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, camryID) || !containsID(result.Items, corollaID) {
		t.Errorf("expected both Toyota models with no model filter, got %+v", result.Items)
	}
	if containsID(result.Items, kiaID) {
		t.Errorf("Kia listing must not appear under a Toyota make filter, got %+v", result.Items)
	}
}

// An empty model — whether the param is entirely absent, or present but
// empty (e.g. a hand-typed ?model= URL, or Gin's c.Query("model")
// returning an empty string either way) — must never turn into a clause
// that excludes every listing. See ListingRepository.List's f.Model
// empty-string guard.
func TestCarsList_EmptyModelParamAppliesNoFilter(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newCarsFilterTestServer(pool)
	defer server.Close()
	userID := testutil.InsertUser(t, pool, "+77064100003")

	id1 := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active",
	})
	id2 := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Kia", Model: "Rio", Region: "Алматы", Year: 2020, Price: 6_000_000, Status: "active",
	})

	status, result := getCars(t, server, "model=")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}
	if !containsID(result.Items, id1) || !containsID(result.Items, id2) {
		t.Errorf("an empty model= param must not filter anything out, got %+v", result.Items)
	}
}
