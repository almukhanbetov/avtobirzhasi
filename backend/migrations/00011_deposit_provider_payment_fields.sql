-- +goose Up
ALTER TABLE deposits
    ADD COLUMN provider_payment_id varchar,
    ADD COLUMN failed_at timestamptz;

CREATE INDEX idx_deposits_provider_payment_id ON deposits (provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

ALTER TABLE deposits DROP CONSTRAINT deposits_status_check;
ALTER TABLE deposits
    ADD CONSTRAINT deposits_status_check
    CHECK (status IN ('pending', 'paid', 'refunded', 'failed'));

-- +goose Down
ALTER TABLE deposits DROP CONSTRAINT deposits_status_check;
ALTER TABLE deposits
    ADD CONSTRAINT deposits_status_check
    CHECK (status IN ('pending', 'paid', 'refunded'));

DROP INDEX idx_deposits_provider_payment_id;
ALTER TABLE deposits
    DROP COLUMN failed_at,
    DROP COLUMN provider_payment_id;
