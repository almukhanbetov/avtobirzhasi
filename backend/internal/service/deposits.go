package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// ErrDepositNotFound is returned when the deposit id doesn't exist.
	ErrDepositNotFound = errors.New("deposit not found")
	// ErrDepositForbidden is returned when the caller doesn't own the deposit.
	ErrDepositForbidden = errors.New("not your deposit")
	// ErrDepositNotPending is returned when the deposit (or its match) has
	// already moved past the point where a mock payment applies.
	ErrDepositNotPending = errors.New("deposit is not payable")
)

// DepositService implements the mock "pay deposit" flow: no real payment
// gateway, just marking a deposit paid, recomputing the parent match's
// derived status, and creating the contact-unlock notifications once both
// sides have paid. Like ExchangeService, it owns its transactions directly
// against the pool, since paying a deposit touches deposits, matches and
// notifications atomically.
type DepositService struct {
	db *pgxpool.Pool
}

// NewDepositService creates a DepositService.
func NewDepositService(db *pgxpool.Pool) *DepositService {
	return &DepositService{db: db}
}

// PaidDeposit is what Pay returns on success.
type PaidDeposit struct {
	ID          string
	MatchID     string
	Status      string
	MatchStatus string
}

// Pay handles one mock deposit payment. The ownership check is re-done here
// under row lock (not just trusted from the handler layer) since this is
// the money-moving operation. Rejects deposits that are already
// paid/refunded, or whose match already reached a terminal state
// (expired/cancelled).
func (s *DepositService) Pay(ctx context.Context, depositID, userID string) (*PaidDeposit, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op once committed

	var deposit struct {
		ID      string
		MatchID string
		UserID  string
		Status  string
	}
	err = tx.QueryRow(ctx,
		`SELECT id, match_id, user_id, status FROM deposits WHERE id = $1 FOR UPDATE`, depositID,
	).Scan(&deposit.ID, &deposit.MatchID, &deposit.UserID, &deposit.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrDepositNotFound
	}
	if err != nil {
		return nil, err
	}
	if deposit.UserID != userID {
		return nil, ErrDepositForbidden
	}
	if deposit.Status != "pending" {
		return nil, ErrDepositNotPending
	}

	var matchStatus, listingID, buyerRequestID string
	err = tx.QueryRow(ctx,
		`SELECT status, listing_id, buyer_request_id FROM matches WHERE id = $1 FOR UPDATE`, deposit.MatchID,
	).Scan(&matchStatus, &listingID, &buyerRequestID)
	if err != nil {
		return nil, err
	}
	if matchStatus == "expired" || matchStatus == "cancelled" {
		return nil, ErrDepositNotPending
	}

	if _, err := tx.Exec(ctx,
		`UPDATE deposits SET status = 'paid', paid_at = now() WHERE id = $1`, depositID,
	); err != nil {
		return nil, err
	}

	var sellerPaid, buyerPaid bool
	if err := tx.QueryRow(ctx, `
		SELECT
			bool_or(role = 'seller' AND status = 'paid'),
			bool_or(role = 'buyer' AND status = 'paid')
		FROM deposits WHERE match_id = $1
	`, deposit.MatchID).Scan(&sellerPaid, &buyerPaid); err != nil {
		return nil, err
	}

	newStatus := deriveMatchStatus(sellerPaid, buyerPaid)
	if _, err := tx.Exec(ctx,
		`UPDATE matches SET seller_deposit_paid = $1, buyer_deposit_paid = $2, status = $3, updated_at = now() WHERE id = $4`,
		sellerPaid, buyerPaid, newStatus, deposit.MatchID,
	); err != nil {
		return nil, err
	}

	var listingUserID, make, model string
	if err := tx.QueryRow(ctx,
		`SELECT user_id, make, model FROM listings WHERE id = $1`, listingID,
	).Scan(&listingUserID, &make, &model); err != nil {
		return nil, err
	}
	var requestUserID string
	if err := tx.QueryRow(ctx,
		`SELECT user_id FROM buyer_requests WHERE id = $1`, buyerRequestID,
	).Scan(&requestUserID); err != nil {
		return nil, err
	}
	carLabel := fmt.Sprintf("%s %s", make, model)

	if _, err := tx.Exec(ctx,
		`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'deposit_received', $2, $3)`,
		deposit.UserID, fmt.Sprintf("Депозит по сделке %s получен и подтверждён.", carLabel), deposit.MatchID,
	); err != nil {
		return nil, err
	}

	if newStatus == "confirmed" {
		contactsMsg := fmt.Sprintf("Контакты по сделке %s открыты — можно связаться со стороной.", carLabel)
		if _, err := tx.Exec(ctx,
			`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'contacts_open', $2, $3)`,
			listingUserID, contactsMsg, deposit.MatchID,
		); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'contacts_open', $2, $3)`,
			requestUserID, contactsMsg, deposit.MatchID,
		); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &PaidDeposit{ID: depositID, MatchID: deposit.MatchID, Status: "paid", MatchStatus: newStatus}, nil
}

// deriveMatchStatus computes a match's status from the two deposit flags —
// see SKILL.md's Matches section. Terminal states (expired/cancelled) are
// never derived; Pay already rejects those matches before reaching here.
func deriveMatchStatus(sellerPaid, buyerPaid bool) string {
	switch {
	case sellerPaid && buyerPaid:
		return "confirmed"
	case sellerPaid:
		return "seller_deposit_paid"
	case buyerPaid:
		return "buyer_deposit_paid"
	default:
		return "awaiting_deposit"
	}
}
