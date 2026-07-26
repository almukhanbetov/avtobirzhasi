package handlers

import (
	"errors"
	"net/http"

	"avtobirzhasi/backend/internal/middleware"
	"avtobirzhasi/backend/internal/repository"

	"github.com/gin-gonic/gin"
)

// NotificationsHandler wires the authenticated /api/notifications routes.
type NotificationsHandler struct {
	notifications *repository.NotificationRepository
}

// NewNotificationsHandler creates a NotificationsHandler.
func NewNotificationsHandler(notifications *repository.NotificationRepository) *NotificationsHandler {
	return &NotificationsHandler{notifications: notifications}
}

// RegisterNotificationsRoutes wires the notification routes, all behind
// the JWT middleware.
func RegisterNotificationsRoutes(router *gin.RouterGroup, h *NotificationsHandler, jwtSecret string) {
	router.GET("/notifications", middleware.Auth(jwtSecret), h.List)
	router.PATCH("/notifications/:id/read", middleware.Auth(jwtSecret), h.MarkRead)
}

// List handles GET /api/notifications — every notification for the
// authenticated user, most recent first.
func (h *NotificationsHandler) List(c *gin.Context) {
	userID, _ := middleware.UserID(c)

	rows, err := h.notifications.ListForUser(c.Request.Context(), userID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось загрузить уведомления")
		return
	}

	out := make([]notificationResponse, len(rows))
	for i, n := range rows {
		out[i] = toNotificationResponse(n)
	}
	c.JSON(http.StatusOK, out)
}

// MarkRead handles PATCH /api/notifications/:id/read (owner only).
func (h *NotificationsHandler) MarkRead(c *gin.Context) {
	userID, _ := middleware.UserID(c)
	id := c.Param("id")

	n, err := h.notifications.GetByID(c.Request.Context(), id)
	if errors.Is(err, repository.ErrNotFound) {
		respondError(c, http.StatusNotFound, "NOT_FOUND", "Уведомление не найдено")
		return
	}
	if err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось обновить уведомление")
		return
	}
	if n.UserID != userID {
		respondError(c, http.StatusForbidden, "FORBIDDEN", "Это не ваше уведомление")
		return
	}

	if err := h.notifications.MarkRead(c.Request.Context(), id); err != nil {
		respondError(c, http.StatusInternalServerError, "INTERNAL_ERROR", "Не удалось обновить уведомление")
		return
	}

	c.Status(http.StatusNoContent)
}
