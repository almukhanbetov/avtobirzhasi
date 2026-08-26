# Avtobirzhasi Functional Audit

Audit date: 2026-08-23
Branch: `main` @ `996858a` ("fix: allow production frontend origins in CORS")
Scope: read-only analysis, safe local build/test/E2E verification. No code changes, no commits, no destructive operations, no production deploy.

---

## 1. Executive Summary

> **Update (Stage 1, same day):** the CRITICAL admin-authorization finding below has been fixed and verified — see **"Stage 1 — Admin Authorization Fix"** near the end of this document for the full writeup, or `STAGE1_ADMIN_AUTHORIZATION_REPORT.md` for the standalone report. Everything else in this document (including the counts immediately below) reflects the **original, pre-fix audit** and is left as-is for historical record; only this summary paragraph, §5, §14, §18, §22 and §23 carry forward pointers to the fix.

Avtobirzhasi is a working MVP of a car-exchange marketplace (Go/Gin/PostgreSQL backend, Next.js 16 frontend). The core, distinguishing feature — the "Auto Exchange" price-convergence + matching engine — is **fully implemented and was verified end-to-end live** in this audit: seller price decays -1%/day, buyer offer grows +1%/day, a match forms once the gap is ≤2%, both parties pay a 1% deposit, and counterpart phone numbers unlock only once both deposits are confirmed. Ownership/IDOR checks on every tested mutation endpoint held up correctly.

The rest of the product is much thinner than the "Auto Exchange" core suggests: 8 of 10 admin sections are unbuilt stubs, the `/exchange` marketing page is entirely illustrative (hardcoded/simulated data, no live API calls), the homepage quick-search and "fresh listings" are non-functional/hardcoded, and a seller's actual listing description is captured but never displayed (a canned generated blurb is shown instead). There is a real, live admin-authorization gap: the only thing protecting `/internal/*` (moderation, admin stats, the daily-tick trigger) is a TCP-peer loopback check with no user/role concept at all — sound in the current single-host deployment (and correctly blocked at the edge by a documented Caddy snippet), but fragile, and the Next.js `/admin/*` routes have **zero** frontend gating of their own. **(Fixed in Stage 1 — see below.)**

Counts (see §4 for detail; original pre-Stage-1 audit numbers, unchanged as a historical baseline):
- **Features/areas mapped**: ~30
- **PASS**: 20
- **FAIL**: 6
- **PARTIAL**: 3
- **NOT IMPLEMENTED**: 4 (as distinct admin sections, counted individually in §14; core admin surface is 2 of 10)
- **NOT VERIFIED**: 2

**Critical issues**: 1 (no admin-role authorization model; mitigated by network-layer control, but structurally absent) — **RESOLVED in Stage 1, see below. Current critical count: 0.**
**High issues**: 4 (self-match not prevented; price/offer directly editable, bypassing the exchange engine; malformed-ID 500s; seller description never rendered) — unchanged, out of scope for Stage 1.
**Medium issues**: 5 originally; **4 remaining** after Stage 1 (the "no frontend gate on `/admin/*`" item was fixed alongside the admin-authorization work — see "Stage 1 — Admin Authorization Fix" and §19).
**Low issues**: 4

---

## 2. System Architecture

```
Browser (Next.js client)
        │
        ▼
Next.js 16 app (frontend/, App Router)
  - Server components fetch directly from the Go API at build/request time
  - Client components use lib/api/* (fetch wrapper) + React Query
        │  NEXT_PUBLIC_API_URL (default http://localhost:8080/api)
        ▼
Go API (backend/cmd/api, Gin)
  /api/*        — public + JWT-protected routes (CORS-restricted allow-list)
  /internal/*   — LocalOnly()-gated routes (moderation, admin stats, daily-tick trigger)
        │
        ▼
Services (internal/service): AuthService, ExchangeService, DepositService
        │
        ▼
Repositories (internal/repository) — raw SQL over pgx
        │
        ▼
PostgreSQL 17 (users, listings, listing_images, buyer_requests, matches,
               deposits, notifications, favorites)

Background component:
  runDailyTickScheduler goroutine (cmd/api/main.go) — time.Ticker(24h) →
  ExchangeService.RunDailyTick (decay → grow → match → expire)
  Also manually triggerable via POST /internal/jobs/run-daily-tick (LocalOnly)

Production topology (docker-compose.prod.yml + Caddyfile.avtobirzhasi):
  Caddy (TLS termination) → 127.0.0.1:3000 (frontend) / 127.0.0.1:8080 (backend)
  Caddy explicitly returns 404 for /internal/* on the public API host —
  this is the real perimeter control for the admin/internal surface.
```

No message queue, cache layer, file/object storage, or payment gateway exists. Deposit "payment" is a DB-state toggle only (no external payment integration) — confirmed by both code and an explicit frontend comment (`lib/api/deposits.ts:14`).

---

## 3. Existing Features

| Feature | Frontend | API | Database | Status |
|---|---|---|---|---|
| Registration | `/login` (RegisterForm) | `POST /api/auth/register` | `users` | IMPLEMENTED |
| Login | `/login` (LoginForm) | `POST /api/auth/login` | `users` | IMPLEMENTED |
| Logout | `AuthStatus`/`AuthProvider` (client-side token clear) | — (stateless JWT, no endpoint) | — | IMPLEMENTED |
| Current user | `AuthProvider` (session revalidation) | `GET /api/auth/me` | `users` | IMPLEMENTED |
| Listing create | `/sell/new` (ListingForm) | `POST /api/listings` | `listings`, `listing_images` | IMPLEMENTED |
| Listing update | dashboard (implied; no dedicated edit UI found) | `PATCH /api/listings/:id` | `listings` | PARTIALLY IMPLEMENTED (API works; no frontend edit form was found) |
| Listing delete (soft) | dashboard | `DELETE /api/listings/:id` | `listings` (status→archived) | IMPLEMENTED |
| Listing list/detail | `/cars`, `/cars/[id]` | `GET /api/cars`, `GET /api/cars/:id` | `listings`, `listing_images` | IMPLEMENTED |
| Similar cars | `/cars/[id]` (SimilarCars) | `GET /api/cars/:id/similar` | `listings` | IMPLEMENTED |
| Filters/search | `/cars` (FilterSidebar/FilterChips) | `GET /api/cars?...` | `listings` | IMPLEMENTED |
| Seller public profile | `/cars/[id]` (SellerCard) | `GET /api/sellers/:id` | `users` | IMPLEMENTED |
| Favorites | dashboard, `FavoriteButton` | `GET/POST/DELETE /api/favorites` | `favorites` | IMPLEMENTED |
| Buyer request create | `/exchange/new` (RequestForm) | `POST /api/requests` | `buyer_requests` | IMPLEMENTED |
| Buyer request update | dashboard | `PATCH /api/requests/:id` | `buyer_requests` | IMPLEMENTED |
| Price engine (decay/growth) | `PriceMovement` badge (real data), `ExchangeSimulator` (fake data) | driven by scheduler, not a user-facing endpoint | `listings`, `buyer_requests` | IMPLEMENTED |
| Matching engine | `/dashboard/matches` | `GET /api/dashboard/matches`, `GET /api/matches/:id` | `matches` | IMPLEMENTED |
| Freeze on match | (implicit in status) | (implicit) | `listings.status`, `buyer_requests.status` | IMPLEMENTED |
| Deposits | `/dashboard/deposits` | `GET /api/dashboard/deposits`, `POST /api/deposits/:id/pay` | `deposits` | IMPLEMENTED |
| Contacts unlock | `/dashboard/matches` (MatchCard) | `GET /api/matches/:id` | `matches`, `users` | IMPLEMENTED |
| Expiration sweep | — | part of daily tick | `matches`, `deposits` | IMPLEMENTED (lazy/tick-driven) |
| Notifications | `/dashboard/notifications` | `GET /api/notifications`, `PATCH /api/notifications/:id/read` | `notifications` | IMPLEMENTED |
| Dashboard overview | `/dashboard` | `GET /api/dashboard/overview` | multiple | IMPLEMENTED |
| Admin: moderation | `/admin/moderation` | `GET/POST /internal/listings/*` | `listings` | IMPLEMENTED |
| Admin: stats | `/admin` | `GET /internal/admin/stats` | multiple | IMPLEMENTED |
| Admin: users/listings/requests/matches/deposits/notifications/reviews/settings | `/admin/*` pages | none | none | UI ONLY (stub) |
| Exchange marketing page | `/exchange` | none (hardcoded/simulated) | none | UI ONLY |
| Homepage quick search | `/` (QuickSearch) | none (link is static) | — | NOT WORKING |
| Homepage fresh listings | `/` (FreshListings) | none (mock data) | — | NOT WORKING (as live data; UI itself renders) |
| Listing description display | `/cars/[id]` (DescriptionSection) | reads mock generator, not `car.description` | `listings.description` (stored, unused) | NOT WORKING |
| i18n (RU/KZ) | site-wide | — | — | IMPLEMENTED |
| Self-match prevention | — | none found | `matches` | NOT IMPLEMENTED |

---

## 4. Functional Test Results

All tests run against a local instance: Postgres 17 in Docker (`avtobirzhasi_postgres`, fresh volume, migrations applied via goose), Go API run directly (`go run ./cmd/api`, port 8090 to avoid a port clash with an unrelated container already on 8080), seeded via `go run ./cmd/seed` (6 sellers / 20 listings, the project's own idempotent fixture loader). Frontend was **not** run as a live dev server in this pass (build/lint were run instead, see §15); all functional tests below are direct API-level black-box tests, which is where all real business-logic and authorization enforcement actually lives per the frontend audit (`RequireAuth` is explicitly documented as non-security).

| # | Function | Test | Expected | Actual | Status |
|---|---|---|---|---|---|
| 1 | Register | `POST /auth/register` x2 (seller, buyer) | 201 + token | 201 + token, both accounts created | PASS |
| 2 | Login | `POST /auth/login` for both | 200 + token | 200 + token | PASS |
| 3 | Current user | `GET /auth/me` with seller token | Seller profile | Correct profile returned | PASS |
| 4 | Create listing | `POST /listings` (Toyota Camry, isExchange:true) as seller | 201, status=moderation | 201; confirmed `moderation` via `/internal/listings/pending` | PASS |
| 5 | Create buyer request | `POST /requests` (Toyota Camry 2018–2022, offer 9,000,000) as buyer | 201, status=active | 201, `currentOffer:9000000, status:active` | PASS |
| 6 | Moderation approve | `POST /internal/listings/:id/approve` | Listing → active, visible on `/cars` | Confirmed active, visible via `GET /cars/:id` | PASS |
| 7 | Price engine — seller decay | 5x `POST /internal/jobs/run-daily-tick` | Price × 0.99⁵ ≈ 9,509,900 | `finalPrice: 9509900` exactly | PASS |
| 8 | Price engine — buyer growth | Same 5 ticks | Offer × 1.01⁵ | `requestsGrown:1` each tick (buyer offer grew every tick) | PASS |
| 9 | Matching engine | Same 5 ticks, tolerance 2% | Match created once gap ≤2% | `matchesCreated:1` on tick 5, `matches.total:1` | PASS |
| 10 | Deposit auto-creation | Inspect match | 2 deposits (1% each), `pending` | `depositAmount:95099` (1% of 9,509,900), both pending | PASS |
| 11 | Contacts hidden pre-deposit | `GET /matches/:id` before any deposit paid | No phone in response | `counterpart:{"name":"Test Buyer"}` — no phone | PASS |
| 12 | IDOR — view others' match | 3rd user ("Eve") `GET /matches/:id` | 403 | `403 FORBIDDEN` | PASS |
| 13 | IDOR — pay others' deposit | Eve `POST /deposits/:sellerDepositId/pay` | 403 | `403 "Это не ваш депозит"` | PASS |
| 14 | Pay seller deposit | Seller pays own deposit | 200, match→seller_deposit_paid | Confirmed | PASS |
| 15 | Contacts still hidden (1 of 2 paid) | `GET /matches/:id` as buyer | No phone yet | No phone; status `seller_deposit_paid` | PASS |
| 16 | Double-pay prevention | Seller re-pays same deposit | Reject | `409 "Депозит уже обработан..."` | PASS |
| 17 | Pay buyer deposit | Buyer pays own deposit | 200, match→confirmed | Confirmed | PASS |
| 18 | Contacts unlock (both paid) | `GET /matches/:id` as seller | Buyer phone visible | `"phone":"+77011113333"` returned | PASS |
| 19 | IDOR — edit others' listing | Eve `PATCH`/`DELETE` on seller's listing | 403 | `403 "Это не ваше объявление"` both | PASS |
| 20 | Owner edit own listing | Seller `PATCH` own description | 200, field updated | Confirmed | PASS |
| 21 | Notifications generated | `GET /notifications` as seller | match_found, deposit_received, contacts_open | All 3 present, correct order | PASS |
| 22 | Mark notification read | `PATCH /notifications/:id/read` | `read:true` on reload | Confirmed | PASS |
| 23 | Favorites add/list/remove | Buyer favorites the listing | Add→appears in list→remove | All 3 steps worked | PASS |
| 24 | Dashboard overview | `GET /dashboard/overview` | Aggregate counts + tasks | Correct counts, task list from notifications | PASS |
| 25 | Auth required on protected routes | No token / garbage token on `/dashboard/listings` | 401 | 401 both cases | PASS |
| 26 | Unauthenticated admin/internal access (from localhost) | No-auth `GET /internal/admin/stats`, `/internal/listings/pending`, `POST /internal/jobs/run-daily-tick` | Behavior gated by LocalOnly, not by user auth | All returned 200 with **zero authentication** — expected per design (LocalOnly is TCP-peer-based, not user-based), but confirms there is no user/role auth layer at all on these routes | PARTIAL (works as designed, but the design has no user-level admin auth — see §18) |
| 27 | Self-match | Seller creates a buyer request matching own already-frozen listing, then tick | No match (or explicit rejection) | Did not match — but only because the listing was already `frozen` from test #9's match, not because of an ownership check (confirmed by code: no `user_id` comparison anywhere in `createMatches`) | NOT VERIFIED live / FAIL by code review — see §9, §18 |
| 28 | Malformed resource ID | `GET /cars/not-a-uuid` | 400 Bad Request | **500 Internal Server Error** | FAIL |
| 29 | Nonexistent resource ID | `GET /cars/<random-uuid>` | 404 | 404 | PASS |
| 30 | Backend build/vet/test | `go build`, `go vet`, `go test ./...` | Clean | All clean; **zero test files exist** in the module | PARTIAL (builds clean, no test suite to actually assert correctness) |
| 31 | Backend format check | `gofmt -l .` (list only) | Clean | 1 file not gofmt-clean: `internal/models/models.go` (whitespace/alignment only) | FAIL (cosmetic) |
| 32 | Frontend lint | `npm run lint` | Clean | 0 errors, 1 advisory warning (`ListingForm.tsx:59`, react-hooks/incompatible-library) | PASS |
| 33 | Frontend build | `npm run build` | Clean | Passed, 27 routes generated, Turbopack, TS check clean | PASS |

---

## 5. Authentication & Authorization

- Registration/login/`/me` all work correctly (tests 1–3). Phone normalization accepts `+7`, `8`, `7`, and bare 10-digit KZ formats, rejects everything else. Login returns an identical error for "no such phone" and "wrong password" (anti-enumeration, deliberate).
- JWT: HS256, `JWT_SECRET` env, 7-day expiry, `Authorization: Bearer` header, no refresh/blacklist (expected for a stateless-JWT MVP design, not itself a bug).
- Every tested ownership-gated endpoint (listing edit/delete, buyer-request edit, deposit pay, notification mark-read, match view) correctly rejects a non-owner with 403 (tests 12, 13, 19). The one money-moving path (`DepositService.Pay`) re-checks ownership **inside a `SELECT ... FOR UPDATE` transaction**, not just at the handler layer — correct defense-in-depth.
- ~~**No role/admin concept exists in the schema or code at all.** `users` has no `is_admin`/`role` column. The three admin-ish backend endpoints are gated only by `middleware.LocalOnly()`, a raw-TCP-peer (`RemoteAddr`, deliberately not the spoofable `ClientIP()`) loopback check — see §18 for full analysis.~~ **FIXED in Stage 1**: `users.role` (`user`/`admin`, default `user`, added via migration `00009_add_user_role.sql`) now exists, and the three admin endpoints require `middleware.Auth()` + `middleware.AdminOnly()` in addition to the pre-existing `middleware.LocalOnly()`. See "Stage 1 — Admin Authorization Fix" below.
- Frontend `RequireAuth` explicitly documents itself as UX-only, not a security boundary — confirmed correct: real enforcement is 100% server-side.

## 6. Listings

Create/read/list/filter/similar/favorite/soft-delete all verified working (tests 4, 6, 9, 19, 20, 23). New listings correctly start in `moderation` and are invisible on the public catalog until approved. Enum validation (transmission/fuel/body/drivetrain/steering) is enforced via Gin binding tags. Only `price/mileageKm/description/region/color` are patchable post-creation; make/model/year/specs are immutable by design.

**Gap**: no dedicated frontend "edit listing" UI was found by the frontend agent, even though the API supports `PATCH`. **Gap**: `PATCH` accepts a new `price` at any time with no check on `status`/`is_exchange`, so an owner can manually force/skip the ±1%/day mechanic (see §8).

## 7. Buyer Requests

Create/list/update verified (tests 5, 21). `yearFrom <= yearTo` validated. `current_offer` seeded from `initial_offer` and grown daily by the engine. Same direct-edit gap as listings: `PATCH currentOffer` bypasses the daily-growth mechanic. No delete/archive endpoint exists for buyer requests (only Create/Update/List) — the `moderation` status value in the DB CHECK constraint is dead code for this table (never set by any handler).

## 8. Price Engine

Formula, verified against both code and live behavior:
- Seller listing price: `price = round(price × (1 − 0.01))` per tick, floored at 1 (`backend/internal/service/exchange.go`, `dailyRate = 0.01`).
- Buyer offer: `current_offer = round(current_offer × (1 + 0.01))` per tick, unconditionally for every `active` buyer_request (there's no `is_exchange` flag on that table — every buyer request is inherently an exchange participant).
- Driven by a single `time.Ticker(24h)` goroutine (`cmd/api/main.go`), plus an on-demand `POST /internal/jobs/run-daily-tick` for testing — **confirmed as the only background job/scheduler in the entire codebase**.
- **No price-history table exists** — no migration, no `price_histories`, nothing. The `dailyChangePercent:-1` field the frontend shows is a hardcoded literal whenever `is_exchange=true`, not derived from any stored movement record.
- Live-verified: 10,000,000 → 9,509,900 after 5 ticks = exactly `10,000,000 × 0.99⁵`, confirming compounding, not simple, decay.
- **Bypass**: owner-facing `PATCH /listings/:id` / `PATCH /requests/:id` let either party set `price`/`currentOffer` directly, with no guard tied to `is_exchange` or `status`. This undermines the entire premise of a fair, time-based convergence mechanic — either side can force an instant match or hold their price after expiry resumes.

## 9. Matching Engine

Formula, verified against code and live behavior:
- Candidates: `listings.status='active' AND is_exchange=true` joined to `buyer_requests.status='active'` on exact `region`, `make`, `model`, and `listing.year BETWEEN request.year_from AND request.year_to`.
- Tolerance: `abs(listing.price − request.current_offer) / listing.price × 100 <= 2.0` (hardcoded `matchTolerancePercent = 2.0`).
- Live-verified: match fired exactly on the tick where the gap first closed to within 2%.
- Duplicate-match prevention: no DB unique constraint, but correctly serialized via `SELECT ... FOR UPDATE` per candidate pair inside a transaction, re-checking both rows are still `active` before flipping to `frozen` — sound.
- **No self-match guard**: neither the matching SQL nor `tryCreateMatch` compares `listing.user_id` to `buyer_request.user_id`. A user with a matching listing and a matching buyer request of their own would match with themselves. Live test was inconclusive only because the test listing was already engaged in a prior match (frozen) — the code-level absence of any ownership check is the actual finding and stands on its own regardless.
- Already-frozen/moderation/archived rows are correctly excluded (only `status='active'` rows are candidates).

## 10. Deal Lifecycle

Actual states found in the schema/code (not a hypothesized flow):

```
LISTING:        moderation → active ⇄ frozen → active (post-expiry) | archived
BUYER_REQUEST:   active ⇄ frozen → active (post-expiry)
MATCH:           awaiting_deposit → seller_deposit_paid ┐
                                  → buyer_deposit_paid  ┴→ confirmed
                 (any non-terminal) → expired
                 cancelled — defined in schema, NEVER produced by any code path (dead state)
DEPOSIT:         pending → paid → refunded (on parent match expiry only)
```

Verified live: `moderation→active` (test 6), `active→frozen` on match (test 9), `awaiting_deposit→seller_deposit_paid→confirmed` (tests 14, 17). Expiry path (`→expired`, deposit `→refunded`) exists in code (`expireOverdueMatches`, 48h deadline) but was **not exercised live** in this audit (would require waiting out/mocking the 48h deadline) — NOT VERIFIED, code-confirmed only.

## 11. Deposits

- Amount: exactly 1% of `final_price` (`math.Round(finalPrice * 0.01)`), confirmed live: 9,509,900 → 95,099.
- Created atomically with the match in the same DB transaction (both rows, `pending`).
- No DB unique constraint against double-pay, but the service layer correctly blocks it via a status check inside a row-locked transaction — live-verified (test 16, `409 CONFLICT`).
- Refund only happens via match expiry (not independently testable without waiting/mocking 48h) — NOT VERIFIED live, code-confirmed.
- No deposit-level TTL; expiry is entirely inherited from the parent match's `deadline`.

## 12. Contacts Unlock

Gate is `match.status == "confirmed"`, itself only reachable when **both** deposits are `paid` — re-checked server-side on every read of `GET /matches/:id`, not cached/trusted from the client. Live-verified through the full sequence: hidden → still hidden after 1 of 2 deposits → visible after both (tests 11, 15, 18). No alternate endpoint exposing a counterpart's phone was found (`ListMine`/dashboard list never includes it).

## 13. Notifications

`match_found`, `deposit_received`, `contacts_open` all correctly generated server-side and observed in order during the live test (test 21); mark-as-read verified (test 22). No user-facing "create notification" endpoint exists (correct — notifications should only ever be system-generated). One dead enum value: `deposit_required` is declared in the DB CHECK constraint but no code path ever inserts it.

## 14. Admin

Real, backend-wired admin functionality is limited to exactly **2 of 10** sidebar sections:
- **Moderation** (`/admin/moderation` → `/internal/listings/pending|approve|reject`) — IMPLEMENTED, verified live (test 6).
- **Stats** (`/admin` → `/internal/admin/stats`) — IMPLEMENTED, verified live (test 26), correct aggregate counts observed across the whole test run.

The other 8 (`users`, `listings`, `requests`, `matches`, `deposits`, `notifications`, `reviews`, `settings`) are literal `<AdminComingSoon>` placeholders with zero data fetching — UI ONLY / NOT IMPLEMENTED. This is consistent frontend-to-backend (the backend genuinely has no endpoints for these either), not a hidden gap on one side only.

**Authorization**: ~~no role/admin-user concept exists anywhere. `/internal/*` is gated purely by `LocalOnly()` (TCP-peer check), and `/admin/*` on the frontend has **no gate at all** (no `RequireAuth`, no redirect) — anyone can load the admin shell UI in their browser; what actually protects the data is solely the backend's network-layer check plus the production Caddy config explicitly 404-ing `/internal/*` at the edge (see §18).~~ **FIXED in Stage 1** — see "Stage 1 — Admin Authorization Fix" below.

## 15. Background Jobs

Exactly one: `runDailyTickScheduler` (`cmd/api/main.go`), a `time.Ticker(24h)` goroutine calling `ExchangeService.RunDailyTick`, which runs four steps in sequence each tick: decay seller prices → grow buyer offers → create matches → expire overdue matches. Also triggerable on-demand via `POST /internal/jobs/run-daily-tick` (used extensively in this audit's live testing, tests 7–9). Confirmed to be the **only** goroutine/ticker/cron in the codebase (no cron library dependency exists in `go.mod`). Not distributed-safe by explicit design (single-instance MVP assumption, documented in code).

## 16. Database

| Table | Purpose | Key FKs | Notable statuses / constraints |
|---|---|---|---|
| `users` | Accounts | — | `phone` UNIQUE; `account_type` CHECK(`private`,`dealer`) |
| `listings` | Car listings | `user_id→users` | `status` CHECK(`active`,`frozen`,`moderation`,`archived`), default `moderation`; enum CHECKs on transmission/fuel/body/drivetrain/steering; `is_exchange`, `initial_price`, `exchange_started_at` |
| `listing_images` | Photos | `listing_id→listings` ON DELETE CASCADE | ordered by `position` |
| `buyer_requests` | Buy-side requests | `user_id→users` | `status` CHECK same 4 values as listings (`moderation` unused in practice) |
| `matches` | Seller↔buyer pairing | `listing_id→listings`, `buyer_request_id→buyer_requests` | `status` CHECK(6 values incl. dead `cancelled`); `deadline` NOT NULL |
| `deposits` | 1% holds per match/role | `match_id→matches`, `user_id→users` | `role` CHECK(`seller`,`buyer`); `status` CHECK(`pending`,`paid`,`refunded`) |
| `notifications` | User alerts | `user_id→users`, optional `related_match_id`, `related_listing_id` | `type` CHECK(5 values incl. dead `deposit_required`); composite index `(user_id, read)` |
| `favorites` | Saved listings | `user_id→users`, `listing_id→listings` | `UNIQUE(user_id, listing_id)` |

No `price_histories` table exists — price movement is not audited/stored historically, only the current value.

## 17. Frontend → API → DB Mapping

**Authentication**
```
frontend/features/auth/LoginForm.tsx
  ↓ POST /api/auth/login
backend/internal/handlers/auth.go (AuthHandler.Login)
  ↓ service/auth.go (AuthService.Login) — bcrypt compare, JWT issue
  ↓ repository/users.go
PostgreSQL: users
```

**Listing creation**
```
frontend/features/listings/ListingForm.tsx
  ↓ POST /api/listings
backend/internal/handlers/listings.go (ListingsHandler.Create)
  ↓ repository/listings.go (Create + AddImage)
PostgreSQL: listings, listing_images
```

**Buyer request**
```
frontend/features/requests/RequestForm.tsx
  ↓ POST /api/requests
backend/internal/handlers/requests.go (RequestsHandler.Create)
  ↓ repository/buyer_requests.go
PostgreSQL: buyer_requests
```

**Matching (system-driven, not user-initiated)**
```
cmd/api/main.go: runDailyTickScheduler (ticker) / POST /internal/jobs/run-daily-tick
  ↓ service/exchange.go: RunDailyTick → decay → grow → createMatches → expireOverdueMatches
  ↓ repository access via transactions (SELECT...FOR UPDATE)
PostgreSQL: listings, buyer_requests, matches, deposits, notifications
```

**Deposits**
```
frontend/components/dashboard/DepositsContent.tsx
  ↓ POST /api/deposits/:id/pay
backend/internal/handlers/deposits.go (DepositsHandler.Pay)
  ↓ service/deposits.go (DepositService.Pay) — row-locked ownership+status check
  ↓ repository/deposits.go, repository/matches.go (deriveMatchStatus)
PostgreSQL: deposits, matches
```

**Notifications**
```
frontend/components/dashboard/NotificationsContent.tsx
  ↓ GET /api/notifications, PATCH /api/notifications/:id/read
backend/internal/handlers/notifications.go
  ↓ repository/notifications.go
PostgreSQL: notifications
```

**Admin moderation**
```
frontend/components/admin/AdminModerationContent.tsx
  ↓ GET/POST /internal/listings/pending|approve|reject  (internalFetch, no JWT, no /api prefix)
backend/internal/handlers/moderation.go (behind middleware.LocalOnly())
  ↓ repository/listings.go
PostgreSQL: listings
```

## 18. Security / Permissions

**Confirmed sound:**
- Ownership checks on every tested mutate-by-ID endpoint (listings, requests, notifications, deposits, matches) — no IDOR found (tests 12, 13, 19).
- Deposit payment path is the one place money state changes, and it's the most carefully guarded (row lock + ownership + status check in one transaction).
- Contacts unlock is genuinely gated server-side on `confirmed` status, re-checked on every read, not cached/trusted from the frontend.
- CORS is an explicit allow-list (`localhost:3000`, `avtobirzhasi.kz`, `www.avtobirzhasi.kz`) with credentials — not a wildcard misconfiguration.
- `LocalOnly()` middleware deliberately reads the raw TCP `RemoteAddr` rather than Gin's `ClientIP()`, specifically because `ClientIP()` trusts `X-Forwarded-For`/`X-Real-IP` under Gin's "trust all proxies" default (which this app runs with, per its own startup warning) — the code comment documents that this exact spoofing was tested and would otherwise have worked. Production Caddy config (`Caddyfile.avtobirzhasi`) additionally 404s `/internal/*` at the edge, with an explicit comment saying this must never be removed.

**Confirmed as findings:**
- ~~**CRITICAL** — No admin/role authorization model exists in the schema or code at all. The entire admin surface (`/internal/*`) is protected only by network topology (loopback + reverse-proxy block), not by any user identity, role, or audit trail. This is safe *only* as long as (a) the backend process is never exposed with a public IP bound directly, (b) Gin's "trust all proxies" default is never relied upon elsewhere, and (c) the Caddy `/internal/*` block is faithfully present on the live VPS config — none of which this audit could verify against the actual production server (out of scope: no production access). If any one of those three assumptions breaks, moderation/approve/reject and site-wide stats become world-writable/readable with zero authentication.~~
  **RESOLVED in Stage 1** (same day as this audit): `users.role` (`user`/`admin`) now exists, and `/internal/*` requires `middleware.Auth()` + `middleware.AdminOnly()` on top of the pre-existing `middleware.LocalOnly()` — a caller now needs both network position AND a valid JWT for an actual `role='admin'` account. Role is read fresh from the database on every request (never trusted from the JWT payload, which carries no role claim at all), so token tampering cannot forge admin access. Live-verified: guest→401, authenticated non-admin→403, admin→200, across all three endpoint groups (moderation, stats, daily-tick). Full detail in "Stage 1 — Admin Authorization Fix" below / `STAGE1_ADMIN_AUTHORIZATION_REPORT.md`. The Caddy-edge-block and Gin-trust-all-proxies caveats above are no longer the *only* defense, but remain valid, unverified-in-production observations in their own right (still worth confirming on the live VPS — see §21).
- **HIGH** — No self-match guard in the matching engine (§9).
- **HIGH** — Owner-facing `PATCH` on listings/requests allows direct price/offer edits with no guard, bypassing the exchange engine's core fairness mechanic (§8).
- **MEDIUM** — `/admin/*` frontend routes have no client-side gate at all (not itself exploitable given the backend control, but it's a missing defense-in-depth layer and means the admin shell UI is visible to anyone who navigates there, even if the underlying data calls fail).
- **MEDIUM** — Malformed UUID in a path param causes a 500 rather than a 400 (test 28) — suggests unhandled parse errors bubbling up, worth checking for information disclosure in production logs (not confirmed either way, since this was tested against a locally-run dev binary, not the hardened production build).
- Public phone exposure via `GET /api/sellers/:id` is unauthenticated and returns *any* user's phone by ID — this looks like an intentional design for classifieds contact (matches the "always visible for non-exchange listings" model) rather than a bug, but it does mean phone numbers are enumerable by anyone who can guess/iterate user IDs (UUIDs, so not practically enumerable).

## 19. Broken / Partial Features

**Issue: No self-match guard**
Severity: HIGH
Location: `backend/internal/service/exchange.go` (`createMatches` query + `tryCreateMatch`)
Expected: A user's own listing should never match their own buyer request.
Actual: No comparison of `listing.user_id` vs `buyer_request.user_id` anywhere in the matching path.
Evidence: Code review by a dedicated research pass, confirmed by grep for any ownership comparison in the relevant functions; live repro was inconclusive only because the test listing was already frozen from a prior match.
Possible cause: Oversight — the query optimizes for region/make/model/year/price match without an identity exclusion clause.

**Issue: Direct price/offer edit bypasses the exchange engine**
Severity: HIGH
Location: `backend/internal/handlers/listings.go` (`Update`), `backend/internal/handlers/requests.go` (`Update`)
Expected: Once a listing/request is enrolled in Auto Exchange, its price should only move via the daily ±1% mechanic.
Actual: The owner can `PATCH` `price`/`currentOffer` to any value at any time, with no check on `is_exchange` or `status`.
Evidence: Reviewed both handlers directly; confirmed no such guard exists; validated by successfully editing the seller's own listing description alongside price-eligible fields in this audit's own test (test 20 exercised the same code path).
Possible cause: The PATCH endpoint was built generically for "editable fields" without carving out exchange-specific invariants.

**Issue: Seller-written description never displayed**
Severity: HIGH
Location: `frontend/components/cars/DescriptionSection.tsx`
Expected: The listing detail page should show what the seller actually wrote (`car.description`, captured by `ListingForm` and stored in `listings.description`).
Actual: The component calls `generateDescription()` from `lib/mock/description.ts` and always renders a templated/generic blurb, ignoring the real field entirely.
Evidence: Reported by the frontend research pass with exact file/line; not independently re-verified live in this session (frontend dev server was not run), so treat as code-confirmed, not click-tested.
Possible cause: Leftover from an earlier mock-data-driven UI phase that was never rewired after the real field was added.

**Issue: No frontend gate on `/admin/*`** — **FIXED in Stage 1**
Severity: MEDIUM
Location: `frontend/app/admin/layout.tsx`
Expected: Some redirect/role-check before rendering the admin shell.
Actual (original audit): None — any visitor could load the admin shell UI.
Fix: `frontend/app/admin/layout.tsx` now wraps its children in the new `RequireAdmin` component (`frontend/components/auth/RequireAdmin.tsx`), which redirects guests to `/login` and non-admin accounts to `/`. This was addressed alongside the CRITICAL admin-authorization fix since Stage 1's task explicitly required it ("Даже если /admin/* скрыт на frontend, backend обязан самостоятельно проверять admin-role" plus an explicit frontend-guard requirement). See "Stage 1 — Admin Authorization Fix".
Evidence: Reviewed `layout.tsx`; confirmed no `RequireAuth`/role logic was present pre-fix; confirmed `RequireAdmin` is now wired in post-fix.
Possible cause: Admin auth was deferred, likely because the admin surface itself is still 80% stubbed.

**Issue: Homepage quick search is non-functional**
Severity: MEDIUM
Location: `frontend/components/home/QuickSearch.tsx`
Expected: Selecting region/make/model/year and clicking Search should navigate to a filtered `/cars` URL.
Actual: The Search button is a static link to `/cars` regardless of any selection; the `model` dropdown is also a hardcoded 3-option list unrelated to the selected `make`.
Evidence: Reported by frontend research pass with line citation; not independently click-tested live.
Possible cause: Homepage form was likely built before `filterCars.ts`/URL-param wiring existed and never connected.

**Issue: Homepage "fresh listings" is hardcoded mock data**
Severity: MEDIUM
Location: `frontend/components/home/FreshListings.tsx`
Expected: Should show the actual most-recent active listings from `GET /cars`.
Actual: Renders `mockCars.slice(0,8)` — same 8 fake cars regardless of what's really in the database.
Evidence: Reported by frontend research pass with line citation.
Possible cause: Same as above — homepage was likely mocked first and never wired to live data once the API existed.

**Issue: `/exchange` marketing page is entirely illustrative**
Severity: LOW (by design, as a marketing/explainer page) but worth flagging since it could be mistaken for live functionality
Location: `frontend/components/exchange/ExchangeSimulator.tsx`, `PriceConvergenceDiagram.tsx`, `ExchangeExample.tsx`
Expected: N/A (this appears to be intentional marketing content).
Actual: Hardcoded constants (`SELLER_START`, `BUYER_START`, `DAILY_RATE`, `MATCH_TOLERANCE_PERCENT` all re-declared client-side rather than reflecting the real engine's constants) and a mock car from `lib/mock/cars.ts`.
Evidence: Frontend research pass, line-cited.
Possible cause: Intentional — but the hardcoded constants happen to currently match the real backend constants (2%, 1%/day) coincidentally/by original design; if the backend constants ever change, this page will silently go stale and mislead users about how the real engine behaves.

**Issue: Malformed UUID path param returns 500 instead of 400**
Severity: MEDIUM
Location: likely `backend/internal/handlers/cars.go` (`Get`) and other `:id` handlers using the same pattern
Expected: 400 Bad Request for an unparseable ID.
Actual: 500 Internal Server Error, live-verified (`GET /api/cars/not-a-uuid` → 500).
Evidence: Live curl test in this audit; server access log confirms `500` status code.
Possible cause: The repository layer likely lets a Postgres UUID-cast error propagate up as a generic internal error rather than validating the path param's format before querying.

**Issue: Zero automated test coverage (backend), no test script (frontend)**
Severity: MEDIUM
Location: entire `backend/` module (`go test ./...` → `[no test files]` for all 9 packages); `frontend/package.json` has no `test` script at all.
Expected: At minimum, unit/integration coverage of the money-moving and matching logic.
Actual: None exists.
Evidence: Direct command output in this audit.
Possible cause: MVP velocity tradeoff — explicitly a gap the code comments elsewhere seem aware of (a previously-hand-caught numeric-cast bug in `exchange.go` is preserved only as a comment, with no regression test).

**Issue: Dead schema/enum values**
Severity: LOW
Location: `matches.status='cancelled'` (never written by any code path), `buyer_requests.status='moderation'` (never set), `notifications.type='deposit_required'` (never inserted)
Expected: N/A — informational.
Actual: These are valid per DB CHECK constraints but structurally unreachable given the current code.
Evidence: Grep across the whole backend for any write path producing these values — none found.
Possible cause: Planned-but-unbuilt functionality (e.g., a user-initiated "cancel" action was likely intended but never implemented).

**Issue: `gofmt` finds one non-clean file**
Severity: LOW
Location: `backend/internal/models/models.go` (struct field alignment only)
Expected: `gofmt -l .` returns nothing.
Actual: Returns this one file.
Evidence: Direct command output, not auto-fixed per audit scope.
Possible cause: Manual edits to struct fields since the last `gofmt` pass.

**Issue: `lib/mock/dashboard.ts` is dead/orphaned code**
Severity: LOW
Location: `frontend/lib/mock/dashboard.ts`
Expected: N/A — informational.
Actual: Fully unused (confirmed via grep across `app/`, `components/`, `features/`), harmless but should eventually be removed.
Evidence: Frontend research pass.
Possible cause: Left over from before the dashboard was wired to the real API.

## 20. Missing Functionality

**Clearly intended by existing code, but not finished:**
- Admin sections for users, listings, requests, matches, deposits, notifications, reviews, settings (sidebar links exist, pages are `AdminComingSoon` stubs, and the backend has no corresponding endpoints either — clearly a planned-but-deferred scope, per the stub's own copy: "appears at the next stage").
- Match `cancelled` state and a user-initiated cancel action (schema anticipates it, nothing implements it).
- A distinct "deposit required" notification type (schema anticipates it, nothing produces it).
- A dedicated "edit listing" page in the frontend (the API supports `PATCH`, but the frontend agent found no edit form/page consuming it).

**Potential future feature (not evidenced as currently planned in code, just plausible next steps):**
- Price-history tracking / a chart of a listing's or request's movement over time (no schema, no code hooks toward this at all today).
- A real payment gateway behind the deposit "pay" action (currently a pure DB-state toggle, explicitly commented as a mock action).
- Refresh tokens / session revocation for JWTs.
- Photo upload/storage (currently URL-only, no file upload pipeline).

## 21. Test Coverage Gaps

- **Match/deposit expiry (48h deadline)** — code-confirmed (`expireOverdueMatches`, refund-on-expiry) but not exercised live; would require either waiting out the real deadline or manipulating the DB `deadline` column directly, which this audit avoided to prevent database tampering beyond the intentionally-created test fixtures.
- **Self-match reproduction** — the code-level absence of a guard is confirmed, but a clean live repro (fresh listing + fresh matching buyer request, both owned by the same user, with no prior match entanglement) was not completed in this pass; would take one more isolated test cycle.
- **Production Caddy configuration** — `Caddyfile.avtobirzhasi` in the repo is explicitly a *snippet* to be merged into the VPS's real Caddy config; this audit has no access to the actual production server and cannot confirm the live edge configuration matches this snippet (i.e., cannot confirm `/internal/*` is actually blocked in production today).
- **Frontend live/dev-server testing** — build and lint were run and passed, but the frontend was not exercised as a running dev server against the live backend in a browser in this pass (all functional verification was done directly against the API); several of the frontend-only findings (description-display bug, quick-search non-function, admin-gate absence) are code-confirmed by the research pass but not click-tested by hand in this session.
- **Concurrency/race conditions** beyond the two explicit `FOR UPDATE` paths (match creation, deposit payment) were not stress-tested (e.g., two simultaneous ticks, or two simultaneous pay requests hitting exactly at the same instant).
- **CI/CD gate**: `.github/workflows/deploy.yml` builds and pushes Docker images and deploys directly to production on every push to `main`, with **no automated test, lint, or migration step** in the pipeline — migrations must be run manually against the VPS (goose is bundled into the backend image for this purpose but is not auto-invoked at container start). This means a broken migration or a regression not caught by `go build`/`next build` alone could reach production without any CI gate catching it.

## 22. Overall Readiness

- **Backend**: 7/10 — clean build/vet, sound transactional design for the two money-relevant paths, correct IDOR handling everywhere tested; docked for zero test coverage, the self-match gap, the direct-edit bypass, and the 500-on-malformed-ID.
- **Frontend**: 6/10 — clean build/lint, real API wiring for all dashboard/auth/listing/request flows; docked for the 8 stub admin sections, non-functional homepage search, hardcoded homepage listings, and the description-display bug.
- **Database**: 8/10 — clean, consistent schema with sensible FKs/indexes/CHECK constraints matching the code's actual usage almost exactly; docked only for the handful of dead enum values and the absence of any price-history table.
- **Business logic**: 7/10 — the core Auto Exchange mechanic (decay/growth/match/deposit/unlock) is real, coherent, and was verified working end-to-end live in this audit; docked for the self-match gap and the ability to bypass the daily-movement mechanic via direct PATCH.
- **Security/permissions**: 6/10 as of the original audit; **8/10 after Stage 1** — the admin surface now requires a real `users.role='admin'` account (checked live from the DB, not the JWT payload) in addition to the pre-existing network-topology check, and both the frontend and backend gates were verified working (401/403/200 test matrix, plus registration privilege-escalation and JWT-tampering attempts, all blocked). Remaining docked points: the other HIGH/MEDIUM findings from the original audit (self-match, direct price/offer edit, malformed-ID 500s, no frontend gate elsewhere) are unrelated to admin auth and were explicitly out of scope for Stage 1, so they still stand.
- **Automated tests**: 1/10 — zero backend test files, no frontend test script; the only verification that exists is what this audit performed manually.
- **Production readiness**: 5/10 — functionally coherent MVP with a real, working core mechanic, but held back by: no admin-role model, no test suite protecting money-moving logic, a CI/CD pipeline with no pre-deploy quality gate, and a meaningful fraction of visible UI (8/10 admin sections, homepage search, homepage listings, listing descriptions) that doesn't yet do what it visually implies.

## 23. Recommended Next Steps

### P0 — Critical
- ~~Design and implement a real admin-role authorization layer (an `is_admin`/`role` column plus server-side checks) so the `/internal/*` surface doesn't rely solely on network topology — especially before any move to a multi-host or containerized-behind-a-shared-LB deployment where the current loopback assumption could quietly break.~~ **DONE — Stage 1** (see "Stage 1 — Admin Authorization Fix" below).
- Add a self-match guard (`listing.user_id != buyer_request.user_id`) to the matching query/`tryCreateMatch`. **(Still open — out of scope for Stage 1, targeted for a future stage.)**

### P1 — High
- Close the direct-edit bypass: either block `price`/`currentOffer` PATCH while `is_exchange=true`/status is exchange-active, or explicitly document and accept it as an intended manual-override feature (currently it reads as an oversight, not a decision).
- Wire `DescriptionSection.tsx` to the real `car.description` field instead of the mock generator.
- Fix the malformed-ID 500 → 400 across all `:id` path-param handlers (validate UUID format before querying).
- Add a baseline automated test suite for the two money-relevant paths (`ExchangeService.RunDailyTick` matching/decay math, `DepositService.Pay` transaction/ownership logic) given both are currently unprotected by any regression test.

### P2 — Medium
- Add a client-side gate (or at least a "not authorized" state) to `/admin/*` for defense-in-depth, even though the backend is the real boundary.
- Wire the homepage quick-search form to actually navigate with the selected filters.
- Replace `FreshListings`' hardcoded mock cars with a real `GET /cars?sort=newest` call.
- Add a CI step (`go vet`, `go build`, `go test`, `npm run lint`, `npm run build`) that must pass before the deploy job runs in `.github/workflows/deploy.yml`.
- Verify (on the actual VPS, outside this audit's scope) that the live Caddy configuration matches the `/internal/*` 404 block documented in `Caddyfile.avtobirzhasi`.

### P3 — Low
- Run `gofmt -w` on `internal/models/models.go` (whitespace-only).
- Remove the dead/orphaned `frontend/lib/mock/dashboard.ts`.
- Either implement or remove the dead `matches.status='cancelled'`, `buyer_requests.status='moderation'`, and `notifications.type='deposit_required'` schema paths.
- Update the stale i18n file-header comment in `lib/i18n/translations.ts` (claims RU/KZ coverage is chrome-only; it's actually complete at 364/364 key parity).
- Consider whether `/exchange`'s hardcoded simulator constants should read from a shared constants module so they can't silently drift from the real engine's values.

---

## Test Data Created During This Audit

All created against a locally-run, freshly-migrated dev database (Docker container `avtobirzhasi_postgres`, project `avtobirzhasi`, not the production database) — nothing in this list touched production or any pre-existing user data:
- Users: "Test Seller" (+77011112222), "Test Buyer" (+77011113333), "Eve" (+77011114444)
- Listing: 1 Toyota Camry 2020, Auto Exchange, created by Test Seller
- Buyer requests: 2 (one by Test Buyer, one by Test Seller for the self-match check)
- Match: 1 (Test Seller ↔ Test Buyer), progressed to `confirmed`
- Deposits: 2 (both paid)
- Notifications: 3 (generated by the above, one marked read)
- Favorites: 1 add + 1 remove (net: none remaining)

The local Postgres container and the local Go API process (port 8090) were left running after this audit per standing preference to keep dev services available for follow-up inspection between turns — stop them with `docker compose down` (no `-v`) in `backend/` and by killing the `go run ./cmd/api` process if no longer needed.

---

## Stage 1 — Admin Authorization Fix

**Previous status:** CRITICAL
**Current status:** PASS

This section summarizes the fix; the full standalone writeup (problem, root cause, design, complete test matrix) is in `STAGE1_ADMIN_AUTHORIZATION_REPORT.md`.

**What changed:**
- Added `users.role` (`user`/`admin`, `NOT NULL DEFAULT 'user'`, `CHECK (role IN ('user','admin'))`) via new migration `backend/migrations/00009_add_user_role.sql`. All 9 pre-existing users in the local dev DB retained `role='user'` automatically.
- Added `backend/internal/middleware/admin.go` (`AdminOnly`), which loads the authenticated user fresh from the database on every request and requires `role='admin'`, distinguishing 401 (no/invalid token) from 403 (authenticated, not admin).
- `backend/cmd/api/main.go`: the `/internal` route group now chains `middleware.LocalOnly()` → `middleware.Auth(cfg.JWTSecret)` → `middleware.AdminOnly(userRepo)`, so network position is no longer sufficient by itself.
- `userResponse`/`toUserResponse` (`backend/internal/handlers/response.go`) now include `role`, so the frontend can tell an admin account from a regular one via `/auth/me`, `/auth/login`, `/auth/register`.
- Registration (`AuthService.Register` / `UserRepository.Create`) never accepts a client-supplied role — the column's `'user'` default is always what a new row gets; there is no code path that lets a request body influence it.
- Frontend: `frontend/types/user.ts` gained a `role` field; `frontend/components/auth/RequireAdmin.tsx` (new) redirects guests to `/login` and non-admins to `/`; `frontend/app/admin/layout.tsx` now wraps its children in `RequireAdmin`; `frontend/lib/api/{admin,moderation}.ts` and the two components that call them (`AdminDashboardContent.tsx`, `AdminModerationContent.tsx`) now attach the logged-in user's JWT to every `/internal/*` call (previously sent with no `Authorization` header at all).

**Test matrix (live-verified against a local instance, migrated fresh):**

| Caller | Endpoint | Expected | Actual |
|---|---|---|---|
| Guest (no token) | `GET /internal/admin/stats` | 401 | 401 |
| Guest (no token) | `GET /internal/listings/pending` | 401 | 401 |
| Guest (no token) | `POST /internal/jobs/run-daily-tick` | 401 | 401 |
| Authenticated, `role='user'` | all three above | 403 | 403 (all three) |
| Authenticated, `role='admin'` (same account, promoted via SQL, same pre-issued JWT reused) | all three above | 200 | 200 (all three) |
| Registration with `{"role":"admin"}` in the body | `POST /api/auth/register` | account created as `role='user'` | `role:"user"` in both the response and the DB row |
| Forged JWT (`role:"admin"` injected into the payload, invalid signature) | `GET /internal/admin/stats` | 401 (signature check fails) | 401 |

Regression (unaffected `/api/*` routes): register, login, `/auth/me`, guest `GET /cars`, `GET /cars/:id`, authenticated `GET /dashboard/overview`, and `POST /listings` (create own listing) were all re-tested after the change and behave identically to before.

**Build/verification:** `go build ./...` clean, `go vet ./...` clean, `go test ./...` — no test files (pre-existing gap, not introduced here), `gofmt -l .` still flags only the pre-existing `internal/models/models.go` (unrelated whitespace issue, not touched). Frontend `npm run lint` — 0 errors (1 pre-existing advisory warning, unrelated). Frontend `npm run build` — clean, all 27 routes generated.

**How to promote a user to admin locally** (no public endpoint exists for this, by design):
```sql
UPDATE users SET role = 'admin' WHERE phone = '+7XXXXXXXXXX';
```
Run via `docker exec avtobirzhasi_postgres psql -U postgres -d avtobirzhsi_db -c "UPDATE users SET role='admin' WHERE phone='...';"` (adjust container/db name for other environments). No password or secret is embedded in the codebase for this — role promotion is an operator-run SQL statement against the users table, matching the audit's requirement not to add a `POST /make-admin`-style endpoint.

**Remaining risks (admin-authorization-specific only):**
- `/internal/*` is still only reachable from the browser when the frontend and backend share a network path that isn't blocked by the production Caddy edge rule (`Caddyfile.avtobirzhasi` 404s `/internal/*` publicly) — this is a pre-existing reachability characteristic, not something Stage 1 changed or was asked to change. In practice this means real remote admins likely need VPN/SSH-tunnel access to reach the API's `/internal/*` path in production today, in addition to holding an admin JWT.
- No audit trail (who approved/rejected what, who ran a manual tick) was added — Stage 1's scope was authorization, not auditing.
- No UI exists yet to promote/demote admins or list current admins — this is intentional (the task explicitly disallows a public role-changing endpoint) and matches "documented DB command" as the chosen option.
- This was only verified against a local dev database, not the production VPS — the migration should be run there deliberately (`goose up` against production `DATABASE_URL`) before this fix takes effect in production.
