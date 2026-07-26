package handlers

import (
	"net/http"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// AdminStatsHandler exposes the internal, LocalOnly-protected admin
// dashboard stats endpoint.
type AdminStatsHandler struct {
	admin *repository.AdminRepository
}

// NewAdminStatsHandler creates an AdminStatsHandler.
func NewAdminStatsHandler(admin *repository.AdminRepository) *AdminStatsHandler {
	return &AdminStatsHandler{admin: admin}
}

// RegisterAdminStatsRoutes wires the internal route. Callers must mount
// this under a router group protected by middleware.LocalOnly().
func RegisterAdminStatsRoutes(router *gin.RouterGroup, h *AdminStatsHandler) {
	router.GET("/admin/stats", h.Get)
}

// Get handles GET /internal/admin/stats — site-wide counts for the admin
// dashboard.
func (h *AdminStatsHandler) Get(c *gin.Context) {
	stats, err := h.admin.GetStats(c.Request.Context())
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить статистику")
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"users": stats.Users,
		"listings": gin.H{
			"total":      stats.ListingsTotal,
			"active":     stats.ListingsActive,
			"moderation": stats.ListingsModeration,
			"frozen":     stats.ListingsFrozen,
			"archived":   stats.ListingsArchived,
			"exchange":   stats.ListingsExchange,
		},
		"buyerRequests": gin.H{
			"total":  stats.RequestsTotal,
			"active": stats.RequestsActive,
			"frozen": stats.RequestsFrozen,
		},
		"matches": gin.H{
			"total":           stats.MatchesTotal,
			"awaitingDeposit": stats.MatchesAwaitingDeposit,
			"partiallyPaid":   stats.MatchesPartiallyPaid,
			"confirmed":       stats.MatchesConfirmed,
			"expired":         stats.MatchesExpired,
			"cancelled":       stats.MatchesCancelled,
		},
		"deposits": gin.H{
			"total":    stats.DepositsTotal,
			"pending":  stats.DepositsPending,
			"paid":     stats.DepositsPaid,
			"refunded": stats.DepositsRefunded,
		},
	})
}
