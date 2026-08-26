# Avtobirzhasi Project Completion Audit

Audit date: 2026-08-25
Branch: `main` @ `996858a` ("fix: allow production frontend origins in CORS") + uncommitted working tree (Stage 1 admin-auth fix + i18n, matching `AVTOBIRZHASI_FUNCTIONAL_AUDIT.md` / `STAGE1_ADMIN_AUTHORIZATION_REPORT.md`)
Scope: read-only completion audit. No code changes, no fixes, no refactors, no migrations, no deploy, no commits.

This is not a bug audit. It answers one question: **is avtobirzhasi.kz a functionally finished product, or is it still in development?** Every claim below was checked directly against code (file/line evidence), not taken from prior reports. The two existing reports (`AVTOBIRZHASI_FUNCTIONAL_AUDIT.md`, `STAGE1_ADMIN_AUTHORIZATION_REPORT.md`) were read first and used as a map, then independently re-verified — reading `exchange.go`, `deposits.go` (service), `listings.go`/`requests.go`/`cars.go` handlers, `main.go`, migrations, dashboard row components, `AdminComingSoon.tsx`, `QuickSearch.tsx`, `FreshListings.tsx`, `DescriptionSection.tsx`, the CI workflow, and the production compose/Caddy files directly, plus running `go build`/`go vet`/`go test`/`gofmt` and grepping for TODO/mock markers. Where this audit's own reading confirms a prior finding, it's cited as "confirmed." One material gap not previously called out is flagged below (§ Frontend Completeness / listing & request row actions).

---

## Executive Verdict

**Avtobirzhasi is a working MVP prototype of its core mechanic, not a finished product.** The distinguishing feature — the Auto Exchange price-convergence + matching engine (seller price −1%/day, buyer offer +1%/day, match at ≤2% gap, 1% deposits, contact unlock on dual payment) — is real, transactionally sound, and was live-verified end-to-end. That is the strongest part of the codebase by a wide margin.

Everything around that core is thinner:
- Sellers and buyers have **no way to edit or delete/cancel their own listings or requests from the UI** — the API exists (`PATCH`/`DELETE`), the dashboard rows render but expose zero mutate actions (confirmed by reading `ListingRow.tsx` and `RequestRow.tsx` directly — only "open"/"details" links, no edit or delete button anywhere).
- **8 of 10 admin panel sections are literal placeholder stubs** (`<AdminComingSoon>`, confirmed by grep) with no backend endpoints behind them at all.
- The **deposit "payment" is a pure DB-state toggle with no real payment gateway** — explicitly documented as a mock in the service code's own comment.
- **Zero automated tests exist** anywhere in the project (`go test ./...` → `[no test files]` for all 9 backend packages; `frontend/package.json` has no `test` script).
- **CI/CD deploys straight to production on every push to `main`** with no test, lint, or migration gate (`.github/workflows/deploy.yml` only builds/pushes Docker images and SSHes a `docker compose up -d`).
- Two named, explicitly-required protections are **missing from the price/matching engine**: no self-match guard, and no protection against manually bypassing the daily ±1% movement (owner-facing `PATCH` accepts any `price`/`currentOffer` directly).
- The homepage quick-search is non-functional (static link, hardcoded model list) and the homepage "fresh listings" render 8 hardcoded fake cars, not live data.

The admin-authorization gap the prior audit flagged as CRITICAL has been fixed in the current (uncommitted) working tree — role-based access control is real and DB-sourced — but that fix has **not been applied to production** (the migration must still be run there manually).

---

## Overall Completion Score

Weighted per the requested formula:

| Category | Weight | Score | Weighted |
|---|---:|---:|---:|
| Core business logic (Listings, Buyer Requests, Price Engine, Matching, Deal Lifecycle, Deposits, Contact Unlock) | 35% | 68% | 23.8 |
| User-facing features (Auth, Notifications, Search, Admin, Frontend) | 20% | 61% | 12.2 |
| Security | 15% | 72% | 10.8 |
| Data integrity (Database) | 10% | 80% | 8.0 |
| Automated testing | 8% | 5% | 0.4 |
| CI/CD | 5% | 30% | 1.5 |
| Production operations | 7% | 40% | 2.8 |

```
Overall Project Completion ≈ 23.8 + 12.2 + 10.8 + 8.0 + 0.4 + 1.5 + 2.8 = 59.5%  ≈  60%
```

Sub-scores (§ Code Complete vs Feature Complete vs Production Ready for full reasoning):

| Dimension | Score |
|---|---:|
| Code Complete | ~75% |
| Feature Complete | ~55% |
| Production Ready | ~35% |
| Commercially Complete | ~20% |

---

## Current Product Stage

```
MVP IN DEVELOPMENT
```

The single core mechanic (Auto Exchange) works end-to-end and is genuinely the product's spine. But the product is not yet **MVP FEATURE COMPLETE**: users can't manage their own listings/requests through the UI, 80% of admin is unbuilt, and the deposit flow — the thing that would make this a real marketplace rather than a demo — has no real payment behind it.

---

## Skill Completion Matrix

| Skill | Status | Completion | Blocking Issue |
|---|---|---:|---|
| A. Authentication & Accounts | MOSTLY COMPLETE | 85% | No password reset/session revocation; admin migration not yet run in prod |
| B. Car Listings | PARTIAL | 60% | No edit/delete UI at all; fake description shown instead of real one |
| C. Buyer Requests | PARTIAL | 55% | No delete/cancel endpoint exists; no edit UI either |
| D. Price Engine | PARTIAL | 70% | No guard against manual PATCH bypass of the ±1%/day mechanic; no price history |
| E. Matching Engine | PARTIAL | 65% | No self-match guard (explicitly required, absent in code) |
| F. Deal Lifecycle | MOSTLY COMPLETE | 78% | Expiry/refund path code-only, not live-verified this pass; `cancelled` state unreachable |
| G. Deposits / Payment Logic | PARTIAL | 55% | Business logic solid; **zero real payment integration** (pure DB toggle) |
| H. Contact Unlock | COMPLETE | 90% | None found |
| I. Notifications | MOSTLY COMPLETE | 70% | No real-time/polling — user must reload page; no push mechanism |
| J. Search & Filters | PARTIAL | 55% | Homepage quick-search is non-functional (static link, hardcoded model list) |
| K. Admin Panel | PARTIAL | 32% | 8 of 10 sections are stub placeholders, no backend behind them |
| L. Background Jobs | MOSTLY COMPLETE | 70% | Single ticker only; no retries, no distributed-safety (documented as accepted for MVP) |
| M. Database Integrity | MOSTLY COMPLETE | 80% | 3 dead enum values; migrations not auto-run in prod deploy |
| N. Frontend Completeness | PARTIAL | 55% | Stub admin, broken search, fake description, no edit/delete actions anywhere in dashboard rows |
| O. Backend API Completeness | MOSTLY COMPLETE | 70% | Malformed UUID → 500 not 400; some endpoints (listing PATCH/DELETE, request PATCH) unreachable from any UI |
| P. Security | MOSTLY COMPLETE | 72% | Self-match gap, price-bypass gap, malformed-ID 500, no rate limiting, no admin audit trail |
| Q. Automated Testing | STUB | 5% | Zero backend test files, no frontend test script, no E2E framework |
| R. CI/CD | PARTIAL | 30% | No test/lint gate; deploys to prod on every `main` push; migrations run manually |
| S. Production Readiness | PARTIAL | 40% | No app-container health checks, no graceful shutdown, no backup/observability story, manual Caddy merge, admin migration not applied in prod |
| T. Product Completeness | PARTIAL | 65% | Golden-path works; self-service flows and admin/backoffice don't |

**Completion criteria reminder**: a skill can only reach 100% if code, DB support, working API, working frontend, correct permissions, *and* automated tests all exist. Given automated tests are effectively absent project-wide, **no skill in this project qualifies for a true 100%** under the stated rubric — the ceiling for every row above is capped by the missing test category regardless of how solid the implementation is.

---

## Core Business Skills

### A. Authentication & Accounts — MOSTLY COMPLETE, 85%
- Register/login/logout(client-side token clear)/`GET /auth/me` all implemented and wired end-to-end: `backend/internal/handlers/auth.go`, `backend/internal/service/auth.go`, `frontend/features/auth/{LoginForm,RegisterForm}.tsx`.
- JWT (HS256, `Authorization: Bearer`, 7-day expiry), phone-based login with anti-enumeration (identical error for wrong phone vs wrong password).
- Role model: `users.role` (`user`/`admin`) added via `backend/migrations/00009_add_user_role.sql`, enforced by `backend/internal/middleware/admin.go` (`AdminOnly`, DB-sourced, never trusts a JWT claim) — confirmed by direct read.
- `frontend/components/auth/RequireAuth.tsx` is explicitly UX-only; `RequireAdmin.tsx` is a real gate for `/admin/*`.
- Gaps: no password reset, no email/phone verification, no refresh-token/session-revocation (acceptable for a stateless-JWT MVP, not a blocker by itself), profile-edit capability not independently verified this pass.

### B. Car Listings — PARTIAL, 60%
- Create/list/detail/filter/similar/favorite/soft-delete-via-API all work: `backend/internal/handlers/{listings,cars,favorites}.go`.
- New listings correctly start `status='moderation'` and are invisible until approved (confirmed in `Create`, `backend/internal/handlers/listings.go:93`).
- **Confirmed directly**: `Update`/`Archive` (`PATCH`/`DELETE /api/listings/:id`) exist and are ownership-checked (`loadOwnedListing`, `listings.go:134-149`) — but `frontend/components/dashboard/ListingRow.tsx` renders only an "open" link to the public listing page; there is no edit form, no delete button, no status-change control anywhere in the dashboard UI. A real seller cannot edit or remove their own listing without calling the API directly.
- **Confirmed directly**: `frontend/components/cars/DescriptionSection.tsx` calls `generateDescription(car, lang)` from `lib/mock/description.ts`, never rendering the real `car.description` the seller wrote and the API stores.
- `PATCH` accepts `price` with no guard tied to `is_exchange`/status (see Price Engine below).

### C. Buyer Requests — PARTIAL, 55%
- Create/list work: `backend/internal/handlers/requests.go`.
- `Update` (`PATCH /api/requests/:id`) exists and is ownership-checked, but — like listings — has **no UI entry point** (`frontend/components/dashboard/RequestRow.tsx` only links to `/exchange`, no edit action).
- **No delete/cancel/archive endpoint exists at all** for buyer requests (confirmed: `RegisterRequestsRoutes`, `requests.go:27-31`, only registers `POST`, `PATCH`, `GET` — no `DELETE`). The `moderation` status value in the DB `CHECK` constraint (`00004_create_buyer_requests.sql`) is unreachable dead code.

### D. Price Engine — PARTIAL, 70%
- Formula confirmed directly in `backend/internal/service/exchange.go`: seller `price = GREATEST(1, ROUND(price * 0.99))` per tick (`decayListingPrices`, line 96-101), buyer `current_offer = ROUND(current_offer * 1.01)` per tick (`growBuyerOffers`, line 112-117). Explicit `::float8` cast with a code comment documenting a previously hand-caught silent-truncation bug.
- Driven by a single `time.NewTicker(24*time.Hour)` goroutine (`cmd/api/main.go:98-110`) plus an on-demand `POST /internal/jobs/run-daily-tick`.
- **No price-history table** — no migration, nothing stores movement over time; only the current value persists.
- **No protection against manual price bypass** — this is one of the skill's explicitly required checks and it is **absent**: `updateListingRequest.Price` and `updateRequestRequest.CurrentOffer` (`listings.go:124`, `requests.go:76`) are directly settable via `PATCH` with zero check on `is_exchange` or `status`. An owner can force an instant match or freeze their price/offer at will, defeating the entire fairness premise of the mechanic.

### E. Matching Engine — PARTIAL, 65%
- Candidate query confirmed directly (`createMatches`, `exchange.go:134-148`): exact `region`/`make`/`model`, `listing.year BETWEEN request.year_from AND request.year_to`, price gap `<= 2.0%` (`matchTolerancePercent`).
- Duplicate-match protection: sound — `tryCreateMatch` re-checks both rows `FOR UPDATE` inside a transaction before flipping status (`exchange.go:186-223`).
- Inactive-item protection: correct — only `status='active'` rows are candidates on both sides.
- **Self-match protection is missing** — confirmed by direct reading of the entire matching path (`createMatches` query and `tryCreateMatch`): no comparison of `listing.user_id` to `buyer_request.user_id` exists anywhere. This is one of the skill's explicitly required checks per this audit's own scope and it fails.
- Concurrency: sound (row-locked transaction per candidate pair).

### F. Deal Lifecycle — MOSTLY COMPLETE, 78%
States derived strictly from code (`exchange.go`, `deposits.go` service, migrations), not assumed:
```
LISTING:        moderation → active ⇄ frozen → active (post-expiry) | archived
BUYER_REQUEST:  active ⇄ frozen → active (post-expiry)
MATCH:          awaiting_deposit → seller_deposit_paid ┐
                                  → buyer_deposit_paid  ┴→ confirmed
                (any non-terminal, deadline passed) → expired
                cancelled — defined in schema CHECK, never produced by any code path
DEPOSIT:        pending → paid → refunded (only on parent match expiry)
```
- `deriveMatchStatus` (`deposits.go:161-172`) confirms the four-way status derivation from the two paid-flags.
- `expireMatch` (`exchange.go:317-370`) confirms the expiry path: unfreezes both sides back to `active`, refunds any paid deposit, notifies both parties.
- Expiry/refund path is code-real but was **not exercised live in this pass** (would require waiting out or mocking the 48h `matchDeadlineWindow`) — NOT VERIFIED live, code-confirmed only.

### G. Deposits / Payment Logic — PARTIAL, 55%
Two distinct levels, per the audit's own required framing:

**Business deposit logic implemented — yes, and solid.**
- 1% of `final_price`, created atomically with the match in the same transaction (`tryCreateMatch`, `exchange.go:225-250`).
- `DepositService.Pay` (`deposits.go` service, confirmed by direct read) re-checks ownership and status under `SELECT ... FOR UPDATE` in a transaction — correct defense-in-depth against double-pay and IDOR.
- Refund is correctly tied to match expiry only, no independent deposit-level TTL.

**Real external payment integration implemented — no.**
The service's own doc comment states it plainly: *"DepositService implements the mock 'pay deposit' flow: no real payment gateway, just marking a deposit paid..."* (`deposits.go:22-24`, confirmed verbatim). There is no payment provider SDK, no webhook handler, no card/bank integration anywhere in `go.mod` or the codebase. "Paying a deposit" is a single authenticated `POST` that flips a DB row — nothing of value actually moves. This is the single most important thing to not misrepresent to a stakeholder: the deposit *mechanic* is real, the deposit *payment* is not.

### H. Contact Unlock — COMPLETE, 90%
- Gate is `match.status == 'confirmed'`, itself only reachable once `deriveMatchStatus` sees both deposit flags true — re-derived server-side on every `Pay` call and re-checked on every read, never cached/trusted from the client (confirmed by reading the full `Pay` flow and the match-response construction).
- No alternate endpoint exposing a counterpart's phone before that point was found.
- Docked slightly only because this pass didn't re-run the live click-through (relies on the prior audit's live verification, which this pass's code reading corroborates exactly).

---

## User-Facing Skills

### I. Notifications — MOSTLY COMPLETE, 70%
- `match_found`, `deposit_received`, `contacts_open`, `match_expired` are all generated server-side at the correct points (confirmed in `exchange.go` and `deposits.go` service) — no user-facing "create notification" endpoint exists, which is correct.
- List/mark-read wired via `frontend/components/dashboard/NotificationsContent.tsx` using React Query (`useQuery`/`useMutation`).
- **Confirmed directly**: no `refetchInterval`, `setInterval`, `WebSocket`, or `EventSource` anywhere in the notifications path — new notifications only appear after a manual page reload/navigation, not in real time. For a marketplace where "your match/deposit/contacts" state matters, this is a meaningful gap, not just polish.
- `deposit_required` is a dead enum value in the DB `CHECK` constraint (`00007_create_notifications.sql`), never inserted by any code path.

### J. Search & Filters — PARTIAL, 55%
- `/cars` catalog filtering (region/make/model/year/price/bodyType/transmission/drivetrain/fuelType, URL params, backend-supported) is real and complete — confirmed via `backend/internal/handlers/cars.go` (`List`) matching `frontend/features/filters/*`.
- **Confirmed directly**: `frontend/components/home/QuickSearch.tsx` — the "Search" button is a plain `<Button href="/cars">`, completely ignoring whatever region/make/model/year/price the user selected (line 85-88); the model dropdown is a hardcoded 3-option list (`Camry`/`Tucson`/`Rio`, lines 58-60) unrelated to the selected make. This is the homepage's primary call-to-action and it does not do what it visually promises.

### K. Admin Panel — PARTIAL, 32%
- **Confirmed directly by grep**: `matches`, `notifications`, `requests`, `deposits`, `settings`, `reviews`, `listings`, `users` — all 8 render `<AdminComingSoon>` (`frontend/components/admin/AdminComingSoon.tsx`), a static "coming soon" panel with zero data fetching. Only `moderation` (`/admin/moderation`) does not.
- The backend has genuinely no endpoints for those 8 sections either — this is consistent frontend-to-backend, not a hidden one-sided gap.
- What *is* real: moderation (`GET/POST /internal/listings/pending|approve|reject`) and the admin stats dashboard (`GET /internal/admin/stats`), both now behind the real `LocalOnly + Auth + AdminOnly` chain (`main.go:76-83`, confirmed).
- Admin promotion has no UI or endpoint at all, by explicit design — it is a manual `UPDATE users SET role='admin' ...` SQL statement (see Manual Developer Dependencies).

---

## Backend Completion — O. Backend API Completeness: MOSTLY COMPLETE, 70%
- Routes/handlers/services/repositories follow one consistent pattern across the module; validation via Gin binding tags (`oneof=`, `required`, `min=`); ownership checks are pervasive and correctly implemented everywhere they were checked (`loadOwnedListing`, request/deposit/match ownership checks).
- `go build ./...`, `go vet ./...` both clean (independently re-run this pass).
- Confirmed gap (re-verified structurally, not re-curled live this pass): `cars.go`'s `Get`/`Similar` pass `c.Param("id")` straight into the repository with no UUID-format pre-validation — a malformed ID surfaces as whatever the Postgres driver's cast error becomes, which the prior audit's live test recorded as a 500, not a 400.
- Orphan-in-reverse (API exists → no frontend caller): `PATCH /api/listings/:id`, `DELETE /api/listings/:id`, `PATCH /api/requests/:id` are all real, ownership-checked, working endpoints with **no UI that calls them** (see Frontend Completeness).

## Frontend Completion — N. Frontend Completeness: PARTIAL, 55%
What works: registration/login, catalog browse + filter, listing detail, dashboard overview, matches, deposits, notifications (list/read), favorites — all genuinely wired to live data via `lib/api/*` + React Query, confirmed by reading the relevant components and their fetch calls.

What doesn't, confirmed by direct inspection this pass:
- `ListingRow.tsx` / `RequestRow.tsx` — no edit, no delete/cancel, no status action of any kind; "open"/"details" links only. This is the most concrete, previously-undercited gap in this audit: sellers/buyers have a dashboard that lets them *see* their own listings and requests but not *manage* them.
- `DescriptionSection.tsx` — renders `generateDescription()` from a mock module instead of the real, stored `car.description`.
- `QuickSearch.tsx` — non-functional search button, hardcoded model options.
- `FreshListings.tsx` — renders `mockCars.slice(0, 8)`, static fake data, not `GET /cars?sort=newest`.
- 8/10 admin sections are `AdminComingSoon` stubs.
- `frontend/lib/mock/dashboard.ts` — confirmed orphaned (unused, grep across `app/`/`components/`/`features/` found no references).

## Database Completion — M. Database Integrity: MOSTLY COMPLETE, 80%
Schema reviewed directly (`00001`–`00009` migrations):

| Table | Key FKs | Notable constraints |
|---|---|---|
| `users` | — | `phone` UNIQUE, `account_type` CHECK, `role` CHECK(`user`,`admin`) added in `00009` |
| `listings` | `user_id→users` | `status` CHECK (4 values), enum CHECKs on transmission/fuel/body/drivetrain/steering |
| `listing_images` | `listing_id→listings` | ordered by `position` |
| `buyer_requests` | `user_id→users` | `status` CHECK (4 values, `moderation` unreachable) |
| `matches` | `listing_id→listings`, `buyer_request_id→buyer_requests` | `status` CHECK (6 values, `cancelled` unreachable); indexed on status/listing/request |
| `deposits` | `match_id→matches`, `user_id→users` | `role`/`status` CHECK; indexed on match/user |
| `notifications` | `user_id→users`, optional `related_match_id`/`related_listing_id` | `type` CHECK (5 values, `deposit_required` unreachable); composite index `(user_id, read)` |
| `favorites` | `user_id→users`, `listing_id→listings` | `UNIQUE(user_id, listing_id)` |

- Indexes exist on every status/foreign-key column actually queried by hot paths (matching, dashboard lists).
- No `ON DELETE CASCADE`/`SET NULL` specified on most FKs except `listing_images` — acceptable given the app never hard-deletes users/listings (soft-delete via status), but worth noting as a latent gap if hard-delete is ever added.
- Migrations are goose-formatted, sequential, each has a working `Down`. Not auto-run by the deploy pipeline or the container entrypoint — a manual step (see Manual Developer Dependencies).
- Dead values are informational, not integrity bugs: `matches.status='cancelled'`, `buyer_requests.status='moderation'`, `notifications.type='deposit_required'` are all valid per `CHECK` but unreachable given current code.

## Security Completion — P. Security: MOSTLY COMPLETE, 72%
Confirmed sound (re-verified structurally):
- Ownership re-checked at the handler layer for every mutate-by-ID endpoint reviewed (listings, requests) and, for the one money-moving path, again inside a row-locked transaction (`DepositService.Pay`).
- Admin authorization is now real: `AdminOnly` loads role fresh from the DB every request, never trusts a JWT claim (there is no role claim in the token at all) — confirmed by reading `middleware/admin.go` and `main.go`'s route wiring.
- CORS is an explicit allow-list (not a wildcard).

Confirmed gaps:
- No self-match guard (Matching Engine, above).
- Direct PATCH bypass of the price/offer mechanic (Price Engine, above).
- Malformed-UUID path params → 500 instead of 400.
- No rate limiting anywhere in the codebase (no middleware for it, nothing in `go.mod`).
- No audit trail for admin actions (who approved/rejected what, who ran a manual tick) — `moderation.go`/`jobs.go` write no actor-attributed log.
- Admin-authorization fix is real in code but its migration has not been run against production (see Manual Developer Dependencies) — until it is, production is still running on the pre-fix schema.

## Testing Completion — Q. Automated Testing: STUB, 5%
Directly re-run this pass:
```
go test ./...  →  [no test files]  (all 9 backend packages)
```
`frontend/package.json` `scripts` block has `dev`, `build`, `start`, `lint` — **no `test` script**, and no test framework (`jest`, `vitest`, `playwright`, `@testing-library/*`) appears in `dependencies`/`devDependencies`. No `*_test.go`, `*.test.ts(x)`, or `*.spec.ts(x)` files exist anywhere in the repo (confirmed by `find`). Every piece of verification that has ever happened on this project — including this audit — has been manual/live black-box testing, not a regression suite. The 5% reflects that build/vet cleanliness at least gives *some* mechanical assurance; it is not test coverage.

## CI/CD Completion — R. CI/CD: PARTIAL, 30%
`.github/workflows/deploy.yml` (read in full this pass): triggers on every push to `main`, builds and pushes both Docker images, then SSHes into the VPS and runs `docker compose -f docker-compose.prod.yml pull && up -d`. That's the entire pipeline.
- No `go build`/`go vet`/`go test` step.
- No `npm run lint`/`npm run build` step.
- No migration step (`goose up` is never invoked by CI or by the container).
- No rollback mechanism beyond manually re-running the workflow against an older commit.
- A broken build would be caught (Docker build fails → job fails → no deploy), but a logically broken change that still compiles ships straight to production with nothing to catch it.

## Production Readiness — S. Production Readiness: PARTIAL, 40%
`docker-compose.prod.yml` and `Caddyfile.avtobirzhasi` read in full this pass:
- `restart: unless-stopped` on all three services; Postgres has a real `healthcheck` (`pg_isready`) gating backend startup via `depends_on: condition: service_healthy`.
- **Backend and frontend containers have no healthcheck of their own** — only Postgres does.
- No graceful-shutdown handling in `cmd/api/main.go` — `router.Run(...)` blocks directly with no `signal.NotifyContext`/`http.Server.Shutdown`, so a SIGTERM during deploy hard-kills in-flight requests rather than draining them.
- Caddy config is explicitly a *snippet* the operator must hand-merge into the VPS's real Caddy config — not automated, not verifiable from this repo whether it's actually live in production today (both this audit and the prior one flag this as unverifiable without VPS access).
- No backup strategy documented anywhere for the `avtobirzhasi_pgdata` volume.
- No logging/observability stack — `log.Printf`/`gin.Default()`'s own request log to stdout only, no structured logging, no error-tracking integration (Sentry etc.), no metrics.
- Secrets via `.env`/`backend.env`/`frontend.env` files, not a secrets manager — acceptable for this scale, not a blocker.
- The admin-role migration (`00009`) has not been confirmed run against production.

---

## Full E2E Status

Golden path, evaluated against code (this pass did not stand up a live server; the prior audit's live run, dated the same code state, is treated as corroborating evidence and was independently cross-checked at the code level in this pass):

| Step | Status | Evidence |
|---|---|---|
| Register | PASS | `auth.go` handler/service verified directly |
| Login | PASS | verified directly |
| Seller creates listing | PASS | `listings.go` `Create`, starts `status='moderation'` |
| Moderation approve | PASS | `moderation.go`, now admin-role-gated |
| Buyer creates request | PASS | `requests.go` `Create` |
| Price movement (daily tick) | PASS | `exchange.go` formulas verified directly |
| Matching | PARTIAL | works, but no self-match guard |
| Deposits (business logic) | PASS | `deposits.go` service verified directly |
| Deposits (real payment) | FAIL / NOT IMPLEMENTED | confirmed mock, no gateway |
| Contact unlock | PASS | gate verified directly |
| Seller edits/removes own listing | FAIL (UI) | API works, zero UI entry point |
| Buyer edits/cancels own request | FAIL (UI) / MISSING (cancel, no API at all) | |

**Core E2E: PASS** for the narrow "list → moderate → request → converge → match → deposit → unlock" spine. **PARTIAL** the moment ordinary self-service account management (editing/removing your own content) or real money movement enters the picture.

---

## Incomplete / Stub / Mock Functionality

Directly confirmed this pass (not inherited from prior reports without re-checking):
- `frontend/components/admin/AdminComingSoon.tsx` used by 8/10 admin pages — literal placeholder, no data.
- `frontend/components/cars/DescriptionSection.tsx` → `lib/mock/description.ts` — fake generated text instead of the real stored description.
- `frontend/components/home/FreshListings.tsx` → `lib/mock/cars.ts` — hardcoded fake catalog on the homepage.
- `frontend/components/home/QuickSearch.tsx` — non-functional search control.
- `backend/internal/service/deposits.go` — deposit "payment" explicitly self-documented as mock in its own doc comment.
- `frontend/lib/mock/dashboard.ts` — orphaned/unused mock module (dead code, harmless).
- Grep for `TODO|FIXME|HACK|not implemented|coming soon` across `backend/internal`, `backend/cmd`, and all frontend `app/components/features/lib` source found **zero literal markers** — none of the above are self-flagged in code comments; they were only found by reading actual behavior, which is itself a signal that gaps here are silent rather than tracked.

---

## Manual Developer Dependencies

Concretely, what currently requires a developer/operator to do something by hand for the product to function normally:
1. **Promoting a user to admin** — no endpoint exists (by design); requires `UPDATE users SET role='admin' WHERE phone='...'` run directly against the database.
2. **Running database migrations in production** — `goose` is bundled into the backend image but never invoked automatically by the container entrypoint or the CI pipeline; an operator must SSH in and run it.
3. **Merging the Caddy config** — `Caddyfile.avtobirzhasi` is an unmerged snippet; a human must hand-splice it into the VPS's live Caddy config and cannot verify from this repo that it's actually been done.
4. **Editing or removing a listing/buyer request** — since no UI exists for it, this today can only be done by a developer calling the API directly on the user's behalf, or by direct SQL.
5. **Deploying a rollback** — no automated rollback; reverting a bad production deploy means a human re-runs the workflow against an older commit or SSHes in to manually run the previous image tag.
6. **Verifying a deploy didn't break anything** — since CI has no test/lint gate, a human must manually smoke-test after every deploy (the pipeline itself provides no such assurance).

---

## Code Complete vs Feature Complete vs Production Ready

**Code Complete (~75%)** — Nearly every core mechanic described in the project's own skill docs has a real code implementation: auth, listings, requests, the exchange engine, matching, deposits, contact unlock, notifications, moderation, admin stats. What's missing in code (not just polish) is narrower: the self-match guard, the price-bypass guard, a delete endpoint for buyer requests, price history, and 8 admin sections' backend endpoints simply don't exist yet.

**Feature Complete (~55%)** — The core Auto Exchange loop works end-to-end as a *feature*. But "feature complete" for a marketplace product also means users can manage what they created — and they can't, from the UI, for either listings or requests. Homepage search doesn't search. 80% of admin doesn't function. These are not code-complete-but-rough features; they are features whose primary interaction surface is absent or broken.

**Production Ready (~35%)** — Backend/frontend build clean and the transactional money-relevant paths (deposit pay, match creation) are genuinely well-guarded at the code level. But there is no automated test suite protecting any of this from regressing, no CI quality gate before a change reaches production, no health checks on the app containers, no graceful shutdown, no documented backup or rollback story, and the most recent security fix (admin roles) has not yet been confirmed applied to the live database.

**Commercially Complete (~20%)** — A real business cannot run on this today without constant developer involvement: admins can only be created via manual SQL, listings/requests can't be self-managed, and — most importantly — the deposit "payment" is not a real payment. No actual money can currently change hands through this product; the entire financial premise of the marketplace (escrow-like deposits) is simulated.

These four numbers are deliberately far apart. The gap between "Code Complete" (75%) and "Commercially Complete" (20%) *is* the answer to "is this finished": no.

---

## Project Definition of Done

### Core DoD (required to call the product functionally done, within its current scope)
- Self-match guard added to the matching query.
- Owner-facing `PATCH` on listings/requests blocked (or explicitly scoped) while a listing/request is exchange-active, so the daily mechanic can't be bypassed.
- Edit and delete/cancel UI for a seller's own listings and a buyer's own requests, wired to the already-existing (listings) or yet-to-be-built (buyer request delete) endpoints.
- `DescriptionSection.tsx` wired to the real `car.description`.
- Homepage `QuickSearch` actually navigates with the selected filters; `FreshListings` calls `GET /cars?sort=newest` instead of rendering mock data.
- A decision, made explicitly and documented, on the remaining 8 admin sections: build them, or formally descope them from "MVP" so the sidebar stops implying they exist.

### Production DoD (required before this can be trusted to run unattended)
- CI gate: `go build`, `go vet`, `go test`, `npm run lint`, `npm run build` must all pass before the deploy job runs.
- Automated migration step in the deploy pipeline (or a documented, verified manual runbook that's actually been executed against production for `00009`).
- Health checks on the backend and frontend containers, not just Postgres.
- Graceful shutdown in `cmd/api/main.go` (signal handling + `http.Server.Shutdown`).
- Malformed-ID handlers return 400, not 500, across all `:id` path-param routes.
- A confirmed, documented backup strategy for the Postgres volume.
- Confirmation (from the live VPS, out of this audit's reach) that the Caddy `/internal/*` block is actually deployed.

### Quality DoD (tests and correctness gates)
- Unit/integration tests for `ExchangeService.RunDailyTick` (decay/growth math, matching, expiry) and `DepositService.Pay` (ownership, double-pay, transaction correctness) — these are the two money-relevant code paths and currently have zero regression protection.
- At minimum a smoke-test script for the golden E2E path, runnable in CI.
- A frontend test script (even a minimal one) so `npm run lint`/`build` aren't the only quality signal.

---

## Remaining Work

### P0 — Blockers
- **Add a self-match guard** to `createMatches`/`tryCreateMatch`. *Why unfinished:* no `user_id` comparison exists anywhere in the matching path. *Skill:* Matching Engine. *Scope:* SMALL.
- **Decide and implement real payment integration, or explicitly re-label deposits as simulated everywhere they're shown to users.** *Why unfinished:* `DepositService` is self-documented as mock; presenting it as a real deposit to end users without a real gateway is a trust/commercial risk. *Skill:* Deposits. *Scope:* LARGE (real integration) / SMALL (relabeling only).
- **Run the admin-role migration (`00009`) against production and confirm it.** *Why unfinished:* code exists locally/uncommitted only; the prior CRITICAL fix has no effect until deployed. *Skill:* Security / Admin. *Scope:* SMALL.

### P1 — Required before production
- Block the direct `price`/`currentOffer` PATCH bypass while a listing/request is exchange-active. *Skill:* Price Engine. *Scope:* SMALL.
- Add edit/delete UI for a seller's own listings (API already exists). *Skill:* Listings / Frontend. *Scope:* MEDIUM.
- Add a delete/cancel endpoint *and* UI for buyer requests (API doesn't exist yet either). *Skill:* Buyer Requests. *Scope:* MEDIUM.
- Fix malformed-UUID 500s → 400s on all `:id` handlers. *Skill:* Backend API. *Scope:* SMALL.
- Add a CI gate (build/vet/test/lint) before the deploy job. *Skill:* CI/CD. *Scope:* SMALL.
- Add a baseline automated test suite for `ExchangeService` and `DepositService`. *Skill:* Testing. *Scope:* MEDIUM.
- Wire `DescriptionSection.tsx` to the real description. *Skill:* Listings / Frontend. *Scope:* SMALL.

### P2 — Required for feature completeness
- Wire the homepage `QuickSearch` to actually filter. *Skill:* Search. *Scope:* SMALL.
- Replace `FreshListings`' mock data with a live `GET /cars?sort=newest` call. *Skill:* Search / Frontend. *Scope:* SMALL.
- Build (or formally descope) the remaining 8 admin sections. *Skill:* Admin. *Scope:* LARGE.
- Add a real-time/polling mechanism for notifications. *Skill:* Notifications. *Scope:* MEDIUM.
- Add health checks and graceful shutdown to the backend/frontend containers. *Skill:* Production Readiness. *Scope:* SMALL.

### P3 — Optional improvements
- Remove dead schema/enum values (`matches.cancelled`, `buyer_requests.moderation`, `notifications.deposit_required`) or implement the features they imply.
- Remove the orphaned `frontend/lib/mock/dashboard.ts`.
- Add an admin action audit trail (who approved/rejected/triggered what).
- Add price-history tracking for listings/requests.
- Run `gofmt -w` on `internal/models/models.go` (cosmetic).

---

## Is The Project Finished?

```
NO
```

1. Two explicitly-required protections in the core matching/pricing engine — self-match prevention and manual price-bypass prevention — are confirmed absent in code.
2. The deposit "payment" that underpins the entire marketplace's financial premise is a mock DB toggle with no real payment gateway, confirmed by the code's own documentation.
3. Sellers and buyers have no way to edit or remove their own listings/requests through the product's UI, even though the listing API supports it.
4. There is no delete/cancel capability for buyer requests anywhere — not in the UI, not in the API.
5. 8 of 10 admin panel sections are non-functional placeholders with no backend behind them.
6. Zero automated tests exist anywhere in the project — the two money-relevant code paths (pricing/matching, deposits) have no regression protection at all.
7. CI/CD deploys directly to production on every push to `main` with no test, lint, or migration gate.
8. The homepage's primary search control does not perform the search it visually offers.
9. The most recent security fix (real admin-role authorization) exists only in an uncommitted local working tree and has not been confirmed applied to the production database.
10. No automated backup, health-check, or graceful-shutdown story exists for the production deployment.

---

## Test Environment / Method Notes

This pass did not stand up a live server (no `docker compose up`, no `go run ./cmd/api`); all findings are code-level, obtained by reading source files directly and cross-checking against `go build`/`go vet`/`go test`/`gofmt` run fresh in this session, plus targeted greps for stub/mock markers. Where a claim depends on runtime behavior not re-exercised this pass (e.g., the 500-on-malformed-UUID, the full live E2E click-through), it is explicitly marked as inherited/corroborating rather than freshly reproduced, consistent with this audit's read-only, no-server-changes scope.
