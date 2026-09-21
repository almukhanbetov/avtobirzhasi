package handlers

import "avtobirzhasi/backend/internal/models"

// sellerResponse mirrors the frontend's Seller type
// (frontend/lib/mock/sellers.ts) — a user viewed from the "who's selling
// this car" side.
//
// Stage 9Б-17: no phone here, deliberately, not just "the frontend
// doesn't render it" — this is a public, unauthenticated endpoint
// (RegisterSellersRoutes), and any seller ID is trivially harvestable
// from the equally-public GET /api/cars catalog, so anything included
// here is effectively world-readable. The only place a phone number may
// ever be returned is MatchesHandler.Get, and only once that match's
// status has been re-checked, server-side, to be "confirmed" — see its
// doc comment. This struct must never grow a Phone field again.
type sellerResponse struct {
	ID             string  `json:"id"`
	Name           string  `json:"name"`
	Type           string  `json:"type"`
	Since          string  `json:"since"`
	Rating         float64 `json:"rating"`
	ReviewsCount   int     `json:"reviewsCount"`
	ActiveListings int     `json:"activeListings"`
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
	}
}
