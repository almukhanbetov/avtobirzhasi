package service

import (
	"context"
	"errors"
	"fmt"
	"net/http"
)

// PaymentStatus is a provider-neutral outcome for a payment attempt.
type PaymentStatus string

const (
	PaymentStatusPending   PaymentStatus = "pending"
	PaymentStatusSucceeded PaymentStatus = "succeeded"
	PaymentStatusFailed    PaymentStatus = "failed"
)

// CreatePaymentResult is what CreatePayment returns. RedirectURL is empty
// when the provider resolves the payment synchronously (only
// MockPaymentProvider does this) — callers must check Status, not just
// whether RedirectURL is empty, before deciding what to do next.
type CreatePaymentResult struct {
	ProviderPaymentID string
	RedirectURL       string
	Status            PaymentStatus
}

// WebhookEvent is a normalized, already-signature-verified payment result
// notification. Amount/currency are carried through so the caller can
// compare them against its own record of what the deposit should cost —
// never applied to the database as-is.
type WebhookEvent struct {
	ProviderPaymentID string
	Status            PaymentStatus
	AmountTenge       int64
	Currency          string
}

// ErrWebhookInvalid is returned by VerifyWebhook when the payload's
// signature doesn't match — the caller must reject the request (not just
// log it) since an unverified payload could be forged by anyone who can
// reach the public webhook URL.
var ErrWebhookInvalid = errors.New("webhook signature invalid")

// PaymentProvider is the seam between DepositService's business logic
// (ownership checks, status transitions, match/notification side effects —
// all of which are real) and whatever actually moves money. Every real
// card gateway is inherently asynchronous: CreatePayment only starts a
// hosted-page session; the definitive result arrives later, out-of-band,
// through VerifyWebhook (or a GetPaymentStatus poll as a fallback) — never
// through the browser returning to a success URL.
type PaymentProvider interface {
	// Name identifies the provider — stored on the deposit row
	// (deposits.provider) so it's always possible to tell, per deposit,
	// which provider (if any) actually processed it.
	Name() string

	// CreatePayment starts a new payment session for a deposit.
	// idempotencyKey lets a provider that supports it dedupe a frontend
	// retry; providers that don't can ignore it, since depositID (the
	// merchant order id) is itself stable and unique per deposit.
	CreatePayment(ctx context.Context, depositID string, amountTenge int64, idempotencyKey string) (CreatePaymentResult, error)

	// GetPaymentStatus is the fallback source of truth used by a
	// status-check endpoint the frontend polls — for when a webhook is
	// delayed or lost.
	GetPaymentStatus(ctx context.Context, providerPaymentID string) (PaymentStatus, error)

	// VerifyWebhook validates an inbound webhook's authenticity (signature)
	// and parses it into a normalized event. Returns ErrWebhookInvalid on a
	// bad signature — callers must never apply an event that fails this
	// check.
	VerifyWebhook(headers http.Header, body []byte) (WebhookEvent, error)

	// Refund reverses a previously successful charge. Only called after a
	// business condition requires it (match expiry with a paid deposit —
	// see ExchangeService.expireMatch).
	Refund(ctx context.Context, providerPaymentID string, amountTenge int64) (providerRefundID string, err error)
}

// MockPaymentProvider performs no real charge — no external call, no card,
// no money moves. CreatePayment resolves synchronously with
// PaymentStatusSucceeded so DepositService can finalize the deposit
// immediately, exactly like before Stage 11's async architecture existed —
// this keeps local development and every non-payment-focused test
// unchanged. Never claim this satisfies "real payment integration" in any
// audit or user-facing copy.
type MockPaymentProvider struct{}

// NewMockPaymentProvider creates a MockPaymentProvider.
func NewMockPaymentProvider() *MockPaymentProvider {
	return &MockPaymentProvider{}
}

func (m *MockPaymentProvider) Name() string { return "mock" }

func (m *MockPaymentProvider) CreatePayment(ctx context.Context, depositID string, amountTenge int64, idempotencyKey string) (CreatePaymentResult, error) {
	return CreatePaymentResult{
		ProviderPaymentID: fmt.Sprintf("mock-%s", depositID),
		RedirectURL:       "",
		Status:            PaymentStatusSucceeded,
	}, nil
}

func (m *MockPaymentProvider) GetPaymentStatus(ctx context.Context, providerPaymentID string) (PaymentStatus, error) {
	return PaymentStatusSucceeded, nil
}

func (m *MockPaymentProvider) VerifyWebhook(headers http.Header, body []byte) (WebhookEvent, error) {
	return WebhookEvent{}, errors.New("mock provider has no webhook")
}

func (m *MockPaymentProvider) Refund(ctx context.Context, providerPaymentID string, amountTenge int64) (string, error) {
	return fmt.Sprintf("mock-refund-%s", providerPaymentID), nil
}
