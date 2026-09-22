package handlers_test

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"avtobirzhasi/backend/internal/handlers"
	"avtobirzhasi/backend/internal/repository"
	"avtobirzhasi/backend/internal/testutil"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Stage 9Б-17/9Б-АДМИН-КОНТАКТ: regression coverage for seller-contact
// privacy. GET /api/sellers/:id (public, no auth) must never include
// phone, for anyone, under any circumstance — checked at the raw-JSON
// level, not just against a Go struct, since a struct field with the
// right zero value would still pass a naive equality check.
// GET /api/matches/:id must never include a real phone number for
// either party, at any status, including "confirmed" — since the
// single-admin-contact stage, the frontend derives whether to show the
// admin's number purely from `status`, never from a phone field this
// endpoint returns.

func newContactPrivacyTestServer(pool *pgxpool.Pool) *httptest.Server {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	repo := repository.New(pool)
	listingRepo := repository.NewListingRepository(repo)
	userRepo := repository.NewUserRepository(repo)
	matchRepo := repository.NewMatchRepository(repo)
	api := router.Group("/api")
	handlers.RegisterSellersRoutes(api, handlers.NewSellersHandler(userRepo, listingRepo))
	handlers.RegisterMatchesRoutes(api, handlers.NewMatchesHandler(matchRepo, listingRepo, userRepo), testJWTSecret)
	return httptest.NewServer(router)
}

func doGet(t *testing.T, url, token string) (int, map[string]any) {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("GET %s: %v", url, err)
	}
	defer resp.Body.Close()
	var body map[string]any
	// Some responses (e.g. 403) may not carry the exact shape below, but
	// are still valid JSON objects — decode leniently, callers check
	// status first.
	_ = json.NewDecoder(resp.Body).Decode(&body)
	return resp.StatusCode, body
}

func TestSellersGet_PublicResponseNeverIncludesPhone(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newContactPrivacyTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77064200001")

	status, body := doGet(t, server.URL+"/api/sellers/"+sellerID, "")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200", status)
	}

	// The key itself must be absent — not present-with-empty-string,
	// not present-as-null. json.Unmarshal into map[string]any only
	// produces a key if it was actually present in the source JSON.
	if _, present := body["phone"]; present {
		t.Errorf("GET /api/sellers/:id response must not contain a \"phone\" key at all, got: %+v", body)
	}

	// The rest of the public profile must still be there — this endpoint
	// isn't supposed to become empty, only lose the one sensitive field.
	for _, field := range []string{"id", "name", "type", "since", "rating", "reviewsCount", "activeListings"} {
		if _, present := body[field]; !present {
			t.Errorf("expected field %q to still be present in the public seller response, got: %+v", field, body)
		}
	}
	if body["id"] != sellerID {
		t.Errorf("id = %v, want %v", body["id"], sellerID)
	}
}

func TestSellersGet_UnauthenticatedRequestStillWorksAndStillHasNoPhone(t *testing.T) {
	// This endpoint is intentionally still public (no middleware.Auth) —
	// it backs the car detail page's seller card for anonymous catalog
	// browsers too. Confirms that decision explicitly: no token at all
	// is a normal, successful call, and still carries no phone.
	pool := testutil.SetupDB(t)
	server := newContactPrivacyTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77064200002")

	status, body := doGet(t, server.URL+"/api/sellers/"+sellerID, "")
	if status != http.StatusOK {
		t.Fatalf("status = %d, want 200 (this endpoint stays public)", status)
	}
	if _, present := body["phone"]; present {
		t.Errorf("unauthenticated caller must not receive phone, got: %+v", body)
	}
}

// setupMatch creates a seller, a buyer, a listing, a buyer request and a
// match between them with the given status, and returns everything a
// test needs to hit GET /api/matches/:id from either side. phoneSuffix
// keeps users unique across multiple calls within one test (users.phone
// has a unique constraint).
func setupMatch(t *testing.T, pool *pgxpool.Pool, status string, phoneSuffix string) (matchID, sellerID, sellerToken, buyerID, buyerToken string) {
	t.Helper()
	sellerID = testutil.InsertUser(t, pool, "+7706420"+phoneSuffix+"0")
	buyerID = testutil.InsertUser(t, pool, "+7706420"+phoneSuffix+"1")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы", Year: 2020, Price: 9_000_000, Status: "active",
	})
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: buyerID, Make: "Toyota", Model: "Camry", Region: "Алматы", YearFrom: 2018, YearTo: 2022, CurrentOffer: 8_500_000,
	})
	matchID, _, _ = testutil.InsertMatch(t, pool, testutil.MatchFixture{
		ListingID: listingID, BuyerRequestID: requestID, FinalPrice: 8_800_000, DepositAmount: 88_000, Status: status,
	})
	sellerToken = testutil.IssueTestToken(t, testJWTSecret, sellerID)
	buyerToken = testutil.IssueTestToken(t, testJWTSecret, buyerID)
	return matchID, sellerID, sellerToken, buyerID, buyerToken
}

func TestMatchesGet_UnauthenticatedUserGetsNoContact(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newContactPrivacyTestServer(pool)
	defer server.Close()

	matchID, _, _, _, _ := setupMatch(t, pool, "confirmed", "1")

	status, body := doGet(t, server.URL+"/api/matches/"+matchID, "")
	if status != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401 without a token", status)
	}
	if _, present := body["phone"]; present {
		t.Errorf("no phone must ever appear for an unauthenticated request, got: %+v", body)
	}
}

func TestMatchesGet_UninvolvedUserGetsNoContact(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newContactPrivacyTestServer(pool)
	defer server.Close()

	matchID, _, _, _, _ := setupMatch(t, pool, "confirmed", "2")
	strangerID := testutil.InsertUser(t, pool, "+77064200020")
	strangerToken := testutil.IssueTestToken(t, testJWTSecret, strangerID)

	status, body := doGet(t, server.URL+"/api/matches/"+matchID, strangerToken)
	if status != http.StatusForbidden {
		t.Fatalf("status = %d, want 403 for a user with no part in this match", status)
	}
	if _, present := body["phone"]; present {
		t.Errorf("an uninvolved authenticated user must not receive phone, got: %+v", body)
	}
}

func TestMatchesGet_PartyBeforeBothDepositsGetsNoContact(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newContactPrivacyTestServer(pool)
	defer server.Close()

	// Only one side's deposit paid — matches this session's deriveMatchStatus
	// rule (seller-only or buyer-only paid is "seller_deposit_paid" /
	// "buyer_deposit_paid", never "confirmed").
	for i, status := range []string{"awaiting_deposit", "seller_deposit_paid", "buyer_deposit_paid"} {
		matchID, _, sellerToken, _, buyerToken := setupMatch(t, pool, status, fmt.Sprintf("3%d", i))

		for _, tok := range []struct {
			name  string
			token string
		}{{"seller", sellerToken}, {"buyer", buyerToken}} {
			status2, body := doGet(t, server.URL+"/api/matches/"+matchID, tok.token)
			if status2 != http.StatusOK {
				t.Fatalf("[match status=%s, caller=%s] request status = %d, want 200", status, tok.name, status2)
			}
			if _, present := body["phone"]; present {
				t.Errorf("[match status=%s, caller=%s] phone must not appear before both deposits are confirmed, got: %+v", status, tok.name, body)
			}
		}
	}
}

// Even once a match is fully confirmed, GET /api/matches/:id must not
// hand either party the other's real phone number — contact now goes
// through the single admin number the frontend renders on its own,
// driven only by `status == "confirmed"`. This is the same field this
// suite already proves absent pre-confirmation (see
// TestMatchesGet_PartyBeforeBothDepositsGetsNoContact) — this test
// proves it stays absent afterward too, not just delayed.
func TestMatchesGet_ConfirmedMatchNeverIncludesRealPhone(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newContactPrivacyTestServer(pool)
	defer server.Close()

	matchID, _, sellerToken, _, buyerToken := setupMatch(t, pool, "confirmed", "4")

	status, body := doGet(t, server.URL+"/api/matches/"+matchID, sellerToken)
	if status != http.StatusOK {
		t.Fatalf("seller: status = %d, want 200", status)
	}
	if body["status"] != "confirmed" {
		t.Fatalf("seller: match status = %v, want \"confirmed\" (test setup is wrong, not the assertion below)", body["status"])
	}
	counterpart, ok := body["counterpart"].(map[string]any)
	if !ok {
		t.Fatalf("seller: expected a counterpart object, got: %+v", body)
	}
	if _, present := counterpart["phone"]; present {
		t.Errorf("seller: counterpart.phone must never be returned, even confirmed — got: %+v", counterpart)
	}
	if counterpart["name"] == nil || counterpart["name"] == "" {
		t.Errorf("seller: counterpart.name should still be present, got: %+v", counterpart)
	}

	status, body = doGet(t, server.URL+"/api/matches/"+matchID, buyerToken)
	if status != http.StatusOK {
		t.Fatalf("buyer: status = %d, want 200", status)
	}
	counterpart, ok = body["counterpart"].(map[string]any)
	if !ok {
		t.Fatalf("buyer: expected a counterpart object, got: %+v", body)
	}
	if _, present := counterpart["phone"]; present {
		t.Errorf("buyer: counterpart.phone must never be returned, even confirmed — got: %+v", counterpart)
	}
}
