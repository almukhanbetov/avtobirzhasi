package repository

import (
	"context"
	"errors"
	"fmt"

	"avtobirzhasi/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

// ErrNotFound is returned by repository lookups that find no matching row.
var ErrNotFound = errors.New("not found")

// UserRepository provides SQL access to the users table.
type UserRepository struct {
	*Repository
}

// NewUserRepository creates a UserRepository bound to the given Repository.
func NewUserRepository(r *Repository) *UserRepository {
	return &UserRepository{Repository: r}
}

// Create inserts a new user. u.Name, u.Phone and u.PasswordHash must be set;
// the generated id and defaulted columns are scanned back into u. Role is
// never taken from the caller here — it always comes back as the column's
// 'user' default, so nothing can register itself as an admin.
func (r *UserRepository) Create(ctx context.Context, u *models.User) error {
	const query = `
		INSERT INTO users (name, phone, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, account_type, role, rating, reviews_count, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query, u.Name, u.Phone, u.PasswordHash).Scan(
		&u.ID, &u.AccountType, &u.Role, &u.Rating, &u.ReviewsCount, &u.CreatedAt, &u.UpdatedAt,
	)
}

// FindByPhone looks up a user by their normalized (+7XXXXXXXXXX) phone
// number. Returns ErrNotFound if no such user exists.
func (r *UserRepository) FindByPhone(ctx context.Context, phone string) (*models.User, error) {
	const query = `
		SELECT id, name, phone, password_hash, email, region, account_type, role, rating, reviews_count, created_at, updated_at
		FROM users WHERE phone = $1
	`
	return r.scanUser(r.db.QueryRow(ctx, query, phone))
}

// FindByID looks up a user by id. Returns ErrNotFound if no such user exists.
func (r *UserRepository) FindByID(ctx context.Context, id string) (*models.User, error) {
	const query = `
		SELECT id, name, phone, password_hash, email, region, account_type, role, rating, reviews_count, created_at, updated_at
		FROM users WHERE id = $1
	`
	return r.scanUser(r.db.QueryRow(ctx, query, id))
}

// ListAll returns every user, optionally filtered by a case-insensitive
// substring match on name or phone, newest first, plus the total matching
// row count — backs the admin users lookup view (support needing to find
// an account by phone/name; it is deliberately read-only, see
// STAGE10_ADMIN_COMPLETION_REPORT.md for why role-promotion stays a
// manual SQL step rather than a UI action this stage).
func (r *UserRepository) ListAll(ctx context.Context, search string, page, pageSize int) ([]models.User, int, error) {
	where := ""
	args := []any{}
	if search != "" {
		where = "WHERE name ILIKE $1 OR phone ILIKE $1"
		args = append(args, "%"+search+"%")
	}

	var total int
	countQuery := "SELECT count(*) FROM users " + where
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := "SELECT id, name, phone, password_hash, email, region, account_type, role, rating, reviews_count, created_at, updated_at FROM users " +
		where + fmt.Sprintf(" ORDER BY created_at DESC LIMIT $%d OFFSET $%d", len(args)-1, len(args))

	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var out []models.User
	for rows.Next() {
		u, err := r.scanUser(rows)
		if err != nil {
			return nil, 0, err
		}
		out = append(out, *u)
	}
	return out, total, rows.Err()
}

func (r *UserRepository) scanUser(row pgx.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(
		&u.ID, &u.Name, &u.Phone, &u.PasswordHash, &u.Email, &u.Region,
		&u.AccountType, &u.Role, &u.Rating, &u.ReviewsCount, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}
