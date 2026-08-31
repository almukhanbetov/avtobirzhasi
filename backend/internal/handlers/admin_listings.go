package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// AdminListingsHandler exposes the admin-wide listings view — every
// listing regardless of owner or status, plus a force-archive action for
// content that needs removing outside the normal owner-initiated delete
// or the moderation queue (e.g. a fraud report on an already-active
// listing). Mounted behind middleware.Auth() + middleware.AdminOnly()
// under /api/admin.
type AdminListingsHandler struct {
	listings *repository.ListingRepository
	users    *repository.UserRepository
}

// NewAdminListingsHandler creates an AdminListingsHandler.
func NewAdminListingsHandler(listings *repository.ListingRepository, users *repository.UserRepository) *AdminListingsHandler {
	return &AdminListingsHandler{listings: listings, users: users}
}

// RegisterAdminListingsRoutes wires the routes. Callers must mount this
// under a router group protected by middleware.Auth() and
// middleware.AdminOnly().
func RegisterAdminListingsRoutes(router *gin.RouterGroup, h *AdminListingsHandler) {
	router.GET("/listings", h.List)
	router.GET("/listings/:id", h.Get)
	router.PATCH("/listings/:id", h.Update)
	router.POST("/listings/:id/archive", h.Archive)
}

// adminListingResponse is sellerListingResponse (car_response.go) plus who
// owns it, so the admin table doesn't need a second lookup per row.
type adminListingResponse struct {
	sellerListingResponse
	SellerName string `json:"sellerName"`
}

// List handles GET /api/admin/listings?status=&page= — every listing
// regardless of owner, optionally filtered by status, newest first.
func (h *AdminListingsHandler) List(c *gin.Context) {
	page := parsePage(c)
	items, total, err := h.listings.ListAll(c.Request.Context(), c.Query("status"), page, adminPageSize)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить объявления")
		return
	}

	out := make([]adminListingResponse, len(items))
	for i, l := range items {
		sellerName := ""
		if user, err := h.users.FindByID(c.Request.Context(), l.UserID); err == nil {
			sellerName = user.Name
		}
		out[i] = adminListingResponse{
			sellerListingResponse: toSellerListingResponse(l),
			SellerName:            sellerName,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      out,
		"total":      total,
		"totalPages": totalPages(total, adminPageSize),
		"page":       page,
	})
}

// Get handles GET /api/admin/listings/:id — one listing regardless of
// owner or status, in the same {id, car, status, updatedAt, sellerName}
// shape as a row of List, so the admin edit page can prefill its form.
func (h *AdminListingsHandler) Get(c *gin.Context) {
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	listing, err := h.listings.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Объявление не найдено")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить объявление")
		return
	}

	sellerName := ""
	if user, err := h.users.FindByID(c.Request.Context(), listing.UserID); err == nil {
		sellerName = user.Name
	}
	c.JSON(http.StatusOK, adminListingResponse{
		sellerListingResponse: toSellerListingResponse(*listing),
		SellerName:            sellerName,
	})
}

// Update handles PATCH /api/admin/listings/:id — an admin edits any
// listing regardless of owner. Same partial updateListingRequest DTO,
// same field rules, and same 'manual_edit' price-history behaviour as the
// owner's PATCH /api/listings/:id (buildListingFieldUpdate is shared);
// the only differences are no ownership check and the admin-role gate on
// the /api/admin group. System columns stay unbindable.
func (h *AdminListingsHandler) Update(c *gin.Context) {
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	listing, err := h.listings.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Объявление не найдено")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить объявление")
		return
	}

	var req updateListingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, "VALIDATION_ERROR", "Проверьте правильность заполнения полей объявления")
		return
	}

	// Auto Exchange listings move only via the daily ±1% engine — a direct
	// price edit (even by an admin) would bypass the fairness mechanic.
	if req.Price != nil && listing.IsExchange {
		respondError(c, http.StatusConflict, "EXCHANGE_MANAGED_FIELD", "Цена управляется автообменом и не может быть изменена вручную")
		return
	}

	fields, priceEdit := buildListingFieldUpdate(listing, req)

	if len(fields) == 0 && req.Images == nil {
		c.JSON(http.StatusOK, toCarResponse(*listing))
		return
	}

	if err := h.listings.UpdateListing(c.Request.Context(), id, fields, req.Images, priceEdit); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось обновить объявление")
		return
	}

	updated, err := h.listings.GetByID(c.Request.Context(), id)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось обновить объявление")
		return
	}
	c.JSON(http.StatusOK, toCarResponse(*updated))
}

// Archive handles POST /api/admin/listings/:id/archive — force-archives
// any listing regardless of owner. Distinct from ModerationHandler.Reject
// (which only applies to a listing still awaiting moderation): this is
// for already-active/frozen content an admin needs to take down.
func (h *AdminListingsHandler) Archive(c *gin.Context) {
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	listing, err := h.listings.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Объявление не найдено")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить объявление")
		return
	}
	if listing.Status == "archived" {
		respondError(c, http.StatusConflict, "CONFLICT", "Объявление уже удалено")
		return
	}

	if err := h.listings.SetStatus(c.Request.Context(), id, "archived"); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось удалить объявление")
		return
	}

	c.Status(http.StatusNoContent)
}
