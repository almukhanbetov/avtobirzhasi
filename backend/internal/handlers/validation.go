package handlers

import (
	"net/http"
	"regexp"
	"strconv"

	"github.com/gin-gonic/gin"
)

// adminPageSize is the fixed page size for every admin list endpoint —
// small and constant on purpose (these are operator-facing monitoring
// views, not a paginated product surface with user-tunable density).
const adminPageSize = 20

// parsePage reads the "page" query param, defaulting to (and floor-ing
// invalid/non-positive values at) 1.
func parsePage(c *gin.Context) int {
	page, err := strconv.Atoi(c.Query("page"))
	if err != nil || page < 1 {
		return 1
	}
	return page
}

// totalPages computes the page count for an admin list's pagination
// envelope, matching the public catalog's own convention (cars.go's List).
func totalPages(total, pageSize int) int {
	pages := (total + pageSize - 1) / pageSize
	if pages < 1 {
		return 1
	}
	return pages
}

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// requireUUIDParam reads a path param and validates it looks like a UUID
// before any handler passes it to a repository. Left unchecked, a
// malformed id (e.g. "not-a-uuid") reaches Postgres as a bare string and
// surfaces as a raw driver/cast error — a 500, not a 400. Writes the
// error response itself and returns ok=false when the param doesn't look
// like a UUID, so callers can just `id, ok := requireUUIDParam(c, "id"); if !ok { return }`.
func requireUUIDParam(c *gin.Context, name string) (string, bool) {
	id := c.Param(name)
	if !uuidPattern.MatchString(id) {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Некорректный идентификатор")
		return "", false
	}
	return id, true
}

// optionalUUIDQuery reads an optional query parameter (unlike
// requireUUIDParam's required path param) and validates it looks like a
// UUID if present — Stage 7А's regionId/cityId/districtId catalog filter
// params, none of which are mandatory. Returns (nil, true) when absent,
// (&value, true) when present and well-formed, or writes a 400 and
// returns (nil, false) when present but malformed — same reasoning as
// requireUUIDParam: a bad value must never reach Postgres as a bare
// string and surface as a raw driver error.
func optionalUUIDQuery(c *gin.Context, name string) (*string, bool) {
	raw := c.Query(name)
	if raw == "" {
		return nil, true
	}
	if !uuidPattern.MatchString(raw) {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Некорректный идентификатор в параметрах поиска")
		return nil, false
	}
	return &raw, true
}
