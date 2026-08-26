package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// ModerationHandler exposes the admin endpoints backing the admin
// moderation queue (app/admin/moderation on the frontend). Mounted under
// /api/admin, behind middleware.Auth() + middleware.AdminOnly() — a
// caller must hold a valid JWT for a real users.role='admin' account,
// checked fresh from the DB every request (see cmd/api/main.go). Not
// LocalOnly-gated: unlike the daily-tick trigger, this is a real
// browser-facing admin feature, and LocalOnly made it unreachable from
// any actual admin session before Stage 10 — see
// STAGE10_ADMIN_COMPLETION_REPORT.md.
type ModerationHandler struct {
	listings *repository.ListingRepository
	users    *repository.UserRepository
}

// NewModerationHandler creates a ModerationHandler.
func NewModerationHandler(listings *repository.ListingRepository, users *repository.UserRepository) *ModerationHandler {
	return &ModerationHandler{listings: listings, users: users}
}

// RegisterModerationRoutes wires the routes. Callers must mount this
// under a router group protected by middleware.Auth() and
// middleware.AdminOnly() (see cmd/api/main.go's /api/admin group).
func RegisterModerationRoutes(router *gin.RouterGroup, h *ModerationHandler) {
	router.GET("/listings/pending", h.ListPending)
	router.POST("/listings/:id/approve", h.Approve)
	router.POST("/listings/:id/reject", h.Reject)
}

// pendingListingResponse is carResponse plus the seller's name, so the
// admin queue can show who posted each listing without a second lookup.
type pendingListingResponse struct {
	carResponse
	SellerName string `json:"sellerName"`
}

// ListPending handles GET /internal/listings/pending — every listing
// awaiting moderation, oldest first.
func (h *ModerationHandler) ListPending(c *gin.Context) {
	items, err := h.listings.ListPendingModeration(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить очередь модерации")
		return
	}

	out := make([]pendingListingResponse, len(items))
	for i, l := range items {
		sellerName := ""
		if user, err := h.users.FindByID(c.Request.Context(), l.UserID); err == nil {
			sellerName = user.Name
		}
		out[i] = pendingListingResponse{
			carResponse: toCarResponse(l),
			SellerName:  sellerName,
		}
	}

	c.JSON(http.StatusOK, out)
}

// loadPendingListing loads a listing and confirms it's still awaiting
// moderation, writing the appropriate error response and returning
// ok=false if not. Shared by Approve and Reject.
func (h *ModerationHandler) loadPendingListing(c *gin.Context, id string) (ok bool) {
	listing, err := h.listings.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Объявление не найдено")
		return false
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить объявление")
		return false
	}
	if listing.Status != "moderation" {
		respondError(c, http.StatusConflict, "CONFLICT", "Объявление не на модерации")
		return false
	}
	return true
}

// Approve handles POST /internal/listings/:id/approve — moves a listing
// from "moderation" to "active", the only way it starts appearing in the
// public catalog (and, if it's an Auto Exchange listing, starts
// participating in the daily price-decay/matching pass).
func (h *ModerationHandler) Approve(c *gin.Context) {
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}
	if !h.loadPendingListing(c, id) {
		return
	}

	if err := h.listings.SetStatus(c.Request.Context(), id, "active"); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось одобрить объявление")
		return
	}

	c.Status(http.StatusNoContent)
}

// Reject handles POST /internal/listings/:id/reject — moves a listing from
// "moderation" straight to "archived" (the same terminal, soft-deleted
// state a seller's own DELETE /api/listings/:id produces). It never goes
// through "active", so a rejected listing is never publicly visible.
func (h *ModerationHandler) Reject(c *gin.Context) {
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}
	if !h.loadPendingListing(c, id) {
		return
	}

	if err := h.listings.SetStatus(c.Request.Context(), id, "archived"); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось отклонить объявление")
		return
	}

	c.Status(http.StatusNoContent)
}
