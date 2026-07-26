-- +goose Up
CREATE TABLE favorites (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid NOT NULL REFERENCES users(id),
    listing_id  uuid NOT NULL REFERENCES listings(id),
    created_at  timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, listing_id)
);

-- +goose Down
DROP TABLE favorites;
