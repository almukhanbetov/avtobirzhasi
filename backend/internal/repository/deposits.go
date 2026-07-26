package repository

import (
	"context"
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
	ID         string
	MatchID    string
	UserID     string
	Role       string
	Amount     int64
	Status     string
	CreatedAt  time.Time
	PaidAt     *time.Time
	RefundedAt *time.Time
}

const depositColumns = `id, match_id, user_id, role, amount, status, created_at, paid_at, refunded_at`

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
			&d.ID, &d.MatchID, &d.UserID, &d.Role, &d.Amount, &d.Status,
			&d.CreatedAt, &d.PaidAt, &d.RefundedAt,
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
