package repository

import (
	"context"
	"errors"

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
// the generated id and defaulted columns are scanned back into u.
func (r *UserRepository) Create(ctx context.Context, u *models.User) error {
	const query = `
		INSERT INTO users (name, phone, password_hash)
		VALUES ($1, $2, $3)
		RETURNING id, account_type, rating, reviews_count, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query, u.Name, u.Phone, u.PasswordHash).Scan(
		&u.ID, &u.AccountType, &u.Rating, &u.ReviewsCount, &u.CreatedAt, &u.UpdatedAt,
	)
}

// FindByPhone looks up a user by their normalized (+7XXXXXXXXXX) phone
// number. Returns ErrNotFound if no such user exists.
func (r *UserRepository) FindByPhone(ctx context.Context, phone string) (*models.User, error) {
	const query = `
		SELECT id, name, phone, password_hash, email, region, account_type, rating, reviews_count, created_at, updated_at
		FROM users WHERE phone = $1
	`
	return r.scanUser(r.db.QueryRow(ctx, query, phone))
}

// FindByID looks up a user by id. Returns ErrNotFound if no such user exists.
func (r *UserRepository) FindByID(ctx context.Context, id string) (*models.User, error) {
	const query = `
		SELECT id, name, phone, password_hash, email, region, account_type, rating, reviews_count, created_at, updated_at
		FROM users WHERE id = $1
	`
	return r.scanUser(r.db.QueryRow(ctx, query, id))
}

func (r *UserRepository) scanUser(row pgx.Row) (*models.User, error) {
	var u models.User
	err := row.Scan(
		&u.ID, &u.Name, &u.Phone, &u.PasswordHash, &u.Email, &u.Region,
		&u.AccountType, &u.Rating, &u.ReviewsCount, &u.CreatedAt, &u.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &u, nil
}
