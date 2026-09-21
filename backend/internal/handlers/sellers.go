package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// SellersHandler wires the public GET /api/sellers/:id route.
type SellersHandler struct {
	users    *repository.UserRepository
	listings *repository.ListingRepository
}

// NewSellersHandler creates a SellersHandler.
func NewSellersHandler(users *repository.UserRepository, listings *repository.ListingRepository) *SellersHandler {
	return &SellersHandler{users: users, listings: listings}
}

// RegisterSellersRoutes wires the public seller-profile route.
//
// Stage 9Б-17: deliberately left without middleware.Auth. This is the car
// detail page's "Продавец" card (name/rating/review count/active
// listings), viewed by anonymous catalog browsers on every listing page,
// not just logged-in users — requiring auth here would break normal
// browsing for no security benefit, now that sellerResponse structurally
// has no Phone field to protect (see its doc comment). Authorization
// alone was never the right gate for a phone number anyway: the actual
// contact-reveal rule (deposit-confirmed Match, re-checked server-side
// per request) lives only in MatchesHandler.Get.
func RegisterSellersRoutes(router *gin.RouterGroup, h *SellersHandler) {
	router.GET("/sellers/:id", h.Get)
}

// Get handles GET /api/sellers/:id — the car detail page's "Продавец"
// card.
func (h *SellersHandler) Get(c *gin.Context) {
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}
	user, err := h.users.FindByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Продавец не найден")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить продавца")
		return
	}

	activeListings, err := h.listings.CountActiveByUser(c.Request.Context(), user.ID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить продавца")
		return
	}

	c.JSON(http.StatusOK, toSellerResponse(user, activeListings))
}
