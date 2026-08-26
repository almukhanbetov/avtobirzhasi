package repository

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"avtobirzhasi/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

// ListingRepository provides SQL access to the listings table (and its
// listing_images children).
type ListingRepository struct {
	*Repository
}

// NewListingRepository creates a ListingRepository bound to the given
// Repository.
func NewListingRepository(r *Repository) *ListingRepository {
	return &ListingRepository{Repository: r}
}

const listingColumns = `
	id, user_id, make, model, year, price, mileage_km, region, transmission,
	fuel_type, body_type, drivetrain, engine_volume, engine_power, color,
	steering_wheel, description, status, is_exchange, initial_price,
	exchange_started_at, created_at, updated_at`

type scannable interface {
	Scan(dest ...any) error
}

func scanListing(row scannable) (models.Listing, error) {
	var l models.Listing
	err := row.Scan(
		&l.ID, &l.UserID, &l.Make, &l.Model, &l.Year, &l.Price, &l.MileageKm, &l.Region,
		&l.Transmission, &l.FuelType, &l.BodyType, &l.Drivetrain, &l.EngineVolume, &l.EnginePower,
		&l.Color, &l.SteeringWheel, &l.Description, &l.Status, &l.IsExchange, &l.InitialPrice,
		&l.ExchangeStartedAt, &l.CreatedAt, &l.UpdatedAt,
	)
	return l, err
}

// ListingFilters mirrors frontend/features/listings/filterCars.ts's
// CarFilters exactly — field for field.
type ListingFilters struct {
	Region       string
	Make         string
	Model        string
	YearFrom     *int
	YearTo       *int
	PriceFrom    *int64
	PriceTo      *int64
	BodyType     string
	Transmission string
	Drivetrain   string
	FuelType     string
	Sort         string // newest | price-asc | price-desc | year-desc
	Page         int
	PageSize     int
}

// List returns active listings matching f, sorted and paginated, plus the
// total count of matching rows (before pagination) for building the
// frontend's {items, total, totalPages, page} envelope.
func (r *ListingRepository) List(ctx context.Context, f ListingFilters) ([]models.Listing, int, error) {
	where := []string{"status = 'active'"}
	var args []any

	add := func(cond string, val any) {
		args = append(args, val)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}

	if f.Region != "" {
		add("region = $%d", f.Region)
	}
	if f.Make != "" {
		add("make = $%d", f.Make)
	}
	if f.Model != "" {
		add("(make || ' ' || model) ILIKE $%d", "%"+f.Model+"%")
	}
	if f.YearFrom != nil {
		add("year >= $%d", *f.YearFrom)
	}
	if f.YearTo != nil {
		add("year <= $%d", *f.YearTo)
	}
	if f.PriceFrom != nil {
		add("price >= $%d", *f.PriceFrom)
	}
	if f.PriceTo != nil {
		add("price <= $%d", *f.PriceTo)
	}
	if f.BodyType != "" {
		add("body_type = $%d", f.BodyType)
	}
	if f.Transmission != "" {
		add("transmission = $%d", f.Transmission)
	}
	if f.Drivetrain != "" {
		add("drivetrain = $%d", f.Drivetrain)
	}
	if f.FuelType != "" {
		add("fuel_type = $%d", f.FuelType)
	}

	whereClause := strings.Join(where, " AND ")

	orderBy := "created_at DESC"
	switch f.Sort {
	case "price-asc":
		orderBy = "price ASC"
	case "price-desc":
		orderBy = "price DESC"
	case "year-desc":
		orderBy = "year DESC"
	}

	var total int
	countQuery := fmt.Sprintf("SELECT count(*) FROM listings WHERE %s", whereClause)
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("count listings: %w", err)
	}

	pageSize := f.PageSize
	if pageSize <= 0 {
		pageSize = 8
	}
	page := f.Page
	if page <= 0 {
		page = 1
	}
	offset := (page - 1) * pageSize

	listArgs := append(append([]any{}, args...), pageSize, offset)
	listQuery := fmt.Sprintf(`
		SELECT %s FROM listings
		WHERE %s
		ORDER BY %s
		LIMIT $%d OFFSET $%d
	`, listingColumns, whereClause, orderBy, len(listArgs)-1, len(listArgs))

	rows, err := r.db.Query(ctx, listQuery, listArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("list listings: %w", err)
	}
	defer rows.Close()

	var listings []models.Listing
	for rows.Next() {
		l, err := scanListing(rows)
		if err != nil {
			return nil, 0, err
		}
		listings = append(listings, l)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	if err := r.attachImages(ctx, listings); err != nil {
		return nil, 0, err
	}

	return listings, total, nil
}

// GetByID loads a single listing (any status) with its images.
func (r *ListingRepository) GetByID(ctx context.Context, id string) (*models.Listing, error) {
	query := fmt.Sprintf("SELECT %s FROM listings WHERE id = $1", listingColumns)
	l, err := scanListing(r.db.QueryRow(ctx, query, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	images, err := r.imagesFor(ctx, l.ID)
	if err != nil {
		return nil, err
	}
	l.Images = images
	return &l, nil
}

// Similar returns up to limit other active listings sharing the same
// body type or make as l, excluding l itself — mirrors
// components/cars/SimilarCars.tsx.
func (r *ListingRepository) Similar(ctx context.Context, l *models.Listing, limit int) ([]models.Listing, error) {
	query := fmt.Sprintf(`
		SELECT %s FROM listings
		WHERE status = 'active' AND id != $1 AND (body_type = $2 OR make = $3)
		ORDER BY created_at DESC
		LIMIT $4
	`, listingColumns)

	rows, err := r.db.Query(ctx, query, l.ID, l.BodyType, l.Make, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var listings []models.Listing
	for rows.Next() {
		similar, err := scanListing(rows)
		if err != nil {
			return nil, err
		}
		listings = append(listings, similar)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if err := r.attachImages(ctx, listings); err != nil {
		return nil, err
	}
	return listings, nil
}

// Create inserts a new listing. The generated id and defaulted columns are
// scanned back into l.
func (r *ListingRepository) Create(ctx context.Context, l *models.Listing) error {
	const query = `
		INSERT INTO listings (
			user_id, make, model, year, price, mileage_km, region, transmission,
			fuel_type, body_type, drivetrain, engine_volume, engine_power, color,
			steering_wheel, description, status, is_exchange, initial_price, exchange_started_at
		) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
		RETURNING id, created_at, updated_at
	`
	return r.db.QueryRow(ctx, query,
		l.UserID, l.Make, l.Model, l.Year, l.Price, l.MileageKm, l.Region, l.Transmission,
		l.FuelType, l.BodyType, l.Drivetrain, l.EngineVolume, l.EnginePower, l.Color,
		l.SteeringWheel, l.Description, l.Status, l.IsExchange, l.InitialPrice, l.ExchangeStartedAt,
	).Scan(&l.ID, &l.CreatedAt, &l.UpdatedAt)
}

// AddImage appends a gallery image to a listing.
func (r *ListingRepository) AddImage(ctx context.Context, listingID, url string, position int) error {
	_, err := r.db.Exec(ctx,
		`INSERT INTO listing_images (listing_id, url, position) VALUES ($1, $2, $3)`,
		listingID, url, position,
	)
	return err
}

// Update sets the given columns on a listing and bumps updated_at. Keys in
// fields must be literal, handler-controlled column names — never derived
// from raw user input — since they are interpolated directly into the SQL
// text (values remain fully parameterized).
func (r *ListingRepository) Update(ctx context.Context, id string, fields map[string]any) error {
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

	query := fmt.Sprintf("UPDATE listings SET %s WHERE id = $%d", strings.Join(sets, ", "), i)
	_, err := r.db.Exec(ctx, query, args...)
	return err
}

// SetStatus transitions a listing's status (e.g. to "archived" for a soft
// delete).
func (r *ListingRepository) SetStatus(ctx context.Context, id, status string) error {
	_, err := r.db.Exec(ctx,
		`UPDATE listings SET status = $1, updated_at = now() WHERE id = $2`, status, id)
	return err
}

// ListByUser returns all of a user's listings regardless of status, for
// the "Мои объявления" dashboard page.
func (r *ListingRepository) ListByUser(ctx context.Context, userID string) ([]models.Listing, error) {
	query := fmt.Sprintf("SELECT %s FROM listings WHERE user_id = $1 ORDER BY created_at DESC", listingColumns)
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

// ListAll returns every listing regardless of owner, optionally filtered
// by status, newest first — backs the admin listings view. Unlike
// ListByUser, this crosses ownership boundaries, so callers must only
// ever be admin-gated handlers.
func (r *ListingRepository) ListAll(ctx context.Context, status string, page, pageSize int) ([]models.Listing, int, error) {
	where := ""
	args := []any{}
	if status != "" {
		where = "WHERE status = $1"
		args = append(args, status)
	}

	var total int
	countQuery := fmt.Sprintf("SELECT count(*) FROM listings %s", where)
	if err := r.db.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, pageSize, (page-1)*pageSize)
	query := fmt.Sprintf(
		"SELECT %s FROM listings %s ORDER BY created_at DESC LIMIT $%d OFFSET $%d",
		listingColumns, where, len(args)-1, len(args),
	)
	rows, err := r.db.Query(ctx, query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var listings []models.Listing
	for rows.Next() {
		l, err := scanListing(rows)
		if err != nil {
			return nil, 0, err
		}
		listings = append(listings, l)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, err
	}

	if err := r.attachImages(ctx, listings); err != nil {
		return nil, 0, err
	}
	return listings, total, nil
}

// ListPendingModeration returns every listing awaiting moderation, across
// all sellers, oldest first — the admin queue backing
// GET /internal/listings/pending.
func (r *ListingRepository) ListPendingModeration(ctx context.Context) ([]models.Listing, error) {
	query := fmt.Sprintf(
		"SELECT %s FROM listings WHERE status = 'moderation' ORDER BY created_at ASC",
		listingColumns,
	)
	rows, err := r.db.Query(ctx, query)
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

// CountActiveByUser counts a user's listings that are visibly "on the
// market" from a buyer's perspective — active or temporarily frozen by a
// pending Match, but not moderation/archived. Backs the frontend Seller's
// activeListings field (lib/mock/sellers.ts) — see SKILL.md's users
// section for why this isn't a stored column.
func (r *ListingRepository) CountActiveByUser(ctx context.Context, userID string) (int, error) {
	var count int
	err := r.db.QueryRow(ctx,
		`SELECT count(*) FROM listings WHERE user_id = $1 AND status IN ('active', 'frozen')`, userID,
	).Scan(&count)
	return count, err
}

func (r *ListingRepository) imagesFor(ctx context.Context, listingID string) ([]string, error) {
	rows, err := r.db.Query(ctx,
		`SELECT url FROM listing_images WHERE listing_id = $1 ORDER BY position`, listingID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var urls []string
	for rows.Next() {
		var url string
		if err := rows.Scan(&url); err != nil {
			return nil, err
		}
		urls = append(urls, url)
	}
	return urls, rows.Err()
}

// attachImages lives on the base Repository (not ListingRepository) so
// other repositories that join against listings — e.g. FavoriteRepository
// — can reuse it via embedding too.
func (r *Repository) attachImages(ctx context.Context, listings []models.Listing) error {
	if len(listings) == 0 {
		return nil
	}

	ids := make([]string, len(listings))
	index := make(map[string]int, len(listings))
	for i, l := range listings {
		ids[i] = l.ID
		index[l.ID] = i
	}

	rows, err := r.db.Query(ctx,
		`SELECT listing_id, url FROM listing_images WHERE listing_id = ANY($1) ORDER BY listing_id, position`,
		ids,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var listingID, url string
		if err := rows.Scan(&listingID, &url); err != nil {
			return err
		}
		if i, ok := index[listingID]; ok {
			listings[i].Images = append(listings[i].Images, url)
		}
	}
	return rows.Err()
}
