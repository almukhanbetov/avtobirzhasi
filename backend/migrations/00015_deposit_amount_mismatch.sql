-- +goose Up
-- 'amount_mismatch' is a terminal manual-review state: the provider
-- reported a captured payment whose amount/currency doesn't match the
-- deposit's stored amount. It is never treated as paid, can't be re-paid,
-- and later callbacks for it are ignored. The reported values are kept
-- for investigation. Purely additive: no existing row is touched.
ALTER TABLE deposits DROP CONSTRAINT deposits_status_check;
ALTER TABLE deposits
    ADD CONSTRAINT deposits_status_check
    CHECK (status IN ('pending', 'paid', 'refunded', 'failed', 'amount_mismatch'));

ALTER TABLE deposits
    ADD COLUMN mismatch_reported_amount bigint,
    ADD COLUMN mismatch_reported_currency varchar,
    ADD COLUMN mismatch_at timestamptz;

-- +goose Down
-- Fails (on purpose) while any deposit is still in 'amount_mismatch' —
-- resolve those manually first rather than silently rewriting them.
ALTER TABLE deposits DROP CONSTRAINT deposits_status_check;
ALTER TABLE deposits
    ADD CONSTRAINT deposits_status_check
    CHECK (status IN ('pending', 'paid', 'refunded', 'failed'));

ALTER TABLE deposits
    DROP COLUMN mismatch_at,
    DROP COLUMN mismatch_reported_currency,
    DROP COLUMN mismatch_reported_amount;
