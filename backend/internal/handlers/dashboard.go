package handlers

import (
	"fmt"
	"net/http"
	"time"

	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/models"
	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// DashboardHandler wires GET /api/dashboard/overview.
type DashboardHandler struct {
	listings      *repository.ListingRepository
	buyerRequests *repository.BuyerRequestRepository
	matches       *repository.MatchRepository
	favorites     *repository.FavoriteRepository
	notifications *repository.NotificationRepository
}

// NewDashboardHandler creates a DashboardHandler.
func NewDashboardHandler(
	listings *repository.ListingRepository,
	buyerRequests *repository.BuyerRequestRepository,
	matches *repository.MatchRepository,
	favorites *repository.FavoriteRepository,
	notifications *repository.NotificationRepository,
) *DashboardHandler {
	return &DashboardHandler{
		listings:      listings,
		buyerRequests: buyerRequests,
		matches:       matches,
		favorites:     favorites,
		notifications: notifications,
	}
}

// RegisterDashboardRoutes wires the dashboard overview route, behind the
// JWT middleware.
func RegisterDashboardRoutes(router *gin.RouterGroup, h *DashboardHandler, jwtSecret string) {
	router.GET("/dashboard/overview", middleware.Auth(jwtSecret), h.Overview)
}

// dashboardTask is one entry of the "Требуют внимания" list. Only the
// fields relevant to its Type are populated — see SKILL.md's Dashboard
// overview section for the three shapes (deposit_required, moderation,
// notification).
type dashboardTask struct {
	Type           string  `json:"type"`
	Message        string  `json:"message"`
	MatchID        *string `json:"matchId,omitempty"`
	Deadline       *string `json:"deadline,omitempty"`
	ListingID      *string `json:"listingId,omitempty"`
	NotificationID *string `json:"notificationId,omitempty"`
}

type dashboardOverviewResponse struct {
	ActiveListings int             `json:"activeListings"`
	BuyerRequests  int             `json:"buyerRequests"`
	ActiveMatches  int             `json:"activeMatches"`
	Favorites      int             `json:"favorites"`
	Tasks          []dashboardTask `json:"tasks"`
}

// Overview handles GET /api/dashboard/overview — the summary counts and
// task list that app/dashboard/page.tsx used to derive client-side from
// mock arrays; moved server-side per SKILL.md so the frontend just renders
// what it's given.
func (h *DashboardHandler) Overview(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	ctx := c.Request.Context()

	listings, err := h.listings.ListByUser(ctx, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить обзор")
		return
	}
	requests, err := h.buyerRequests.ListByUser(ctx, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить обзор")
		return
	}
	matchRows, err := h.matches.ListForUser(ctx, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить обзор")
		return
	}
	favorites, err := h.favorites.ListCars(ctx, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить обзор")
		return
	}
	notifications, err := h.notifications.ListForUser(ctx, userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить обзор")
		return
	}

	activeListings := 0
	var moderationListing *models.Listing
	for i := range listings {
		l := &listings[i]
		if l.Status != "archived" {
			activeListings++
		}
		if l.Status == "moderation" && moderationListing == nil {
			moderationListing = l
		}
	}

	// depositMatch is the non-terminal match, among those still waiting on
	// this user's own deposit, with the soonest deadline — the most urgent
	// one to surface as a task.
	activeMatches := 0
	var depositMatch *repository.MatchRow
	for i := range matchRows {
		m := &matchRows[i]
		if m.Status == "expired" || m.Status == "cancelled" {
			continue
		}
		activeMatches++

		role := roleFor(*m, userID)
		needsMyDeposit := (role == "seller" && !m.SellerDepositPaid) || (role == "buyer" && !m.BuyerDepositPaid)
		if needsMyDeposit && (depositMatch == nil || m.Deadline.Before(depositMatch.Deadline)) {
			depositMatch = m
		}
	}

	// notifications is already ordered most-recent-first, so the first
	// unread one found is "the latest unread".
	var latestUnread *repository.NotificationRow
	for i := range notifications {
		if !notifications[i].Read {
			latestUnread = &notifications[i]
			break
		}
	}

	tasks := make([]dashboardTask, 0, 3)
	if depositMatch != nil {
		depositListing, err := h.listings.GetByID(ctx, depositMatch.ListingID)
		if err != nil {
			respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить обзор")
			return
		}
		matchID := depositMatch.ID
		deadline := depositMatch.Deadline.Format(time.RFC3339)
		tasks = append(tasks, dashboardTask{
			Type:     "deposit_required",
			Message:  fmt.Sprintf("Нужно внести депозит — %s %s", depositListing.Make, depositListing.Model),
			MatchID:  &matchID,
			Deadline: &deadline,
		})
	}
	if moderationListing != nil {
		listingID := moderationListing.ID
		tasks = append(tasks, dashboardTask{
			Type:      "moderation",
			Message:   fmt.Sprintf("%s %s проверяется — обычно это занимает до одного дня", moderationListing.Make, moderationListing.Model),
			ListingID: &listingID,
		})
	}
	if latestUnread != nil {
		notificationID := latestUnread.ID
		tasks = append(tasks, dashboardTask{
			Type:           "notification",
			Message:        latestUnread.Message,
			NotificationID: &notificationID,
		})
	}

	c.JSON(http.StatusOK, dashboardOverviewResponse{
		ActiveListings: activeListings,
		BuyerRequests:  len(requests),
		ActiveMatches:  activeMatches,
		Favorites:      len(favorites),
		Tasks:          tasks,
	})
}
