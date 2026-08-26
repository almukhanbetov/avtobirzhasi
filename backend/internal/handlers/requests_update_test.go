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

func newRequestsTestServer(pool *pgxpool.Pool) *httptest.Server {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	repo := repository.New(pool)
	requestRepo := repository.NewBuyerRequestRepository(repo)
	h := handlers.NewRequestsHandler(requestRepo)
	api := router.Group("/api")
	handlers.RegisterRequestsRoutes(api, h, testJWTSecret)
	return httptest.NewServer(router)
}

// Every buyer request is inherently an Auto Exchange participant (unlike
// listings, there's no non-exchange variant) — so currentOffer must always
// be rejected, unconditionally. See STAGE2_CORE_BUSINESS_SAFETY_REPORT.md.
func TestRequestsUpdate_CurrentOfferAlwaysBlocked(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77040000001")
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/requests/"+requestID, token, map[string]any{"currentOffer": 20_000_000})
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

	var offer int64
	pool.QueryRow(context.TODO(), `SELECT current_offer FROM buyer_requests WHERE id = $1`, requestID).Scan(&offer)
	if offer != 9_000_000 {
		t.Errorf("current_offer after rejected PATCH = %d, want unchanged 9000000", offer)
	}
}

// Regression check: other fields (region) remain editable.
func TestRequestsUpdate_RegionRemainsEditable(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newRequestsTestServer(pool)
	defer server.Close()

	userID := testutil.InsertUser(t, pool, "+77040000002")
	requestID := testutil.InsertBuyerRequest(t, pool, testutil.BuyerRequestFixture{
		UserID: userID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		YearFrom: 2018, YearTo: 2022, CurrentOffer: 9_000_000,
	})
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	resp := patchJSON(t, server, "/api/requests/"+requestID, token, map[string]any{"region": "Астана"})
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body := new(bytes.Buffer)
		body.ReadFrom(resp.Body)
		t.Fatalf("status = %d, want 200; body: %s", resp.StatusCode, body.String())
	}

	var region string
	pool.QueryRow(context.TODO(), `SELECT region FROM buyer_requests WHERE id = $1`, requestID).Scan(&region)
	if region != "Астана" {
		t.Errorf("region after PATCH = %q, want Астана", region)
	}
}
