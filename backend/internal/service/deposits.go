package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	// ErrDepositNotFound is returned when the deposit id doesn't exist.
	ErrDepositNotFound = errors.New("deposit not found")
	// ErrDepositForbidden is returned when the caller doesn't own the deposit.
	ErrDepositForbidden = errors.New("not your deposit")
	// ErrDepositNotPending is returned when the deposit (or its match) has
	// already moved past the point where starting a new payment applies.
	ErrDepositNotPending = errors.New("deposit is not payable")
	// ErrWebhookAmountMismatch is returned when a webhook's reported
	// amount/currency doesn't match the deposit's own server-computed
	// amount — the event is rejected, never applied, on this error.
	ErrWebhookAmountMismatch = errors.New("webhook amount/currency does not match deposit")
)

// DepositService implements the deposit payment flow: start a payment
// session through a PaymentProvider (see payment.go), and — once the
// provider confirms it, either synchronously (MockPaymentProvider) or via
// ConfirmWebhook (a real gateway) — mark it paid, recompute the parent
// match's derived status, and create the contact-unlock notifications once
// both sides have paid. Like ExchangeService, it owns its transactions
// directly against the pool, since paying a deposit touches deposits,
// matches and notifications atomically.
type DepositService struct {
	db       *pgxpool.Pool
	provider PaymentProvider
}

// NewDepositService creates a DepositService backed by the given
// PaymentProvider.
func NewDepositService(db *pgxpool.Pool, provider PaymentProvider) *DepositService {
	return &DepositService{db: db, provider: provider}
}

// ErrPaymentFailed wraps a PaymentProvider.CreatePayment failure — kept
// distinct from the ownership/state errors below since it means the
// request was otherwise valid, but starting the payment itself (with
// whatever provider is configured) failed.
var ErrPaymentFailed = errors.New("payment provider declined the request")

// PaymentSession is what InitiatePay returns. RedirectURL is empty when
// the provider already resolved the payment synchronously (only
// MockPaymentProvider does this today) — in that case Status/MatchStatus
// already reflect the final outcome and the caller should treat this
// exactly like the old, purely-synchronous mock flow. Otherwise the
// caller must send the browser to RedirectURL and wait for
// ConfirmWebhook (or a status poll) to resolve it.
type PaymentSession struct {
	DepositID   string
	RedirectURL string
	Status      string // "pending" or "paid"
	MatchStatus string // only meaningful once Status == "paid"
}

// InitiatePay starts a payment for one deposit via s.provider. The
// ownership check is re-done here under row lock (not just trusted from
// the handler layer) since this is the money-moving operation. Rejects
// deposits that are already paid/refunded, or whose match already reached
// a terminal state (expired/cancelled) — a deposit that previously
// 'failed' may be retried.
func (s *DepositService) InitiatePay(ctx context.Context, depositID, userID string) (*PaymentSession, error) {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }() // no-op once committed

	var deposit struct {
		ID      string
		MatchID string
		UserID  string
		Amount  int64
		Status  string
	}
	err = tx.QueryRow(ctx,
		`SELECT id, match_id, user_id, amount, status FROM deposits WHERE id = $1 FOR UPDATE`, depositID,
	).Scan(&deposit.ID, &deposit.MatchID, &deposit.UserID, &deposit.Amount, &deposit.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrDepositNotFound
	}
	if err != nil {
		return nil, err
	}
	if deposit.UserID != userID {
		return nil, ErrDepositForbidden
	}
	if deposit.Status != "pending" && deposit.Status != "failed" {
		return nil, ErrDepositNotPending
	}

	var matchStatus string
	err = tx.QueryRow(ctx,
		`SELECT status FROM matches WHERE id = $1 FOR UPDATE`, deposit.MatchID,
	).Scan(&matchStatus)
	if err != nil {
		return nil, err
	}
	if matchStatus == "expired" || matchStatus == "cancelled" {
		return nil, ErrDepositNotPending
	}

	// The session is created inside the same row-locked transaction as
	// the status flip below, so a provider failure leaves the deposit
	// untouched (the transaction rolls back) rather than half-applied.
	result, err := s.provider.CreatePayment(ctx, deposit.ID, deposit.Amount, "")
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrPaymentFailed, err)
	}

	if result.Status == PaymentStatusSucceeded {
		newStatus, err := s.finalizeDepositPaid(ctx, tx, deposit.ID, deposit.MatchID, deposit.UserID, s.provider.Name(), result.ProviderPaymentID)
		if err != nil {
			return nil, err
		}
		if err := tx.Commit(ctx); err != nil {
			return nil, err
		}
		return &PaymentSession{DepositID: depositID, Status: "paid", MatchStatus: newStatus}, nil
	}

	if _, err := tx.Exec(ctx,
		`UPDATE deposits SET status = 'pending', provider = $2, provider_payment_id = $3, failed_at = NULL WHERE id = $1`,
		depositID, s.provider.Name(), result.ProviderPaymentID,
	); err != nil {
		return nil, err
	}
	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &PaymentSession{DepositID: depositID, RedirectURL: result.RedirectURL, Status: "pending"}, nil
}

// ConfirmWebhook applies an already signature-verified WebhookEvent (see
// PaymentProvider.VerifyWebhook — callers must never call this with an
// unverified event). This is the only path (besides MockPaymentProvider's
// synchronous resolution in InitiatePay) that ever marks a deposit paid,
// per this stage's requirement that a success redirect alone must never do
// so. Idempotent: a deposit that's already left 'pending' (paid/failed/
// refunded) is left untouched — gateways commonly retry webhook delivery.
func (s *DepositService) ConfirmWebhook(ctx context.Context, event WebhookEvent) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var deposit struct {
		ID      string
		MatchID string
		UserID  string
		Amount  int64
		Status  string
	}
	err = tx.QueryRow(ctx,
		`SELECT id, match_id, user_id, amount, status FROM deposits WHERE provider_payment_id = $1 FOR UPDATE`,
		event.ProviderPaymentID,
	).Scan(&deposit.ID, &deposit.MatchID, &deposit.UserID, &deposit.Amount, &deposit.Status)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrDepositNotFound
	}
	if err != nil {
		return err
	}

	if deposit.Status != "pending" {
		return tx.Commit(ctx)
	}

	switch event.Status {
	case PaymentStatusSucceeded:
		// Never trust the webhook's amount/currency for the write itself —
		// only use them to confirm this event actually matches what the
		// deposit is server-computed to cost.
		if event.Currency != "KZT" || event.AmountTenge != deposit.Amount {
			return fmt.Errorf("%w: got %d %s, deposit expects %d KZT", ErrWebhookAmountMismatch, event.AmountTenge, event.Currency, deposit.Amount)
		}
		if _, err := s.finalizeDepositPaid(ctx, tx, deposit.ID, deposit.MatchID, deposit.UserID, s.provider.Name(), event.ProviderPaymentID); err != nil {
			return err
		}
	case PaymentStatusFailed:
		if _, err := tx.Exec(ctx, `UPDATE deposits SET status = 'failed', failed_at = now() WHERE id = $1`, deposit.ID); err != nil {
			return err
		}
	default:
		// pending/incomplete — nothing resolved yet, wait for a later event.
	}

	return tx.Commit(ctx)
}

// CheckStatus is the fallback the frontend polls after being redirected
// back from a hosted payment page, for when the webhook hasn't arrived
// yet (or was lost). If the deposit is still 'pending' and a real
// provider is attached, it actively asks the provider for the current
// status rather than only reading the (possibly stale) DB row.
func (s *DepositService) CheckStatus(ctx context.Context, depositID, userID string) (*PaymentSession, error) {
	var providerPaymentID, providerName, status, matchID string
	err := s.db.QueryRow(ctx, `
		SELECT coalesce(provider_payment_id, ''), provider, status, match_id
		FROM deposits WHERE id = $1 AND user_id = $2
	`, depositID, userID).Scan(&providerPaymentID, &providerName, &status, &matchID)
	if errors.Is(err, pgx.ErrNoRows) {
		var exists bool
		if err2 := s.db.QueryRow(ctx, `SELECT true FROM deposits WHERE id = $1`, depositID).Scan(&exists); err2 == nil && exists {
			return nil, ErrDepositForbidden
		}
		return nil, ErrDepositNotFound
	}
	if err != nil {
		return nil, err
	}

	if status == "pending" && providerPaymentID != "" && providerName != "mock" {
		if err := s.reconcileFromProvider(ctx, depositID, providerPaymentID); err != nil {
			return nil, err
		}
		if err := s.db.QueryRow(ctx, `SELECT status FROM deposits WHERE id = $1`, depositID).Scan(&status); err != nil {
			return nil, err
		}
	}

	var matchStatus string
	if err := s.db.QueryRow(ctx, `SELECT status FROM matches WHERE id = $1`, matchID).Scan(&matchStatus); err != nil {
		return nil, err
	}

	return &PaymentSession{DepositID: depositID, Status: status, MatchStatus: matchStatus}, nil
}

// reconcileFromProvider asks the provider directly for a payment's status
// and applies it if it has resolved. Used as a fallback when a webhook is
// delayed — never the primary path.
func (s *DepositService) reconcileFromProvider(ctx context.Context, depositID, providerPaymentID string) error {
	status, err := s.provider.GetPaymentStatus(ctx, providerPaymentID)
	if err != nil || status == PaymentStatusPending {
		return nil // provider error or still pending — nothing to apply, try again later
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var deposit struct {
		ID, MatchID, UserID, Status string
	}
	if err := tx.QueryRow(ctx,
		`SELECT id, match_id, user_id, status FROM deposits WHERE id = $1 FOR UPDATE`, depositID,
	).Scan(&deposit.ID, &deposit.MatchID, &deposit.UserID, &deposit.Status); err != nil {
		return err
	}
	if deposit.Status != "pending" {
		return tx.Commit(ctx) // already resolved (by a webhook that arrived meanwhile)
	}

	switch status {
	case PaymentStatusSucceeded:
		if _, err := s.finalizeDepositPaid(ctx, tx, deposit.ID, deposit.MatchID, deposit.UserID, s.provider.Name(), providerPaymentID); err != nil {
			return err
		}
	case PaymentStatusFailed:
		if _, err := tx.Exec(ctx, `UPDATE deposits SET status = 'failed', failed_at = now() WHERE id = $1`, deposit.ID); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

// finalizeDepositPaid marks one deposit paid, recomputes the parent
// match's derived status, and creates the deposit_received / (once both
// sides have paid) contacts_open notifications. Shared by InitiatePay's
// synchronous mock path and ConfirmWebhook/reconcileFromProvider's async
// real-provider path — this is the exact logic Stage 6 through Stage 10
// already exercised, unchanged.
func (s *DepositService) finalizeDepositPaid(ctx context.Context, tx pgx.Tx, depositID, matchID, depositUserID, providerName, providerReference string) (matchStatus string, err error) {
	if _, err := tx.Exec(ctx,
		`UPDATE deposits SET status = 'paid', paid_at = now(), provider = $2, provider_reference = $3, provider_payment_id = $3 WHERE id = $1`,
		depositID, providerName, providerReference,
	); err != nil {
		return "", err
	}

	var sellerPaid, buyerPaid bool
	if err := tx.QueryRow(ctx, `
		SELECT
			bool_or(role = 'seller' AND status = 'paid'),
			bool_or(role = 'buyer' AND status = 'paid')
		FROM deposits WHERE match_id = $1
	`, matchID).Scan(&sellerPaid, &buyerPaid); err != nil {
		return "", err
	}

	newStatus := deriveMatchStatus(sellerPaid, buyerPaid)
	var listingID, buyerRequestID string
	if err := tx.QueryRow(ctx,
		`UPDATE matches SET seller_deposit_paid = $1, buyer_deposit_paid = $2, status = $3, updated_at = now()
		 WHERE id = $4 RETURNING listing_id, buyer_request_id`,
		sellerPaid, buyerPaid, newStatus, matchID,
	).Scan(&listingID, &buyerRequestID); err != nil {
		return "", err
	}

	var listingUserID, make, model string
	if err := tx.QueryRow(ctx,
		`SELECT user_id, make, model FROM listings WHERE id = $1`, listingID,
	).Scan(&listingUserID, &make, &model); err != nil {
		return "", err
	}
	var requestUserID string
	if err := tx.QueryRow(ctx,
		`SELECT user_id FROM buyer_requests WHERE id = $1`, buyerRequestID,
	).Scan(&requestUserID); err != nil {
		return "", err
	}
	carLabel := fmt.Sprintf("%s %s", make, model)

	if _, err := tx.Exec(ctx,
		`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'deposit_received', $2, $3)`,
		depositUserID, fmt.Sprintf("Депозит по сделке %s получен и подтверждён.", carLabel), matchID,
	); err != nil {
		return "", err
	}

	if newStatus == "confirmed" {
		contactsMsg := fmt.Sprintf("Контакты по сделке %s открыты — можно связаться со стороной.", carLabel)
		if _, err := tx.Exec(ctx,
			`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'contacts_open', $2, $3)`,
			listingUserID, contactsMsg, matchID,
		); err != nil {
			return "", err
		}
		if _, err := tx.Exec(ctx,
			`INSERT INTO notifications (user_id, type, message, related_match_id) VALUES ($1, 'contacts_open', $2, $3)`,
			requestUserID, contactsMsg, matchID,
		); err != nil {
			return "", err
		}
	}

	return newStatus, nil
}

// deriveMatchStatus computes a match's status from the two deposit flags —
// see SKILL.md's Matches section. Terminal states (expired/cancelled) are
// never derived; InitiatePay already rejects those matches before
// reaching here.
func deriveMatchStatus(sellerPaid, buyerPaid bool) string {
	switch {
	case sellerPaid && buyerPaid:
		return "confirmed"
	case sellerPaid:
		return "seller_deposit_paid"
	case buyerPaid:
		return "buyer_deposit_paid"
	default:
		return "awaiting_deposit"
	}
}
