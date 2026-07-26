-- +goose Up
CREATE TABLE buyer_requests (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid NOT NULL REFERENCES users(id),
    make           text NOT NULL,
    model          text NOT NULL,
    year_from      int NOT NULL,
    year_to        int NOT NULL,
    region         text NOT NULL,
    initial_offer  bigint NOT NULL,
    current_offer  bigint NOT NULL,
    status         varchar NOT NULL DEFAULT 'active'
                   CHECK (status IN ('active', 'frozen', 'moderation', 'archived')),
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_buyer_requests_status ON buyer_requests (status);
CREATE INDEX idx_buyer_requests_user_id ON buyer_requests (user_id);

-- +goose Down
DROP TABLE buyer_requests;
