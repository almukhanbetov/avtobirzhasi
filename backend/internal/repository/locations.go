package repository

import (
	"context"
	"errors"

	"avtobirzhasi/backend/internal/models"

	"github.com/jackc/pgx/v5"
)

// LocationRepository provides read-only SQL access to the regions/cities/
// districts reference tables (backend/migrations/00014_location_reference_tables.sql).
// This data is only ever written by cmd/import-locations — see
// docs/LOCATION_IMPLEMENTATION.md Stage 3/3B — so this repository has no
// write methods.
type LocationRepository struct {
	*Repository
}

// NewLocationRepository creates a LocationRepository bound to the given
// Repository.
func NewLocationRepository(r *Repository) *LocationRepository {
	return &LocationRepository{Repository: r}
}

// ListRegions returns every region (oblast or republican-significance
// city), alphabetically by Russian name.
func (r *LocationRepository) ListRegions(ctx context.Context) ([]models.Region, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, name_ru, name_kz, kind FROM regions ORDER BY name_ru
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.Region
	for rows.Next() {
		var reg models.Region
		if err := rows.Scan(&reg.ID, &reg.NameRU, &reg.NameKZ, &reg.Kind); err != nil {
			return nil, err
		}
		out = append(out, reg)
	}
	return out, rows.Err()
}

// RegionExists reports whether a region id exists, so a handler can 404
// distinctly from "region exists but has no cities".
func (r *LocationRepository) RegionExists(ctx context.Context, id string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM regions WHERE id = $1)`, id).Scan(&exists)
	return exists, err
}

// RegionName returns a region's Russian name. ok is false if the region
// doesn't exist — used to derive the authoritative legacy `region` text
// from a submitted regionId (Stage 5В: never trust client-sent text once
// structured ids are present).
func (r *LocationRepository) RegionName(ctx context.Context, id string) (name string, ok bool, err error) {
	err = r.db.QueryRow(ctx, `SELECT name_ru FROM regions WHERE id = $1`, id).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return name, true, nil
}

// CityName returns a city's Russian name — same purpose as RegionName,
// preferred over it when a cityId is present (the legacy `region` text
// has always held a city name, not an oblast name — see
// docs/LOCATION_IMPLEMENTATION.md Stage 1).
func (r *LocationRepository) CityName(ctx context.Context, id string) (name string, ok bool, err error) {
	err = r.db.QueryRow(ctx, `SELECT name_ru FROM cities WHERE id = $1`, id).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return name, true, nil
}

// CityRegionID returns the region_id a city belongs to. ok is false if
// the city doesn't exist — used by ListingsHandler.Create to validate a
// submitted (regionId, cityId) pair belongs together before saving.
func (r *LocationRepository) CityRegionID(ctx context.Context, cityID string) (regionID string, ok bool, err error) {
	err = r.db.QueryRow(ctx, `SELECT region_id FROM cities WHERE id = $1`, cityID).Scan(&regionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	return regionID, true, nil
}

// DistrictCityID returns the city_id an urban district belongs to. ok is
// false if the district doesn't exist, or exists but is an administrative
// (region-level) district — city_id NULL, never a valid parent for a
// listing's districtId.
func (r *LocationRepository) DistrictCityID(ctx context.Context, districtID string) (cityID string, ok bool, err error) {
	var maybeCityID *string
	err = r.db.QueryRow(ctx, `SELECT city_id FROM districts WHERE id = $1`, districtID).Scan(&maybeCityID)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	if maybeCityID == nil {
		return "", false, nil
	}
	return *maybeCityID, true, nil
}

// ListCitiesByRegion returns only the cities belonging to regionID,
// alphabetically by Russian name. A republican-significance region
// (Astana/Almaty/Shymkent) has exactly one city row — the city itself
// (see cmd/import-locations) — so this never returns a duplicate.
func (r *LocationRepository) ListCitiesByRegion(ctx context.Context, regionID string) ([]models.City, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, region_id, name_ru, name_kz FROM cities WHERE region_id = $1 ORDER BY name_ru
	`, regionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.City
	for rows.Next() {
		var c models.City
		if err := rows.Scan(&c.ID, &c.RegionID, &c.NameRU, &c.NameKZ); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// CityExists reports whether a city id exists, so a handler can 404
// distinctly from "city exists but has no districts".
func (r *LocationRepository) CityExists(ctx context.Context, id string) (bool, error) {
	var exists bool
	err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM cities WHERE id = $1)`, id).Scan(&exists)
	return exists, err
}

// ListDistrictsByCity returns only the urban districts belonging to
// cityID, alphabetically by Russian name. Administrative (oblast-level)
// districts have city_id NULL and are never returned here — see the
// districts_check constraint in migration 00014.
func (r *LocationRepository) ListDistrictsByCity(ctx context.Context, cityID string) ([]models.District, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id, kind, region_id, city_id, name_ru, name_kz
		FROM districts WHERE city_id = $1 ORDER BY name_ru
	`, cityID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []models.District
	for rows.Next() {
		var d models.District
		if err := rows.Scan(&d.ID, &d.Kind, &d.RegionID, &d.CityID, &d.NameRU, &d.NameKZ); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, rows.Err()
}
