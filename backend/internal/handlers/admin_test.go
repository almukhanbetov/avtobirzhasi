package handlers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"avtobirzhasi/backend/internal/handlers"
	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/repository"
	"avtobirzhasi/backend/internal/testutil"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// newAdminTestServer mounts every /api/admin route exactly as
// cmd/api/main.go does — Auth + AdminOnly, deliberately no LocalOnly (see
// STAGE10_ADMIN_COMPLETION_REPORT.md for why that network gate was
// removed from these routes).
func newAdminTestServer(pool *pgxpool.Pool) *httptest.Server {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	repo := repository.New(pool)
	userRepo := repository.NewUserRepository(repo)
	listingRepo := repository.NewListingRepository(repo)
	requestRepo := repository.NewBuyerRequestRepository(repo)
	matchRepo := repository.NewMatchRepository(repo)
	depositRepo := repository.NewDepositRepository(repo)
	adminRepo := repository.NewAdminRepository(pool)

	adminAPI := router.Group("/api/admin", middleware.Auth(testJWTSecret), middleware.AdminOnly(userRepo))
	handlers.RegisterModerationRoutes(adminAPI, handlers.NewModerationHandler(listingRepo, userRepo))
	handlers.RegisterAdminStatsRoutes(adminAPI, handlers.NewAdminStatsHandler(adminRepo))
	handlers.RegisterAdminListingsRoutes(adminAPI, handlers.NewAdminListingsHandler(listingRepo, userRepo))
	handlers.RegisterAdminRequestsRoutes(adminAPI, handlers.NewAdminRequestsHandler(requestRepo, userRepo))
	handlers.RegisterAdminMatchesRoutes(adminAPI, handlers.NewAdminMatchesHandler(matchRepo))
	handlers.RegisterAdminDepositsRoutes(adminAPI, handlers.NewAdminDepositsHandler(depositRepo))
	handlers.RegisterAdminUsersRoutes(adminAPI, handlers.NewAdminUsersHandler(userRepo))

	return httptest.NewServer(router)
}

func getWithToken(t *testing.T, url, token string) *http.Response {
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
		t.Fatalf("do request: %v", err)
	}
	return resp
}

// Every admin list endpoint must enforce the identical guest/user/admin
// split — this is the exact security requirement Stage 10 was told to
// verify, and the reason these routes moved off LocalOnly onto Auth +
// AdminOnly (see STAGE10_ADMIN_COMPLETION_REPORT.md).
func TestAdminEndpoints_RBAC(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	normalUserID := testutil.InsertUser(t, pool, "+77050000001")
	normalToken := testutil.IssueTestToken(t, testJWTSecret, normalUserID)
	adminUserID := testutil.InsertAdminUser(t, pool, "+77050000002")
	adminToken := testutil.IssueTestToken(t, testJWTSecret, adminUserID)

	endpoints := []string{
		"/api/admin/listings",
		"/api/admin/requests",
		"/api/admin/matches",
		"/api/admin/deposits",
		"/api/admin/users",
		"/api/admin/stats",
		"/api/admin/listings/pending",
	}

	for _, path := range endpoints {
		t.Run(path, func(t *testing.T) {
			guestResp := getWithToken(t, server.URL+path, "")
			defer guestResp.Body.Close()
			if guestResp.StatusCode != http.StatusUnauthorized {
				t.Errorf("guest -> %d, want 401", guestResp.StatusCode)
			}

			userResp := getWithToken(t, server.URL+path, normalToken)
			defer userResp.Body.Close()
			if userResp.StatusCode != http.StatusForbidden {
				t.Errorf("non-admin user -> %d, want 403", userResp.StatusCode)
			}

			adminResp := getWithToken(t, server.URL+path, adminToken)
			defer adminResp.Body.Close()
			if adminResp.StatusCode != http.StatusOK {
				t.Errorf("admin -> %d, want 200", adminResp.StatusCode)
			}
		})
	}
}

// Paginated admin list responses share one envelope shape — verified here
// against the listings endpoint, representative of the other four (all
// built from the same parsePage/totalPages helpers).
func TestAdminListings_ResponseShape(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77050000003")
	testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2020, Price: 5_000_000, Status: "active",
	})
	adminUserID := testutil.InsertAdminUser(t, pool, "+77050000004")
	adminToken := testutil.IssueTestToken(t, testJWTSecret, adminUserID)

	resp := getWithToken(t, server.URL+"/api/admin/listings", adminToken)
	defer resp.Body.Close()

	var body struct {
		Items []struct {
			ID         string `json:"id"`
			SellerName string `json:"sellerName"`
			Status     string `json:"status"`
		} `json:"items"`
		Total      int `json:"total"`
		TotalPages int `json:"totalPages"`
		Page       int `json:"page"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	if body.Total != 1 || len(body.Items) != 1 {
		t.Fatalf("total/items = %d/%d, want 1/1", body.Total, len(body.Items))
	}
	if body.Items[0].SellerName != "Test User" {
		t.Errorf("sellerName = %q, want the fixture's name", body.Items[0].SellerName)
	}
	if body.Items[0].Status != "active" {
		t.Errorf("status = %q, want active", body.Items[0].Status)
	}
	if body.Page != 1 {
		t.Errorf("page = %d, want 1", body.Page)
	}
}

// Admin users list must never leak a password hash — the one field
// toUserResponse deliberately omits.
func TestAdminUsers_NeverExposesPasswordHash(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	testutil.InsertUser(t, pool, "+77050000005")
	adminUserID := testutil.InsertAdminUser(t, pool, "+77050000006")
	adminToken := testutil.IssueTestToken(t, testJWTSecret, adminUserID)

	resp := getWithToken(t, server.URL+"/api/admin/users", adminToken)
	defer resp.Body.Close()

	var raw map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	body, _ := json.Marshal(raw)
	if strings.Contains(string(body), "passwordHash") || strings.Contains(string(body), "password_hash") {
		t.Errorf("admin users response leaks a password hash field: %s", body)
	}
}

// Force-archive: admin-only, works regardless of who owns the listing,
// and is idempotent-safe (a second archive is a 409, not a crash).
func TestAdminListingsArchive_AdminOnlyAndIdempotentSafe(t *testing.T) {
	pool := testutil.SetupDB(t)
	server := newAdminTestServer(pool)
	defer server.Close()

	sellerID := testutil.InsertUser(t, pool, "+77050000007")
	listingID := testutil.InsertListing(t, pool, testutil.ListingFixture{
		UserID: sellerID, Make: "Toyota", Model: "Camry", Region: "Алматы",
		Year: 2020, Price: 5_000_000, Status: "active",
	})
	normalUserID := testutil.InsertUser(t, pool, "+77050000008")
	normalToken := testutil.IssueTestToken(t, testJWTSecret, normalUserID)
	adminUserID := testutil.InsertAdminUser(t, pool, "+77050000009")
	adminToken := testutil.IssueTestToken(t, testJWTSecret, adminUserID)

	postWithToken := func(token string) *http.Response {
		req, _ := http.NewRequest(http.MethodPost, server.URL+"/api/admin/listings/"+listingID+"/archive", nil)
		if token != "" {
			req.Header.Set("Authorization", "Bearer "+token)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatalf("do request: %v", err)
		}
		return resp
	}

	forbiddenResp := postWithToken(normalToken)
	defer forbiddenResp.Body.Close()
	if forbiddenResp.StatusCode != http.StatusForbidden {
		t.Fatalf("non-admin archive attempt = %d, want 403", forbiddenResp.StatusCode)
	}

	okResp := postWithToken(adminToken)
	defer okResp.Body.Close()
	if okResp.StatusCode != http.StatusNoContent {
		t.Fatalf("admin archive = %d, want 204", okResp.StatusCode)
	}

	conflictResp := postWithToken(adminToken)
	defer conflictResp.Body.Close()
	if conflictResp.StatusCode != http.StatusConflict {
		t.Fatalf("second admin archive = %d, want 409", conflictResp.StatusCode)
	}
}
