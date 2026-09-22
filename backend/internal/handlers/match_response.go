package handlers

import (
	"time"

	"avtobirzhasi/backend/internal/repository"
)

// matchResponse mirrors the frontend's MatchDeal type
// (frontend/types/dashboard.ts).
type matchResponse struct {
	ID                string      `json:"id"`
	Car               carResponse `json:"car"`
	FinalPrice        int64       `json:"finalPrice"`
	DepositAmount     int64       `json:"depositAmount"`
	SellerDepositPaid bool        `json:"sellerDepositPaid"`
	BuyerDepositPaid  bool        `json:"buyerDepositPaid"`
	Deadline          string      `json:"deadline"`
	Status            string      `json:"status"`
	Role              string      `json:"role"`
}

// counterpartResponse is the other party to a Match.
//
// No phone here, deliberately: once both deposits are confirmed, contact
// happens through the single admin number (frontend's ADMIN_CONTACT,
// lib/contact/adminContact.ts) instead of the counterpart's real number —
// the real number stays in PostgreSQL for internal business use only and
// is never handed to the other party. See MatchesHandler.Get's doc
// comment for the (unchanged) confirmed-status gate this struct sits
// behind — that gate is what decides whether the UI shows the admin
// contact at all, even though the number itself no longer varies.
type counterpartResponse struct {
	Name string `json:"name"`
}

// matchDetailResponse is the payload for GET /api/matches/:id — everything
// in matchResponse, plus the counterpart contact (phone gated on confirmed
// status).
type matchDetailResponse struct {
	matchResponse
	Counterpart counterpartResponse `json:"counterpart"`
}

func toMatchResponse(m repository.MatchRow, car carResponse, role string) matchResponse {
	return matchResponse{
		ID:                m.ID,
		Car:               car,
		FinalPrice:        m.FinalPrice,
		DepositAmount:     m.DepositAmount,
		SellerDepositPaid: m.SellerDepositPaid,
		BuyerDepositPaid:  m.BuyerDepositPaid,
		Deadline:          m.Deadline.Format(time.RFC3339),
		Status:            m.Status,
		Role:              role,
	}
}
