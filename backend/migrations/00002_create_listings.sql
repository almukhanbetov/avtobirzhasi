-- +goose Up
CREATE TABLE listings (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL REFERENCES users(id),
    make                 text NOT NULL,
    model                text NOT NULL,
    year                 int NOT NULL,
    price                bigint NOT NULL,
    mileage_km           int NOT NULL,
    region               text NOT NULL,
    transmission         varchar NOT NULL
                         CHECK (transmission IN ('automatic', 'manual')),
    fuel_type            varchar NOT NULL
                         CHECK (fuel_type IN ('petrol', 'diesel', 'hybrid', 'electric', 'gas')),
    body_type            varchar NOT NULL
                         CHECK (body_type IN ('sedan', 'suv', 'crossover', 'hatchback', 'coupe', 'universal')),
    drivetrain           varchar NOT NULL
                         CHECK (drivetrain IN ('fwd', 'rwd', 'awd')),
    engine_volume        numeric(3,1) NOT NULL,
    engine_power         int NOT NULL,
    color                text NOT NULL,
    steering_wheel       varchar NOT NULL DEFAULT 'left'
                         CHECK (steering_wheel IN ('left', 'right')),
    description          text,
    status               varchar NOT NULL DEFAULT 'moderation'
                         CHECK (status IN ('active', 'frozen', 'moderation', 'archived')),
    is_exchange          boolean NOT NULL DEFAULT false,
    initial_price        bigint,
    exchange_started_at  timestamptz,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listings_status ON listings (status);
CREATE INDEX idx_listings_is_exchange ON listings (is_exchange);
CREATE INDEX idx_listings_user_id ON listings (user_id);
CREATE INDEX idx_listings_make_model_region ON listings (make, model, region);

-- +goose Down
DROP TABLE listings;
