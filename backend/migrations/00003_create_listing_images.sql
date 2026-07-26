-- +goose Up
CREATE TABLE listing_images (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id  uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    url         text NOT NULL,
    position    int NOT NULL DEFAULT 0
);

CREATE INDEX idx_listing_images_listing_id ON listing_images (listing_id);

-- +goose Down
DROP TABLE listing_images;
