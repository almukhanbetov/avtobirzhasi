# Avtobirzhasi Project Completion Audit

**Scoped update (2026-08-26)**: `STAGE6_AUTOMATED_TESTING_REPORT.md`, `STAGE7_CICD_QUALITY_GATES_REPORT.md`, `STAGE8_PRODUCTION_READINESS_REPORT.md`, `STAGE8B_REAL_PRODUCTION_VERIFICATION_REPORT.md`, and its `Stage 8C VPS Verification` addendum all landed after this audit was written. Per those stages' explicit scope, only the **Automated Testing (Q)**, **CI/CD (R)**, and **Production Readiness (S)** skill sections and the **Overall Completion Score** table below were revised to reflect that work — every other section (including all P0/P1/P2 findings, the E2E table, and every other skill row, including O/M/P which only received small cross-reference notes) still describes the pre-Stage-6 codebase exactly as originally audited, and has *not* been re-verified as part of this update — this deliberately includes the original body text's several references to migration `00009` being unconfirmed in production (e.g. the Executive Verdict, Manual Developer Dependencies, Remaining Work): those are now stale (Stage 8C confirmed it directly against the production schema — see the S section below) but are left as-is outside the scoped S/R/Q sections, consistent with this note's own instruction not to read an unedited section as "still true today." Stage 8B verified CI/production against the *real* GitHub Actions run and live VPS-facing endpoints; Stage 8C then obtained direct, human-executed, read-only VPS/production-DB shell access (this environment itself has none) to close most of what 8B could only mark NOT VERIFIED. See `STAGE8B_REAL_PRODUCTION_VERIFICATION_REPORT.md` (including its Stage 8C section) for exactly what was and wasn't confirmed. Stage 8D (`STAGE8D_BACKUP_DEPLOY_SYNC_REPORT.md`) then built the fix for the backup-scripts-not-on-the-VPS gap directly into the deploy pipeline — implemented and locally verified, but explicitly **not yet exercised against the real VPS** (no push credential in this environment), so it is documented but does not change the S score until confirmed live.

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
| Automated testing | 8% | 38% | 3.0 |
| CI/CD | 5% | 85% | 4.3 |
| Production operations | 7% | 84% | 5.9 |

```
Overall Project Completion ≈ 23.8 + 12.2 + 10.8 + 8.0 + 3.0 + 4.3 + 5.9 = 68.0%  ≈  68%
```

*(Automated testing/CI-CD unchanged this pass. Production operations revised 2026-08-26 per Stage 8C (`STAGE8B_REAL_PRODUCTION_VERIFICATION_REPORT.md`'s Stage 8C section), in which a human operator with real VPS/production-DB access ran the read-only checks this AI environment could not: migration `00009` confirmed applied, Docker containers confirmed healthy with no restart-loop, backend RBAC confirmed correct independent of the reverse proxy, recent logs confirmed clean (one pre-existing, already-tracked malformed-UUID issue aside). The other four rows are unchanged from the original 2026-08-25 audit and were not re-verified in this update. This total still deliberately withholds full credit for backups: `scripts/backup-db.sh`/`restore-db.sh` were confirmed **not present on the VPS at all** — no production backup has ever run, no schedule exists, no off-host storage exists — none of that was upgraded to PASS without direct evidence, per this stage's explicit instruction not to inflate the score.)*

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
| M. Database Integrity | MOSTLY COMPLETE | 80% | 3 dead enum values; migrations now auto-run in the deploy pipeline (Stage 7) — score unchanged since this row covers schema/constraint completeness, not deploy operations (see S); backup/restore mechanism added Stage 8, tracked under S |
| N. Frontend Completeness | PARTIAL | 55% | Stub admin, broken search, fake description, no edit/delete actions anywhere in dashboard rows |
| O. Backend API Completeness | MOSTLY COMPLETE | 70% | Malformed UUID → 500 not 400; some endpoints (listing PATCH/DELETE, request PATCH) unreachable from any UI. *(Stage 8 added graceful shutdown/timeouts/pool config/health-check to the same process — real, verified reliability work, but scored under Production Readiness (S) since this row's own rubric is API-surface completeness, which those changes don't affect; score unchanged.)* |
| P. Security | MOSTLY COMPLETE | 72% | Self-match gap, price-bypass gap, malformed-ID 500, no rate limiting, no admin audit trail. *(Stage 8 re-audited secrets/CORS and found no new issue and no regression — no new gap, but also no fix to any gap listed here; score unchanged. Security headers (HSTS/CSP/etc.) remain unadded, tracked under S.)* |
| Q. Automated Testing | PARTIAL | 38% | *(updated 2026-08-26)* Stage 6 added 22 backend tests (self-match, price/offer bypass, deposit pay/double-pay/ownership, decay/growth math, expiry idempotency, phone normalization) and 33 frontend tests (filters, formatting, phone validation, URL params) — all pure logic/integration, zero component tests, zero E2E, no auth-service/repository/admin/moderation/dashboard coverage |
| R. CI/CD | MOSTLY COMPLETE | 78% | *(updated 2026-08-26)* Stage 7 added backend/frontend/Docker quality gates before deploy, PR checks, migration-failure protection, deploy concurrency control, least-privilege permissions — not yet exercised on GitHub's real infrastructure, no post-deploy smoke test, no automated rollback |
| S. Production Readiness | PARTIAL | 84% | *(updated 2026-08-26, Stage 8C)* Stage 8B's remaining NOT VERIFIED items were closed by a human operator running read-only checks directly on the production VPS/DB (this environment has no VPS/DB credentials of its own — see Stage 8C's report section for exactly what was run). Now directly confirmed on production: `users.role` column exists with `default='user'` and a `CHECK (role IN ('user','admin'))` constraint matching migration `00009` exactly; `docker compose ps` shows postgres/backend/frontend all running with no restart-loop; the backend's own RBAC (`LocalOnly`/`Auth`/`AdminOnly`) returns the correct 401/403 split when tested directly against the backend; recent logs show no panic/fatal/crash-loop (one pre-existing, already-tracked issue remains — malformed-UUID path params logging errors, a known P1 gap, not new). **Still genuinely incomplete**: the backup mechanism Stage 8 built (`scripts/backup-db.sh`/`restore-db.sh`) is **not even present on the VPS** — the deploy pipeline only pulls/runs Docker images, it never syncs repository files like `docker-compose.prod.yml` or `scripts/` onto the server, so nothing has actually been backed up in production, no schedule exists, and there is no off-host backup destination. See `STAGE8B_REAL_PRODUCTION_VERIFICATION_REPORT.md`'s Stage 8C section. |
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

## Testing Completion — Q. Automated Testing: PARTIAL, 38% *(updated 2026-08-26 — see STAGE6_AUTOMATED_TESTING_REPORT.md)*
Original finding (2026-08-25, now stale): `go test ./...` → `[no test files]` for all 9 backend packages; no frontend `test` script; zero `*_test.go`/`*.test.ts(x)` files anywhere.

**Current state**: Stage 6 closed the zero-coverage gap for the two money-relevant code paths this audit flagged as having "no regression protection at all" (§ Project Definition of Done, Quality DoD):
- Backend: 22 tests across `phone_test.go`, `deposits_test.go`, `exchange_test.go` (service layer) and `listings_update_test.go`, `requests_update_test.go` (handler layer, real HTTP via `httptest`). Directly covers: self-match is never created (the exact Stage 2 regression), `PATCH price`/`currentOffer` bypass rejection (the other Stage 2 regression), the full deposit-pay flow to `confirmed`, double-pay rejection, wrong-user rejection, a failing payment provider leaving state untouched, daily decay/growth math, overdue-match expiry with refund, and daily-tick idempotency. Runs against a dedicated `avtobirzhsi_test` database, never the dev/prod database.
- Frontend: `vitest` + `@testing-library/react` newly installed (there was none before); 33 tests covering `parseCarFilters`/`countActiveFilters`, `formatTenge`/`formatMileage`, `pluralizeCars`, the phone-normalization Zod schema (cross-checked against the backend's own normalization), and `buildHref`/`getParam`. All pure-logic — **no component was ever rendered/tested**.
- Still zero coverage: `AuthService` (register/login/JWT issuance), any repository in isolation, admin/moderation/dashboard/notification handlers, and everything in the frontend that isn't a pure `lib`/`features` function (i.e. no component, page, or hook has a test).
- 38% reflects real, targeted regression protection on the two highest-risk mechanics existing where there was none, while most of the codebase (by file count) remains as untested as before.

## CI/CD Completion — R. CI/CD: MOSTLY COMPLETE, 85% *(updated 2026-08-26 — see STAGE7_CICD_QUALITY_GATES_REPORT.md and STAGE8B_REAL_PRODUCTION_VERIFICATION_REPORT.md)*
Original finding (2026-08-25, now stale): `.github/workflows/deploy.yml` triggered on every push to `main`, built and pushed both Docker images, then SSHed into the VPS and ran `docker compose pull && up -d` — no test/lint/build/migration gate of any kind.

**Current state**: Stage 7 restructured the same workflow into `backend-quality` → `frontend-quality` → `docker-build` → `build-and-push` → `deploy`, wired with `needs` so any gate failing blocks the production push and the SSH deploy:
- `backend-quality`: `go build`/`go vet`/`go test -p 1 ./...` against a GitHub Actions Postgres 17 service container, migrated with the project's own Goose migrations — never production data.
- `frontend-quality`: `npm run test` (Vitest), `npm run lint`, `npx tsc --noEmit`, `npm run build` — the real scripts from `frontend/package.json`, no new framework introduced.
- `docker-build`: both production Dockerfiles actually build (verified locally this stage too), `push: false`, no registry credentials needed — catches a Docker-specific failure one job earlier than before, and now also runs on every PR.
- Now also triggers on `pull_request` — a PR gets the same three gates without ever reaching the real image push or the SSH deploy (enforced by `needs` and a belt-and-suspenders `if: github.event_name == 'push' && ...`).
- **New**: a migration step (`docker compose run --rm --entrypoint sh backend -c './goose ... up'`) now runs automatically before `up -d`, using the same `set -e` the script already had — a migration failure now blocks the deploy instead of migrations simply never running. This directly narrows (does not fully close — see below) Manual Developer Dependency #2.
- **New**: `concurrency` on `build-and-push`/`deploy` prevents two overlapping production deploys; `timeout-minutes` on every job; workflow-level `permissions: contents: read` (was previously unset/default).
- **Updated 2026-08-26 (Stage 8B)**: this pipeline has now actually run on GitHub's real infrastructure, not just been reasoned about — commit `3ca8c1f`'s run (https://github.com/almukhanbetov/avtobirzhasi/actions/runs/32940395545) shows all 5 jobs (`backend-quality`, `frontend-quality`, `docker-build`, `build-and-push`, `deploy`) with conclusion `success`, and the real job timestamps confirm `needs` was honored (each job started only after its dependencies finished, not just declared to). Still open: no post-deploy smoke test *built into the workflow itself* (Stage 8B performed one manually, outside CI); no automated rollback beyond re-running an older workflow run.

## Production Readiness — S. Production Readiness: PARTIAL, 84% *(score unchanged 2026-08-26 — see STAGE8D_BACKUP_DEPLOY_SYNC_REPORT.md; STAGE8_PRODUCTION_READINESS_REPORT.md and STAGE8B_REAL_PRODUCTION_VERIFICATION_REPORT.md/Stage 8C remain the basis for the 84% itself)*

**Stage 8D (2026-08-26, implemented but not yet deployed — score deliberately not bumped)**: Stage 8C found the backup mechanism Stage 8 built was never actually on the VPS at all (`scripts/backup-db.sh`: NOT PRESENT) — root cause: the deploy pipeline only ever pulled/ran Docker *images*, never repository files. Stage 8D added an `scp`-based sync step to `.github/workflows/deploy.yml` (copying exactly `docker-compose.prod.yml`, `scripts/backup-db.sh`, `scripts/restore-db.sh` — no secrets, no source code) plus, in the existing SSH deploy script: making the scripts executable, installing an idempotent daily 03:00 backup cron job (verified via a corrected local simulation to be non-duplicating and to leave unrelated cron entries untouched), and running+verifying one backup immediately on every deploy (failing the deploy visibly if it produces no non-empty file). **All of this is implemented and locally verified, but none of it has been exercised against the real VPS yet** — this AI environment has no push credential for this repository (same limitation as Stages 7/8B), so the score stays at 84% until a real deploy confirms it, per this stage's own explicit instruction not to upgrade an untested mechanism to a higher score. See `STAGE8D_BACKUP_DEPLOY_SYNC_REPORT.md` for the full design and local-verification evidence.
Original findings (2026-08-25, now stale except where noted): `restart: unless-stopped` on all three services was already in place; Postgres already had a real `healthcheck` gating backend startup.

**Stage 8B live verification (2026-08-26)**, against the real production system rather than local reproduction: `https://avtobirzhasi.kz` and `https://www.avtobirzhasi.kz` both return `200` over valid, non-expired TLS (Let's Encrypt, expires 2026-10-24); `http://` correctly redirects to `https://`; `https://api.avtobirzhasi.kz/api/health` returns live `200 {"status":"ok"}` — this is Stage 8's new DB-connectivity check genuinely passing against the production database right now, not a stale/cached response; CORS was confirmed to correctly allow `https://avtobirzhasi.kz` and correctly reject an arbitrary origin, live. A new finding from this pass: hitting `/internal/*` from outside returns the *backend's own* `LocalOnly()` 403 JSON, not Caddy's documented `respond 404` — meaning the request reached the Go process rather than being stopped at the edge as `Caddyfile.avtobirzhasi`'s own comments say it must. No actual exposure resulted (the backend's independent check still correctly denied it), but it means the live Caddy config's exact state doesn't fully match what's documented in this repo — flagged for a human with VPS access to confirm directly. Migration `00009`'s schema state, the VPS's actual Docker container health, and production logs all remain **NOT VERIFIED** — no VPS or production-DB credentials exist in this environment, and none were guessed at.

**Stage 8C VPS verification (2026-08-26)**, performed by a human operator with real VPS/production-DB shell access (this AI environment has none — it does not run these commands itself): `docker compose -f docker-compose.prod.yml ps` shows postgres/backend/frontend all running, Postgres healthy, no restart-loop. Direct schema query confirms `users.role` exists with `column_default='user'::character varying` and a `CHECK` constraint restricting it to `('user','admin')` — **migration `00009` is confirmed applied to production**, closing the single biggest NOT VERIFIED item from Stage 8B. Testing the backend directly on its loopback port (bypassing Caddy entirely) confirms `LocalOnly`/`Auth`/`AdminOnly` produce the correct 401/403 split independent of the reverse proxy. Recent logs show no panic/fatal/crash-loop; the one error pattern present (malformed UUID path params, e.g. a stray `car-3`-shaped id) is the same pre-existing, already-tracked P1 gap this audit's Backend Completion (O) section already lists — not a new issue, not something Stage 8C fixed. **Backups remain unresolved**: `scripts/backup-db.sh`/`restore-db.sh` are **not present on the VPS at all** — confirming the operational gap that the deploy pipeline only pulls/runs Docker images and never syncs repository files (`docker-compose.prod.yml`, `scripts/`) onto the server. Nothing has been backed up in production, no schedule exists, and there is no off-host destination.

**Current state (Stage 8)**:
- **Health checks — closed.** `/api/health` now checks DB connectivity via `pool.Ping` and returns 503 if unreachable (previously a static `{"status":"ok"}` that proved nothing about the database). Live-verified locally (200 → stop DB → 503 → restart DB → 200).
- **Docker healthcheck — closed.** `backend`/`frontend` containers now both have a real `healthcheck` (`wget --spider`), verified to actually pass/fail correctly inside the built images; `frontend`'s `depends_on` upgraded to `condition: service_healthy` on `backend`. Previously only Postgres had one.
- **Graceful shutdown — closed.** `cmd/api/main.go` now uses `signal.NotifyContext` + an explicit `http.Server` + `Shutdown(ctx)`, live-verified with a real SIGTERM (drains, logs, exits cleanly — no force-kill needed).
- **Server timeouts — closed.** `ReadHeaderTimeout`/`ReadTimeout`/`WriteTimeout`/`IdleTimeout` added; previously Gin's zero-value defaults (none) applied.
- **DB pool — closed.** Explicit `MaxConns=10`/`MinConns=2`/lifetime/idle limits added (previously pgx's silent implicit defaults); startup `Ping` is now bounded-retried (~20s) instead of a single all-or-nothing check.
- **Background job lifecycle — closed.** The daily-tick scheduler now stops cleanly on shutdown and recovers a panic instead of crashing the whole process (a real, previously-unprotected gap — a panic in this specific goroutine wasn't caught by Gin's `Recovery()` middleware, unlike a panic inside an HTTP handler).
- **Backups — mechanism verified, but not yet deployed to the VPS at all.** `scripts/backup-db.sh`/`scripts/restore-db.sh` were added and verified end-to-end (backup, restore into a scratch DB, and the restore script's refusal to target the production DB name) against the local dev database. **Stage 8C confirmed directly on the VPS that these scripts don't exist there** — the deploy pipeline only pulls/runs Docker images, it never syncs repository files onto the server, so a human must separately `git pull` or `scp` them over before any production backup can run. No schedule and no off-host storage exist either, as a direct consequence.
- **Caddy config is still just a snippet** — correct as written (Caddy's automatic HTTPS + HTTP→HTTPS redirect, `/internal/*` blocked), unchanged by Stage 8, still not verifiable from this repo whether it's actually merged live on the VPS.
- **Updated 2026-08-26 (Stage 8C): the admin-role migration (`00009`) is now confirmed applied to production** via a direct schema query run by a human operator on the VPS (`users.role`, correct default, correct `CHECK` constraint) — this item is now `PASS`, no longer `NOT VERIFIED`.
- Still open, unchanged: no log aggregation/alerting (stdout-only, nothing pages a human on repeated failure), no structured logging, no error-tracking integration, no security headers (HSTS/CSP/etc.) in Caddy, no off-host backup destination, multi-instance job safety remains explicitly out of scope by design.
- Secrets via `.env`/`backend.env`/`frontend.env` files, not a secrets manager — unchanged, still acceptable for this scale, re-confirmed clean (no real secret committed) by Stage 8's own re-audit.

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
