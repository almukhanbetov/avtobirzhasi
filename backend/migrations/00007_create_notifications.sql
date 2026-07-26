-- +goose Up
CREATE TABLE notifications (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL REFERENCES users(id),
    type                 varchar NOT NULL
                         CHECK (type IN (
                             'match_found',
                             'deposit_required',
                             'deposit_received',
                             'contacts_open',
                             'match_expired'
                         )),
    message              text NOT NULL,
    read                 boolean NOT NULL DEFAULT false,
    related_match_id     uuid REFERENCES matches(id),
    related_listing_id   uuid REFERENCES listings(id),
    created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id_read ON notifications (user_id, read);

-- +goose Down
DROP TABLE notifications;
