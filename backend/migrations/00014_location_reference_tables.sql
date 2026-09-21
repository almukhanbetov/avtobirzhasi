-- +goose Up

-- Stage 2 of the Kazakhstan location rollout (see
-- docs/LOCATION_IMPLEMENTATION.md). Schema only — no geographic data is
-- inserted here (that is Stage 3) and none of the existing `region text`
-- columns on listings/buyer_requests/users are touched. The new *_id
-- columns added below are all nullable, so every existing row keeps
-- reading and writing exactly as it does today.

-- Kazakhstan's 17 top-level administrative units: 14 oblasts plus the 3
-- cities of republican significance (Astana, Almaty, Shymkent). A
-- republican-significance city is modeled as BOTH a `regions` row here
-- (kind = 'republican_city') AND, once Stage 3 seeds data, a single child
-- row in `cities` for the city itself — so every listing/request/user
-- still points at a `city_id` regardless of which kind of region it's in,
-- matching the city-level granularity the existing free-text `region`
-- values already use (see docs/LOCATION_IMPLEMENTATION.md section 1.1).
CREATE TABLE regions (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ru    text NOT NULL,
    name_kz    text NOT NULL,
    slug       text NOT NULL UNIQUE,
    kind       varchar NOT NULL
               CHECK (kind IN ('oblast', 'republican_city')),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Cities/settlements within a region — including the single city row that
-- represents each republican-significance region itself. This is the
-- granularity listings.region (free text) already operates at today.
CREATE TABLE cities (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    region_id  uuid NOT NULL REFERENCES regions(id) ON DELETE RESTRICT,
    name_ru    text NOT NULL,
    name_kz    text NOT NULL,
    slug       text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_cities_region_id ON cities (region_id);

-- Districts come in two distinct kinds that must not be confused:
--   'administrative' — a rural/administrative district of an oblast
--                       (e.g. Илийский район, Алматинская область) —
--                       region_id set, city_id NULL.
--   'urban'           — a city district (e.g. Алмалинский район,
--                       г. Алматы) — city_id set, region_id NULL.
-- The CHECK below enforces that exactly one parent is set and that it
-- matches `kind`, so a row can never be ambiguous about which hierarchy
-- it belongs to.
CREATE TABLE districts (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kind       varchar NOT NULL
               CHECK (kind IN ('administrative', 'urban')),
    region_id  uuid REFERENCES regions(id) ON DELETE RESTRICT,
    city_id    uuid REFERENCES cities(id) ON DELETE RESTRICT,
    name_ru    text NOT NULL,
    name_kz    text NOT NULL,
    slug       text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (
        (kind = 'administrative' AND region_id IS NOT NULL AND city_id IS NULL) OR
        (kind = 'urban' AND city_id IS NOT NULL AND region_id IS NULL)
    )
);

CREATE INDEX idx_districts_region_id ON districts (region_id);
CREATE INDEX idx_districts_city_id ON districts (city_id);

-- Nullable location columns on the three existing tables that carry a
-- free-text `region` today. Deliberately NOT NULL-free and with no CHECK
-- requiring them: every existing row keeps its current `region` value
-- untouched, and nothing here makes the new columns mandatory before a
-- validated backfill exists (see docs/LOCATION_IMPLEMENTATION.md, Stage 2
-- section — this is why ON DELETE SET NULL, not CASCADE: removing a
-- reference-data row must never delete or block a real listing/request/
-- user row).
ALTER TABLE listings
    ADD COLUMN region_id   uuid REFERENCES regions(id) ON DELETE SET NULL,
    ADD COLUMN city_id     uuid REFERENCES cities(id) ON DELETE SET NULL,
    ADD COLUMN district_id uuid REFERENCES districts(id) ON DELETE SET NULL;

CREATE INDEX idx_listings_city_id ON listings (city_id);

ALTER TABLE buyer_requests
    ADD COLUMN region_id   uuid REFERENCES regions(id) ON DELETE SET NULL,
    ADD COLUMN city_id     uuid REFERENCES cities(id) ON DELETE SET NULL,
    ADD COLUMN district_id uuid REFERENCES districts(id) ON DELETE SET NULL;

CREATE INDEX idx_buyer_requests_city_id ON buyer_requests (city_id);

ALTER TABLE users
    ADD COLUMN region_id   uuid REFERENCES regions(id) ON DELETE SET NULL,
    ADD COLUMN city_id     uuid REFERENCES cities(id) ON DELETE SET NULL,
    ADD COLUMN district_id uuid REFERENCES districts(id) ON DELETE SET NULL;

CREATE INDEX idx_users_city_id ON users (city_id);

-- +goose Down
ALTER TABLE users
    DROP COLUMN region_id,
    DROP COLUMN city_id,
    DROP COLUMN district_id;

ALTER TABLE buyer_requests
    DROP COLUMN region_id,
    DROP COLUMN city_id,
    DROP COLUMN district_id;

ALTER TABLE listings
    DROP COLUMN region_id,
    DROP COLUMN city_id,
    DROP COLUMN district_id;

DROP TABLE districts;
DROP TABLE cities;
DROP TABLE regions;
