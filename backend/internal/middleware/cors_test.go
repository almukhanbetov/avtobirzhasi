package middleware_test

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"avtobirzhasi/backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// Stage 8Б-3: reproduces the exact symptom reported against the real dev
// servers — a browser origin not in CORS's fixed allowlist gets a bare
// 403 from gin-contrib/cors (not a missing-header pass-through), which is
// why LocationSelector's fetch failed with "Не удалось загрузить список"
// even though GET /api/regions works fine with curl (no Origin header —
// curl isn't a browser, so CORS never applies to it at all).

func newCORSTestServer() *httptest.Server {
	gin.SetMode(gin.TestMode)
	router := gin.New()
	router.Use(middleware.CORS())
	router.GET("/api/regions", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"items": []string{}})
	})
	return httptest.NewServer(router)
}

func getWithOrigin(t *testing.T, server *httptest.Server, origin string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodGet, server.URL+"/api/regions", nil)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	return resp
}

func TestCORS_NoOriginHeaderAlwaysAllowed(t *testing.T) {
	server := newCORSTestServer()
	defer server.Close()

	resp := getWithOrigin(t, server, "")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for a non-browser (no Origin) request, got %d", resp.StatusCode)
	}
}

func TestCORS_UnlistedOriginIsRejected(t *testing.T) {
	server := newCORSTestServer()
	defer server.Close()

	resp := getWithOrigin(t, server, "http://localhost:3001")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for an origin not in the fixed allowlist, got %d", resp.StatusCode)
	}
}

func TestCORS_DefaultDevPortIsAllowed(t *testing.T) {
	server := newCORSTestServer()
	defer server.Close()

	resp := getWithOrigin(t, server, "http://localhost:3000")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for the standard dev port, got %d", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "http://localhost:3000" {
		t.Fatalf("expected Access-Control-Allow-Origin echoing the dev origin, got %q", got)
	}
}

func TestCORS_ProductionOriginsAlwaysAllowed(t *testing.T) {
	server := newCORSTestServer()
	defer server.Close()

	for _, origin := range []string{"https://avtobirzhasi.kz", "https://www.avtobirzhasi.kz"} {
		resp := getWithOrigin(t, server, origin)
		resp.Body.Close()
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200 for production origin %s, got %d", origin, resp.StatusCode)
		}
	}
}

func TestCORS_ExtraOriginsEnvAllowsAdditionalLocalPort(t *testing.T) {
	t.Setenv("CORS_EXTRA_ORIGINS", "http://localhost:3001,http://localhost:5173")
	server := newCORSTestServer()
	defer server.Close()

	resp := getWithOrigin(t, server, "http://localhost:3001")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for an origin added via CORS_EXTRA_ORIGINS, got %d", resp.StatusCode)
	}
	if got := resp.Header.Get("Access-Control-Allow-Origin"); got != "http://localhost:3001" {
		t.Fatalf("expected Access-Control-Allow-Origin echoing the extra origin, got %q", got)
	}
}

func TestCORS_ExtraOriginsEnvDoesNotAllowArbitraryOrigins(t *testing.T) {
	t.Setenv("CORS_EXTRA_ORIGINS", "http://localhost:3001")
	server := newCORSTestServer()
	defer server.Close()

	resp := getWithOrigin(t, server, "http://evil.example.com")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for an origin outside both the fixed list and CORS_EXTRA_ORIGINS, got %d", resp.StatusCode)
	}
}
