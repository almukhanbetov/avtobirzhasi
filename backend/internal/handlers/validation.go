package handlers

import (
	"net/http"
	"regexp"

	"github.com/gin-gonic/gin"
)

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
