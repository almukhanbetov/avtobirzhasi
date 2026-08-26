package repository

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
)

// MatchRepository provides SQL access to the matches table, joined with
// listings and buyer_requests to resolve each side's owning user — needed
// for role assignment and ownership checks without a second round trip.
type MatchRepository struct {
	*Repository
}

// NewMatchRepository creates a MatchRepository bound to the given
// Repository.
func NewMatchRepository(r *Repository) *MatchRepository {
	return &MatchRepository{Repository: r}
}

// MatchRow is a matches row plus the seller's and buyer's user ids.
type MatchRow struct {
	ID                string
	ListingID         string
	BuyerRequestID    string
	FinalPrice        int64
	DepositAmount     int64
	SellerDepositPaid bool
	BuyerDepositPaid  bool
	Status            string
	Deadline          time.Time
	CreatedAt         time.Time
	UpdatedAt         time.Time
	SellerUserID      string
	BuyerUserID       string
}

const matchColumns = `
	m.id, m.listing_id, m.buyer_request_id, m.final_price, m.deposit_amount,
	m.seller_deposit_paid, m.buyer_deposit_paid, m.status, m.deadline,
	m.created_at, m.updated_at, l.user_id, br.user_id`

func scanMatch(row scannable) (MatchRow, error) {
	var m MatchRow
	err := row.Scan(
		&m.ID, &m.ListingID, &m.BuyerRequestID, &m.FinalPrice, &m.DepositAmount,
		&m.SellerDepositPaid, &m.BuyerDepositPaid, &m.Status, &m.Deadline,
		&m.CreatedAt, &m.UpdatedAt, &m.SellerUserID, &m.BuyerUserID,
	)
	return m, err
}

// ListForUser returns every match where the user owns either the listing
// (seller side) or the buyer_request (buyer side), most recently created
// first.
func (r *MatchRepository) ListForUser(ctx context.Context, userID string) ([]MatchRow, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM matches m
		JOIN listings l ON l.id = m.listing_id
		JOIN buyer_requests br ON br.id = m.buyer_request_id
		WHERE l.user_id = $1 OR br.user_id = $1
		ORDER BY m.created_at DESC
	`, matchColumns)

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []MatchRow
	for rows.Next() {
		m, err := scanMatch(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// ListAll returns every match regardless of party, optionally filtered by
// status, newest first, plus the total matching row count — backs the
// admin matches monitoring view.
func (r *MatchRepository) ListAll(ctx context.Context, status string, page, pageSize int) ([]MatchRow, int, error) {
	where := ""
	args := []any{}
	if status != "" {
		where = "WHERE m.status = $1"
		args = append(args, status)
	}

	var total int
	countQuery := fmt.Sprintf("SELECT count(*) FROM matches m %s", where)
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(`
		SELECT %s
		FROM matches m
		JOIN listings l ON l.id = m.listing_id
		JOIN buyer_requests br ON br.id = m.buyer_request_id
		%s
		ORDER BY m.created_at DESC
		LIMIT $%d OFFSET $%d
	`, matchColumns, where, len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []MatchRow
	for rows.Next() {
		m, err := scanMatch(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, m)
	}
	return out, total, rows.Err()
}

// GetByID looks up a single match by id. Returns ErrNotFound if no such
// match exists.
func (r *MatchRepository) GetByID(ctx context.Context, id string) (MatchRow, error) {
	query := fmt.Sprintf(`
		SELECT %s
		FROM matches m
		JOIN listings l ON l.id = m.listing_id
		JOIN buyer_requests br ON br.id = m.buyer_request_id
		WHERE m.id = $1
	`, matchColumns)

	m, err := scanMatch(r.db.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return MatchRow{}, ErrNotFound
	}
	if err != nil {
		return MatchRow{}, err
	}
	return m, nil
}
