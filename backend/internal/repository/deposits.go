package repository

import (
	"context"
	"fmt"
	"time"
)

// DepositRepository provides read access to the deposits table. Writes
// (marking a deposit paid) go through service.DepositService instead, since
// paying a deposit must also recompute the parent match's status and create
// notifications atomically — see that file for why.
type DepositRepository struct {
	*Repository
}

// NewDepositRepository creates a DepositRepository bound to the given
// Repository.
func NewDepositRepository(r *Repository) *DepositRepository {
	return &DepositRepository{Repository: r}
}

// DepositRow is a deposits row.
type DepositRow struct {
	ID                string
	MatchID           string
	UserID            string
	Role              string
	Amount            int64
	Status            string
	Provider          string
	ProviderPaymentID string
	CreatedAt         time.Time
	PaidAt            *time.Time
	RefundedAt        *time.Time
	FailedAt          *time.Time
}

const depositColumns = `id, match_id, user_id, role, amount, status, provider, coalesce(provider_payment_id, ''), created_at, paid_at, refunded_at, failed_at`

// ListForUser returns every deposit ever owed by a user (any status), most
// recently created first.
func (r *DepositRepository) ListForUser(ctx context.Context, userID string) ([]DepositRow, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+depositColumns+`
		FROM deposits
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []DepositRow
	for rows.Next() {
		var d DepositRow
		if err := rows.Scan(
			&d.ID, &d.MatchID, &d.UserID, &d.Role, &d.Amount, &d.Status, &d.Provider, &d.ProviderPaymentID,
			&d.CreatedAt, &d.PaidAt, &d.RefundedAt, &d.FailedAt,
		); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return out, nil
}

// ListAll returns every deposit regardless of owner, optionally filtered
// by status, newest first, plus the total matching row count — backs the
// admin deposits monitoring view.
func (r *DepositRepository) ListAll(ctx context.Context, status string, page, pageSize int) ([]DepositRow, int, error) {
	where := ""
	args := []any{}
	if status != "" {
		where = "WHERE status = $1"
		args = append(args, status)
	}

	var total int
	countQuery := fmt.Sprintf("SELECT count(*) FROM deposits %s", where)
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(
		"SELECT %s FROM deposits %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		depositColumns, where, len(args)-1, len(args),
	)
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []DepositRow
	for rows.Next() {
		var d DepositRow
		if err := rows.Scan(
			&d.ID, &d.MatchID, &d.UserID, &d.Role, &d.Amount, &d.Status, &d.Provider, &d.ProviderPaymentID,
			&d.CreatedAt, &d.PaidAt, &d.RefundedAt, &d.FailedAt,
		); err != nil {
			return nil, 0, err
		}
		out = append(out, d)
	}
	return out, total, rows.Err()
}
