-- +goose Up
CREATE TABLE users (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           text NOT NULL,
    phone          text NOT NULL UNIQUE,
    password_hash  text NOT NULL,
    email          text,
    region         text,
    account_type   varchar NOT NULL DEFAULT 'private'
                   CHECK (account_type IN ('private', 'dealer')),
    rating         numeric(2,1) NOT NULL DEFAULT 5.0,
    reviews_count  int NOT NULL DEFAULT 0,
    created_at     timestamptz NOT NULL DEFAULT now(),
    updated_at     timestamptz NOT NULL DEFAULT now()
);

-- +goose Down
DROP TABLE users;
