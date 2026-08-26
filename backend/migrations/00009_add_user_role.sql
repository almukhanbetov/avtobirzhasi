-- +goose Up
-- Adds a minimal user/admin role so administrative endpoints can require a
-- real authorization check instead of relying only on network topology
-- (see middleware.LocalOnly). Existing rows all get 'user' via the
-- column default — nobody is silently promoted to admin by this migration.
ALTER TABLE users
    ADD COLUMN role varchar NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

-- +goose Down
ALTER TABLE users DROP COLUMN role;
