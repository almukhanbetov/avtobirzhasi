package handlers

import (
	"net/http"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// AdminUsersHandler exposes the read-only admin user lookup used by
// support to find an account by phone/name. Mounted behind
// middleware.Auth() + middleware.AdminOnly() under /api/admin — see
// STAGE10_ADMIN_COMPLETION_REPORT.md for why this stays read-only
// (promoting a user to admin remains a deliberate manual SQL step, not a
// UI action, since self-escalation safety wasn't in this stage's minimal
// scope).
type AdminUsersHandler struct {
	users *repository.UserRepository
}

// NewAdminUsersHandler creates an AdminUsersHandler.
func NewAdminUsersHandler(users *repository.UserRepository) *AdminUsersHandler {
	return &AdminUsersHandler{users: users}
}

// RegisterAdminUsersRoutes wires the route. Callers must mount this under
// a router group protected by middleware.Auth() and middleware.AdminOnly().
func RegisterAdminUsersRoutes(router *gin.RouterGroup, h *AdminUsersHandler) {
	router.GET("/users", h.List)
}

// List handles GET /api/admin/users?search=&page= — every user matching
// an optional case-insensitive name/phone substring, paginated.
// toUserResponse (response.go) already omits password_hash.
func (h *AdminUsersHandler) List(c *gin.Context) {
	page := parsePage(c)
	items, total, err := h.users.ListAll(c.Request.Context(), c.Query("search"), page, adminPageSize)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить пользователей")
		return
	}

	out := make([]userResponse, len(items))
	for i, u := range items {
		out[i] = toUserResponse(&u)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      out,
		"total":      total,
		"totalPages": totalPages(total, adminPageSize),
		"page":       page,
	})
}
