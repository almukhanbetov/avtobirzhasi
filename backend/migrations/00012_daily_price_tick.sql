-- +goose Up

-- One row per calendar day the Auto Exchange daily price tick has run.
-- RunDailyTick claims the current date here (INSERT ... ON CONFLICT DO
-- NOTHING) inside the same transaction that moves prices, so it applies
-- exactly one -1% to listings / +1% to buyer offers per calendar day no
-- matter how often it fires (container restart on every deploy, the
-- hourly re-check, a manual /internal/jobs/run-daily-tick).
CREATE TABLE daily_tick_runs (
    run_date         date PRIMARY KEY,
    ran_at           timestamptz NOT NULL DEFAULT now(),
    listings_decayed integer NOT NULL DEFAULT 0,
    requests_grown   integer NOT NULL DEFAULT 0
);

-- Audit trail of every automated price change to an exchange listing —
-- backs the "last N price changes" diagnostic and proves the daily tick
-- actually ran.
CREATE TABLE listing_price_history (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id     uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
    previous_price bigint NOT NULL,
    new_price      bigint NOT NULL,
    reason         varchar NOT NULL DEFAULT 'daily_decay'
                   CHECK (reason IN ('daily_decay')),
    changed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_listing_price_history_listing
    ON listing_price_history (listing_id, changed_at DESC);

-- +goose Down
DROP TABLE listing_price_history;
DROP TABLE daily_tick_runs;
