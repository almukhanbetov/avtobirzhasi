# Stage 10 — Admin Scope and Completion

Date: 2026-08-26
Branch: `main` (uncommitted working tree on top of `8e0e3c5`)
Scope: define and close the minimal admin surface a live marketplace actually needs to operate, without payment, listing-image-flow, matching/deposit-algorithm, or production-infrastructure changes.

## A Critical Finding Before Any New Code

Before building anything, the existing "complete" admin sections (moderation, stats) were checked against **real production reachability**, not just code correctness — and they failed:

```
$ curl https://api.avtobirzhasi.kz/internal/listings/pending
{"error":{"code":"FORBIDDEN","message":"Недоступно"}}   HTTP 403
```

`middleware.LocalOnly()` rejects any request whose TCP peer isn't `127.0.0.1`/`::1` — correct for a genuinely internal debug trigger, but the *entire* admin panel (moderation queue, stats dashboard) was mounted under the same `/internal` group. Since `AdminModerationContent.tsx`/`AdminDashboardContent.tsx` are client components, their fetches originate from an **admin's own browser**, not the VPS — meaning the already-built moderation and stats panels have never actually been usable from a real production browser session, in any deploy since they were written. This was invisible to every prior stage's verification because all of it tested the backend's HTTP behavior directly (`curl` with a JWT) or read code, never simulated "an admin's browser calling this over the public internet."

**Fix (confirmed with the user before proceeding, given it touches route security)**: moved every admin-facing product feature — moderation, stats, and this stage's 5 new sections — from `/internal/*` (`LocalOnly` + `Auth` + `AdminOnly`) to a new `/api/admin/*` group (`Auth` + `AdminOnly` only). `AdminOnly` is the real, DB-sourced role check (per Stage 1) and was always the actual security boundary; `LocalOnly` was a network-position check appropriate only for the one truly internal endpoint left under `/internal`: the manual daily-tick trigger, which must never be reachable from the public internet by design (unchanged). No Docker/Caddy/CI file needed to change for this — `/api/*` was already reverse-proxied end-to-end; only Go route registration moved.

Without this fix, every one of Stage 10's 5 new sections would have been equally unreachable in production, making the whole stage pointless.

## Admin Sections — Full Inventory

| Section | Frontend (before) | Backend (before) | DB support | Status (before) | Needed for MVP? |
|---|---|---|---|---|---|
| Moderation | Real UI | Real (`/internal/listings/pending\|approve\|reject`) | Yes | **Unreachable in production** (LocalOnly) | MVP REQUIRED |
| Stats / dashboard | Real UI | Real (`/internal/admin/stats`) | Yes (aggregate counts) | **Unreachable in production** (LocalOnly) | MVP REQUIRED |
| Listings management | `AdminComingSoon` | None (only per-user + pending-only) | Yes | STUB | MVP REQUIRED |
| Users management | `AdminComingSoon` | None | Yes | STUB | MVP REQUIRED (read-only) |
| Matches monitoring | `AdminComingSoon` | None (only per-user) | Yes | STUB | MVP REQUIRED (read-only) |
| Deposits monitoring | `AdminComingSoon` | None (only per-user) | Yes | STUB | MVP REQUIRED (read-only) |
| Buyer requests management | `AdminComingSoon` | None (only per-user) | Yes | STUB | MVP REQUIRED |
| Notifications overview | `AdminComingSoon` | None | Yes (per-user only) | STUB | POST-MVP |
| Reviews | `AdminComingSoon` | **No reviews feature exists at all** — `users.rating`/`reviews_count` are static columns with no write path anywhere in the product | Columns only, no table | STUB | NOT NEEDED |
| Settings | `AdminComingSoon` | None — would require moving hardcoded exchange constants (`dailyRate`, `matchTolerancePercent`) into DB-backed config | None | STUB | NOT NEEDED (would touch the exchange algorithm, explicitly forbidden) |

## MVP Required Sections — Rationale

Judged against this product's actual business model (a matching marketplace with real, if mocked, money movement and unmoderated user-generated content), not hypothetical future features:

- **Moderation, Stats**: already built, correctly judged essential in earlier stages. This stage's job was making them *actually reachable*, not rebuilding them.
- **Listings / Buyer Requests management**: support needs to find and, when necessary, force-remove a *specific* listing or request that isn't in the moderation queue (fraud report, legal request, a seller who can't self-serve) — moderation only ever sees new, not-yet-approved content. This was a real, standing gap: before this stage, an admin's only recourse for an already-active listing was direct SQL.
- **Users management (read-only)**: support needs to find an account by phone/name (e.g. "which user is `+7707...`"). Role-promotion (creating a new admin) deliberately **stays a manual SQL step** — self-escalation safety is a materially bigger, more sensitive problem than "minimal read-only lookup," and building it safely wasn't in this stage's scope.
- **Matches / Deposits monitoring (read-only)**: these are the two places money-adjacent disputes happen ("my deposit didn't unlock contacts," "my match expired unexpectedly"). An admin needs to look up a specific deal's state to help; before this stage there was no cross-user way to do that at all.

## Post-MVP / Not Needed — Rationale

- **Notifications overview**: no concrete operational necessity identified beyond what Matches/Deposits monitoring already covers for dispute resolution. Deferred, not built.
- **Reviews**: cannot be "completed" — there is no reviews *feature* anywhere in the product to administer (no table, no write endpoint, no review-writing UI). Building review administration before the review feature itself exists would be building UI for data that can never appear.
- **Settings**: the only plausible content (daily rate %, match tolerance %, deposit %) lives as hardcoded Go constants in `exchange.go`. Making these DB-configurable is a real feature with real risk (an admin fat-fingering the daily rate is a business-logic change, not an admin-panel change) and was explicitly out of scope ("не менять matching/deposit business logic").

Per the task's explicit instruction ("не оставлять кликабельную пустую заглушку"), all three were **removed** — from `AdminSidebar.tsx`'s navigation and as page routes entirely (`app/admin/{reviews,settings,notifications}/` deleted) — rather than left as dead links. `AdminComingSoon.tsx` itself was deleted once its last caller was gone (confirmed via grep before removal).

## Backend Implemented

New, minimal, read-first, admin-gated (`Auth` + `AdminOnly`, mounted under `/api/admin`):

| Route | Purpose |
|---|---|
| `GET /api/admin/listings?status=&page=` | Every listing, any owner, any status, paginated |
| `POST /api/admin/listings/:id/archive` | Force-archive any listing (409 if already archived) |
| `GET /api/admin/requests?status=&page=` | Every buyer request, any owner, any status, paginated |
| `POST /api/admin/requests/:id/archive` | Force-archive any buyer request |
| `GET /api/admin/matches?status=&page=` | Every match, any party, paginated (read-only) |
| `GET /api/admin/deposits?status=&page=` | Every deposit, any owner, paginated (read-only) |
| `GET /api/admin/users?search=&page=` | Every user, optional name/phone substring search (read-only, never exposes `password_hash`) |
| `GET /api/admin/listings/pending`, `POST .../approve`, `POST .../reject` | Moderation — **moved**, not rebuilt |
| `GET /api/admin/stats` | Site-wide counts — **moved**, not rebuilt (was `/internal/admin/stats`) |

Implementation notes:
- New repository methods (`ListAll` on `ListingRepository`, `BuyerRequestRepository`, `MatchRepository`, `DepositRepository`; on `UserRepository`) — each paginated, optionally filtered, reusing the existing scan/column helpers rather than duplicating them.
- Response types reuse existing builders wherever possible (`toSellerListingResponse`, `toBuyerRequestResponse`, `toUserResponse`) — no parallel API shape was invented for data that already has one.
- Force-archive endpoints check current status first (`409 CONFLICT` if already archived) — no silent double-action, no destructive operation beyond what a seller's own self-delete already does (same `SetStatus` call, just admin-triggered and cross-owner).
- No new endpoint was added for anything judged POST-MVP/NOT NEEDED — no speculative backend for Reviews/Settings/Notifications-overview.

## Frontend Implemented

- `types/admin.ts` — `AdminListing`, `AdminBuyerRequest`, `AdminMatch`, `AdminDeposit`, `AdminUserRow`, and a shared `AdminPage<T>` envelope type.
- `lib/api/admin.ts` — extended with `listAdminListings`/`archiveAdminListing`/`listAdminRequests`/`archiveAdminRequest`/`listAdminMatches`/`listAdminDeposits`/`listAdminUsers`, all via `apiFetch` (not the now-removed `internalFetch`).
- `lib/api/moderation.ts` — updated to call `/admin/listings/pending|approve|reject` via `apiFetch` instead of `/internal/...` via `internalFetch`.
- `components/admin/AdminPagination.tsx` — one shared prev/next footer, reused by all 5 new sections (the one piece of UI genuinely identical across them; the rest — listings' image+price+archive vs. users' search+rating vs. matches'/deposits' read-only ID rows — were kept as separate components rather than forced into one generic table).
- `components/admin/Admin{Listings,Requests,Matches,Deposits,Users}Content.tsx` — each with a status/search filter, loading skeleton, error state, empty state, real paginated data, and (for listings/requests) a `confirm()`-gated force-archive action.
- `app/admin/{listings,requests,matches,deposits,users}/page.tsx` — now render the real content components instead of `AdminComingSoon`.
- `app/admin/{reviews,settings,notifications}/` — deleted. `AdminSidebar.tsx` — those 3 nav entries removed.
- `lib/api/client.ts` — `internalFetch` deleted (zero remaining callers after the moderation migration).
- `admin.moderation.subtitle` (RU+KZ) — corrected; it previously claimed to be "an internal tool, only accessible from the machine running the backend," which was true but is no longer the design and was actively misleading about how the feature now works.

## Security

Every new admin endpoint, live-tested this stage against a real `go run ./cmd/api` instance (not just unit-tested):

```
guest (no token)      -> 401  (all 7 endpoints: listings, requests, matches, deposits, users, stats, listings/pending)
non-admin user token  -> 403  (same 7)
admin token           -> 200  (same 7, after promoting a test user via the deliberate manual SQL path)
```

Force-archive additionally verified: non-admin → 403 (never reaches the archive logic), admin → 204, a second admin archive of the same listing → 409 (not a crash, not a silent no-op), malformed UUID → 400 (via the existing `requireUUIDParam`, applied identically here). `GET /api/admin/users` response confirmed to never include `password_hash` in either its Go struct (`toUserResponse` already omitted it) or the raw JSON on the wire.

## Tests

**Backend — 1 new file, 4 new tests, 38 total (up from 34)**:
- `admin_test.go` — `TestAdminEndpoints_RBAC` (table-driven across all 7 admin GET endpoints: guest/user/admin), `TestAdminListings_ResponseShape` (envelope + `sellerName` join), `TestAdminUsers_NeverExposesPasswordHash`, `TestAdminListingsArchive_AdminOnlyAndIdempotentSafe`.
- `testutil.go` — added `InsertAdminUser` (role='admin' fixture) alongside the existing `InsertUser`.

**Frontend — 2 new files, 10 new tests, 55 total (up from 45)**:
- `AdminListingsContent.test.tsx` (6 tests) — real data render, loading skeleton, empty state, error state, archive-on-confirm, no-archive-on-dismiss.
- `AdminUsersContent.test.tsx` (4 tests) — real data render + no password leak, search re-queries the API, empty state, error state.
- Representative, not exhaustive: Matches/Deposits/Requests content components share the same patterns (verified manually via the backend E2E below) but don't each have a dedicated test file, consistent with the task's "минимальные" instruction.

## Regression

Backend:
```
$ go build ./...      clean
$ go vet ./...          clean
$ go test -p 1 ./...    ok: internal/handlers (38 tests total), internal/service
```
Frontend:
```
$ npm run test          Test Files 10 passed, Tests 55 passed
$ npx tsc --noEmit      clean (after clearing a stale .next/ type-validator cache
                         referencing the deleted reviews/settings/notifications routes)
$ npm run lint          0 errors, 1 pre-existing unrelated warning
$ npm run build         24 routes (down from 27 — 3 admin stub routes removed)
```

Live E2E (local `go run ./cmd/api`, real HTTP, real Postgres, not simulated): register → promote to admin via SQL → hit all 7 `/api/admin/*` endpoints as guest/user/admin → create a listing as a fresh seller → force-archive it as admin → confirm 409 on a second attempt → confirm malformed-UUID 400. All exactly as designed.

**Not performed**: a real mouse-driven browser click-through (no browser-automation tool in this environment — same limitation Stage 3/9 already noted). Component-level RTL tests plus a live backend API pass are the substitute evidence.

## Remaining Admin Gaps

- **Notifications overview, Reviews, Settings remain unbuilt** — by design, per the MVP-scope decision above, not oversight.
- **Role promotion is still manual SQL** — a deliberate, safety-motivated exclusion, not forgotten. A future stage could add a UI for this with proper safeguards (e.g., requiring a second admin's confirmation, an audit log entry) — that's real additional design work, not a small addition.
- **No admin action audit trail** — force-archiving a listing/request, or approving/rejecting one, still writes no "who did this and when" record. Pre-existing gap (the original completion audit flagged the same thing for moderation), not introduced or closed by this stage.
- **Matches/Deposits admin views are ID-based, not name-enriched** — deliberately: joining in seller/buyer names for every row would mean 2 extra lookups per row on every page load, for a monitoring view whose primary use case (cross-reference during a support ticket that already has a listing/request id) doesn't need it. The Users search view exists precisely to resolve an id to a name when actually needed.
- **This stage's admin routing fix has not been exercised against real production** (no push credential in this AI environment, same limitation as every prior stage) — the `/api/admin/*` reachability fix is locally live-tested and code-correct, but only a real deploy + a real admin browser session (or the same public-`curl`-without-VPS-access technique used in Stage 8B) can confirm it works in production exactly as it did locally.

## Files Changed

Backend: `cmd/api/main.go`, `internal/handlers/{admin_stats,moderation,validation}.go` (modified), `internal/handlers/admin_{listings,requests,matches,deposits,users}.go` (new), `internal/handlers/admin_test.go` (new), `internal/repository/{listings,buyer_requests,matches,deposits,users}.go` (modified — `ListAll` added), `internal/testutil/testutil.go` (modified — `InsertAdminUser` added).

Frontend: `types/admin.ts` (new), `lib/api/admin.ts` (modified), `lib/api/moderation.ts` (modified), `lib/api/client.ts` (modified — `internalFetch` removed), `lib/i18n/translations.ts` (modified), `components/admin/AdminPagination.tsx` (new), `components/admin/Admin{Listings,Requests,Matches,Deposits,Users}Content.tsx` (new), `components/admin/Admin{Listings,Users}Content.test.tsx` (new), `components/admin/AdminSidebar.tsx` (modified), `components/admin/AdminComingSoon.tsx` (deleted), `app/admin/{listings,requests,matches,deposits,users}/page.tsx` (modified), `app/admin/{reviews,settings,notifications}/` (deleted).

Root: `Caddyfile.avtobirzhasi` (comment-only correction, no directive change).

No payment code, no listing-image-flow code, no matching/exchange/deposit *business logic*, no Docker/Caddy directive, no CI/CD workflow file. No `git commit`/`git push` performed.
