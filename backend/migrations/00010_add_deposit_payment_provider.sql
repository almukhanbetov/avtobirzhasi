-- +goose Up
ALTER TABLE deposits
    ADD COLUMN provider varchar NOT NULL DEFAULT 'mock',
    ADD COLUMN provider_reference varchar;

-- +goose Down
ALTER TABLE deposits DROP COLUMN provider_reference;
ALTER TABLE deposits DROP COLUMN provider;
