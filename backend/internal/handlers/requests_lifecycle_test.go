package handlers_test

import (
	"context"
	"net/http"
	"testing"

	"avtobirzhasi/backend/internal/testutil"
)

// The Stage 9 self-service flow: a buyer can cancel (archive) their own
// request — this endpoint didn't exist at all before Stage 3.
func TestRequestsCancel_OwnerSucceeds(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77040000010")
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Kia", Model: "Rio", Region: "Астана",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 3_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := deleteRequest(t, server.URL+"/api/requests/"+requestID, token)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", resp.StatusCode)
	}

	var status string
	pool.QueryRow(context.TODO(), `SELECT status FROM buyer_requests WHERE id = $1`, requestID).Scan(&status)
	if status != "archived" {
		t.Errorf("status after cancel = %q, want archived", status)
	}
}

func TestRequestsCancel_ForbiddenForNonOwner(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	ownerID := testutil.InsertUser(t, pool, "+77040000011")
	otherID := testutil.InsertUser(t, pool, "+77040000012")
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: ownerID, Make: "Kia", Model: "Rio", Region: "Астана",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 3_000_000, Status: "active",
	})
	token := testutil.IssueTestToken(t, testJWTSecret, otherID)

	resp := deleteRequest(t, server.URL+"/api/requests/"+requestID, token)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}

	var status string
	pool.QueryRow(context.TODO(), `SELECT status FROM buyer_requests WHERE id = $1`, requestID).Scan(&status)
	if status != "active" {
		t.Errorf("status after forbidden cancel = %q, want unchanged active", status)
	}
}

func TestRequestsCancel_UnauthenticatedRejected(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77040000013")
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Kia", Model: "Rio", Region: "Астана",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 3_000_000, Status: "active",
	})

	resp := deleteRequest(t, server.URL+"/api/requests/"+requestID, "")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
}

func TestRequestsRoutes_MalformedUUIDReturns400(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77040000014")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	t.Run("PATCH", func(t *testing.T) {
		resp := patchJSON(t, server, "/api/requests/car-3", token, map[string]any{"region": "Алматы"})
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", resp.StatusCode)
		}
	})

	t.Run("DELETE", func(t *testing.T) {
		resp := deleteRequest(t, server.URL+"/api/requests/car-3", token)
		defer resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("status = %d, want 400", resp.StatusCode)
		}
	})
}
