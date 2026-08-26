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
	router.GET("/deposits/:id/status", middleware.Auth(jwtSecret), h.Status)
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

// Pay handles POST /api/deposits/:id/pay (owner of that deposit only) —
// starts a payment session through DepositService's configured
// PaymentProvider. When the provider resolves synchronously
// (MockPaymentProvider, so no real money moves), the response already
// carries the final id/status/matchStatus, exactly like before this
// stage. When a real provider is configured, the response instead carries
// redirectUrl — the frontend must send the browser there and poll
// GET /api/deposits/:id/status afterwards; nothing is marked paid here.
// See service.DepositService.InitiatePay/ConfirmWebhook.
func (h *DepositsHandler) Pay(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	result, err := h.pay.InitiatePay(c.Request.Context(), id, userID)
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
	case result.RedirectURL != "":
		c.JSON(http.StatusOK, gin.H{"redirectUrl": result.RedirectURL})
	default:
		c.JSON(http.StatusOK, gin.H{
			"id":          result.DepositID,
			"status":      result.Status,
			"matchStatus": result.MatchStatus,
		})
	}
}

// Status handles GET /api/deposits/:id/status (owner of that deposit
// only) — the frontend polls this after being redirected back from a
// hosted payment page, since a browser return alone never means the
// payment succeeded. See service.DepositService.CheckStatus.
func (h *DepositsHandler) Status(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id, ok := requireUUIDParam(c, "id")
	if !ok {
		return
	}

	result, err := h.pay.CheckStatus(c.Request.Context(), id, userID)
	switch {
	case errors.Is(err, service.ErrDepositNotFound):
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Депозит не найден")
	case errors.Is(err, service.ErrDepositForbidden):
		respondError(c, http.StatusForbidden, "FORBIDDEN", "Это не ваш депозит")
	case err != nil:
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось проверить статус депозита")
	default:
		c.JSON(http.StatusOK, gin.H{
			"id":          result.DepositID,
			"status":      result.Status,
			"matchStatus": result.MatchStatus,
		})
	}
}
