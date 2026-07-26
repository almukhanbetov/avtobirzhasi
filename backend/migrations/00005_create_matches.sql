-- +goose Up
CREATE TABLE matches (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id            uuid NOT NULL REFERENCES listings(id),
    buyer_request_id      uuid NOT NULL REFERENCES buyer_requests(id),
    final_price           bigint NOT NULL,
    deposit_amount        bigint NOT NULL,
    seller_deposit_paid   boolean NOT NULL DEFAULT false,
    buyer_deposit_paid    boolean NOT NULL DEFAULT false,
    status                varchar NOT NULL DEFAULT 'awaiting_deposit'
                          CHECK (status IN (
                              'awaiting_deposit',
                              'seller_deposit_paid',
                              'buyer_deposit_paid',
                              'confirmed',
                              'expired',
                              'cancelled'
                          )),
    deadline              timestamptz NOT NULL,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_matches_status ON matches (status);
CREATE INDEX idx_matches_listing_id ON matches (listing_id);
CREATE INDEX idx_matches_buyer_request_id ON matches (buyer_request_id);

-- +goose Down
DROP TABLE matches;
