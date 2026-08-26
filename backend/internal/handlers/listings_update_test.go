package handlers_test

import (
	"bytes"
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

const testJWTSecret = "test-secret"

func newListingsTestServer(pool *pgxpool.Pool) *httptest.Server {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	repo := repository.New(pool)
	listingRepo := repository.NewListingRepository(repo)
	h := handlers.NewListingsHandler(listingRepo)
	api := router.Group("/api")
	handlers.RegisterListingsWriteRoutes(api, h, testJWTSecret)
	return httptest.NewServer(router)
}

func patchJSON(t *testing.T, server *httptest.Server, path, token string, body map[string]any) *http.Response {
	t.Helper()
	payload, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("marshal request body: %v", err)
	}
	req, err := http.NewRequest(http.MethodPatch, server.URL+path, bytes.NewReader(payload))
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

// This is the exact regression Stage 2 fixed: PATCHing price on an
// is_exchange listing must be rejected outright, since the price is
// supposed to move only through the daily ±1% engine.
// See STAGE2_CORE_BUSINESS_SAFETY_REPORT.md.
func TestListingsUpdate_PriceBlockedWhenExchangeManaged(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77030000001")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2020, Price: 10_000_000, IsExchange: true,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/listings/"+listingID, token, map[string]any{"price": 5_000_000})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("status = %d, want 409", resp.StatusCode)
	}
	var body struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	json.NewDecoder(resp.Body).Decode(&body)
	if body.Error.Code != "EXCHANGE_MANAGED_FIELD" {
		t.Errorf("error code = %q, want EXCHANGE_MANAGED_FIELD", body.Error.Code)
	}

	var price int64
	pool.QueryRow(context.TODO(), `SELECT price FROM listings WHERE id = $1`, listingID).Scan(&price)
	if price != 10_000_000 {
		t.Errorf("price after rejected PATCH = %d, want unchanged 10000000", price)
	}
}

// Regression check: other fields on the same exchange listing must remain
// editable — only price is blocked.
func TestListingsUpdate_OtherFieldsRemainEditableOnExchangeListing(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77030000002")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2020, Price: 10_000_000, IsExchange: true,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/listings/"+listingID, token, map[string]any{"description": "updated text"})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body := new(bytes.Buffer)
		body.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 200; body: %s", resp.StatusCode, body.String())
	}
}

// Regression check: a non-exchange (plain classified) listing's price must
// remain freely editable — the block is conditional on is_exchange, not
// blanket.
func TestListingsUpdate_PriceEditableWhenNotExchangeManaged(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77030000003")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: userID, Make: "Lada", Model: "Vesta", Region: "Караганда",
		Year: 2019, Price: 5_000_000, IsExchange: false,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/listings/"+listingID, token, map[string]any{"price": 4_500_000})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body := new(bytes.Buffer)
		body.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 200; body: %s", resp.StatusCode, body.String())
	}

	var price int64
	pool.QueryRow(context.TODO(), `SELECT price FROM listings WHERE id = $1`, listingID).Scan(&price)
	if price != 4_500_000 {
		t.Errorf("price after PATCH = %d, want 4500000", price)
	}
}

// A user cannot PATCH someone else's listing at all, exchange-managed or
// not — this is the ownership check the price-bypass fix sits behind.
func TestListingsUpdate_ForbiddenForNonOwner(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newListingsTestServer(pool)
	defer server.Close()

	ownerID := testutil.InsertUser(t, pool, "+77030000004")
	otherID := testutil.InsertUser(t, pool, "+77030000005")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: ownerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2020, Price: 10_000_000, IsExchange: false,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, otherID)

	resp := patchJSON(t, server, "/api/listings/"+listingID, token, map[string]any{"price": 1})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("status = %d, want 403", resp.StatusCode)
	}
}
