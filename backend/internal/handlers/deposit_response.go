package handlers

import (
	"avtobirzhasi/backend/internal/models"
	"avtobirzhasi/backend/internal/repository"
)

// depositResponse mirrors the frontend's Deposit type
// (frontend/types/dashboard.ts).
type depositResponse struct {
	ID      string      `json:"id"`
	MatchID string      `json:"matchId"`
	Car     carResponse `json:"car"`
	Amount  int64       `json:"amount"`
	Status  string      `json:"status"`
	Date    string      `json:"date"`
}

// toDepositResponse picks the date matching the mock convention
// (lib/mock/dashboard.ts): the moment the deposit last changed state —
// paid_at once paid, refunded_at once refunded, created_at while pending.
func toDepositResponse(d repository.DepositRow, listing models.Listing) depositResponse {
	date := d.CreatedAt
	switch {
	case d.Status == "paid" && d.PaidAt != nil:
		date = *d.PaidAt
	case d.Status == "refunded" && d.RefundedAt != nil:
		date = *d.RefundedAt
	}

	return depositResponse{
		ID:      d.ID,
		MatchID: d.MatchID,
		Car:     toCarResponse(listing),
		Amount:  d.Amount,
		Status:  d.Status,
		Date:    date.Format("2006-01-02"),
	}
}
