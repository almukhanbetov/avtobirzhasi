# Stage 11 — Real Payment Integration

Date: 2026-08-26
Branch: `main`
Provider decided this stage: **FreedomPay** (see Provider Decision below)

## Provider Decision

The task's own gate (item 5) required stopping before writing any provider-specific code until a provider was named. No provider was ever named anywhere in this repository. The user's instruction was "надо сделать все как uibirzhasi.kz" (build it the way the sibling project uibirzhasi.kz does) — a different, unrelated project on this machine.

Investigation (schema-only `grep` of `/home/mukhtar/uibirzhasi.dump`, a Postgres dump belonging to that project — never a raw row-data dump) found a `payments` table with a `pg_payment_id` column, suggesting one of the "pg_"-parameter-family CIS gateways (PayGate/Best2Pay-style protocol). The user rejected an initial guess of PayGate.kz. A targeted keyword search of the same dump for known KZ/RU gateway names found exactly one hit: **FreedomPay**, appearing in a CMS content row that is uibirzhasi.kz's own payment-instructions page text, explicitly naming FreedomPay's hosted payment page and 3-D Secure redirect flow. The user confirmed FreedomPay.

FreedomPay's public documentation (`freedompay.kz/docs-en/merchant-api/*`) confirmed it uses the same "pg_"-parameter, MD5-signed protocol family — consistent with the schema clue. Implemented against that documentation; **no sandbox credentials were available in this session**, so the implementation could not be verified against FreedomPay's real API (see Verified vs. Assumed below).

## Architecture

The mock synchronous flow (`POST /api/deposits/:id/pay` → immediately `paid`) could not simply gain a real provider — every real gateway is create-session → redirect → user pays on the provider's own page → the provider tells the merchant the result via a server-to-server webhook (or a status poll), independent of whether the browser ever returns. This required a genuine state-machine change, not just a new `PaymentProvider` implementation.

**New `PaymentProvider` interface** (`backend/internal/service/payment.go`):
```go
type PaymentProvider interface {
    Name() string
    CreatePayment(ctx context.Context, depositID string, amountTenge int64, idempotencyKey string) (CreatePaymentResult, error)
    GetPaymentStatus(ctx context.Context, providerPaymentID string) (PaymentStatus, error)
    VerifyWebhook(headers http.Header, body []byte) (WebhookEvent, error)
    Refund(ctx context.Context, providerPaymentID string, amountTenge int64) (providerRefundID string, err error)
}
```

**`MockPaymentProvider`** (unchanged behavior) implements this by having `CreatePayment` resolve synchronously with `PaymentStatusSucceeded` — so local dev, and every deposit test that doesn't specifically target the async path, sees exactly the same instant-pay UX as before this stage.

**`FreedomPayProvider`** (`backend/internal/service/payment_freedompay.go`) implements the real gateway:
- `CreatePayment` → `POST /init_payment.php`, returns a `pg_redirect_url` the frontend sends the browser to. `pg_success_url`/`pg_failure_url` are built per-deposit with `?depositId=...` appended so the frontend's return page knows what to poll (FreedomPay's docs don't guarantee any param is echoed back automatically).
- `GetPaymentStatus` → `POST /get_status3.php`, used as a fallback poll.
- `VerifyWebhook` → verifies the MD5 `pg_sig` on an inbound `pg_result_url` callback using the documented algorithm (script name + alphabetically-sorted fields + `pg_salt` + secret key, MD5 hex), rejects on mismatch, parses `pg_result` (1/0/2) into a normalized `WebhookEvent`.
- `Refund` → `POST /g2g/refund`.
- `pg_order_id` is always the deposit's own UUID — stable and unique per deposit, so a frontend retry naturally reuses the same order id instead of risking a double charge; no separate idempotency-key column was needed.

**`DepositService`** (`backend/internal/service/deposits.go`) — `Pay` was replaced by:
- `InitiatePay` — re-checks ownership/status/match-validity under row lock exactly as before, then calls `provider.CreatePayment`. If the provider resolves synchronously (mock), finalizes immediately via the shared `finalizeDepositPaid` (same notification/contact-unlock logic Stage 6–10 already had, untouched). Otherwise stores `provider_payment_id` and returns a redirect URL, leaving `status = 'pending'`.
- `ConfirmWebhook` — the **only** path (besides the mock's synchronous resolution) that ever marks a deposit paid. Looks the deposit up by `provider_payment_id`, is a no-op if it's already left `pending` (webhook replay safety), and **rejects** the event if `amount`/`currency` don't match the deposit's own server-computed `amount` — never applies an unverified or mismatched amount.
- `CheckStatus` — backs the frontend's polling endpoint; if still `pending` and a real provider is attached, actively calls `GetPaymentStatus` as a fallback for a delayed/lost webhook.
- Allows retrying a `failed` deposit (not just `pending`) — a failed payment attempt isn't a dead end.

**`ExchangeService.expireMatch`** now calls `provider.Refund` for any paid deposit that went through a real (non-mock) provider before flipping it to `refunded` — if the refund call fails, the whole expiry transaction rolls back, so a deposit is never marked refunded locally before the provider confirms it actually reversed the charge (`refundPaidDeposits` in `exchange.go`).

**New public webhook endpoint**: `POST /api/webhooks/payments/freedompay` (`backend/internal/handlers/webhooks.go`), registered outside every Auth/AdminOnly/LocalOnly group since a gateway cannot present a JWT — authenticity comes entirely from the signature check.

**New polling endpoint**: `GET /api/deposits/:id/status` (owner-only, JWT-authed).

## Database Changes

`backend/migrations/00011_deposit_provider_payment_fields.sql` (applied to both the local dev and test databases):
- `deposits.provider_payment_id varchar` — the provider's session/payment id, needed *before* payment completes (unlike `provider_reference`, which was only ever set after a mock "charge").
- `deposits.failed_at timestamptz`.
- `deposits.status` CHECK extended to add `'failed'`.

No card number, CVV, or other raw payment credential is stored or ever received by this backend — `CreatePayment` only ever talks to FreedomPay's own hosted page.

## Security / Integrity

- **Amount/currency never trusted from the client or the webhook payload as-is** — `ConfirmWebhook` always compares the webhook's reported amount/currency against the deposit's own server-computed `amount` and the fixed `"KZT"`; a mismatch is rejected, not applied. Verified live (see Live Verification below).
- **Webhook signature verified** via the documented MD5 algorithm; an invalid or missing `pg_sig` is rejected with an XML `pg_status=error` response and never reaches `ConfirmWebhook`. Verified live.
- **A success-URL browser return never marks anything paid** — the return page only ever displays what `GET /api/deposits/:id/status` says, polling it because a webhook may be delayed.
- **Idempotent webhook replay** — a deposit that already left `pending` is a no-op on a second webhook delivery (covered by both a unit test and reasoning above; FreedomPay's docs note it may retry delivery).
- **Refund never applied locally before the provider confirms it** — enforced by `refundPaidDeposits`' transactional design (see above), covered by a unit test asserting a failed `Refund` call leaves the deposit `paid` and the match un-expired.
- Real credentials (`FREEDOMPAY_MERCHANT_ID`, `FREEDOMPAY_SECRET_KEY`) are only ever read from environment variables — never hardcoded, never committed (`.env.example` files carry only variable names).

## Frontend Changes

- `lib/api/deposits.ts` — `payDeposit` now returns a union: `{redirectUrl}` for a real gateway, or the old `{id, status, matchStatus}` shape when a provider resolves synchronously (mock). New `getDepositStatus`.
- `DepositsContent.tsx` — redirects the browser (`window.location.href`) when a `redirectUrl` comes back; shows a "FreedomPay" real-payment notice instead of the mock-test banner once any deposit is on a non-mock provider.
- `DepositRow.tsx` — a `failed` deposit can be retried (same Pay button as `pending`).
- New `dashboard.deposits.return` page (`app/dashboard/deposits/return/page.tsx` + `DepositReturnContent.tsx`) — where FreedomPay's `pg_success_url`/`pg_failure_url` redirect back to; polls `GET /api/deposits/:id/status` every 2s (up to ~30s) and only ever displays the server-verified status, never assumes success from the redirect itself.
- `types/dashboard.ts` — `DepositStatus` gained `"failed"`; `Badge` gained a `destructive` variant for it.

## Automated Tests

**Backend** (`go test ./... -p 1`, all passing against the real Postgres test DB):
- `payment_freedompay_test.go` — signature algorithm against a hand-computed MD5 known-vector, key-order independence, `scriptNameFromURL`, `parseTengeAmount`, `CreatePayment`/`GetPaymentStatus`/`Refund` against an `httptest` FreedomPay stub, `VerifyWebhook` accept/tamper/missing-signature cases.
- `deposits_test.go` — extended with an async-provider stub: `InitiatePay` returns a redirect and leaves the deposit `pending` for a real provider (the core Stage 11 regression); `ConfirmWebhook` marks paid + unlocks contacts, rejects amount mismatches, is idempotent on replay, marks `failed` on a failure event; a `failed` deposit can be retried. Existing mock-flow tests renamed (`Pay` → `InitiatePay`) but otherwise unchanged in what they assert.
- `exchange_test.go` — extended with a tracking/failing refund-provider stub proving `expireMatch` calls `Refund` for a real-provider deposit with the right id/amount, and that a failed refund aborts the whole expiry (deposit stays `paid`, match stays un-expired).
- `webhooks_test.go` (new, `handlers_test` package) — a valid signed webhook against a live `httptest` server marks the deposit paid; an invalid signature is rejected and the deposit stays untouched.

**Frontend** (`npm run test`, all passing):
- `DepositsContent.test.tsx` (new) — mock-mode vs. real-provider notice selection, synchronous mock flow, and browser redirect on a `redirectUrl` response.
- `DepositReturnContent.test.tsx` (new) — verifying/success/failure states driven entirely by the polled server status.

## Live Verification (this session)

No FreedomPay sandbox credentials were available, so a real end-to-end payment against FreedomPay's actual API was **not** performed. Instead, the real running backend (built from this stage's code, against the real local Postgres) was exercised directly over HTTP:
- Registered real users, seeded a real match + deposits, paid via the live `POST /api/deposits/:id/pay` — confirmed byte-for-byte the same mock instant-pay behavior as before this stage (both deposits paid, match `confirmed`, `contacts_open`/`deposit_received` notifications created).
- Restarted the backend with FreedomPay credentials configured (fake values — no real network call was made to FreedomPay, since a webhook's signature check requires no outbound call), seeded a deposit exactly as `InitiatePay` would leave it for a real provider, and POSTed a correctly-signed webhook to the live `/api/webhooks/payments/freedompay` — the deposit flipped to `paid` end-to-end through the real handler → service → Postgres.
- POSTed the same webhook with a forged signature — rejected (`pg_status=error`), deposit stayed `pending`.
- POSTed a validly-signed webhook claiming a different amount than the deposit's own — rejected, deposit stayed `pending`.
- Confirmed `/dashboard/deposits` and the new `/dashboard/deposits/return?depositId=...` pages both render (HTTP 200, correct `<title>`) against the live backend.
- All smoke-test data was deleted from the local dev database afterward.

## Verified vs. Assumed

Everything above the DB/webhook/signature layer was exercised live. What was **not** verified, because no FreedomPay sandbox account was available:
- The exact XML response field names for `get_status3.php` (`pg_transaction_status` values assumed from the general documentation pattern, not observed from a real response).
- The refund endpoint path (`/g2g/refund` vs. an alternative `revoke.php` seen in a different documentation index page — public docs were inconsistent on this; `/g2g/refund` was chosen as the more detailed, field-complete reference).
- Whether FreedomPay's hosted page actually echoes `pg_success_url`/`pg_failure_url` verbatim including the appended `?depositId=` query param (assumed yes, since these are merchant-supplied static redirect targets, not something FreedomPay would have reason to rewrite).
- Real card behavior, 3-D Secure flow, and real webhook delivery timing/retry behavior.

## Production Enablement

`FREEDOMPAY_MERCHANT_ID`/`FREEDOMPAY_SECRET_KEY` are unset in this environment — the backend falls back to `MockPaymentProvider` (`cmd/api/main.go`'s `newPaymentProvider`), so **no real money can move** with the current deployment. Enabling FreedomPay in production requires, at minimum: FreedomPay's approval of the merchant account, real merchant ID/secret key, an HTTPS-reachable `FREEDOMPAY_RESULT_URL` on the production domain, and a live sandbox run against FreedomPay's actual test API to confirm the "Assumed" items above before flipping `FREEDOMPAY_TESTING_MODE` off.

```
PAYMENT CODE READY / PRODUCTION PAYMENT NOT ENABLED
```

## Regression

- `go build ./...`, `go vet ./...`, `go test ./... -p 1` — all pass.
- `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build` — all pass.
- Migration `00011` applied and reversible (`goose down` path written, not separately re-tested this stage — same pattern as prior migrations).

## Files Changed

- `backend/migrations/00011_deposit_provider_payment_fields.sql` (new)
- `backend/internal/service/payment.go` (rewritten interface + Mock)
- `backend/internal/service/payment_freedompay.go` (new)
- `backend/internal/service/payment_freedompay_test.go` (new)
- `backend/internal/service/deposits.go` (rewritten: `InitiatePay`, `ConfirmWebhook`, `CheckStatus`, `finalizeDepositPaid`)
- `backend/internal/service/deposits_test.go` (updated + extended)
- `backend/internal/service/exchange.go` (`refundPaidDeposits`, constructor takes a `PaymentProvider`)
- `backend/internal/service/exchange_test.go` (updated + extended)
- `backend/internal/handlers/deposits.go` (`Pay` updated, new `Status`)
- `backend/internal/handlers/webhooks.go` (new)
- `backend/internal/handlers/webhooks_test.go` (new)
- `backend/internal/repository/deposits.go` (`ProviderPaymentID`, `FailedAt`)
- `backend/internal/config/config.go` (FreedomPay env vars)
- `backend/cmd/api/main.go` (`newPaymentProvider`, webhook route, `ExchangeService` wiring)
- `backend/.env.example`, `backend.env.example` (FreedomPay variable names, no real values)
- `frontend/lib/api/deposits.ts`, `frontend/types/dashboard.ts`, `frontend/lib/labels/dashboard.ts`, `frontend/components/ui/Badge.tsx`
- `frontend/components/dashboard/DepositsContent.tsx`, `DepositRow.tsx`, `DepositReturnContent.tsx` (new), `DepositsContent.test.tsx` (new), `DepositReturnContent.test.tsx` (new)
- `frontend/app/dashboard/deposits/return/page.tsx` (new)
- `frontend/lib/i18n/translations.ts` (new keys, ru+kz)
- `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md` (Section G updated — see that file)
- `STAGE11_REAL_PAYMENT_REPORT.md` — this file (replaces the earlier analysis-only version)

No `git commit`/`git push` performed this turn.
