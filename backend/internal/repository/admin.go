package repository

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"
)

// AdminRepository runs read-only, cross-user aggregate queries for the
// admin dashboard. Like ExchangeService, it queries the pool directly
// rather than composing several single-resource repositories, since these
// are simple counts across whole tables, not resource CRUD.
type AdminRepository struct {
	db *pgxpool.Pool
}

// NewAdminRepository creates an AdminRepository.
func NewAdminRepository(db *pgxpool.Pool) *AdminRepository {
	return &AdminRepository{db: db}
}

// AdminStats is the full set of site-wide counts backing the admin
// dashboard.
type AdminStats struct {
	Users int

	ListingsTotal      int
	ListingsActive     int
	ListingsModeration int
	ListingsFrozen     int
	ListingsArchived   int
	ListingsExchange   int

	RequestsTotal  int
	RequestsActive int
	RequestsFrozen int

	MatchesTotal           int
	MatchesAwaitingDeposit int
	MatchesPartiallyPaid   int
	MatchesConfirmed       int
	MatchesExpired         int
	MatchesCancelled       int

	DepositsTotal    int
	DepositsPending  int
	DepositsPaid     int
	DepositsRefunded int
}

// GetStats runs one COUNT query per table (using FILTER for the
// status breakdowns) and assembles the result.
func (r *AdminRepository) GetStats(ctx context.Context) (AdminStats, error) {
	var s AdminStats

	if err := r.db.QueryRow(ctx, `SELECT count(*) FROM users`).Scan(&s.Users); err != nil {
		return s, err
	}

	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*),
			count(*) FILTER (WHERE status = 'active'),
			count(*) FILTER (WHERE status = 'moderation'),
			count(*) FILTER (WHERE status = 'frozen'),
			count(*) FILTER (WHERE status = 'archived'),
			count(*) FILTER (WHERE is_exchange)
		FROM listings
	`).Scan(
		&s.ListingsTotal, &s.ListingsActive, &s.ListingsModeration,
		&s.ListingsFrozen, &s.ListingsArchived, &s.ListingsExchange,
	); err != nil {
		return s, err
	}

	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*),
			count(*) FILTER (WHERE status = 'active'),
			count(*) FILTER (WHERE status = 'frozen')
		FROM buyer_requests
	`).Scan(&s.RequestsTotal, &s.RequestsActive, &s.RequestsFrozen); err != nil {
		return s, err
	}

	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*),
			count(*) FILTER (WHERE status = 'awaiting_deposit'),
			count(*) FILTER (WHERE status IN ('seller_deposit_paid', 'buyer_deposit_paid')),
			count(*) FILTER (WHERE status = 'confirmed'),
			count(*) FILTER (WHERE status = 'expired'),
			count(*) FILTER (WHERE status = 'cancelled')
		FROM matches
	`).Scan(
		&s.MatchesTotal, &s.MatchesAwaitingDeposit, &s.MatchesPartiallyPaid,
		&s.MatchesConfirmed, &s.MatchesExpired, &s.MatchesCancelled,
	); err != nil {
		return s, err
	}

	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*),
			count(*) FILTER (WHERE status = 'pending'),
			count(*) FILTER (WHERE status = 'paid'),
			count(*) FILTER (WHERE status = 'refunded')
		FROM deposits
	`).Scan(&s.DepositsTotal, &s.DepositsPending, &s.DepositsPaid, &s.DepositsRefunded); err != nil {
		return s, err
	}

	return s, nil
}
