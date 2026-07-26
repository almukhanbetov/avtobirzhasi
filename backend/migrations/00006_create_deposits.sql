-- +goose Up
CREATE TABLE deposits (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id      uuid NOT NULL REFERENCES matches(id),
    user_id       uuid NOT NULL REFERENCES users(id),
    role          varchar NOT NULL
                  CHECK (role IN ('seller', 'buyer')),
    amount        bigint NOT NULL,
    status        varchar NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'paid', 'refunded')),
    created_at    timestamptz NOT NULL DEFAULT now(),
    paid_at       timestamptz,
    refunded_at   timestamptz
);

CREATE INDEX idx_deposits_match_id ON deposits (match_id);
CREATE INDEX idx_deposits_user_id ON deposits (user_id);

-- +goose Down
DROP TABLE deposits;
