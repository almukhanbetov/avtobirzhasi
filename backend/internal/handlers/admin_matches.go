package handlers

import (
	"net/http"
	"time"

	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// AdminMatchesHandler exposes the admin-wide matches monitoring view —
// read-only, every match regardless of party. Mounted behind
// middleware.Auth() + middleware.AdminOnly() under /api/admin.
type AdminMatchesHandler struct {
	matches *repository.MatchRepository
}

// NewAdminMatchesHandler creates an AdminMatchesHandler.
func NewAdminMatchesHandler(matches *repository.MatchRepository) *AdminMatchesHandler {
	return &AdminMatchesHandler{matches: matches}
}

// RegisterAdminMatchesRoutes wires the route. Callers must mount this
// under a router group protected by middleware.Auth() and
// middleware.AdminOnly().
func RegisterAdminMatchesRoutes(router *gin.RouterGroup, h *AdminMatchesHandler) {
	router.GET("/matches", h.List)
}

// adminMatchResponse is a thin, id-based view of a match — enough for an
// operator to locate and cross-reference a specific deal during support,
// without the extra listing/buyer-request joins the per-user
// matchResponse needs for its "role"/car display.
type adminMatchResponse struct {
	ID                string `json:"id"`
	ListingID         string `json:"listingId"`
	BuyerRequestID    string `json:"buyerRequestId"`
	SellerUserID      string `json:"sellerUserId"`
	BuyerUserID       string `json:"buyerUserId"`
	FinalPrice        int64  `json:"finalPrice"`
	DepositAmount     int64  `json:"depositAmount"`
	SellerDepositPaid bool   `json:"sellerDepositPaid"`
	BuyerDepositPaid  bool   `json:"buyerDepositPaid"`
	Status            string `json:"status"`
	Deadline          string `json:"deadline"`
	CreatedAt         string `json:"createdAt"`
}

func toAdminMatchResponse(m repository.MatchRow) adminMatchResponse {
	return adminMatchResponse{
		ID:                m.ID,
		ListingID:         m.ListingID,
		BuyerRequestID:    m.BuyerRequestID,
		SellerUserID:      m.SellerUserID,
		BuyerUserID:       m.BuyerUserID,
		FinalPrice:        m.FinalPrice,
		DepositAmount:     m.DepositAmount,
		SellerDepositPaid: m.SellerDepositPaid,
		BuyerDepositPaid:  m.BuyerDepositPaid,
		Status:            m.Status,
		Deadline:          m.Deadline.Format(time.RFC3339),
		CreatedAt:         m.CreatedAt.Format(time.RFC3339),
	}
}

// List handles GET /api/admin/matches?status=&page= — every match
// regardless of party, optionally filtered by status, newest first.
func (h *AdminMatchesHandler) List(c *gin.Context) {
	page := parsePage(c)
	items, total, err := h.matches.ListAll(c.Request.Context(), c.Query("status"), page, adminPageSize)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить сделки")
		return
	}

	out := make([]adminMatchResponse, len(items))
	for i, m := range items {
		out[i] = toAdminMatchResponse(m)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":      out,
		"total":      total,
		"totalPages": totalPages(total, adminPageSize),
		"page":       page,
	})
}
