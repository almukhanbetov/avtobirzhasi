package repository

import (
	"context"
	"fmt"

	"avtobirzhasi/backend/internal/models"
)

// FavoriteRepository provides SQL access to the favorites table.
type FavoriteRepository struct {
	*Repository
}

// NewFavoriteRepository creates a FavoriteRepository bound to the given
// Repository.
func NewFavoriteRepository(r *Repository) *FavoriteRepository {
	return &FavoriteRepository{Repository: r}
}

// listingColumns qualified with the "l." alias, for use in the
// favorites JOIN below (the bare listingColumns const would be ambiguous
// here — both tables have id/user_id/created_at).
const favoriteListingColumns = `
	l.id, l.user_id, l.make, l.model, l.year, l.price, l.mileage_km, l.region, l.transmission,
	l.fuel_type, l.body_type, l.drivetrain, l.engine_volume, l.engine_power, l.color,
	l.steering_wheel, l.description, l.status, l.is_exchange, l.initial_price,
	l.exchange_started_at, l.created_at, l.updated_at`

// Add favorites a listing for a user. Idempotent — favoriting an
// already-favorited listing is a no-op, not an error.
func (r *FavoriteRepository) Add(ctx context.Context, userID, listingID string) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO favorites (user_id, listing_id) VALUES ($1, $2)
		ON CONFLICT (user_id, listing_id) DO NOTHING
	`, userID, listingID)
	return err
}

// Remove un-favorites a listing. Idempotent — removing a non-favorited
// listing is a no-op, not an error.
func (r *FavoriteRepository) Remove(ctx context.Context, userID, listingID string) error {
	_, err := r.db.Exec(ctx,
		`DELETE FROM favorites WHERE user_id = $1 AND listing_id = $2`, userID, listingID)
	return err
}

// ListCars returns the full listing details for everything a user has
// favorited, most recently favorited first.
func (r *FavoriteRepository) ListCars(ctx context.Context, userID string) ([]models.Listing, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM listings l
		JOIN favorites f ON f.listing_id = l.id
		WHERE f.user_id = $1
		ORDER BY f.created_at DESC
	`, favoriteListingColumns)

	rows, err := r.db.Query(ctx, query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var listings []models.Listing
	for rows.Next() {
		l, err := scanListing(rows)
		if err != nil {
			return nil, err
		}
		listings = append(listings, l)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := r.attachImages(ctx, listings); err != nil {
		return nil, err
	}
	return listings, nil
}
