package service

import (
	"context"
	"fmt"
)

// PaymentProvider is the seam between DepositService's business logic
// (ownership checks, status transitions, match/notification side
// effects — all of which are real) and whatever actually moves money
// (which, today, is nothing — see MockPaymentProvider). Charge is called
// once, at the exact moment a deposit is about to be marked paid; a
// non-nil error aborts the payment before anything is written.
//
// Swapping in a real gateway (Kaspi, CloudPayments, Stripe, ...) later
// means writing one new implementation of this interface and changing
// its construction in cmd/api/main.go — DepositService.Pay's transaction
// logic does not need to change.
type PaymentProvider interface {
	// Name identifies the provider — stored on the deposit row
	// (deposits.provider) so it's always possible to tell, per deposit,
	// whether it was ever charged for real.
	Name() string

	// Charge attempts to charge amount (tenge) for depositID and returns
	// a provider-assigned reference to persist (deposits.provider_reference).
	Charge(ctx context.Context, depositID string, amount int64) (reference string, err error)
}

// MockPaymentProvider is the only PaymentProvider implemented today. It
// performs no real charge — no external call, no card, no money moves —
// it exists so the rest of the deposit-payment path (the stored
// provider/provider_reference columns, the response shape, the frontend
// disclosure) already looks exactly like it will once a real provider is
// wired in. Never claim this satisfies "real payment integration" in any
// audit or user-facing copy — see AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md's
// Skill G (Deposits / Payment Logic) for why that distinction matters.
type MockPaymentProvider struct{}

// NewMockPaymentProvider creates a MockPaymentProvider.
func NewMockPaymentProvider() *MockPaymentProvider {
	return &MockPaymentProvider{}
}

func (m *MockPaymentProvider) Name() string { return "mock" }

func (m *MockPaymentProvider) Charge(ctx context.Context, depositID string, amount int64) (string, error) {
	return fmt.Sprintf("mock-%s", depositID), nil
}
