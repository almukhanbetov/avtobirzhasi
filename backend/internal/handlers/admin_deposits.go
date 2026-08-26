package handlers

import (
	"net/http"
	"time"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// AdminDepositsHandler exposes the admin-wide deposits monitoring view —
// read-only, every deposit regardless of owner. Mounted behind
// middleware.Auth() + middleware.AdminOnly() under /api/admin.
type AdminDepositsHandler struct {
	deposits *repository.DepositRepository
}

// NewAdminDepositsHandler creates an AdminDepositsHandler.
func NewAdminDepositsHandler(deposits *repository.DepositRepository) *AdminDepositsHandler {
	return &AdminDepositsHandler{deposits: deposits}
}

// RegisterAdminDepositsRoutes wires the route. Callers must mount this
// under a router group protected by middleware.Auth() and
// middleware.AdminOnly().
func RegisterAdminDepositsRoutes(router *gin.RouterGroup, h *AdminDepositsHandler) {
	router.GET("/deposits", h.List)
}

// adminDepositResponse is a thin, id-based view of a deposit for the
// admin monitoring table.
type adminDepositResponse struct {
	ID         string  `json:"id"`
	MatchID    string  `json:"matchId"`
	UserID     string  `json:"userId"`
	Role       string  `json:"role"`
	Amount     int64   `json:"amount"`
	Status     string  `json:"status"`
	Provider   string  `json:"provider"`
	CreatedAt  string  `json:"createdAt"`
	PaidAt     *string `json:"paidAt,omitempty"`
	RefundedAt *string `json:"refundedAt,omitempty"`
}

func formatTimePtr(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.Format(time.RFC3339)
	return &s
}

func toAdminDepositResponse(d repository.DepositRow) adminDepositResponse {
	return adminDepositResponse{
		ID:         d.ID,
		MatchID:    d.MatchID,
		UserID:     d.UserID,
		Role:       d.Role,
		Amount:     d.Amount,
		Status:     d.Status,
		Provider:   d.Provider,
		CreatedAt:  d.CreatedAt.Format(time.RFC3339),
		PaidAt:     formatTimePtr(d.PaidAt),
		RefundedAt: formatTimePtr(d.RefundedAt),
	}
}

// List handles GET /api/admin/deposits?status=&page= — every deposit
// regardless of owner, optionally filtered by status, newest first.
func (h *AdminDepositsHandler) List(c *gin.Context) {
	page := parsePage(c)
	items, total, err := h.deposits.ListAll(c.Request.Context(), c.Query("status"), page, adminPageSize)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить депозиты")
		return
	}

	out := make([]adminDepositResponse, len(items))
	for i, d := range items {
		out[i] = toAdminDepositResponse(d)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      out,
		"total":      total,
		"totalPages": totalPages(total, adminPageSize),
		"page":       page,
	})
}
