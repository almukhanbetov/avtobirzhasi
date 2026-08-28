package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"avtobirzhasi/backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

// UploadsHandler backs the authenticated multipart image upload used by
// the listing form, plus the public static serving of what it wrote.
//
// A seller's browser uploads the raw files to POST /api/uploads/images
// and gets back absolute URLs; those URLs are then submitted in the
// listing's `images` array exactly like the external image links the
// field accepted before this stage. Files live on the local filesystem
// (dir), served back verbatim from GET /uploads/:name — in production
// that directory is a persistent Docker volume (see
// docker-compose.prod.yml) and the route is reverse-proxied by Caddy
// through the same api.avtobirzhasi.kz block as /api.
type UploadsHandler struct {
	dir        string
	publicBase string
}

// NewUploadsHandler creates an UploadsHandler writing into dir and
// building returned URLs as publicBase + "/uploads/<name>".
func NewUploadsHandler(dir, publicBase string) *UploadsHandler {
	return &UploadsHandler{dir: dir, publicBase: strings.TrimRight(publicBase, "/")}
}

const (
	// maxImageBytes caps a single uploaded file. Listing photos from a
	// phone camera are comfortably under this once re-encoded; anything
	// larger is almost certainly not a normal photo.
	maxImageBytes = 5 << 20 // 5 MiB
	// maxImagesPerRequest bounds one multipart POST. The form itself
	// also enforces a per-listing max (see lib/validation/listing.ts).
	maxImagesPerRequest = 10
	// uploadFormField is the multipart field name the frontend sends
	// files under — must match FormData.append("images", file).
	uploadFormField = "images"
)

// allowedImageTypes maps an accepted sniffed MIME type to the file
// extension it's stored with. Detection is by content sniff
// (http.DetectContentType), never the client-supplied filename or
// Content-Type, so a renamed .exe can't land in the uploads dir.
var allowedImageTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
}

// safeUploadName matches exactly the names UploadImages generates:
// 32 lowercase hex chars + one of the known image extensions. Serve
// rejects anything else, so the :name param can never be a traversal
// sequence or point outside the uploads dir.
var safeUploadName = regexp.MustCompile(`^[a-f0-9]{32}\.(?:jpg|png|webp)$`)

// RegisterUploadsRoutes wires the upload endpoint (JWT-protected — only a
// signed-in seller uploads) and the public static-serving route.
func RegisterUploadsRoutes(api *gin.RouterGroup, static gin.IRoutes, h *UploadsHandler, jwtSecret string) {
	api.POST("/uploads/images", middleware.Auth(jwtSecret), h.UploadImages)
	static.GET("/uploads/:name", h.Serve)
}

// UploadImages handles POST /api/uploads/images — one or more image
// files under the "images" multipart field. Returns { "urls": [...] } in
// submission order. Partial success is not a thing: if any file is
// rejected the whole request fails and nothing is written.
func (h *UploadsHandler) UploadImages(c *gin.Context) {
	// Reject an oversized request body before buffering all of it.
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxImagesPerRequest*maxImageBytes+(1<<20))

	form, err := c.MultipartForm()
	if err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Не удалось прочитать загруженные файлы")
		return
	}
	files := form.File[uploadFormField]
	if len(files) == 0 {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Выберите хотя бы одно фото")
		return
	}
	if len(files) > maxImagesPerRequest {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Можно загрузить не больше 10 фото за раз")
		return
	}

	if err := os.MkdirAll(h.dir, 0o755); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось сохранить фото, попробуйте позже")
		return
	}

	urls := make([]string, 0, len(files))
	written := make([]string, 0, len(files))
	cleanup := func() {
		for _, p := range written {
			_ = os.Remove(p)
		}
	}

	for _, fh := range files {
		if fh.Size > maxImageBytes {
			cleanup()
			respondError(c, http.StatusRequestEntityTooLarge, "FILE_TOO_LARGE", "Каждое фото должно быть не больше 5 МБ")
			return
		}

		src, err := fh.Open()
		if err != nil {
			cleanup()
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось сохранить фото, попробуйте позже")
			return
		}

		head := make([]byte, 512)
		n, _ := io.ReadFull(src, head)
		ext, ok := allowedImageTypes[http.DetectContentType(head[:n])]
		if !ok {
			_ = src.Close()
			cleanup()
			respondError(c, http.StatusBadRequest, "UNSUPPORTED_MEDIA_TYPE", "Поддерживаются только фото в формате JPG, PNG или WebP")
			return
		}

		name, err := randomHex16()
		if err != nil {
			_ = src.Close()
			cleanup()
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось сохранить фото, попробуйте позже")
			return
		}
		name += ext
		dstPath := filepath.Join(h.dir, name)

		dst, err := os.OpenFile(dstPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
		if err != nil {
			_ = src.Close()
			cleanup()
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось сохранить фото, попробуйте позже")
			return
		}

		// head was already consumed from src; write it, then the rest,
		// capped one byte over the limit so a lying fh.Size still can't
		// overflow the cap.
		_, werr := dst.Write(head[:n])
		if werr == nil {
			_, werr = io.Copy(dst, io.LimitReader(src, maxImageBytes-int64(n)+1))
		}
		_ = src.Close()
		if cerr := dst.Close(); werr == nil {
			werr = cerr
		}
		if werr != nil {
			_ = os.Remove(dstPath)
			cleanup()
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось сохранить фото, попробуйте позже")
			return
		}

		written = append(written, dstPath)
		urls = append(urls, h.publicBase+"/uploads/"+name)
	}

	c.JSON(http.StatusCreated, gin.H{"urls": urls})
}

// Serve handles GET /uploads/:name — public, no auth. Only serves names
// that match the exact shape UploadImages generates.
func (h *UploadsHandler) Serve(c *gin.Context) {
	name := c.Param("name")
	if !safeUploadName.MatchString(name) {
		c.Status(http.StatusNotFound)
		return
	}
	path := filepath.Join(h.dir, name)
	if _, err := os.Stat(path); err != nil {
		c.Status(http.StatusNotFound)
		return
	}
	c.Header("Cache-Control", "public, max-age=31536000, immutable")
	c.File(path)
}

func randomHex16() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf), nil
}
