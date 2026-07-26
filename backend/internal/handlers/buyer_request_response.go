package handlers

import (
	"time"

	"avtobirzhasi/backend/internal/models"
)

// buyerRequestResponse mirrors frontend/types/dashboard.ts's BuyerRequest
// type field-for-field.
type buyerRequestResponse struct {
	ID           string `json:"id"`
	Make         string `json:"make"`
	Model        string `json:"model"`
	YearFrom     int    `json:"yearFrom"`
	YearTo       int    `json:"yearTo"`
	Region       string `json:"region"`
	CurrentOffer int64  `json:"currentOffer"`
	Status       string `json:"status"`
	UpdatedAt    string `json:"updatedAt"`
}

func toBuyerRequestResponse(b models.BuyerRequest) buyerRequestResponse {
	return buyerRequestResponse{
		ID:           b.ID,
		Make:         b.Make,
		Model:        b.Model,
		YearFrom:     b.YearFrom,
		YearTo:       b.YearTo,
		Region:       b.Region,
		CurrentOffer: b.CurrentOffer,
		Status:       b.Status,
		UpdatedAt:    b.UpdatedAt.Format(time.RFC3339),
	}
}
