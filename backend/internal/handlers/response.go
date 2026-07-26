package handlers

import (
	"fmt"
	"time"

	"avtobirzhasi/backend/internal/models"

	"github.com/gin-gonic/gin"
)

// respondError writes the standard error envelope described in
// SKILL.md's "Error handling & response shape" section. message must
// already be a human-readable, Russian, non-technical string.
func respondError(c *gin.Context, status int, code, message string) {
	c.JSON(status, gin.H{"error": gin.H{"code": code, "message": message}})
}

// userResponse mirrors the frontend's Seller shape (lib/mock/sellers.ts)
// plus the extra fields the Profile page shows.
type userResponse struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Phone        string  `json:"phone"`
	Email        *string `json:"email,omitempty"`
	Region       *string `json:"region,omitempty"`
	AccountType  string  `json:"accountType"`
	Rating       float64 `json:"rating"`
	ReviewsCount int     `json:"reviewsCount"`
	Since        string  `json:"since"`
}

func toUserResponse(u *models.User) userResponse {
	return userResponse{
		ID:           u.ID,
		Name:         u.Name,
		Phone:        u.Phone,
		Email:        u.Email,
		Region:       u.Region,
		AccountType:  u.AccountType,
		Rating:       u.Rating,
		ReviewsCount: u.ReviewsCount,
		Since:        formatSince(u.CreatedAt),
	}
}

// formatSince renders the frontend's "с {year} года" convention
// (lib/mock/sellers.ts) from the account creation date, so the frontend
// never has to compute it.
func formatSince(t time.Time) string {
	return fmt.Sprintf("с %d года", t.Year())
}
