package handlers

import "avtobirzhasi/backend/internal/models"

// sellerResponse mirrors the frontend's Seller type
// (frontend/lib/mock/sellers.ts) — a user viewed from the "who's selling
// this car" side. Phone is intentionally included here: non-exchange
// listings are plain classifieds where the seller wants to be called
// directly, unlike Auto Exchange Match contacts (see
// MatchesHandler.Get's doc comment for that separate, deposit-gated rule).
type sellerResponse struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Type           string  `json:"type"`
	Since          string  `json:"since"`
	Rating         float64 `json:"rating"`
	ReviewsCount   int     `json:"reviewsCount"`
	ActiveListings int     `json:"activeListings"`
	Phone          string  `json:"phone"`
}

func toSellerResponse(u *models.User, activeListings int) sellerResponse {
	return sellerResponse{
		ID:             u.ID,
		Name:           u.Name,
		Type:           u.AccountType,
		Since:          formatSince(u.CreatedAt),
		Rating:         u.Rating,
		ReviewsCount:   u.ReviewsCount,
		ActiveListings: activeListings,
		Phone:          u.Phone,
	}
}
