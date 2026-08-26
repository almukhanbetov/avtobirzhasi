package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// MatchesHandler wires the authenticated /api/matches and
// /api/dashboard/matches routes.
type MatchesHandler struct {
	matches  *repository.MatchRepository
	listings *repository.ListingRepository
	users    *repository.UserRepository
}

// NewMatchesHandler creates a MatchesHandler.
func NewMatchesHandler(matches *repository.MatchRepository, listings *repository.ListingRepository, users *repository.UserRepository) *MatchesHandler {
	return &MatchesHandler{matches: matches, listings: listings, users: users}
}

// RegisterMatchesRoutes wires the match-reading routes, all behind the JWT
// middleware.
func RegisterMatchesRoutes(router *gin.RouterGroup, h *MatchesHandler, jwtSecret string) {
	router.GET("/dashboard/matches", middleware.Auth(jwtSecret), h.ListMine)
	router.GET("/matches/:id", middleware.Auth(jwtSecret), h.Get)
}

// ListMine handles GET /api/dashboard/matches — every match the
// authenticated user is a party to, as either seller or buyer.
func (h *MatchesHandler) ListMine(c *gin.Context) {
	userID, _ := middleware.UserID(c)

	rows, err := h.matches.ListForUser(c.Request.Context(), userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить сделки")
		return
	}

	out := make([]matchResponse, 0, len(rows))
	for _, m := range rows {
		listing, err := h.listings.GetByID(c.Request.Context(), m.ListingID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить сделки")
			return
		}
		out = append(out, toMatchResponse(m, toCarResponse(*listing), roleFor(m, userID)))
	}

	c.JSON(http.StatusOK, out)
}

// Get handles GET /api/matches/:id (party to the match only). The
// counterpart's phone number is only ever included once status has been
// re-checked here, server-side, to be "confirmed" — never trust a
// frontend-cached status for this. See SKILL.md's Contact unlock rule.
func (h *MatchesHandler) Get(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	m, err := h.matches.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Сделка не найдена")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить сделку")
		return
	}
	if userID != m.SellerUserID && userID != m.BuyerUserID {
		respondError(c, http.StatusForbidden, "FORBIDDEN", "Это не ваша сделка")
		return
	}

	listing, err := h.listings.GetByID(c.Request.Context(), m.ListingID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить сделку")
		return
	}

	counterpartID := m.BuyerUserID
	if userID == m.BuyerUserID {
		counterpartID = m.SellerUserID
	}
	counterpart, err := h.users.FindByID(c.Request.Context(), counterpartID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить сделку")
		return
	}

	resp := matchDetailResponse{
		matchResponse: toMatchResponse(m, toCarResponse(*listing), roleFor(m, userID)),
		Counterpart:   counterpartResponse{Name: counterpart.Name},
	}
	if m.Status == "confirmed" {
		phone := counterpart.Phone
		resp.Counterpart.Phone = &phone
	}

	c.JSON(http.StatusOK, resp)
}

func roleFor(m repository.MatchRow, userID string) string {
	if userID == m.SellerUserID {
		return "seller"
	}
	return "buyer"
}
