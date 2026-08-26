# Stage 1 — Admin Authorization

Date: 2026-08-23
Branch: `main` @ `996858a` (base commit before this stage's uncommitted changes)
Scope: fix the CRITICAL "no admin-role authorization model" finding from `AVTOBIRZHASI_FUNCTIONAL_AUDIT.md`. No other audit findings were touched.

## Problem

`AVTOBIRZHASI_FUNCTIONAL_AUDIT.md` found that every administrative capability in the backend — the listing moderation queue (`GET /internal/listings/pending`, `POST /internal/listings/:id/approve|reject`), the site-wide admin stats endpoint (`GET /internal/admin/stats`), and the manual Auto Exchange daily-tick trigger (`POST /internal/jobs/run-daily-tick`) — was protected by exactly one mechanism: `middleware.LocalOnly()`, which checks that the request's raw TCP peer address is `127.0.0.1`/`::1`. There was no concept of a user role, an admin account, or any identity-based check anywhere in the schema or code. The `users` table had no `role`/`is_admin` column. The Next.js `/admin/*` routes had no gate of their own either — anyone who navigated there in a browser would see the full admin shell render, with only the backend's network check standing between them and real data.

## Root Cause

Loopback-only protection answers "is this request coming from the same machine the backend is running on?" — it says nothing about *who* is making the request. That is sufficient only under a specific, fragile set of assumptions holding simultaneously: the backend process never binds a public interface directly, Gin's client-IP resolution is never mistakenly trusted elsewhere (the app runs with Gin's default "trust all proxies" setting, and `LocalOnly()`'s own code comment documents that `ClientIP()` — as opposed to the raw `RemoteAddr()` it deliberately uses instead — could be spoofed via `X-Forwarded-For`), and the production reverse proxy's edge block on `/internal/*` stays correctly configured indefinitely. If any one of those breaks, every administrative action becomes available to anyone, with no authentication at all — not even a password check. A same-machine/same-network position is not proof of authorization; it was standing in for one.

## Solution

A minimal `user`/`admin` role was added to the existing `users` table and is now enforced by a real, JWT-backed authorization check in front of every administrative endpoint, layered on top of (not instead of) the existing network check:

```
request
  │
  ▼
middleware.LocalOnly()      — unchanged: TCP peer must be loopback
  │
  ▼
middleware.Auth(jwtSecret)  — unchanged Auth middleware, now also
  │                           mounted in front of /internal/*
  ▼
middleware.AdminOnly(userRepo)  — NEW: loads the user fresh from the
  │                                database and requires role='admin'
  ▼
handler
```

`AdminOnly` re-reads the user's role from PostgreSQL on every request — it never trusts a role claim embedded in the JWT (there is no such claim; the token only ever carries `sub`/`iat`/`exp`), so a tampered or forged token cannot grant admin access even if someone guessed or leaked the JWT secret's shape. Role changes (promoting/demoting an admin) take effect on a user's very next request, without requiring them to log in again — verified live in this stage (see Security Tests).

No new public endpoint can change a user's role. Registration (`POST /api/auth/register`) has no `role` field in its request struct, and the repository's `INSERT` never includes a `role` column — every new row gets the column's own `'user'` default from PostgreSQL, not from anything the client sent. A registration payload containing `{"role":"admin"}` was tested live and had zero effect (see Security Tests).

## Database Changes

New migration `backend/migrations/00009_add_user_role.sql` (existing, already-applied migrations `00001`–`00008` were not touched):

```sql
-- +goose Up
ALTER TABLE users
    ADD COLUMN role varchar NOT NULL DEFAULT 'user'
    CHECK (role IN ('user', 'admin'));

-- +goose Down
ALTER TABLE users DROP COLUMN role;
```

- Backward-compatible: adds a column with a default, so every existing row (verified: all 9 pre-existing users in the local dev database) gets `role='user'` automatically — nobody is silently promoted.
- `NOT NULL` with a `DEFAULT` and a `CHECK` constraint restricting values to exactly `user`/`admin` — no other role string can be inserted at the database level, even if application code had a bug.
- No data was deleted, no existing column was altered or dropped.
- Applied and verified against a freshly-migrated local Postgres 17 instance (`goose up` → version 9, clean).

## Authorization Model

```
Guest (no Authorization header, or an invalid/expired one)
  ↓
401 Unauthorized  ("Требуется авторизация")

Authenticated user, users.role = 'user'
  ↓
403 Forbidden  ("Требуются права администратора")

Authenticated user, users.role = 'admin'
  ↓
Allowed — handler runs
```

## Protected Endpoints

| Method | Endpoint | Before | After |
|---|---|---|---|
| GET | `/internal/listings/pending` | `LocalOnly()` only | `LocalOnly()` + `Auth()` + `AdminOnly()` |
| POST | `/internal/listings/:id/approve` | `LocalOnly()` only | `LocalOnly()` + `Auth()` + `AdminOnly()` |
| POST | `/internal/listings/:id/reject` | `LocalOnly()` only | `LocalOnly()` + `Auth()` + `AdminOnly()` |
| GET | `/internal/admin/stats` | `LocalOnly()` only | `LocalOnly()` + `Auth()` + `AdminOnly()` |
| POST | `/internal/jobs/run-daily-tick` | `LocalOnly()` only | `LocalOnly()` + `Auth()` + `AdminOnly()` |
| GET | `/api/health` and all other `/api/*` routes | unchanged | unchanged (out of scope — these are either public or already `Auth()`-gated per-user endpoints, not admin endpoints) |

## Security Tests

All run live against a locally-run instance (fresh Postgres 17 container, migrations 1–9 applied, seed data loaded, API on port 8090), using real HTTP requests via `curl` — not just code inspection.

| Test | Expected | Actual | Result |
|---|---|---|---|
| Guest → `GET /internal/admin/stats` | 401 | `401 {"error":{"code":"UNAUTHORIZED",...}}` | PASS |
| Guest → `GET /internal/listings/pending` | 401 | 401 | PASS |
| Guest → `POST /internal/jobs/run-daily-tick` | 401 | 401 | PASS |
| Normal user (valid JWT, `role='user'`) → `GET /internal/admin/stats` | 403 | `403 {"error":{"code":"FORBIDDEN","message":"Требуются права администратора"}}` | PASS |
| Normal user → `GET /internal/listings/pending` | 403 | 403 | PASS |
| Normal user → `POST /internal/jobs/run-daily-tick` | 403 | 403 | PASS |
| Same user promoted to `role='admin'` via SQL, **same already-issued JWT reused** (no re-login) → all three endpoints | 200 | 200 / 200 / 200, correct data returned | PASS |
| `GET /api/auth/me` before/after promotion | reflects live DB role | `"role":"user"` → `"role":"admin"` after the `UPDATE`, no new login | PASS |
| Registration privilege escalation: `POST /api/auth/register` with `{"role":"admin","isAdmin":true}` in the body | account created as `role='user'` | Response and DB row both show `"role":"user"` | PASS |
| Token tampering: hand-forged JWT with `"role":"admin"` injected into the payload, invalid/absent signature | rejected (signature check) | `401` — signature validation fails before role is ever considered | PASS |
| Regression: register, login, `/auth/me`, guest `GET /api/cars`, `GET /api/cars/:id`, authenticated `GET /api/dashboard/overview`, `POST /api/listings` (create own listing) | unchanged behavior | All identical to pre-fix behavior | PASS |

## Build Verification

```text
Go build:              PASS (go build ./... — exit 0, no output)
Go vet:                 PASS (go vet ./... — exit 0, no output)
Go test:                NO TEST FILES (pre-existing project-wide gap; not introduced by this stage; not required to fix per Stage 1 scope)
gofmt:                  1 pre-existing unrelated finding (internal/models/models.go — Match/Notification struct alignment, present before this stage's changes, not touched)
Frontend build:         PASS (npm run build — Next.js 16.2.11/Turbopack, all 27 routes generated, TypeScript clean)
Frontend lint:          PASS (npm run lint — 0 errors, 1 pre-existing advisory warning in ListingForm.tsx, unrelated to this stage)
Database migration:     PASS (goose up — 00009_add_user_role.sql applied cleanly; existing 9 users all show role='user'; NOT NULL + CHECK constraint confirmed via \d users)
```

## Regression Verification

Re-tested after the change, all against the same local instance:
- `POST /api/auth/register` — new account created normally, response now also includes `"role":"user"`.
- `POST /api/auth/login` — unchanged, returns a valid JWT.
- `GET /api/auth/me` — unchanged shape plus the new `role` field.
- `GET /api/cars` (guest, unauthenticated) — 200, catalog unaffected.
- `GET /api/cars/:id` — unaffected (behaves per existing status rules, unrelated to this change).
- `GET /api/dashboard/overview` (authenticated) — 200, unaffected.
- `POST /api/listings` (create own listing, authenticated) — 200, unaffected; ordinary users are not touched by the `AdminOnly` middleware at all since it is only mounted on the `/internal` group.

No heavy end-to-end re-run (full match/deposit/contacts-unlock lifecycle) was repeated in this stage, per the task's own instruction that this isn't required when the change doesn't touch that logic — Stage 1 does not modify the Auto Exchange engine, matching, deposits, or contacts-unlock code at all.

## Files Changed

Backend:
- `backend/migrations/00009_add_user_role.sql` — **new**
- `backend/internal/models/models.go` — added `Role` field to `User`
- `backend/internal/repository/users.go` — `Create`/`FindByPhone`/`FindByID`/`scanUser` now select/return `role`
- `backend/internal/middleware/admin.go` — **new**, `AdminOnly` middleware
- `backend/internal/handlers/response.go` — `userResponse` now includes `role`
- `backend/internal/handlers/moderation.go`, `admin_stats.go`, `jobs.go` — doc comments updated to describe the new middleware chain (no behavioral change beyond what `main.go` wires)
- `backend/cmd/api/main.go` — `/internal` group now chains `LocalOnly()` + `Auth()` + `AdminOnly()`

Frontend:
- `frontend/types/user.ts` — `AuthUser.role` field added
- `frontend/components/auth/RequireAdmin.tsx` — **new**, admin route guard
- `frontend/app/admin/layout.tsx` — wrapped children in `RequireAdmin`
- `frontend/lib/api/admin.ts`, `frontend/lib/api/moderation.ts` — functions now take and forward a `token` parameter
- `frontend/components/admin/AdminDashboardContent.tsx`, `frontend/components/admin/AdminModerationContent.tsx` — now read the JWT from `useAuth()` and pass it to the above

Documentation:
- `AVTOBIRZHASI_FUNCTIONAL_AUDIT.md` — updated (Executive Summary, §5, §14, §18, §22, §23, new "Stage 1 — Admin Authorization Fix" section)
- `STAGE1_ADMIN_AUTHORIZATION_REPORT.md` — this file, new

No business logic, pricing/matching algorithm, deposit logic, contacts-unlock logic, self-match behavior, or unrelated frontend feature was changed.

## Remaining Risks

Scoped strictly to admin authorization (other audit findings are intentionally out of scope for this stage):
- **Production reachability is unverified.** `/internal/*` is still additionally gated by `LocalOnly()`, and the production Caddy config (`Caddyfile.avtobirzhasi`) explicitly 404s `/internal/*` at the public edge. This audit has no access to the live VPS and cannot confirm that block is actually deployed there — if it is, real remote admins likely need VPN/SSH-tunnel access to reach the API's loopback interface at all, admin JWT notwithstanding. This is a pre-existing deployment-topology characteristic, not something this stage was asked to change.
- **No audit trail.** Nothing records which admin approved/rejected a listing or triggered a manual tick. Out of scope for "authorization," but worth a future stage.
- **No admin-management UI.** Promoting/demoting admins is a manual SQL statement (by design — the task explicitly disallowed a public role-changing endpoint). If the number of admins grows, this should eventually get a proper (still admin-only) management endpoint.
- **This was only verified locally.** The migration must be deliberately run against the production database (`goose -dir migrations up` with the production `DATABASE_URL`) before any of this takes effect there; it was not (and should not have been, out of scope) run against production as part of this stage.
- **Every other HIGH/MEDIUM/LOW finding from the original audit (self-match, direct price/offer PATCH bypass, malformed-UUID 500s, description-display bug, homepage search, etc.) is untouched and still open** — see `AVTOBIRZHASI_FUNCTIONAL_AUDIT.md` for the full list; none of it was in scope for Stage 1.
