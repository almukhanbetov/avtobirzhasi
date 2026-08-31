// Package testutil provides shared helpers for tests that need a real
// PostgreSQL connection: a dedicated test database (avtobirzhsi_test,
// migrated the same way the dev database is — see SKILL.md's Environment
// section), fixture inserts for the tables the Auto Exchange engine and
// deposit flow touch, and a JWT-signing helper for handler tests.
//
// Tests that use SetupDB skip (not fail) when the test database is
// unreachable, so `go test ./...` still passes for a contributor who
// hasn't started the local Postgres container.
package testutil

import (
	"context"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

var loadEnvOnce sync.Once

// loadEnv loads backend/.env (if present) exactly once, regardless of
// which package's test directory `go test` happens to run from. It never
// overrides a variable already set in the real environment (godotenv's
// default behavior), so CI setting TEST_DATABASE_URL directly still wins.
func loadEnv() {
	loadEnvOnce.Do(func() {
		_, thisFile, _, ok := runtime.Caller(0)
		if !ok {
			return
		}
		backendRoot := filepath.Join(filepath.Dir(thisFile), "..", "..")
		_ = godotenv.Load(filepath.Join(backendRoot, ".env"))
	})
}

// TestDatabaseURL resolves the DSN for the dedicated test database.
// Precedence: TEST_DATABASE_URL env var, then DATABASE_URL with its
// dbname swapped for "avtobirzhsi_test", so a contributor's normal .env
// is enough to run integration tests without ever touching the dev
// database's data.
func TestDatabaseURL() string {
	loadEnv()

	if v := os.Getenv("TEST_DATABASE_URL"); v != "" {
		return v
	}

	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		return ""
	}
	u, err := url.Parse(dsn)
	if err != nil {
		return ""
	}
	u.Path = "/avtobirzhsi_test"
	return u.String()
}

// SetupDB connects to the test database, truncates every table this
// package's fixtures touch, and registers pool.Close via t.Cleanup. It
// skips the test if no DSN is configured or the database is unreachable
// (e.g. `docker compose up -d` was never run) rather than failing the
// whole suite.
func SetupDB(t *testing.T) *pgxpool.Pool {
	t.Helper()

	dsn := TestDatabaseURL()
	if dsn == "" {
		t.Skip("no TEST_DATABASE_URL/DATABASE_URL configured; skipping DB-backed test")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	pool, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Skipf("connect test db: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		t.Skipf("test database unreachable (%v) — run `cd backend && docker compose up -d`, "+
			"then `goose -dir migrations postgres <TEST DSN> up` against avtobirzhsi_test", err)
	}
	t.Cleanup(pool.Close)

	truncateAll(t, pool)
	return pool
}

func truncateAll(t *testing.T, pool *pgxpool.Pool) {
	t.Helper()
	_, err := pool.Exec(context.Background(), `
		TRUNCATE TABLE
			notifications, deposits, matches, favorites,
			listing_price_history, daily_tick_runs,
			listing_images, buyer_requests, listings, users
		RESTART IDENTITY CASCADE
	`)
	if err != nil {
		t.Fatalf("truncate test db: %v", err)
	}
}

// InsertUser creates a minimal user row and returns its id. password_hash
// is a fixed placeholder — no test in this package exercises login.
func InsertUser(t *testing.T, pool *pgxpool.Pool, phone string) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO users (name, phone, password_hash, account_type, role)
		VALUES ($1, $2, 'x', 'private', 'user')
		RETURNING id
	`, "Test User", phone).Scan(&id)
	if err != nil {
		t.Fatalf("insert test user: %v", err)
	}
	return id
}

// InsertAdminUser is InsertUser with role='admin' — for tests exercising
// the /api/admin routes' AdminOnly gate.
func InsertAdminUser(t *testing.T, pool *pgxpool.Pool, phone string) string {
	t.Helper()
	var id string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO users (name, phone, password_hash, account_type, role)
		VALUES ($1, $2, 'x', 'private', 'admin')
		RETURNING id
	`, "Test Admin", phone).Scan(&id)
	if err != nil {
		t.Fatalf("insert test admin user: %v", err)
	}
	return id
}

// ListingFixture describes the listing fields tests actually vary; every
// other required column gets a fixed, valid default.
type ListingFixture struct {
	UserID     string
	Make       string
	Model      string
	Region     string
	Year       int
	Price      int64
	IsExchange bool
	Status     string // defaults to "active"
}

// InsertListing inserts a listing row from f and returns its id.
func InsertListing(t *testing.T, pool *pgxpool.Pool, f ListingFixture) string {
	t.Helper()
	status := f.Status
	if status == "" {
		status = "active"
	}
	var id string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO listings (
			user_id, make, model, year, price, mileage_km, region,
			transmission, fuel_type, body_type, drivetrain,
			engine_volume, engine_power, color, status, is_exchange
		) VALUES (
			$1, $2, $3, $4, $5, 0, $6,
			'automatic', 'petrol', 'sedan', 'fwd',
			2.0, 150, 'white', $7, $8
		)
		RETURNING id
	`, f.UserID, f.Make, f.Model, f.Year, f.Price, f.Region, status, f.IsExchange).Scan(&id)
	if err != nil {
		t.Fatalf("insert test listing: %v", err)
	}
	return id
}

// BuyerRequestFixture describes the buyer_request fields tests actually
// vary.
type BuyerRequestFixture struct {
	UserID       string
	Make         string
	Model        string
	Region       string
	YearFrom     int
	YearTo       int
	CurrentOffer int64
	Status       string // defaults to "active"
}

// InsertBuyerRequest inserts a buyer_requests row from f and returns its
// id.
func InsertBuyerRequest(t *testing.T, pool *pgxpool.Pool, f BuyerRequestFixture) string {
	t.Helper()
	status := f.Status
	if status == "" {
		status = "active"
	}
	var id string
	err := pool.QueryRow(context.Background(), `
		INSERT INTO buyer_requests (
			user_id, make, model, year_from, year_to, region,
			initial_offer, current_offer, status
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
		RETURNING id
	`, f.UserID, f.Make, f.Model, f.YearFrom, f.YearTo, f.Region, f.CurrentOffer, status).Scan(&id)
	if err != nil {
		t.Fatalf("insert test buyer request: %v", err)
	}
	return id
}

// MatchFixture describes the matches fields tests actually vary.
type MatchFixture struct {
	ListingID      string
	BuyerRequestID string
	FinalPrice     int64
	DepositAmount  int64
	Status         string // defaults to "awaiting_deposit"
	Deadline       time.Time
}

// InsertMatch inserts a matches row from f (and two pending deposits, one
// per role — matching what tryCreateMatch does atomically in production)
// and returns the match id plus the seller and buyer deposit ids.
func InsertMatch(t *testing.T, pool *pgxpool.Pool, f MatchFixture) (matchID, sellerDepositID, buyerDepositID string) {
	t.Helper()
	status := f.Status
	if status == "" {
		status = "awaiting_deposit"
	}
	deadline := f.Deadline
	if deadline.IsZero() {
		deadline = time.Now().Add(48 * time.Hour)
	}

	ctx := context.Background()
	err := pool.QueryRow(ctx, `
		INSERT INTO matches (listing_id, buyer_request_id, final_price, deposit_amount, status, deadline)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING id
	`, f.ListingID, f.BuyerRequestID, f.FinalPrice, f.DepositAmount, status, deadline).Scan(&matchID)
	if err != nil {
		t.Fatalf("insert test match: %v", err)
	}

	var sellerUserID, buyerUserID string
	if err := pool.QueryRow(ctx, `SELECT user_id FROM listings WHERE id = $1`, f.ListingID).Scan(&sellerUserID); err != nil {
		t.Fatalf("load listing owner: %v", err)
	}
	if err := pool.QueryRow(ctx, `SELECT user_id FROM buyer_requests WHERE id = $1`, f.BuyerRequestID).Scan(&buyerUserID); err != nil {
		t.Fatalf("load buyer request owner: %v", err)
	}

	if err := pool.QueryRow(ctx, `
		INSERT INTO deposits (match_id, user_id, role, amount) VALUES ($1, $2, 'seller', $3) RETURNING id
	`, matchID, sellerUserID, f.DepositAmount).Scan(&sellerDepositID); err != nil {
		t.Fatalf("insert seller deposit: %v", err)
	}
	if err := pool.QueryRow(ctx, `
		INSERT INTO deposits (match_id, user_id, role, amount) VALUES ($1, $2, 'buyer', $3) RETURNING id
	`, matchID, buyerUserID, f.DepositAmount).Scan(&buyerDepositID); err != nil {
		t.Fatalf("insert buyer deposit: %v", err)
	}

	return matchID, sellerDepositID, buyerDepositID
}

// IssueTestToken signs a JWT identical in shape to AuthService.issueToken
// (claims: sub/iat/exp), so handler tests can authenticate as a given
// user without going through the real register/login flow.
func IssueTestToken(t *testing.T, secret, userID string) string {
	t.Helper()
	now := time.Now()
	claims := jwt.MapClaims{
		"sub": userID,
		"iat": now.Unix(),
		"exp": now.Add(time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(secret))
	if err != nil {
		t.Fatalf("sign test token: %v", err)
	}
	return signed
}
