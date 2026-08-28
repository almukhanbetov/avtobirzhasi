package handlers_test

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"avtobirzhasi/backend/internal/handlers"
	"avtobirzhasi/backend/internal/testutil"

	"github.com/gin-gonic/gin"
)

// A 1x1 PNG — real header bytes so http.DetectContentType returns
// "image/png".
var tinyPNG = []byte{
	0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
	0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
	0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
	0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
	0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
	0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
}

func newUploadsTestServer(t *testing.T, dir string) *httptest.Server {
	t.Helper()
	gin.SetMode(gin.TestMode)
	router := gin.New()
	h := handlers.NewUploadsHandler(dir, "http://test.local")
	api := router.Group("/api")
	handlers.RegisterUploadsRoutes(api, router, h, testJWTSecret)
	srv := httptest.NewServer(router)
	t.Cleanup(srv.Close)
	return srv
}

func multipartBody(t *testing.T, field string, files map[string][]byte) (*bytes.Buffer, string) {
	t.Helper()
	body := &bytes.Buffer{}
	w := multipart.NewWriter(body)
	for name, content := range files {
		part, err := w.CreateFormFile(field, name)
		if err != nil {
			t.Fatalf("create form file: %v", err)
		}
		if _, err := part.Write(content); err != nil {
			t.Fatalf("write part: %v", err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	return body, w.FormDataContentType()
}

func postUpload(t *testing.T, url, token string, body *bytes.Buffer, contentType string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, url, body)
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", contentType)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("do request: %v", err)
	}
	return resp
}

func TestUploadImages_ValidPNG_StoredAndServed(t *testing.T) {
	dir := t.TempDir()
	srv := newUploadsTestServer(t, dir)
	token := testutil.IssueTestToken(t, testJWTSecret, "11111111-1111-1111-1111-111111111111")

	body, ct := multipartBody(t, "images", map[string][]byte{"photo.png": tinyPNG})
	resp := postUpload(t, srv.URL+"/api/uploads/images", token, body, ct)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		raw, _ := io.ReadAll(resp.Body)
		t.Fatalf("status = %d, want 201 (body: %s)", resp.StatusCode, raw)
	}

	var out struct {
		URLs []string `json:"urls"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(out.URLs) != 1 {
		t.Fatalf("urls = %v, want 1 entry", out.URLs)
	}
	if !strings.HasPrefix(out.URLs[0], "http://test.local/uploads/") || !strings.HasSuffix(out.URLs[0], ".png") {
		t.Fatalf("url = %q, want http://test.local/uploads/<hex>.png", out.URLs[0])
	}

	name := strings.TrimPrefix(out.URLs[0], "http://test.local/uploads/")
	onDisk := filepath.Join(dir, name)
	got, err := os.ReadFile(onDisk)
	if err != nil {
		t.Fatalf("file not written to disk: %v", err)
	}
	if !bytes.Equal(got, tinyPNG) {
		t.Fatalf("stored bytes differ from upload (%d vs %d)", len(got), len(tinyPNG))
	}

	// And the public static route serves it back.
	imgResp, err := http.Get(srv.URL + "/uploads/" + name)
	if err != nil {
		t.Fatalf("GET image: %v", err)
	}
	defer imgResp.Body.Close()
	if imgResp.StatusCode != http.StatusOK {
		t.Fatalf("GET /uploads/%s = %d, want 200", name, imgResp.StatusCode)
	}
	served, _ := io.ReadAll(imgResp.Body)
	if !bytes.Equal(served, tinyPNG) {
		t.Fatalf("served bytes differ from upload")
	}
}

func TestUploadImages_RejectsNonImage(t *testing.T) {
	dir := t.TempDir()
	srv := newUploadsTestServer(t, dir)
	token := testutil.IssueTestToken(t, testJWTSecret, "11111111-1111-1111-1111-111111111111")

	body, ct := multipartBody(t, "images", map[string][]byte{
		"notes.png": []byte("this is plain text pretending to be a png"),
	})
	resp := postUpload(t, srv.URL+"/api/uploads/images", token, body, ct)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
	assertUploadDirEmpty(t, dir)
}

func TestUploadImages_RejectsOversizeFile(t *testing.T) {
	dir := t.TempDir()
	srv := newUploadsTestServer(t, dir)
	token := testutil.IssueTestToken(t, testJWTSecret, "11111111-1111-1111-1111-111111111111")

	big := make([]byte, (5<<20)+1)
	copy(big, tinyPNG)
	body, ct := multipartBody(t, "images", map[string][]byte{"huge.png": big})
	resp := postUpload(t, srv.URL+"/api/uploads/images", token, body, ct)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", resp.StatusCode)
	}
	assertUploadDirEmpty(t, dir)
}

func TestUploadImages_RequiresAuth(t *testing.T) {
	dir := t.TempDir()
	srv := newUploadsTestServer(t, dir)

	body, ct := multipartBody(t, "images", map[string][]byte{"photo.png": tinyPNG})
	resp := postUpload(t, srv.URL+"/api/uploads/images", "", body, ct)
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
	assertUploadDirEmpty(t, dir)
}

func TestServe_RejectsTraversalName(t *testing.T) {
	dir := t.TempDir()
	srv := newUploadsTestServer(t, dir)

	// gin normalizes the path, but the regexp guard is what actually
	// keeps a non-generated name from ever reaching the filesystem.
	resp, err := http.Get(srv.URL + "/uploads/not-a-real-name.txt")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", resp.StatusCode)
	}
}

func assertUploadDirEmpty(t *testing.T, dir string) {
	t.Helper()
	entries, err := os.ReadDir(dir)
	if err != nil {
		t.Fatalf("read upload dir: %v", err)
	}
	if len(entries) != 0 {
		t.Fatalf("upload dir should be empty after a rejected upload, has %d file(s)", len(entries))
	}
}
