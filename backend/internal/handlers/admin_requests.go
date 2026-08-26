package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// AdminRequestsHandler exposes the admin-wide buyer requests view — every
// request regardless of owner or status, plus a force-archive action.
// Mounted behind middleware.Auth() + middleware.AdminOnly() under
// /api/admin.
type AdminRequestsHandler struct {
	requests *repository.BuyerRequestRepository
	users    *repository.UserRepository
}

// NewAdminRequestsHandler creates an AdminRequestsHandler.
func NewAdminRequestsHandler(requests *repository.BuyerRequestRepository, users *repository.UserRepository) *AdminRequestsHandler {
	return &AdminRequestsHandler{requests: requests, users: users}
}

// RegisterAdminRequestsRoutes wires the routes. Callers must mount this
// under a router group protected by middleware.Auth() and
// middleware.AdminOnly().
func RegisterAdminRequestsRoutes(router *gin.RouterGroup, h *AdminRequestsHandler) {
	router.GET("/requests", h.List)
	router.POST("/requests/:id/archive", h.Archive)
}

// adminBuyerRequestResponse is buyerRequestResponse plus who owns it.
type adminBuyerRequestResponse struct {
	buyerRequestResponse
	BuyerName string `json:"buyerName"`
}

// List handles GET /api/admin/requests?status=&page= — every buyer
// request regardless of owner, optionally filtered by status, newest
// first.
func (h *AdminRequestsHandler) List(c *gin.Context) {
	page := parsePage(c)
	items, total, err := h.requests.ListAll(c.Request.Context(), c.Query("status"), page, adminPageSize)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить заявки")
		return
	}

	out := make([]adminBuyerRequestResponse, len(items))
	for i, b := range items {
		buyerName := ""
		if user, err := h.users.FindByID(c.Request.Context(), b.UserID); err == nil {
			buyerName = user.Name
		}
		out[i] = adminBuyerRequestResponse{
			buyerRequestResponse: toBuyerRequestResponse(b),
			BuyerName:            buyerName,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      out,
		"total":      total,
		"totalPages": totalPages(total, adminPageSize),
		"page":       page,
	})
}

// Archive handles POST /api/admin/requests/:id/archive — force-archives
// any buyer request regardless of owner.
func (h *AdminRequestsHandler) Archive(c *gin.Context) {
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	request, err := h.requests.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Заявка не найдена")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить заявку")
		return
	}
	if request.Status == "archived" {
		respondError(c, http.StatusConflict, "CONFLICT", "Заявка уже удалена")
		return
	}

	if err := h.requests.SetStatus(c.Request.Context(), id, "archived"); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось удалить заявку")
		return
	}

	c.Status(http.StatusNoContent)
}
