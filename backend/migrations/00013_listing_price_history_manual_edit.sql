-- +goose Up

-- Owner-initiated price edits (PATCH /api/listings/:id) also belong in the
-- price-history audit trail, distinguished from the daily decay by reason.
ALTER TABLE listing_price_history DROP CONSTRAINT listing_price_history_reason_check;
ALTER TABLE listing_price_history
    ADD CONSTRAINT listing_price_history_reason_check
    CHECK (reason IN ('daily_decay', 'manual_edit'));

-- +goose Down
ALTER TABLE listing_price_history DROP CONSTRAINT listing_price_history_reason_check;
DELETE FROM listing_price_history WHERE reason <> 'daily_decay';
ALTER TABLE listing_price_history
    ADD CONSTRAINT listing_price_history_reason_check
    CHECK (reason IN ('daily_decay'));
