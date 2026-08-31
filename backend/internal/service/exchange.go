package service

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	// dailyRate is the ±1% daily price movement, identical on both sides —
	// see components/exchange/ExchangeSimulator.tsx.
	dailyRate = 0.01

	// matchTolerancePercent is the "≈2%" gap that triggers a Match.
	matchTolerancePercent = 2.0

	// matchDeadlineWindow is how long a Match waits for both deposits
	// before it expires.
	matchDeadlineWindow = 48 * time.Hour
)

// ExchangeService implements the Auto Exchange engine: daily price
// movement, automatic matching, and expiry of overdue matches. It owns its
// own transactions directly against the pool rather than going through the
// per-resource repositories, since match creation and expiry each touch
// listings, buyer_requests, matches, deposits and notifications atomically
// in a single unit of work.
type ExchangeService struct {
	db       *pgxpool.Pool
	provider PaymentProvider
}

// NewExchangeService creates an ExchangeService. provider is used only to
// reverse a real charge on match expiry (see expireMatch) — pass the same
// PaymentProvider instance given to NewDepositService.
func NewExchangeService(db *pgxpool.Pool, provider PaymentProvider) *ExchangeService {
	return &ExchangeService{db: db, provider: provider}
}

// TickResult summarizes one RunDailyTick pass, returned so callers (the
// scheduler, the manual trigger endpoint) can log/report what happened.
type TickResult struct {
	ListingsDecayed int `json:"listingsDecayed"`
	RequestsGrown   int `json:"requestsGrown"`
	MatchesCreated  int `json:"matchesCreated"`
	MatchesExpired  int `json:"matchesExpired"`
}

// RunDailyTick performs one full pass: the once-per-calendar-day price
// movement, then match creation, then the expiry sweep.
//
// The price movement is idempotent per calendar day — it claims the
// current date in daily_tick_runs before touching any price, so calling
// RunDailyTick more than once on the same day (a container restart, the
// scheduler's hourly re-check, a manual trigger) moves prices exactly
// once. Match creation and the expiry sweep are naturally idempotent
// (an already-frozen listing won't re-match; an already-expired match is
// skipped) and run on every call.
func (s *ExchangeService) RunDailyTick(ctx context.Context) (*TickResult, error) {
	result := &TickResult{}

	moved, err := s.movePricesOncePerDay(ctx)
	if err != nil {
		return nil, fmt.Errorf("daily price movement: %w", err)
	}
	result.ListingsDecayed = moved.listingsDecayed
	result.RequestsGrown = moved.requestsGrown

	matched, err := s.createMatches(ctx)
	if err != nil {
		return nil, fmt.Errorf("create matches: %w", err)
	}
	result.MatchesCreated = matched

	expired, err := s.expireOverdueMatches(ctx)
	if err != nil {
		return nil, fmt.Errorf("expire overdue matches: %w", err)
	}
	result.MatchesExpired = expired

	return result, nil
}

type dailyMoveResult struct {
	alreadyRan      bool
	listingsDecayed int
	requestsGrown   int
}

// movePricesOncePerDay claims the current calendar date in
// daily_tick_runs and, only when this call is the one that claimed it,
// applies one day's -1% to active exchange listings and +1% to active
// buyer offers — the claim, both updates and the price-history rows are a
// single transaction, so a failure anywhere rolls the whole thing back
// (no half-decayed prices, and the day stays unclaimed so the next tick
// retries it).
func (s *ExchangeService) movePricesOncePerDay(ctx context.Context) (dailyMoveResult, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return dailyMoveResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	tag, err := tx.Exec(ctx,
		`INSERT INTO daily_tick_runs (run_date) VALUES (current_date) ON CONFLICT (run_date) DO NOTHING`)
	if err != nil {
		return dailyMoveResult{}, err
	}
	if tag.RowsAffected() == 0 {
		// Some earlier tick already moved prices for today.
		return dailyMoveResult{alreadyRan: true}, tx.Commit(ctx)
	}

	decayed, err := decayListingPrices(ctx, tx)
	if err != nil {
		return dailyMoveResult{}, err
	}
	grown, err := growBuyerOffers(ctx, tx)
	if err != nil {
		return dailyMoveResult{}, err
	}

	if _, err := tx.Exec(ctx,
		`UPDATE daily_tick_runs SET listings_decayed = $1, requests_grown = $2 WHERE run_date = current_date`,
		decayed, grown,
	); err != nil {
		return dailyMoveResult{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return dailyMoveResult{}, err
	}
	return dailyMoveResult{listingsDecayed: decayed, requestsGrown: grown}, nil
}

// decayListingPrices applies the seller-side -1%/day to every active
// exchange listing in tx and writes one listing_price_history row per
// listing that actually moved. Returns how many listings moved.
// GREATEST(1, ...) is a defensive floor so a listing that somehow never
// matches can't decay to zero or negative over a very long run.
func decayListingPrices(ctx context.Context, tx pgx.Tx) (int, error) {
	// $1 MUST be cast explicitly (::float8). Left bare, Postgres infers
	// its type from the neighboring untyped integer literal "1" and
	// silently treats it as `integer`, truncating 0.01 to 0 — the update
	// then "succeeds" while leaving every price unchanged, no error
	// raised. Confirmed by hand while building this.
	var moved int
	err := tx.QueryRow(ctx, `
		WITH targets AS (
			SELECT id,
			       price AS previous_price,
			       GREATEST(1, ROUND((price * (1 - $1::float8))::numeric)::bigint) AS new_price
			FROM listings
			WHERE is_exchange = true AND status = 'active'
		),
		moved AS (
			UPDATE listings l
			SET price = t.new_price, updated_at = now()
			FROM targets t
			WHERE l.id = t.id AND t.previous_price <> t.new_price
			RETURNING l.id
		),
		logged AS (
			INSERT INTO listing_price_history (listing_id, previous_price, new_price, reason)
			SELECT id, previous_price, new_price, 'daily_decay'
			FROM targets
			WHERE previous_price <> new_price
		)
		SELECT count(*) FROM moved
	`, dailyRate).Scan(&moved)
	if err != nil {
		return 0, err
	}
	return moved, nil
}

// growBuyerOffers applies the buyer-side +1%/day to every active buyer
// request in tx.
func growBuyerOffers(ctx context.Context, tx pgx.Tx) (int, error) {
	// See decayListingPrices — same explicit ::float8 cast, same reason.
	tag, err := tx.Exec(ctx, `
		UPDATE buyer_requests
		SET current_offer = ROUND((current_offer * (1 + $1::float8))::numeric)::bigint,
		    updated_at = now()
		WHERE status = 'active'
	`, dailyRate)
	if err != nil {
		return 0, err
	}
	return int(tag.RowsAffected()), nil
}

type candidatePair struct {
	ListingID      string
	BuyerRequestID string
}

// createMatches finds every currently-matching (listing, buyer_request)
// pair — same region/make/model, listing's year within the request's
// range, price gap within tolerance — and tries to create a Match for
// each. See auto-exchange-match skill: "compare Region, Make, Model,
// Year, Price". A listing never matches a buyer_request owned by the same
// user (l.user_id <> br.user_id) — otherwise a seller with a matching
// buyer request of their own would trade with themselves.
func (s *ExchangeService) createMatches(ctx context.Context) (int, error) {
	rows, err := s.db.Query(ctx, `
		SELECT l.id, br.id
		FROM listings l
		JOIN buyer_requests br ON
			br.status = 'active' AND
			l.status = 'active' AND
			l.is_exchange = true AND
			l.user_id <> br.user_id AND
			l.region = br.region AND
			l.make = br.make AND
			l.model = br.model AND
			l.year BETWEEN br.year_from AND br.year_to
		WHERE l.price > 0
		  AND abs(l.price - br.current_offer)::numeric / l.price * 100 <= $1::float8
	`, matchTolerancePercent)
	if err != nil {
		return 0, err
	}

	var pairs []candidatePair
	for rows.Next() {
		var p candidatePair
		if err := rows.Scan(&p.ListingID, &p.BuyerRequestID); err != nil {
			rows.Close()
			return 0, err
		}
		pairs = append(pairs, p)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	created := 0
	for _, pair := range pairs {
		ok, err := s.tryCreateMatch(ctx, pair)
		if err != nil {
			return created, err
		}
		if ok {
			created++
		}
	}
	return created, nil
}

// tryCreateMatch attempts to turn one candidate pair into a Match inside a
// single transaction. It re-checks both rows' status under
// SELECT ... FOR UPDATE first: if either side was already claimed by
// another pair earlier in this same tick (e.g. one listing matches two
// buyer requests simultaneously), it backs off and reports ok=false
// instead of double-matching.
func (s *ExchangeService) tryCreateMatch(ctx context.Context, pair candidatePair) (ok bool, err error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op once committed

	var listingStatus, listingUserID string
	var listingPrice int64
	err = tx.QueryRow(ctx,
		`SELECT status, user_id, price FROM listings WHERE id = $1 FOR UPDATE`, pair.ListingID,
	).Scan(&listingStatus, &listingUserID, &listingPrice)
	if err != nil {
		return false, err
	}

	var requestStatus, requestUserID string
	err = tx.QueryRow(ctx,
		`SELECT status, user_id FROM buyer_requests WHERE id = $1 FOR UPDATE`, pair.BuyerRequestID,
	).Scan(&requestStatus, &requestUserID)
	if err != nil {
		return false, err
	}

	if listingStatus != "active" || requestStatus != "active" {
		return false, nil
	}
	if listingUserID == requestUserID {
		// Re-checked here too (not just excluded in createMatches' SQL) for
		// the same reason the status re-check above exists: this is the
		// authoritative, locked point right before a Match is created.
		return false, nil
	}

	if _, err := tx.Exec(ctx,
		`UPDATE listings SET status = 'frozen', updated_at = now() WHERE id = $1`, pair.ListingID,
	); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE buyer_requests SET status = 'frozen', updated_at = now() WHERE id = $1`, pair.BuyerRequestID,
	); err != nil {
		return false, err
	}

	finalPrice := listingPrice
	depositAmount := int64(math.Round(float64(finalPrice) * 0.01))
	deadline := time.Now().Add(matchDeadlineWindow)

	var matchID string
	err = tx.QueryRow(ctx, `
		INSERT INTO matches (listing_id, buyer_request_id, final_price, deposit_amount, deadline)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id
	`, pair.ListingID, pair.BuyerRequestID, finalPrice, depositAmount, deadline).Scan(&matchID)
	if err != nil {
		return false, err
	}

	if _, err := tx.Exec(ctx,
		`INSERT INTO deposits (match_id, user_id, role, amount) VALUES ($1, $2, 'seller', $3)`,
		matchID, listingUserID, depositAmount,
	); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO deposits (match_id, user_id, role, amount) VALUES ($1, $2, 'buyer', $3)`,
		matchID, requestUserID, depositAmount,
	); err != nil {
		return false, err
	}

	priceText := formatTenge(finalPrice)
	if _, err := tx.Exec(ctx,
		`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'match_found', $2, $3)`,
		listingUserID, fmt.Sprintf("Найден Match по вашему объявлению — цена %s.", priceText), matchID,
	); err != nil {
		return false, err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'match_found', $2, $3)`,
		requestUserID, fmt.Sprintf("Найден Match по вашей заявке — цена %s.", priceText), matchID,
	); err != nil {
		return false, err
	}

	if err := tx.Commit(ctx); err != nil {
		return false, err
	}
	return true, nil
}

type overdueMatch struct {
	MatchID        string
	ListingID      string
	BuyerRequestID string
}

// expireOverdueMatches finds every Match past its deadline that never
// reached "confirmed" (or was already "cancelled"), and expires each one.
func (s *ExchangeService) expireOverdueMatches(ctx context.Context) (int, error) {
	rows, err := s.db.Query(ctx, `
		SELECT id, listing_id, buyer_request_id
		FROM matches
		WHERE status NOT IN ('confirmed', 'expired', 'cancelled') AND deadline < now()
	`)
	if err != nil {
		return 0, err
	}

	var overdue []overdueMatch
	for rows.Next() {
		var o overdueMatch
		if err := rows.Scan(&o.MatchID, &o.ListingID, &o.BuyerRequestID); err != nil {
			rows.Close()
			return 0, err
		}
		overdue = append(overdue, o)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return 0, err
	}

	count := 0
	for _, o := range overdue {
		if err := s.expireMatch(ctx, o); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}

// expireMatch unfreezes both sides back to "active" (they resume moving
// from wherever they were frozen, not their original starting price),
// refunds any deposit that was already paid, and notifies both parties.
func (s *ExchangeService) expireMatch(ctx context.Context, o overdueMatch) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx,
		`UPDATE matches SET status = 'expired', updated_at = now() WHERE id = $1`, o.MatchID,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE listings SET status = 'active', updated_at = now() WHERE id = $1`, o.ListingID,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`UPDATE buyer_requests SET status = 'active', updated_at = now() WHERE id = $1`, o.BuyerRequestID,
	); err != nil {
		return err
	}
	if err := s.refundPaidDeposits(ctx, tx, o.MatchID); err != nil {
		return err
	}

	var sellerID string
	if err := tx.QueryRow(ctx, `SELECT user_id FROM listings WHERE id = $1`, o.ListingID).Scan(&sellerID); err != nil {
		return err
	}
	var buyerID string
	if err := tx.QueryRow(ctx, `SELECT user_id FROM buyer_requests WHERE id = $1`, o.BuyerRequestID).Scan(&buyerID); err != nil {
		return err
	}

	const expiredMsg = "Срок Match истёк — объявление снова активно."
	if _, err := tx.Exec(ctx,
		`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'match_expired', $2, $3)`,
		sellerID, expiredMsg, o.MatchID,
	); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx,
		`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'match_expired', $2, $3)`,
		buyerID, expiredMsg, o.MatchID,
	); err != nil {
		return err
	}

	return tx.Commit(ctx)
}

// refundPaidDeposits reverses every paid deposit on a match before it's
// flipped to 'refunded' — for a deposit that was actually charged through
// a real provider (provider != "mock"), this calls PaymentProvider.Refund
// first and aborts (rolling back the whole expireMatch transaction) if
// that call fails, so a deposit is never marked refunded locally before
// the provider confirms the money was actually returned. Mock deposits
// (provider = "mock", no real charge ever happened) skip the provider
// call entirely.
func (s *ExchangeService) refundPaidDeposits(ctx context.Context, tx pgx.Tx, matchID string) error {
	rows, err := tx.Query(ctx,
		`SELECT id, amount, provider, coalesce(provider_payment_id, '') FROM deposits
		 WHERE match_id = $1 AND status = 'paid' FOR UPDATE`,
		matchID,
	)
	if err != nil {
		return err
	}
	type paidDeposit struct {
		ID, Provider, ProviderPaymentID string
		Amount                          int64
	}
	var deposits []paidDeposit
	for rows.Next() {
		var d paidDeposit
		if err := rows.Scan(&d.ID, &d.Amount, &d.Provider, &d.ProviderPaymentID); err != nil {
			rows.Close()
			return err
		}
		deposits = append(deposits, d)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return err
	}

	for _, d := range deposits {
		refundRef := ""
		if d.Provider != "mock" && d.ProviderPaymentID != "" {
			refundRef, err = s.provider.Refund(ctx, d.ProviderPaymentID, d.Amount)
			if err != nil {
				return fmt.Errorf("refund deposit %s via %s: %w", d.ID, d.Provider, err)
			}
		}
		if _, err := tx.Exec(ctx,
			`UPDATE deposits SET status = 'refunded', refunded_at = now(),
			 provider_reference = CASE WHEN $2 = '' THEN provider_reference ELSE $2 END
			 WHERE id = $1`,
			d.ID, refundRef,
		); err != nil {
			return err
		}
	}
	return nil
}

// formatTenge renders a tenge amount with space-grouped thousands, e.g.
// 11682000 -> "11 682 000 ₸" — matches lib/format/money.ts's convention,
// used only for notification message text.
func formatTenge(amount int64) string {
	digits := strconv.FormatInt(amount, 10)
	var groups []string
	for len(digits) > 3 {
		groups = append([]string{digits[len(digits)-3:]}, groups...)
		digits = digits[:len(digits)-3]
	}
	groups = append([]string{digits}, groups...)
	return strings.Join(groups, " ") + " ₸"
}
