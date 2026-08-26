// Package db manages the PostgreSQL connection pool shared by all
// repositories.
package db

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// Pool limits sized for this project's single small-VPS Postgres
	// instance (SKILL.md: "no ORM required", single-instance MVP) — not
	// pgx's implicit NumCPU-based default, which would be a silent,
	// unreviewed value. 10 max connections leaves ample headroom under
	// Postgres's own default max_connections=100 even with a second
	// process (e.g. cmd/seed) briefly connected at the same time.
	maxConns        = 10
	minConns        = 2
	maxConnLifetime = time.Hour
	maxConnIdleTime = 30 * time.Minute

	// A short Postgres startup delay (e.g. right after `docker compose
	// up`, before its own healthcheck has passed) shouldn't take the API
	// process down immediately — docker-compose.prod.yml's
	// depends_on/healthcheck ordering already usually prevents the API
	// from starting first, but this bounded retry is a second, cheap
	// layer of the same protection rather than a single all-or-nothing
	// Ping. 10 attempts * 2s = a 20s bounded wait, not an indefinite one.
	startupPingAttempts = 10
	startupPingDelay    = 2 * time.Second
)

// NewPool creates a PostgreSQL connection pool from dsn, applies the
// conservative limits above, and verifies connectivity with a bounded,
// retried ping before returning.
func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	if dsn == "" {
		return nil, fmt.Errorf("DATABASE_URL is not set")
	}

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("parse DATABASE_URL: %w", err)
	}
	cfg.MaxConns = maxConns
	cfg.MinConns = minConns
	cfg.MaxConnLifetime = maxConnLifetime
	cfg.MaxConnIdleTime = maxConnIdleTime

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("create pool: %w", err)
	}

	var pingErr error
	for attempt := 1; attempt <= startupPingAttempts; attempt++ {
		if pingErr = pool.Ping(ctx); pingErr == nil {
			return pool, nil
		}
		log.Printf("database ping attempt %d/%d failed: %v", attempt, startupPingAttempts, pingErr)
		if attempt < startupPingAttempts {
			time.Sleep(startupPingDelay)
		}
	}

	pool.Close()
	return nil, fmt.Errorf("ping database after %d attempts: %w", startupPingAttempts, pingErr)
}
