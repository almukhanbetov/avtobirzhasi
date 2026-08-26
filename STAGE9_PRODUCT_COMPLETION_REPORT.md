# Stage 9 — Product Completion

Date: 2026-08-26
Branch: `main` (commit `40f579f` deployed; this stage's own changes are uncommitted, test-only)
Scope: close the remaining Listings/Buyer-Requests self-service, homepage search, and malformed-UUID gaps the completion audit tracked. No production infrastructure, backup, CI/CD, payment, or core matching/exchange algorithm was touched — confirmed by `git diff --stat` at the end of this stage touching only `_test.go`/`.test.tsx` files.

## Stage 9 Scope — What Was Actually Found

Before writing a single line of product code, every one of the 8 named gaps was checked against the **current** code (not the stale, frozen audit text) and, where possible, against **live production**. The result: **7 of 8 were already fully implemented** — by Stage 3 and Stage 4's work, which predates this session's Stage 6–8D infrastructure work and had never been re-verified against the completion audit's original claims. This is not this stage inventing credit for old work; it's this stage catching that the audit document itself was stale in exactly the areas Stage 9 was asked to fix, and correcting the record with fresh evidence rather than re-building what already exists (per this task's own explicit "если уже исправлено — не переписывай").

| # | Gap | Status found | Evidence |
|---|---|---|---|
| 1 | Listings edit UI | **Already done** (Stage 3) | `components/dashboard/ListingRow.tsx` — full inline edit form |
| 2 | Listings delete UI | **Already done** (Stage 3) | Same file — delete button + `confirm()` |
| 3 | Buyer Requests edit UI | **Already done** (Stage 3) | `components/dashboard/RequestRow.tsx` |
| 4 | Buyer Requests delete flow | **Already done** (Stage 3) | `DELETE /api/requests/:id` (`Cancel`) + UI cancel button |
| 5 | Homepage QuickSearch | **Already done** (Stage 4, per commit history) | `components/home/QuickSearch.tsx` builds real `/cars?...` params |
| 6 | FreshListings real data | **Already done** (Stage 4) | `components/home/FreshListings.tsx` calls `listCars()` |
| 7 | malformed UUID → 400 | **Already done** (Stage 3) | `requireUUIDParam`, applied to every `:id` route |
| 8 | Admin UI stubs (existing-backend only) | **Genuinely NOT IMPLEMENTABLE within this stage's constraints** | see Admin UI Completion below |

This stage's actual work was therefore: **rigorously re-verify** items 1–7 (live production checks, a full local API E2E pass, and new automated regression tests — none of this had test coverage before), and **honestly assess and document** item 8 without building new backend, per the task's explicit instruction.

## Listings Completion

`backend/internal/handlers/listings.go` (`Update`, `Archive`) and `components/dashboard/ListingRow.tsx` were read in full, not assumed from the stale audit. Confirmed:
- Ownership: `loadOwnedListing` — owner-only, `403 FORBIDDEN` otherwise, `401` for no token.
- Exchange-field lock (Stage 2): `price` rejected with `409 EXCHANGE_MANAGED_FIELD` when `is_exchange=true`; freely editable otherwise. The frontend independently enforces the same rule (hides the price field entirely for exchange listings, shows a locked-price note) — not just trusting the backend to reject a bad request silently.
- Delete is a soft-delete (`status → archived`), gated in the UI to only be offered while `status` is `active`/`moderation`.
- Loading/success/error states: `useMutation`'s `isPending` disables buttons and swaps label text (`row.saving`/`row.deleting`); errors render inline (`ApiError` message or a generic fallback).

**Live-verified this stage**, against a local `go run ./cmd/api` instance on port 8091 (not production — real test data, not fabricated):
```
POST   /api/listings                          → 201, listing created
PATCH  /api/listings/:id  (non-owner)         → 403
PATCH  /api/listings/:id  (owner, price+desc) → 200, both fields applied
PATCH  /api/listings/:id  (no token)          → 401
DELETE /api/listings/:id  (non-owner)         → 403
DELETE /api/listings/:id  (owner)             → 204, status → archived (confirmed via dashboard listing)
```
**New automated tests** (`backend/internal/handlers/listings_lifecycle_test.go`): owner archive succeeds + status flips, non-owner archive forbidden + status unchanged, unauthenticated archive rejected, malformed-UUID PATCH/DELETE both 400. **New frontend tests** (`components/dashboard/ListingRow.test.tsx`): delete respects `confirm()` (both accept and dismiss paths), edit submits the exact `UpdateListingInput` shape the backend expects, and an exchange-managed listing's edit payload never contains `price` at all (client-side mirror of the Stage 2 server rule).

## Buyer Requests Completion

`backend/internal/handlers/requests.go` (`Update`, `Cancel`) and `components/dashboard/RequestRow.tsx`. Confirmed:
- `DELETE /api/requests/:id` (`Cancel`) exists — soft-cancels (`status → archived`), ownership-checked via `loadOwnedRequest`.
- `currentOffer` is unconditionally blocked (`409 EXCHANGE_MANAGED_FIELD`) — every buyer request is inherently exchange-managed, unlike listings' conditional `is_exchange` flag. The frontend never even renders `currentOffer` as an editable field.
- UI edit/cancel both gated to `status === "active"` only.

**Live-verified this stage**:
```
POST   /api/requests                              → 201, request created
PATCH  /api/requests/:id  (non-owner)             → 403
PATCH  /api/requests/:id  (owner, region)         → 200, applied
PATCH  /api/requests/:id  (owner, currentOffer)   → 409 EXCHANGE_MANAGED_FIELD
DELETE /api/requests/:id  (non-owner)             → 403
DELETE /api/requests/:id  (owner)                 → 204, status → archived
```
**New automated tests** (`backend/internal/handlers/requests_lifecycle_test.go`): owner cancel succeeds + status flips, non-owner cancel forbidden, unauthenticated cancel rejected, malformed-UUID PATCH/DELETE both 400.

## QuickSearch

`components/home/QuickSearch.tsx` was already rewritten (predates this session) to build real `URLSearchParams` — `region`, `make`, `model` (free-text, not the 3-option hardcoded dropdown the original audit described), `yearFrom`, and a `priceFrom`/`priceTo` split from a bucketed price-range select — and `router.push()`s to `/cars?...`, the exact same query param names `backend/internal/handlers/cars.go`'s `List` and `frontend/features/listings/filterCars.ts` already use. No second search API was built or needed.

**New automated tests** (`components/home/QuickSearch.test.tsx`, the first test file for this component): submitting with nothing selected → bare `/cars`; a full selection → all params present and correctly named; a price-range selection → correctly split into `priceFrom`/`priceTo`; a padded model string → trimmed before being added to the URL. 4/4 pass.

## FreshListings

`components/home/FreshListings.tsx` already calls `listCars({ sort: "newest", page: 1, ... })` — the real `/api/cars` endpoint — not `mockCars.slice(0, 8)`. Handles all 4 states: a skeleton grid while loading, an inline error message on API failure, `null` (renders nothing) when the catalog is genuinely empty, and a real grid of `CarCard`s otherwise, page-sized at 8 (the catalog's own page size, so "newest, page 1" already is the freshest 8 — no client-side slicing needed).

**New automated tests** (`components/home/FreshListings.test.tsx`, the first test file for this component): confirms the real API is called with `sort: "newest", page: 1` (not mock data); confirms each returned car renders a real link to `/cars/{id}`; confirms the section renders nothing once loaded with zero listings; confirms an API failure shows an error message instead of crashing. 4/4 pass.

## UUID Validation

`requireUUIDParam` (`backend/internal/handlers/validation.go`) was already applied to every `:id`/`:listingId` path param across the module (Stage 3). **Re-verified this stage against 11 distinct routes**, live, both locally and — for the two public catalog routes — against **production**:
```
LIVE PRODUCTION:
  GET  https://api.avtobirzhasi.kz/api/cars/car-3      → 400 VALIDATION_ERROR
  GET  https://api.avtobirzhasi.kz/api/sellers/car-3   → 400 VALIDATION_ERROR

LOCAL (all 11 checked):
  GET    /cars/car-3                  → 400      GET    /matches/car-3          → 400
  GET    /cars/car-3/similar          → 400      POST   /deposits/car-3/pay     → 400
  GET    /sellers/car-3               → 400      POST   /favorites/car-3       → 400
  PATCH  /listings/car-3              → 400      PATCH  /notifications/car-3/read → 400
  DELETE /listings/car-3              → 400      PATCH  /requests/car-3        → 400
                                                   DELETE /requests/car-3       → 400
```
Not one of these reaches Postgres with an unvalidated string — the exact "invalid input syntax for type uuid" → 500 regression is closed everywhere it could occur. **New automated tests**: `validation_test.go` (pure unit test of `requireUUIDParam` — 8 cases, valid/invalid/edge-length/uppercase), plus a `MalformedUUIDReturns400` integration test added to both the listings and requests lifecycle test files (PATCH + DELETE each).

## Admin UI Completion

Backend capability was checked directly, not assumed. Beyond moderation (`GET/POST /internal/listings/pending|approve|reject`, already real) and the dashboard's aggregate stats (`GET /internal/admin/stats` — site-wide **counts only**, no per-record listing), **no admin-wide "list every X across every user" endpoint exists for any resource** — not listings, not buyer requests, not matches, not deposits, not users, not reviews, not notifications, not settings. `GET /api/dashboard/listings` etc. all return only the *authenticated caller's own* records; there is no admin equivalent.

Per this task's explicit instruction — "если backend отсутствует: NOT IMPLEMENTED, не строить новый backend в этом Stage" — none of the 8 stub sections (`deposits`, `notifications`, `settings`, `requests`, `reviews`, `matches`, `listings`, `users`) could be legitimately completed without building new backend, which was out of scope. No frontend code was written for these; `<AdminComingSoon>` remains, honestly, rather than being wired to nonexistent data or a fabricated placeholder.

```
Admin UI — moderation:        already real, unchanged
Admin UI — stats/overview:    already real, unchanged
Admin UI — deposits/notifications/settings/requests/reviews/matches/listings/users:
                               NOT IMPLEMENTED (no backend exists; correctly not built this stage)
```

## Backend Validation

Reviewed for every route touched this stage — all already correct, re-confirmed rather than changed:
- `400`: malformed UUID (`requireUUIDParam`), request body binding failures (`ShouldBindJSON` + Gin tags).
- `401`: `middleware.Auth` — no/invalid JWT.
- `403`: ownership mismatch (`loadOwnedListing`/`loadOwnedRequest`).
- `404`: `repository.ErrNotFound` on a well-formed but nonexistent id.
- `409`: `EXCHANGE_MANAGED_FIELD` — a real business-state conflict, not a generic bad-request.
- `500`: only genuine server/DB failures (e.g., a `SELECT`/`UPDATE` erroring for a reason other than bad input) — none of the routes tested this stage produced one, on any input tried.

## Frontend UX

Already present, re-confirmed rather than added: `isPending`-driven loading text and disabled buttons on every mutation; inline error text from `ApiError` on failure; a native `window.confirm()` gate before every delete/cancel action (no accidental one-click deletes); edit forms cancel back to the read view without submitting. No redesign — same components, same visual language as the rest of the dashboard.

## Automated Tests

**Backend — 3 new files, 12 new tests** (34 total in the package, up from 22):
- `validation_test.go` — `requireUUIDParam`, 8 cases.
- `listings_lifecycle_test.go` — owner archive, non-owner archive forbidden, unauthenticated rejected, malformed UUID on PATCH/DELETE.
- `requests_lifecycle_test.go` — owner cancel, non-owner cancel forbidden, unauthenticated rejected, malformed UUID on PATCH/DELETE.

**Frontend — 3 new files, 12 new tests** (45 total, up from 33) — **the first component tests in this project** (Stage 6 installed Vitest/RTL but only ever tested pure `lib` functions):
- `QuickSearch.test.tsx` — 4 tests (URL building, price-range split, model trimming, empty-selection fallback).
- `FreshListings.test.tsx` — 4 tests (real API call with the right filters, real per-card links, empty state, error state).
- `ListingRow.test.tsx` — 4 tests (delete confirm accept/dismiss, edit payload shape, exchange-managed price omission).

## Regression

Backend:
```
$ go build ./...      clean
$ go vet ./...         clean
$ go test -p 1 ./...   ok: internal/handlers, internal/service
```
(34 tests total across both packages: 22 from Stage 6 + 12 new this stage, all passing, `-p 1` unchanged per Stage 6/7's finding about the shared test database.)

Frontend:
```
$ npm run test         Test Files 8 passed (8), Tests 45 passed (45)
$ npx tsc --noEmit     clean
$ npm run lint         0 errors, 1 pre-existing unrelated warning (ListingForm.tsx)
$ npm run build        27 routes, succeeds
```

## E2E Results

Performed as a real local API sequence (not simulated), against `go run ./cmd/api` + the local dev Postgres — register → create listing → edit (non-owner blocked, owner succeeds) → delete (non-owner blocked, owner succeeds, verified archived) → create buyer request → edit → attempt forbidden field edit → delete, all exactly as shown in the Listings/Buyer Requests sections above. Catalog filtering and newest-sort (the QuickSearch/FreshListings backends) were hit directly too. **Not performed**: a real mouse-driven browser session (no browser-automation tool available in this environment, same limitation Stage 3's own report already noted) — the UI layer's correctness is instead evidenced by the new RTL component tests (which exercise real DOM rendering, real event handling, and real `useMutation` calls against a mocked API) plus `tsc`/`build` succeeding, matching Stage 3's own original verification approach.
```
register/login                    PASS (live API)
create listing                    PASS (live API)
edit listing (owner/non-owner)    PASS (live API)
delete listing (owner/non-owner)  PASS (live API)
create buyer request              PASS (live API)
edit buyer request                PASS (live API)
delete buyer request              PASS (live API)
homepage QuickSearch               PASS (component test — real DOM interaction)
catalog filters                    PASS (live API)
FreshListings                      PASS (component test — real DOM rendering)
open car detail                    PASS (code-confirmed: CarCard/FreshListings link to /cars/{id}; not a fresh manual click-through)
admin moderation                   NOT RE-TESTED this stage (already confirmed real in prior audits; out of this stage's changed-code scope)
```
No real payment was executed or attempted, per this stage's explicit constraint.

## Remaining Product Gaps

- **8 of 10 admin sections remain non-functional stubs** — a genuine, unresolved gap, but not fixable without new backend, which this stage was explicitly told not to build.
- **No image editing** on an existing listing (add/remove/reorder photos post-creation) — unchanged, not previously flagged by any audit either.
- **No dedicated routed edit page** — edit is inline-in-row for both listings and requests, a deliberate, working design choice (Stage 3), not a missing feature.
- **Deposits remain a mock payment** — untouched, explicitly out of this stage's scope.
- **`lib/mock/cars.ts` still holds the `regions`/`makes`/`years` reference/dropdown lists** used by QuickSearch, ListingRow, and RequestRow. These are legitimate static reference data (SKILL.md's own "Reference data" section calls for exactly this), not fake substitute listings — but the file's name (`mock/cars.ts`) is misleading for what's actually just three constant arrays. Renaming it would touch 7 files across the frontend, outside this stage's "no global cleanup" scope — flagged, not fixed.
- **No real, mouse-driven browser click-through was performed** this stage (no browser-automation tool available) — component-level RTL tests plus a live API E2E pass are the substitute evidence, same approach Stage 3 used originally.

## Files Changed

- `backend/internal/handlers/validation_test.go` — new
- `backend/internal/handlers/listings_lifecycle_test.go` — new
- `backend/internal/handlers/requests_lifecycle_test.go` — new
- `frontend/components/home/QuickSearch.test.tsx` — new
- `frontend/components/home/FreshListings.test.tsx` — new
- `frontend/components/dashboard/ListingRow.test.tsx` — new
- `STAGE9_PRODUCT_COMPLETION_REPORT.md` — this file
- `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md` — updated (see next section)

**No product/business-logic/UI source file was modified** — every one of the 6 new files is a test. No migration, no `.github/workflows/deploy.yml` change, no `docker-compose.prod.yml` change, no Caddy change, no payment code. No `git commit`/`git push` performed.
