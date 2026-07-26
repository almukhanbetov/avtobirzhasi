package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// FavoritesHandler wires the authenticated /api/favorites routes.
type FavoritesHandler struct {
	favorites *repository.FavoriteRepository
	listings  *repository.ListingRepository
}

// NewFavoritesHandler creates a FavoritesHandler.
func NewFavoritesHandler(favorites *repository.FavoriteRepository, listings *repository.ListingRepository) *FavoritesHandler {
	return &FavoritesHandler{favorites: favorites, listings: listings}
}

// RegisterFavoritesRoutes wires the favorites routes, all behind the JWT
// middleware.
func RegisterFavoritesRoutes(router *gin.RouterGroup, h *FavoritesHandler, jwtSecret string) {
	router.GET("/favorites", middleware.Auth(jwtSecret), h.List)
	router.POST("/favorites/:listingId", middleware.Auth(jwtSecret), h.Add)
	router.DELETE("/favorites/:listingId", middleware.Auth(jwtSecret), h.Remove)
}

// List handles GET /api/favorites — the cars the current user has
// favorited.
func (h *FavoritesHandler) List(c *gin.Context) {
	userID, _ := middleware.UserID(c)

	items, err := h.favorites.ListCars(c.Request.Context(), userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить избранное")
		return
	}

	c.JSON(http.StatusOK, toCarResponses(items))
}

// Add handles POST /api/favorites/:listingId.
func (h *FavoritesHandler) Add(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	listingID := c.Param("listingId")

	if _, err := h.listings.GetByID(c.Request.Context(), listingID); err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			respondError(c, http.StatusNotFound, "NOT_FOUND", "Автомобиль не найден")
			return
		}
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось добавить в избранное")
		return
	}

	if err := h.favorites.Add(c.Request.Context(), userID, listingID); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось добавить в избранное")
		return
	}

	c.Status(http.StatusNoContent)
}

// Remove handles DELETE /api/favorites/:listingId.
func (h *FavoritesHandler) Remove(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	listingID := c.Param("listingId")

	if err := h.favorites.Remove(c.Request.Context(), userID, listingID); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось удалить из избранного")
		return
	}

	c.Status(http.StatusNoContent)
}
