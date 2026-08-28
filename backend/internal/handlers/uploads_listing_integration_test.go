package handlers_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"avtobirzhasi/backend/internal/handlers"
	"avtobirzhasi/backend/internal/repository"
	"avtobirzhasi/backend/internal/testutil"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
)

// newUploadAndListingServer wires the two routes the photo flow spans:
// the multipart upload endpoint and the JSON create-listing endpoint.
func newUploadAndListingServer(t *testing.T, pool *pgxpool.Pool, uploadDir string) *httptest.Server {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	repo := repository.New(pool)
	listingRepo := repository.NewListingRepository(repo)

	api := router.Group("/api")
	handlers.RegisterListingsWriteRoutes(api, handlers.NewListingsHandler(listingRepo), testJWTSecret)
	handlers.RegisterUploadsRoutes(
		api, router,
		handlers.NewUploadsHandler(uploadDir, "http://test.local"),
		testJWTSecret,
	)

	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)
	return srv
}

// TestPhotoFlow_UploadThenCreateListing covers the whole chain a seller
// actually walks: upload a file, then submit a listing carrying the URL
// the upload returned — and verify the image comes back out, both in the
// create response and as a real listing_images row.
func TestPhotoFlow_UploadThenCreateListing(t *testing.T) {
	pool := testutil.SetupDB(t)
	dir := t.TempDir()
	srv := newUploadAndListingServer(t, pool, dir)

	userID := testutil.InsertUser(t, pool, "+77030000901")
	token := testutil.IssueTestToken(t, testJWTSecret, userID)

	// 1. Upload the photo.
	body, ct := multipartBody(t, "images", map[string][]byte{"car.png": tinyPNG})
	upResp := postUpload(t, srv.URL+"/api/uploads/images", token, body, ct)
	defer upResp.Body.Close()
	if upResp.StatusCode != http.StatusCreated {
		raw, _ := io.ReadAll(upResp.Body)
		t.Fatalf("upload status = %d, want 201 (%s)", upResp.StatusCode, raw)
	}
	var up struct {
		URLs []string `json:"urls"`
	}
	json.NewDecoder(upResp.Body).Decode(&up)
	if len(up.URLs) != 1 {
		t.Fatalf("upload returned %d urls, want 1", len(up.URLs))
	}
	imageURL := up.URLs[0]

	// 2. Create a listing that references it.
	payload, _ := json.Marshal(map[string]any{
		"make": "Toyota", "model": "Camry", "year": 2021, "price": 9_500_000,
		"mileageKm": 40000, "region": "Алматы", "transmission": "automatic",
		"fuelType": "petrol", "bodyType": "sedan", "drivetrain": "fwd",
		"engineVolume": 2.5, "enginePower": 180, "color": "белый",
		"steeringWheel": "left", "images": []string{imageURL},
	})
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/listings", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)
	createResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("create listing: %v", err)
	}
	defer createResp.Body.Close()
	if createResp.StatusCode != http.StatusCreated {
		raw, _ := io.ReadAll(createResp.Body)
		t.Fatalf("create status = %d, want 201 (%s)", createResp.StatusCode, raw)
	}
	var created struct {
		ID       string   `json:"id"`
		ImageURL string   `json:"imageUrl"`
		Images   []string `json:"images"`
	}
	json.NewDecoder(createResp.Body).Decode(&created)

	// 3. The create response carries the image.
	if created.ImageURL != imageURL || len(created.Images) != 1 || created.Images[0] != imageURL {
		t.Fatalf("create response images = %+v / %q, want [%q]", created.Images, created.ImageURL, imageURL)
	}
	if !strings.HasPrefix(created.ImageURL, "http://test.local/uploads/") {
		t.Fatalf("imageUrl = %q, want an /uploads/ URL", created.ImageURL)
	}

	// 4. And it's persisted as a listing_images row.
	var dbURL string
	if err := pool.QueryRow(context.TODO(),
		`SELECT url FROM listing_images WHERE listing_id = $1 ORDER BY position`, created.ID,
	).Scan(&dbURL); err != nil {
		t.Fatalf("no listing_images row: %v", err)
	}
	if dbURL != imageURL {
		t.Fatalf("stored url = %q, want %q", dbURL, imageURL)
	}
}
