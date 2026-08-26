package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"avtobirzhasi/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

// BuyerRequestRepository provides SQL access to the buyer_requests table.
type BuyerRequestRepository struct {
	*Repository
}

// NewBuyerRequestRepository creates a BuyerRequestRepository bound to the
// given Repository.
func NewBuyerRequestRepository(r *Repository) *BuyerRequestRepository {
	return &BuyerRequestRepository{Repository: r}
}

const buyerRequestColumns = `
	id, user_id, make, model, year_from, year_to, region, initial_offer,
	current_offer, status, created_at, updated_at`

func scanBuyerRequest(row scannable) (models.BuyerRequest, error) {
	var b models.BuyerRequest
	err := row.Scan(
		&b.ID, &b.UserID, &b.Make, &b.Model, &b.YearFrom, &b.YearTo, &b.Region,
		&b.InitialOffer, &b.CurrentOffer, &b.Status, &b.CreatedAt, &b.UpdatedAt,
	)
	return b, err
}

// Create inserts a new buyer request with current_offer starting equal to
// the initial offer. The generated id and defaulted columns are scanned
// back into b.
func (r *BuyerRequestRepository) Create(ctx context.Context, b *models.BuyerRequest) error {
	const query = `
		INSERT INTO buyer_requests (user_id, make, model, year_from, year_to, region, initial_offer, current_offer)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
		RETURNING id, current_offer, status, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		b.UserID, b.Make, b.Model, b.YearFrom, b.YearTo, b.Region, b.InitialOffer,
	).Scan(&b.ID, &b.CurrentOffer, &b.Status, &b.CreatedAt, &b.UpdatedAt)
}

// GetByID loads a single buyer request.
func (r *BuyerRequestRepository) GetByID(ctx context.Context, id string) (*models.BuyerRequest, error) {
	query := fmt.Sprintf("SELECT %s FROM buyer_requests WHERE id = $1", buyerRequestColumns)
	b, err := scanBuyerRequest(r.db.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// ListByUser returns all of a user's buyer requests, for the "Заявки на
// покупку" dashboard page.
func (r *BuyerRequestRepository) ListByUser(ctx context.Context, userID string) ([]models.BuyerRequest, error) {
	query := fmt.Sprintf("SELECT %s FROM buyer_requests WHERE user_id = $1 ORDER BY created_at DESC", buyerRequestColumns)
	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.BuyerRequest
	for rows.Next() {
		b, err := scanBuyerRequest(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

// ListAll returns every buyer request regardless of owner, optionally
// filtered by status, newest first — backs the admin requests view.
// Unlike ListByUser, this crosses ownership boundaries, so callers must
// only ever be admin-gated handlers.
func (r *BuyerRequestRepository) ListAll(ctx context.Context, status string, page, pageSize int) ([]models.BuyerRequest, int, error) {
	where := ""
	args := []any{}
	if status != "" {
		where = "WHERE status = $1"
		args = append(args, status)
	}

	var total int
	countQuery := fmt.Sprintf("SELECT count(*) FROM buyer_requests %s", where)
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(
		"SELECT %s FROM buyer_requests %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		buyerRequestColumns, where, len(args)-1, len(args),
	)
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []models.BuyerRequest
	for rows.Next() {
		b, err := scanBuyerRequest(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, b)
	}
	return out, total, rows.Err()
}

// SetStatus transitions a buyer request's status (e.g. to "archived" for a
// user-initiated cancel — see ListingRepository.SetStatus, same pattern).
func (r *BuyerRequestRepository) SetStatus(ctx context.Context, id, status string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE buyer_requests SET status = $1, updated_at = now() WHERE id = $2`, status, id)
	return err
}

// Update sets the given columns on a buyer request and bumps updated_at.
// Keys in fields must be literal, handler-controlled column names — see
// ListingRepository.Update's doc comment for why this is safe.
func (r *BuyerRequestRepository) Update(ctx context.Context, id string, fields map[string]any) error {
	if len(fields) == 0 {
		return nil
	}

	sets := make([]string, 0, len(fields)+1)
	args := make([]any, 0, len(fields)+1)
	i := 1
	for col, val := range fields {
		sets = append(sets, fmt.Sprintf("%s = $%d", col, i))
		args = append(args, val)
		i++
	}
	sets = append(sets, "updated_at = now()")
	args = append(args, id)

	query := fmt.Sprintf("UPDATE buyer_requests SET %s WHERE id = $%d", strings.Join(sets, ", "), i)
	_, err := r.db.Exec(ctx, query, args...)
	return err
}
