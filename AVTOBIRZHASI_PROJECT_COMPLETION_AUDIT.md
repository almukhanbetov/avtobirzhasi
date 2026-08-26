# Avtobirzhasi Project Completion Audit

**Scoped update (2026-08-26)**: `STAGE6_AUTOMATED_TESTING_REPORT.md` through `STAGE11_REAL_PAYMENT_REPORT.md` all landed after this audit was written. Stages 6–8D's scope was narrowly Testing/CI-CD/Production Readiness (Q/R/S). **Stage 9 additionally re-verified and corrected Skills B, C, J, N, O, and T** on discovering Stage 3/4 had already fixed several findings this audit still described as open. **Stage 10 then closed most of Admin Panel (K)** — after finding and fixing a production-breaking bug of its own (moderation/stats were mounted under a `LocalOnly`-gated path unreachable from any real admin browser session) — and re-updated N/O/T again to reflect it. **Stage 11 then built a real payment integration (FreedomPay) behind Deposits (G)** — a genuine async create→redirect→webhook architecture, live-verified for signature/amount-integrity/idempotency/refund-safety against the real running backend, but not verified against FreedomPay's own sandbox (no credentials available) and not enabled in production (falls back to the mock provider). Every remaining original P0/P1/P2 finding not touched by Q/R/S/B/C/J/K/N/O/T/G (the E2E table's deposit row, Manual Developer Dependencies' remaining items, etc.) still describes the pre-Stage-2 codebase and has *not* been re-verified — don't read an unedited section as "still true today" without checking it directly. See each `STAGE*_REPORT.md` for exactly what its own stage confirmed and how.

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
- The **deposit "payment" has a real gateway integration (FreedomPay) built and live-verified at the protocol level as of Stage 11**, but it is **not enabled in production** — no merchant credentials are configured, so the backend still falls back to the mock provider and no real money moves today. See `STAGE11_REAL_PAYMENT_REPORT.md`.
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
| Core business logic (Listings, Buyer Requests, Price Engine, Matching, Deal Lifecycle, Deposits, Contact Unlock) | 35% | 79% | 27.7 |
| User-facing features (Auth, Notifications, Search, Admin, Frontend) | 20% | 84% | 16.8 |
| Security | 15% | 72% | 10.8 |
| Data integrity (Database) | 10% | 80% | 8.0 |
| Automated testing | 8% | 56% | 4.5 |
| CI/CD | 5% | 85% | 4.3 |
| Production operations | 7% | 88% | 6.2 |

```
Overall Project Completion ≈ 27.7 + 16.8 + 10.8 + 8.0 + 4.5 + 4.3 + 6.2 = 78.3%  ≈  78%
```

*(Updated 2026-08-26 per Stage 11 — see STAGE11_REAL_PAYMENT_REPORT.md. Methodology unchanged: each bucket is the simple average of its named skills' current percentages. **Core business logic** = avg(B 88, C 85, D 70, E 65, F 78, G 78, H 90) = 79, up from 76 — entirely G (Deposits, 55→78) for Stage 11's real FreedomPay integration. **User-facing features** unchanged from Stage 10 (84) — Stage 11 didn't touch A/I/J/K/N. **Automated testing** rises (50→56) for Stage 11's ~20 new backend tests (signature/webhook/async-provider/refund-safety) and 7 new frontend tests. CI/CD and Production operations are unchanged (Stage 11 didn't touch either — no Docker/Caddy/CI file changed, and production payment stays disabled). Security and Data integrity are unchanged from the original 2026-08-25 audit and were not re-verified in this update.)*

Sub-scores (§ Code Complete vs Feature Complete vs Production Ready for full reasoning):

| Dimension | Score |
|---|---:|
| Code Complete | ~78% |
| Feature Complete | ~87% |
| Production Ready | ~88% |
| Commercially Complete | ~28% |

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
| B. Car Listings | MOSTLY COMPLETE | 88% | *(updated 2026-08-26, Stage 9)* Both original findings were already stale before Stage 9 even started (Stage 3 fixed them): `ListingRow.tsx` has a full inline edit form and a confirm-gated delete button, `DescriptionSection.tsx` renders the real `car.description`. Stage 9 re-verified both live (production `curl` + a local API E2E pass) and added the project's first regression tests for the delete/ownership path. Remaining: no image editing post-creation, no dedicated edit page (inline-only is a working design choice, not a gap) |
| C. Buyer Requests | MOSTLY COMPLETE | 85% | *(updated 2026-08-26, Stage 9)* `DELETE /api/requests/:id` (`Cancel`) exists and has UI (Stage 3) — the "no delete/cancel endpoint at all" finding was stale. Ownership, the `currentOffer` exchange-lock, and the full edit/cancel UI flow were all live-verified and now have regression tests. No remaining gap found within this skill's own scope |
| D. Price Engine | PARTIAL | 70% | No guard against manual PATCH bypass of the ±1%/day mechanic; no price history |
| E. Matching Engine | PARTIAL | 65% | No self-match guard (explicitly required, absent in code) |
| F. Deal Lifecycle | MOSTLY COMPLETE | 78% | Expiry/refund path code-only, not live-verified this pass; `cancelled` state unreachable |
| G. Deposits / Payment Logic | MOSTLY COMPLETE | 78% | *(updated 2026-08-26, Stage 11 — see STAGE11_REAL_PAYMENT_REPORT.md)* Real async FreedomPay integration built (create→redirect→webhook, signature-verified, amount/currency integrity enforced, idempotent webhook replay, refund-on-expiry through the provider) and live-verified against the real running backend. Not verified against FreedomPay's actual sandbox (no credentials available) and not enabled in production (falls back to mock) |
| H. Contact Unlock | COMPLETE | 90% | None found |
| I. Notifications | MOSTLY COMPLETE | 70% | No real-time/polling — user must reload page; no push mechanism |
| J. Search & Filters | MOSTLY COMPLETE | 90% | *(updated 2026-08-26, Stage 9)* `QuickSearch.tsx`'s "non-functional, hardcoded model list" finding was stale — it already builds real `region`/`make`/`model` (free text)/`yearFrom`/`priceFrom`/`priceTo` params and navigates to `/cars?...`, matching the real catalog filter API exactly. Now has its first automated tests (4, covering URL-building including the price-range split). Catalog filtering itself was already real |
| K. Admin Panel | MOSTLY COMPLETE | 85% | *(updated 2026-08-26, Stage 10 — see STAGE10_ADMIN_COMPLETION_REPORT.md)* A production-breaking routing bug was found and fixed first: moderation/stats were mounted under `/internal/*` (`LocalOnly`-gated), which returns `403` for **any** external caller regardless of role — meaning the admin panel had never actually been usable from a real browser in production. Moved to `/api/admin/*` (`Auth`+`AdminOnly` only). 5 new sections built with real backend+UI: listings/requests management (with admin force-archive), matches/deposits monitoring, users lookup — all live-verified for the full guest→401/user→403/admin→200 matrix. Notifications-overview/Reviews/Settings were deliberately descoped as POST-MVP/NOT NEEDED for the current business model (Reviews has no underlying feature to administer at all; Settings would require touching the exchange algorithm) and removed from navigation entirely rather than left as misleading stubs. Remaining: role promotion is still manual SQL (deliberate, self-escalation safety wasn't in scope) and there's no admin action audit trail. |
| L. Background Jobs | MOSTLY COMPLETE | 70% | Single ticker only; no retries, no distributed-safety (documented as accepted for MVP) |
| M. Database Integrity | MOSTLY COMPLETE | 80% | 3 dead enum values; migrations now auto-run in the deploy pipeline (Stage 7) — score unchanged since this row covers schema/constraint completeness, not deploy operations (see S); backup/restore mechanism added Stage 8, tracked under S |
| N. Frontend Completeness | MOSTLY COMPLETE | 88% | *(updated 2026-08-26, Stage 10)* "Broken search," "fake description," and "no edit/delete actions" were already stale (Stage 9). Stage 10 closes the remaining cited gap — 8/10 admin sections were stubs — down to 3 deliberately-descoped, cleanly-removed-from-nav sections (not stubs). Remaining, real: no admin action audit trail, role-promotion is manual SQL by design |
| O. Backend API Completeness | MOSTLY COMPLETE | 92% | *(updated 2026-08-26, Stage 10)* Malformed-UUID → 500 was already stale (Stage 3/9). Stage 10 adds admin-wide `ListAll` endpoints for 5 of the 8 resources this row previously flagged as missing (listings, requests, matches, deposits, users) — the other 3 (reviews, settings, notifications-overview) were judged genuinely not needed for the current MVP, not left undone by oversight. *(Stage 8's graceful shutdown/timeouts/pool/health-check work stays tracked under Production Readiness (S).)* |
| P. Security | MOSTLY COMPLETE | 72% | Self-match gap, price-bypass gap, malformed-ID 500, no rate limiting, no admin audit trail. *(Stage 8 re-audited secrets/CORS and found no new issue and no regression — no new gap, but also no fix to any gap listed here; score unchanged. Security headers (HSTS/CSP/etc.) remain unadded, tracked under S.)* |
| Q. Automated Testing | PARTIAL | 56% | *(updated 2026-08-26, Stage 11)* Stage 6: 22 backend + 33 frontend. Stage 9: +12 backend, +12 frontend. Stage 10: +4 backend, +10 frontend. Stage 11: +~20 backend (FreedomPay signature/HTTP/webhook unit tests, an async-provider stub covering the create→pending→webhook flow, amount-mismatch/replay/refund-failure safety cases), +7 frontend (`DepositsContent`, `DepositReturnContent`). Totals: ~58 backend, ~62 frontend. Still no `AuthService`/repository-in-isolation coverage, and 3 of 5 Stage 10 admin components rely on manual E2E rather than their own test file |
| R. CI/CD | MOSTLY COMPLETE | 78% | *(updated 2026-08-26)* Stage 7 added backend/frontend/Docker quality gates before deploy, PR checks, migration-failure protection, deploy concurrency control, least-privilege permissions — not yet exercised on GitHub's real infrastructure, no post-deploy smoke test, no automated rollback |
| S. Production Readiness | MOSTLY COMPLETE | 88% | *(updated 2026-08-26, Stage 8D)* Stage 8C's one remaining gap — the backup mechanism was built but never reached the VPS — is now closed and **confirmed live**: `.github/workflows/deploy.yml`'s `deploy` job now syncs `docker-compose.prod.yml`/`scripts/backup-db.sh`/`scripts/restore-db.sh` to the VPS on every deploy (real run, commit `40f579f`, all 5 jobs green — https://github.com/almukhanbetov/avtobirzhasi/actions/runs/32966975734) and installs/runs a daily backup. Operator-confirmed directly on the VPS: a real backup file exists (`avtobirzhasi_20260826T125104Z.sql.gz`), passes `gzip -t` integrity, the backup script exits `0`, the log shows successful creation and retention pruning, a cron entry is installed, retention is configured for 14 days. Combined with Stage 8C's confirmations (migration `00009` applied, Docker healthy, backend RBAC correct, TLS valid), essentially every operational item this audit tracked under Production Readiness is now closed. **Still open, explicitly non-blocking**: no off-host backup destination (a full VPS/disk loss would still take local backups with it); no log aggregation/alerting/monitoring; no security headers (HSTS/CSP/etc.) in Caddy; Docker images are tagged `:latest` only (no commit-SHA traceability). See `STAGE8D_BACKUP_DEPLOY_SYNC_REPORT.md`. |
| T. Product Completeness | MOSTLY COMPLETE | 88% | *(updated 2026-08-26, Stage 10)* Golden-path and self-service flows already worked (Stage 9). Admin/backoffice — the one real gap Stage 9 left — is now closed for everything the current business model actually needs (moderation, stats, listings/requests management, matches/deposits monitoring, user lookup). What's left (mock payment, role-promotion UI, action audit trail) is deliberate/deferred, not broken |

**Completion criteria reminder**: a skill can only reach 100% if code, DB support, working API, working frontend, correct permissions, *and* automated tests all exist. Given automated tests are effectively absent project-wide, **no skill in this project qualifies for a true 100%** under the stated rubric — the ceiling for every row above is capped by the missing test category regardless of how solid the implementation is.

---

## Core Business Skills

### A. Authentication & Accounts — MOSTLY COMPLETE, 85%
- Register/login/logout(client-side token clear)/`GET /auth/me` all implemented and wired end-to-end: `backend/internal/handlers/auth.go`, `backend/internal/service/auth.go`, `frontend/features/auth/{LoginForm,RegisterForm}.tsx`.
- JWT (HS256, `Authorization: Bearer`, 7-day expiry), phone-based login with anti-enumeration (identical error for wrong phone vs wrong password).
- Role model: `users.role` (`user`/`admin`) added via `backend/migrations/00009_add_user_role.sql`, enforced by `backend/internal/middleware/admin.go` (`AdminOnly`, DB-sourced, never trusts a JWT claim) — confirmed by direct read.
- `frontend/components/auth/RequireAuth.tsx` is explicitly UX-only; `RequireAdmin.tsx` is a real gate for `/admin/*`.
- Gaps: no password reset, no email/phone verification, no refresh-token/session-revocation (acceptable for a stateless-JWT MVP, not a blocker by itself), profile-edit capability not independently verified this pass.

### B. Car Listings — MOSTLY COMPLETE, 88% *(updated 2026-08-26, Stage 9 — see STAGE9_PRODUCT_COMPLETION_REPORT.md)*
Original findings (2026-08-25, now stale): no edit/delete UI, fake description. **Both were already fixed by Stage 3**, before this session's Stage 6–9 infrastructure/testing work began — this audit simply hadn't been re-checked against current code until now.
- Create/list/detail/filter/similar/favorite/soft-delete-via-API all work: `backend/internal/handlers/{listings,cars,favorites}.go`.
- New listings correctly start `status='moderation'` and are invisible until approved.
- `Update`/`Archive` (`PATCH`/`DELETE /api/listings/:id`) are ownership-checked (`loadOwnedListing`) and **do have a real UI**: `frontend/components/dashboard/ListingRow.tsx` is a full inline edit form (price hidden/locked for exchange listings, mileage/region/color/description editable) plus a `confirm()`-gated delete button, both disabled once the listing leaves `active`/`moderation`. Live-verified this pass (owner edit/delete succeed, non-owner gets 403, no token gets 401) and now has regression tests (`listings_lifecycle_test.go`).
- `frontend/components/cars/DescriptionSection.tsx` renders the real, stored `car.description` (falling back to an honest "no description" message) — the mock-generator module was deleted.
- `PATCH price` is blocked by the Stage 2 exchange guard (409) — re-verified live this pass, both server-side and the frontend's own mirrored client-side guard (no price field rendered at all for exchange listings).
- Remaining, real: no image editing (add/remove/reorder photos post-creation); edit is inline-in-row rather than a dedicated routed page — a working design choice, not a defect.

### C. Buyer Requests — MOSTLY COMPLETE, 85% *(updated 2026-08-26, Stage 9 — see STAGE9_PRODUCT_COMPLETION_REPORT.md)*
Original findings (2026-08-25, now stale): no UI entry point for edit, no delete/cancel endpoint at all. **Both were already fixed by Stage 3.**
- Create/list work: `backend/internal/handlers/requests.go`.
- `Update` (`PATCH /api/requests/:id`) is ownership-checked and has a real UI: `frontend/components/dashboard/RequestRow.tsx` offers an inline region-only edit (consistent with `currentOffer` being exchange-managed) and a `confirm()`-gated cancel button, both gated to `status === "active"`.
- `DELETE /api/requests/:id` (`Cancel`) exists — soft-cancels (`status → archived`), ownership-checked via `loadOwnedRequest`. Live-verified this pass (owner cancel succeeds, non-owner gets 403, currentOffer edit attempt gets 409) and now has regression tests (`requests_lifecycle_test.go`). The `moderation` status value remains unreachable dead code (informational, not a defect).

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

### G. Deposits / Payment Logic — MOSTLY COMPLETE, 78%
Two distinct levels, per the audit's own required framing:

**Business deposit logic implemented — yes, and solid.**
- 1% of `final_price`, created atomically with the match in the same transaction (`tryCreateMatch`, `exchange.go:225-250`).
- Ownership/status re-checked under `SELECT ... FOR UPDATE` in a transaction — correct defense-in-depth against double-pay and IDOR. Unchanged by Stage 11.
- Refund is tied to match expiry, and — as of Stage 11 — is a real `PaymentProvider.Refund` call for any deposit charged through a real provider, not just a local status flip; the refund is never applied locally before the provider confirms it (a failing `Refund` call aborts the whole expiry transaction, unit-tested).

**Real external payment integration — built, live-verified at the protocol level, not yet enabled in production.**
Stage 11 (2026-08-26 — see `STAGE11_REAL_PAYMENT_REPORT.md`) replaced the mock's single synchronous `Charge` with a genuine async architecture (`CreatePayment`/`GetPaymentStatus`/`VerifyWebhook`/`Refund`) and implemented it against **FreedomPay** — the gateway the sibling project uibirzhasi.kz names on its own payment-instructions page, per explicit user direction ("надо сделать все как uibirzhasi.kz"). `POST /api/deposits/:id/pay` now starts a hosted-page session and returns a redirect URL; a new public `POST /api/webhooks/payments/freedompay` endpoint — signature-verified, amount/currency-checked against the deposit's own server-computed amount, idempotent on replay — is the only thing that ever marks a deposit paid for a real charge. This was exercised directly against the real running backend and real Postgres this stage: a correctly-signed webhook marked a seeded deposit paid end-to-end; a forged signature was rejected; a validly-signed webhook claiming the wrong amount was rejected. What was **not** verified: a real payment against FreedomPay's actual sandbox API (no credentials were available in this session) — the exact response shape of `get_status3.php` and the refund endpoint path are implemented from public documentation, not observed from a live response. `FREEDOMPAY_MERCHANT_ID`/`FREEDOMPAY_SECRET_KEY` are unset in this environment, so the backend still falls back to `MockPaymentProvider` and **no real money moves today** — this is why the score is 78%, "mostly complete," not higher: the architecture, security properties, and business-logic integration are real and tested, but the loop hasn't closed with an actual gateway sandbox run, and production payment is explicitly not enabled.

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

### J. Search & Filters — MOSTLY COMPLETE, 90% *(updated 2026-08-26, Stage 9 — see STAGE9_PRODUCT_COMPLETION_REPORT.md)*
Original finding (2026-08-25, now stale): QuickSearch was a dead `<Button href="/cars">` with a hardcoded 3-option model dropdown. **Already fixed**, predating this session's Stage 6–9 work.
- `/cars` catalog filtering (region/make/model/year/price/bodyType/transmission/drivetrain/fuelType, URL params, backend-supported) is real and complete.
- `frontend/components/home/QuickSearch.tsx` builds real `URLSearchParams` (`region`, `make`, free-text `model`, `yearFrom`, a `priceFrom`/`priceTo` split from a bucketed range select) and `router.push()`s to `/cars?...`, matching the catalog's own param names exactly. Live-verified this pass (submit with a full selection, a price range, a padded model string, and an empty selection) and now has its first automated tests (4, `QuickSearch.test.tsx`).

### K. Admin Panel — MOSTLY COMPLETE, 85% *(updated 2026-08-26, Stage 10 — see STAGE10_ADMIN_COMPLETION_REPORT.md)*
Original findings (2026-08-25, stale by Stage 9): 8/10 sections render `<AdminComingSoon>`; the backend had genuinely no endpoints for them either.

**Stage 10, before writing anything new**: found that moderation and stats — the two sections every prior pass called "real" — were mounted under `/internal/*` (`LocalOnly`-gated), which returns `403 FORBIDDEN` for *any* caller not on the VPS's own loopback, regardless of role. Since both admin pages are client components fetching from an admin's own browser, **this means the admin panel had never actually been reachable from a real production browser session**, in any deploy — a routing bug invisible to every earlier stage's verification (all of which tested the backend directly with a JWT, or read code, never simulated a real browser hitting the public API). Fixed: moved to `/api/admin/*` (`Auth`+`AdminOnly` only — the real, DB-sourced role check that was always the actual security boundary; `LocalOnly` stays only on the one genuinely internal, non-UI endpoint, the daily-tick trigger).

With that fixed, 5 of the 8 stub sections got real backend (`ListAll` on the relevant repositories, paginated, optionally filtered) and real UI: **listings management** (view any listing + admin force-archive), **requests management** (same, for buyer requests), **matches monitoring** (read-only), **deposits monitoring** (read-only), **users lookup** (read-only, name/phone search, never exposes `password_hash`). All live-verified for the required guest→401/user→403/admin→200 matrix, backed by 4 new backend + 10 new frontend tests.

The remaining 3 (**notifications overview, reviews, settings**) were judged **not needed for the current MVP**, not simply skipped:
- **Reviews** has no underlying feature anywhere in the product (no table, no write endpoint, no review-writing UI) — there is nothing to administer.
- **Settings** would require moving hardcoded exchange constants (`dailyRate`, `matchTolerancePercent`) into DB-backed config — a real, risky feature change to the pricing algorithm, explicitly out of scope.
- **Notifications overview** had no concrete operational necessity identified beyond what matches/deposits monitoring already covers.

Per the task's explicit instruction, these were **removed from the admin navigation and deleted as routes** rather than left as clickable dead ends.

Admin promotion still has no UI or endpoint, by explicit, re-confirmed design — a manual `UPDATE users SET role='admin' ...` SQL statement (see Manual Developer Dependencies). Building this safely (self-escalation risk) was judged bigger than this stage's "minimal" scope.

---

## Backend Completion — O. Backend API Completeness: MOSTLY COMPLETE, 85% *(updated 2026-08-26, Stage 9 — see STAGE9_PRODUCT_COMPLETION_REPORT.md)*
- Routes/handlers/services/repositories follow one consistent pattern across the module; validation via Gin binding tags (`oneof=`, `required`, `min=`); ownership checks are pervasive and correctly implemented everywhere they were checked (`loadOwnedListing`, request/deposit/match ownership checks).
- `go build ./...`, `go vet ./...` both clean.
- **Updated**: the malformed-UUID → 500 finding was already stale (Stage 3 added `requireUUIDParam`, applied to every `:id` route). Stage 9 re-verified this live across 11 distinct routes — including two, `GET /api/cars/:id` and `GET /api/sellers/:id`, checked directly against **production** (`https://api.avtobirzhasi.kz`) — all returning `400 VALIDATION_ERROR`, none reaching Postgres with a bad string.
- **Updated**: the "orphan-in-reverse" finding (working endpoints with no UI caller) is resolved — `PATCH`/`DELETE /api/listings/:id` and `PATCH`/`DELETE /api/requests/:id` all have real, live-verified UI callers now (Skills B/C).
- Remaining: no admin-wide list endpoint for any of 8 resources (Skill K) — the one real backend-completeness gap left.

## Frontend Completion — N. Frontend Completeness: PARTIAL, 78% *(updated 2026-08-26, Stage 9 — see STAGE9_PRODUCT_COMPLETION_REPORT.md)*
What works: registration/login, catalog browse + filter, listing detail, dashboard overview, matches, deposits, notifications (list/read), favorites — all genuinely wired to live data via `lib/api/*` + React Query.

**Updated — all four of these findings were already stale before Stage 9, fixed by Stage 3/4, and are now additionally covered by this project's first-ever component tests**:
- `ListingRow.tsx` / `RequestRow.tsx` — full inline edit + confirm-gated delete/cancel, ownership- and status-gated. Live-verified + `ListingRow.test.tsx` (4 tests).
- `DescriptionSection.tsx` — renders the real, stored `car.description`.
- `QuickSearch.tsx` — builds real filter params and navigates the real catalog. Live-verified + `QuickSearch.test.tsx` (4 tests).
- `FreshListings.tsx` — calls the real `GET /cars?sort=newest` endpoint, with loading/error/empty states. Live-verified + `FreshListings.test.tsx` (4 tests).

Still genuinely open:
- 8/10 admin sections are `AdminComingSoon` stubs — re-confirmed, not fixed (Skill K, no backend exists to wire to).
- `frontend/lib/mock/dashboard.ts` — still orphaned (unused); not re-checked this pass but Stage 9 touched no dashboard-adjacent files that would have changed this.
- `frontend/lib/mock/cars.ts` still holds the `regions`/`makes`/`years` reference/dropdown constant arrays used by QuickSearch and both dashboard rows — legitimate static reference data (per SKILL.md's own "Reference data" section), not fake listings, but the file's `mock/` name is misleading for what it actually contains now. Renaming it touches 7 files, outside Stage 9's no-global-cleanup scope — flagged, not fixed.

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

## Testing Completion — Q. Automated Testing: PARTIAL, 50% *(updated 2026-08-26 — see STAGE6_AUTOMATED_TESTING_REPORT.md, STAGE9_PRODUCT_COMPLETION_REPORT.md, and STAGE10_ADMIN_COMPLETION_REPORT.md)*
Original finding (2026-08-25, now stale): `go test ./...` → `[no test files]` for all 9 backend packages; no frontend `test` script; zero `*_test.go`/`*.test.ts(x)` files anywhere.

**Current state**: Stage 6 closed the zero-coverage gap for the two money-relevant code paths this audit flagged as having "no regression protection at all" (§ Project Definition of Done, Quality DoD):
- Backend: 22 tests across `phone_test.go`, `deposits_test.go`, `exchange_test.go` (service layer) and `listings_update_test.go`, `requests_update_test.go` (handler layer, real HTTP via `httptest`). Directly covers: self-match is never created (the exact Stage 2 regression), `PATCH price`/`currentOffer` bypass rejection (the other Stage 2 regression), the full deposit-pay flow to `confirmed`, double-pay rejection, wrong-user rejection, a failing payment provider leaving state untouched, daily decay/growth math, overdue-match expiry with refund, and daily-tick idempotency. Runs against a dedicated `avtobirzhsi_test` database, never the dev/prod database.
- Frontend: `vitest` + `@testing-library/react` newly installed (there was none before); 33 tests covering `parseCarFilters`/`countActiveFilters`, `formatTenge`/`formatMileage`, `pluralizeCars`, the phone-normalization Zod schema (cross-checked against the backend's own normalization), and `buildHref`/`getParam`. All pure-logic — **no component was ever rendered/tested**.
- Still zero coverage (as of Stage 6): `AuthService` (register/login/JWT issuance), any repository in isolation, admin/moderation/dashboard/notification handlers, and everything in the frontend that isn't a pure `lib`/`features` function (i.e. no component, page, or hook has a test).

**Stage 9 addition (2026-08-26)**: 12 more backend tests — `validation_test.go` (pure unit test of `requireUUIDParam`), `listings_lifecycle_test.go` and `requests_lifecycle_test.go` (owner delete/cancel succeeds, non-owner forbidden, unauthenticated rejected, malformed UUID on PATCH/DELETE). And, closing the "no component was ever rendered/tested" gap Stage 6 explicitly flagged: **12 new frontend component tests**, the first in this project — `QuickSearch.test.tsx`, `FreshListings.test.tsx`, `ListingRow.test.tsx` — using real RTL rendering, real `fireEvent` interactions, and mocked API/router/auth dependencies. 46% reflected this real expansion while acknowledging most components, all repositories, `AuthService`, and admin/moderation/dashboard handlers remain untested.

**Stage 10 addition (2026-08-26)**: 4 more backend tests — `admin_test.go`, covering the guest/user/admin RBAC matrix across all 7 `/api/admin/*` GET endpoints in one table-driven test, plus response-shape, password-hash-non-leak, and archive-idempotency checks. 10 more frontend component tests — `AdminListingsContent.test.tsx` and `AdminUsersContent.test.tsx`, extending the component-testing pattern Stage 9 started to the new admin surface. 50% reflects 38 backend / 55 frontend tests total, still without `AuthService`/repository-in-isolation coverage, and without a dedicated test file for 3 of the 5 new admin components (Matches/Deposits/Requests — covered by manual E2E, not their own automated test, per this stage's "minimal" instruction).

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

## Production Readiness — S. Production Readiness: MOSTLY COMPLETE, 88% *(updated 2026-08-26, Stage 8D — see STAGE8D_BACKUP_DEPLOY_SYNC_REPORT.md)*

**Stage 8D, implemented and confirmed live**: Stage 8C found the backup mechanism Stage 8 built was never actually on the VPS at all (`scripts/backup-db.sh`: NOT PRESENT) — root cause: the deploy pipeline only ever pulled/ran Docker *images*, never repository files. Stage 8D added an `scp`-based sync step to `.github/workflows/deploy.yml` (copying exactly `docker-compose.prod.yml`, `scripts/backup-db.sh`, `scripts/restore-db.sh` — no secrets, no source code) plus, in the existing SSH deploy script: making the scripts executable, installing an idempotent daily 03:00 backup cron job, and running+verifying one backup immediately on every deploy (failing the deploy visibly if it produces no non-empty file).

The first push (`63e81cb`) actually **failed** in real CI — `appleboy/scp-action`'s `source` input needs comma-separated values, not the newline-separated YAML block first used, so `tar` found zero files to archive. This was reproduced exactly with the real `drone-scp` binary locally, fixed, and re-pushed (`40f579f`). **That run succeeded — all 5 jobs green** (https://github.com/almukhanbetov/avtobirzhasi/actions/runs/32966975734), and a human operator independently confirmed directly on the production VPS: a real backup file exists and passes gzip integrity, the script exits `0`, the log shows successful creation and retention pruning, a cron entry is installed, retention is 14 days. Off-host backup remains **NOT IMPLEMENTED** — explicitly deferred, and per this stage's own stated criteria does not by itself block calling this category production-ready. No log aggregation/monitoring, no Caddy security headers, and `:latest`-only image tags (no commit-SHA traceability) round out what's still open — all real, but all narrower gaps than "backups don't work in production," which is what this stage closed.
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
| Deposits (real payment) | PARTIAL *(updated 2026-08-26, Stage 11)* | Real FreedomPay integration built and live-verified at the protocol level (webhook signature/amount-integrity/idempotency); not verified against FreedomPay's sandbox, not enabled in production — see STAGE11_REAL_PAYMENT_REPORT.md |
| Contact unlock | PASS | gate verified directly |
| Seller edits/removes own listing | PASS *(updated 2026-08-26, Stage 9)* | Live-verified: owner edit/delete succeed, non-owner 403, no token 401 — `ListingRow.tsx` + `listings_lifecycle_test.go` |
| Buyer edits/cancels own request | PASS *(updated 2026-08-26, Stage 9)* | Live-verified: owner edit/cancel succeed, non-owner 403 — `RequestRow.tsx` + `requests_lifecycle_test.go` |

**Core E2E: PASS** for the "list → moderate → request → converge → match → deposit → unlock" spine, **and now also** for ordinary self-service account management (editing/removing your own listings and requests) — the one thing this table's PARTIAL verdict used to hinge on. **PARTIAL** remains accurate for real money movement: Stage 11 built and live-verified a real FreedomPay integration at the protocol level, but it isn't enabled in production (no credentials configured) and hasn't been run against FreedomPay's own sandbox — admin/backoffice is no longer a factor here as of Stage 10 (moderation, stats, listings/requests management, matches/deposits monitoring, and user lookup all now work; only 3 deliberately-descoped sections remain unbuilt).

---

## Incomplete / Stub / Mock Functionality

Directly confirmed this pass (not inherited from prior reports without re-checking):
- `frontend/components/admin/AdminComingSoon.tsx` used by 8/10 admin pages — literal placeholder, no data.
- ~~`frontend/components/cars/DescriptionSection.tsx` → fake generated text~~ — **fixed** (renders the real stored description; confirmed stale as of Stage 9, 2026-08-26).
- ~~`frontend/components/home/FreshListings.tsx` → hardcoded fake catalog~~ — **fixed** (calls the real `GET /cars?sort=newest`; confirmed stale as of Stage 9, 2026-08-26).
- ~~`frontend/components/home/QuickSearch.tsx` — non-functional search control~~ — **fixed** (builds real filter params, navigates the real catalog; confirmed stale as of Stage 9, 2026-08-26).
- ~~`backend/internal/service/deposits.go` — deposit "payment" explicitly self-documented as mock~~ — **superseded** (Stage 11, 2026-08-26): a real FreedomPay integration now exists behind the same interface; `MockPaymentProvider` remains the code path actually running in production only because no real credentials are configured (`cmd/api/main.go` falls back to it by design), not because no real integration exists. See `STAGE11_REAL_PAYMENT_REPORT.md`.
- `frontend/lib/mock/dashboard.ts` — orphaned/unused mock module (dead code, harmless). Not re-checked this pass.
- `frontend/lib/mock/cars.ts` — no longer fake listing data, but still holds the `regions`/`makes`/`years` constant arrays QuickSearch and the dashboard rows import; legitimate reference data, misleadingly-named file (see Frontend Completion (N) above).
- Grep for `TODO|FIXME|HACK|not implemented|coming soon` across `backend/internal`, `backend/cmd`, and all frontend `app/components/features/lib` source found **zero literal markers** — none of the above are self-flagged in code comments; they were only found by reading actual behavior, which is itself a signal that gaps here are silent rather than tracked.

---

## Manual Developer Dependencies

Concretely, what currently requires a developer/operator to do something by hand for the product to function normally:
1. **Promoting a user to admin** — no endpoint exists (by design); requires `UPDATE users SET role='admin' WHERE phone='...'` run directly against the database.
2. **Running database migrations in production** — `goose` is bundled into the backend image but never invoked automatically by the container entrypoint or the CI pipeline; an operator must SSH in and run it.
3. **Merging the Caddy config** — `Caddyfile.avtobirzhasi` is an unmerged snippet; a human must hand-splice it into the VPS's live Caddy config and cannot verify from this repo that it's actually been done.
4. ~~**Editing or removing a listing/buyer request**~~ — **resolved** (Stage 9, 2026-08-26, confirming a Stage 3 fix): both have real, live-verified, ownership-checked UI now (`ListingRow.tsx`, `RequestRow.tsx`).
5. **Deploying a rollback** — no automated rollback; reverting a bad production deploy means a human re-runs the workflow against an older commit or SSHes in to manually run the previous image tag.
6. **Verifying a deploy didn't break anything** — since CI has no test/lint gate, a human must manually smoke-test after every deploy (the pipeline itself provides no such assurance).

---

## Code Complete vs Feature Complete vs Production Ready

**Code Complete (~78%, updated 2026-08-26, Stage 11)** — Nearly every core mechanic described in the project's own skill docs has a real code implementation. The self-match guard, price-bypass guard, and buyer-request delete endpoint this figure originally cited as missing were all fixed by Stages 2–3 (predating this note); of the 8 admin sections this figure originally cited as backend-less, 5 now have real endpoints (Stage 10) and the other 3 were judged not needed for the current MVP rather than left undone. Stage 11 added the real FreedomPay payment integration code, bringing this figure up from ~75%.

**Feature Complete (~87%, updated 2026-08-26, Stage 11 — see STAGE9/STAGE10/STAGE11 reports)** — Originally ~55%, on the finding that users couldn't manage their own listings/requests, homepage search didn't search, and 8/10 admin sections didn't function. All three were fixed (Stage 3/4 for the first two, predating this note; Stage 10 for admin). Stage 11 then built a real payment integration behind deposits — code-complete and live-verified at the protocol level. What keeps this below "fully feature complete": the payment integration isn't enabled in production (no credentials) and hasn't been run against the real gateway's sandbox, so it isn't yet a *proven* real payment, only a *built* one.

**Production Ready (~88%, updated 2026-08-26 — see STAGE8/8B/8C/8D reports)** — Originally ~35%, before Stage 8's health checks/graceful shutdown/timeouts/pool config, Stage 8B/8C's live CI+VPS verification, and Stage 8D's confirmed-live production backup mechanism. The admin-role security fix has been directly confirmed applied to the live database (Stage 8C). What's left: no off-host backup, no log aggregation/alerting, no security headers in Caddy — real but narrower gaps than what dragged this figure down originally. Stage 11 didn't touch this dimension (no Docker/Caddy/CI change; production payment is explicitly not enabled).

**Commercially Complete (~28%, updated 2026-08-26, Stage 11)** — A real business still can't run on this without constant developer involvement. Listings/requests **can** be self-managed now (Stage 3/4, live-verified Stage 9) and most admin operations work (Stage 10). The binding constraint has shifted but not resolved: admins can still only be created via manual SQL, and — most importantly — no actual money can currently change hands through this product. Stage 11 removed the *engineering* blocker (a real, tested payment integration now exists) but not the *operational* one: it needs FreedomPay merchant approval, real credentials, and a sandbox-verified go-live before deposits become real money. The modest bump from ~25% reflects that the remaining distance to real payment is now a business/ops step, not a coding one.

These four numbers are deliberately far apart. The gap between "Code Complete" (78%) and "Commercially Complete" (28%) *is* the answer to "is this finished": no.

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
- ~~Decide and implement real payment integration~~ — **done** (Stage 11, 2026-08-26): FreedomPay integration built and live-verified at the protocol level. **Still open:** get real merchant credentials, run a sandbox-verified go-live, and enable it in production (`FREEDOMPAY_MERCHANT_ID`/`FREEDOMPAY_SECRET_KEY` are unset). *Skill:* Deposits. *Scope:* SMALL (ops/credentials, not engineering).
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
2. The deposit "payment" that underpins the entire marketplace's financial premise has a real gateway integration (FreedomPay, Stage 11) built and live-verified at the protocol level, but it is not enabled in production and hasn't been run against the gateway's own sandbox — no real money moves yet.
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
