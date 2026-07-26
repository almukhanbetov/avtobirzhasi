package handlers

import (
	"time"

	"avtobirzhasi/backend/internal/repository"
)

// notificationResponse mirrors the frontend's Notification type
// (frontend/types/dashboard.ts).
type notificationResponse struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Message string `json:"message"`
	Date    string `json:"date"`
	Read    bool   `json:"read"`
}

func toNotificationResponse(n repository.NotificationRow) notificationResponse {
	return notificationResponse{
		ID:      n.ID,
		Type:    n.Type,
		Message: n.Message,
		Date:    n.CreatedAt.Format(time.RFC3339),
		Read:    n.Read,
	}
}
