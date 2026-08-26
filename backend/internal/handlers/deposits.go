package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/repository"
	"avtobirzhasi/backend/internal/service"

	"github.com/gin-gonic/gin"
)

// DepositsHandler wires the authenticated /api/deposits/:id/pay and
// /api/dashboard/deposits routes.
type DepositsHandler struct {
	deposits *repository.DepositRepository
	matches  *repository.MatchRepository
	listings *repository.ListingRepository
	pay      *service.DepositService
}

// NewDepositsHandler creates a DepositsHandler.
func NewDepositsHandler(
	deposits *repository.DepositRepository,
	matches *repository.MatchRepository,
	listings *repository.ListingRepository,
	pay *service.DepositService,
) *DepositsHandler {
	return &DepositsHandler{deposits: deposits, matches: matches, listings: listings, pay: pay}
}

// RegisterDepositsRoutes wires the deposit routes, all behind the JWT
// middleware.
func RegisterDepositsRoutes(router *gin.RouterGroup, h *DepositsHandler, jwtSecret string) {
	router.GET("/dashboard/deposits", middleware.Auth(jwtSecret), h.ListMine)
	router.POST("/deposits/:id/pay", middleware.Auth(jwtSecret), h.Pay)
}

// ListMine handles GET /api/dashboard/deposits — every deposit ever owed by
// the authenticated user, any status.
func (h *DepositsHandler) ListMine(c *gin.Context) {
	userID, _ := middleware.UserID(c)

	rows, err := h.deposits.ListForUser(c.Request.Context(), userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить депозиты")
		return
	}

	out := make([]depositResponse, 0, len(rows))
	for _, d := range rows {
		m, err := h.matches.GetByID(c.Request.Context(), d.MatchID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить депозиты")
			return
		}
		listing, err := h.listings.GetByID(c.Request.Context(), m.ListingID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить депозиты")
			return
		}
		out = append(out, toDepositResponse(d, *listing))
	}

	c.JSON(http.StatusOK, out)
}

// Pay handles POST /api/deposits/:id/pay (owner of that deposit only).
// Charges through DepositService's configured PaymentProvider — today,
// always MockPaymentProvider, so no real money moves yet (see
// service/payment.go). See service.DepositService.Pay for the
// derived-status and notification logic.
func (h *DepositsHandler) Pay(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	result, err := h.pay.Pay(c.Request.Context(), id, userID)
	switch {
	case errors.Is(err, service.ErrDepositNotFound):
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Депозит не найден")
	case errors.Is(err, service.ErrDepositForbidden):
		respondError(c, http.StatusForbidden, "FORBIDDEN", "Это не ваш депозит")
	case errors.Is(err, service.ErrDepositNotPending):
		respondError(c, http.StatusConflict, "CONFLICT", "Депозит уже обработан или сделка закрыта")
	case errors.Is(err, service.ErrPaymentFailed):
		respondError(c, http.StatusBadGateway, "PAYMENT_FAILED", "Платёж не прошёл, попробуйте ещё раз")
	case err != nil:
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось внести депозит")
	default:
		c.JSON(http.StatusOK, gin.H{
			"id":          result.ID,
			"status":      result.Status,
			"matchStatus": result.MatchStatus,
		})
	}
}
