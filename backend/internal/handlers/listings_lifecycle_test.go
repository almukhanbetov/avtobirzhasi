package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"avtobirzhasi/backend/internal/testutil"
)

func deleteRequest(t *testing.T, url, token string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodDelete, url, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	return resp
}

// The Stage 9 self-service flow: a seller can delete (archive) their own
// listing, and it actually disappears from the public catalog's status.
func TestListingsArchive_OwnerSucceeds(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77030000010")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2020, Price: 5_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := deleteRequest(t, server.URL+"/api/listings/"+listingID, token)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", resp.StatusCode)
	}

	var status string
	pool.QueryRow(context.TODO(), `SELECT status FROM listings WHERE id = $1`, listingID).Scan(&status)
	if status != "archived" {
		t.Errorf("status after delete = %q, want archived", status)
	}
}

func TestListingsArchive_ForbiddenForNonOwner(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	ownerID := testutil.InsertUser(t, pool, "+77030000011")
	otherID := testutil.InsertUser(t, pool, "+77030000012")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: ownerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2020, Price: 5_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, otherID)

	resp := deleteRequest(t, server.URL+"/api/listings/"+listingID, token)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}

	var status string
	pool.QueryRow(context.TODO(), `SELECT status FROM listings WHERE id = $1`, listingID).Scan(&status)
	if status != "active" {
		t.Errorf("status after forbidden delete = %q, want unchanged active", status)
	}
}

func TestListingsArchive_UnauthenticatedRejected(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77030000013")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2020, Price: 5_000_000, Status: "active",
	})

	resp := deleteRequest(t, server.URL+"/api/listings/"+listingID, "")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

// A malformed id must be rejected with 400 before ever reaching a SQL
// call — the exact "invalid input syntax for type uuid" -> 500 gap the
// completion audit flagged, closed in Stage 3 and re-verified here
// against the real listings routes specifically.
func TestListingsRoutes_MalformedUUIDReturns400(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77030000014")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	t.Run("PATCH", func(t *testing.T) {
		resp := patchJSON(t, server, "/api/listings/car-3", token, map[string]any{"description": "x"})
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", resp.StatusCode)
		}
	})

	t.Run("DELETE", func(t *testing.T) {
		resp := deleteRequest(t, server.URL+"/api/listings/car-3", token)
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", resp.StatusCode)
		}
	})
}
