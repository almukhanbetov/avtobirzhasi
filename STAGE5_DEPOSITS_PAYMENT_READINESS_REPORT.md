# Stage 5 — Deposits / Payment Readiness

Date: 2026-08-25
Branch: `main` (uncommitted, on top of Stages 1–4's uncommitted changes)
Scope: the completion audit's core finding on Skill G was that "business deposit logic" and "real payment integration" are two different levels of readiness, and only the first exists — deposit "payment" is a pure DB-state toggle, explicitly self-documented as mock in the service code, with no disclosure of that fact anywhere in the user-facing UI.

**Scope decision (asked explicitly before starting, since guessing wrong here was riskier than any other stage):** wiring a real payment gateway needs a chosen provider and real API credentials, neither of which exist in this project or this environment. Fabricating a "real-looking" integration without real credentials would be strictly worse than the current honest mock — it would look wired up while silently doing nothing. The user confirmed the intended scope is **readiness only**: keep the mock, make it explicit everywhere it's user-facing, and refactor the backend so a real provider can be plugged in later behind a clean interface, with no external credentials needed today.

## What Changed

### Backend: a real seam for a future real provider

**New: `backend/internal/service/payment.go`** — a `PaymentProvider` interface:
```go
type PaymentProvider interface {
    Name() string
    Charge(ctx context.Context, depositID string, amount int64) (reference string, err error)
}
```
`MockPaymentProvider` is the only implementation today — `Charge` performs no external call and always succeeds, exactly matching current behavior, but now behind an interface a real provider (Kaspi, CloudPayments, Stripe, ...) can implement later without touching `DepositService`'s transaction logic at all. Its doc comment explicitly warns against ever describing it as "real payment integration" in future audits or user-facing copy.

**`backend/internal/service/deposits.go`** — `DepositService` now holds a `PaymentProvider` and calls `provider.Charge(...)` *inside* the same row-locked transaction that flips the deposit to `paid`, so a provider failure (once a real one exists and can actually fail) rolls back cleanly rather than leaving a half-applied state. A new `ErrPaymentFailed` sentinel distinguishes a declined/errored charge from the pre-existing ownership/state errors; the handler (`deposits.go`) maps it to `502 PAYMENT_FAILED`.

**New migration `00010_add_deposit_payment_provider.sql`** — adds `deposits.provider` (`NOT NULL DEFAULT 'mock'`) and `deposits.provider_reference` (nullable). This is schema *readiness*, not a real integration: every deposit today gets `provider='mock'` and a fake reference like `mock-<deposit-id>`; the columns exist so a real provider's actual reference/transaction id has somewhere to live once one is wired in, without another migration at that point.

**Repository + response layer** (`repository/deposits.go`, `handlers/deposit_response.go`) — `provider` is now read and returned on every deposit (`GET /dashboard/deposits`), specifically so the frontend can disclose it rather than silently defaulting to implying a real charge.

**`cmd/api/main.go`** — `depositService := service.NewDepositService(pool, service.NewMockPaymentProvider())`. Swapping in a real gateway later is exactly one line here, plus the new implementation of `PaymentProvider` itself.

### Frontend: explicit disclosure

- `types/dashboard.ts` — `Deposit.provider: string` added.
- `components/dashboard/DepositsContent.tsx` — a persistent notice banner (using the existing `warning`-token styling already established elsewhere in the app) now reads, in both languages: *"Test mode: paying a deposit here doesn't charge anything real — it's a simulation for verifying the Auto Exchange flow; no real payment gateway is connected yet."* Shown unconditionally on the deposits page (every deposit is `provider='mock'` today), rather than being wired per-row off the new `provider` field — simpler, and correct as long as `mock` is the only provider that exists. New i18n key `dashboard.deposits.mockNotice`, RU+KZ.

## Verification

Live, against the same local instance (migration `00010` applied via `goose up` → version 10; API rebuilt and restarted; fresh test users/listing/request/match created through real HTTP calls):

| Test | Expected | Actual |
|---|---|---|
| `GET /api/dashboard/deposits` before paying | `provider: "mock"` already present (schema default) | Confirmed |
| `POST /api/deposits/:id/pay` | 200, `status: "paid"` | Confirmed |
| DB row after pay | `provider = 'mock'`, `provider_reference = 'mock-<id>'` | Confirmed via direct query |
| `GET /api/dashboard/deposits` after paying | API reflects the stored provider | `"provider":"mock"` |
| Double-pay the same deposit | 409 (regression check — the charge-inside-the-transaction change didn't weaken this) | `409 CONFLICT` |
| A different user pays someone else's deposit | 403 (regression check — IDOR) | `403 FORBIDDEN` |
| Match status transition (`awaiting_deposit → seller_deposit_paid`) | Unaffected by the refactor | Confirmed |

**Build:**
```
go build ./...   PASS
go vet ./...     PASS
gofmt -l .       1 pre-existing, unrelated finding (models.go)
npx tsc --noEmit PASS (0 errors)
```
(`npm run lint`/`npm run build` were re-run at the end of this stage alongside Stage 6's checks — see that report; the dev server sharing this environment's CPU made a standalone timed run impractical mid-stage, so this stage's own verification leaned on `tsc` plus the live API tests above, which is where the actual behavior change lives.)

## What Stage 5 Does Not Cover — by design

- **No real payment gateway is connected.** This was the explicit, user-confirmed scope boundary. `MockPaymentProvider` still performs no real charge.
- **No refund-side provider call.** `expireOverdueMatches`' refund path (`exchange.go`) still just flips `deposits.status = 'refunded'` — there's no `PaymentProvider.Refund` method yet, since designing that seam without a real provider's actual refund semantics to build against would be speculative. A future stage wiring a real provider should design `Charge`/`Refund` together against that provider's real API.
- **The disclosure is a static banner, not a per-provider dynamic one.** Since `mock` is the only provider that will ever exist until a real one is built, a conditional "is this provider real?" check in the frontend would be unfalsifiable today — this can be revisited once (if) a second provider exists.
- Everything else (matching, price engine, notifications, admin) is unrelated to this stage.

## Why This Matters for the Completion Audit

This directly narrows (without closing) the audit's Skill G gap and the "Deposits (real payment): FAIL / NOT IMPLEMENTED" line in its Full E2E Status table. After this stage: **business deposit logic remains fully implemented** (unchanged, already solid per the audit), **and the codebase is now structured so real payment integration is an additive change** (implement `PaymentProvider`, change one constructor call) **rather than a rewrite** — but real payment integration itself is still not implemented, and the user-facing product now says so explicitly instead of staying silent about it.
