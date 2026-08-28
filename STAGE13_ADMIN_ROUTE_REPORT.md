# Stage 13 — Production `/admin` route

Focused audit and fix: opening `https://avtobirzhasi.kz/admin` showed the
public marketing homepage instead of the admin panel.

**Not touched:** FreedomPay, photo upload, matching engine, price engine.
No unrelated refactoring.

---

## ROOT CAUSE

`frontend/components/auth/RequireAdmin.tsx` — a signed-in **non-admin**
user hitting `/admin` was sent to the homepage:

```js
if (status === "authenticated" && user && user.role !== "admin") {
  router.replace("/");   // <-- lands on the marketing homepage
}
```

`/admin` and every child route exist, are built, are deployed, and their
server response is correct (a prerendered admin shell showing a loading
spinner — `<title>Dashboard — Админка</title>`, `x-nextjs-prerender: 1`,
**no** homepage markup). The homepage only ever appeared **client-side**,
after hydration, via that `router.replace("/")`. To a user this is
indistinguishable from "`/admin` doesn't exist".

Scenario matrix (before the fix):

| Who | What happened | Correct? |
|---|---|---|
| Guest | `router.replace("/login")` → login page | acceptable |
| Signed-in non-admin | `router.replace("/")` → **homepage** | ✗ **the bug** |
| Admin | admin dashboard renders | ✓ |

Not a routing / middleware / Caddy / i18n / stale-image problem — all of
those were checked and ruled out (see Diagnostics below).

---

## FIX

`RequireAdmin` no longer redirects anyone to `/`. A signed-in non-admin
now gets an explicit in-place **"Доступ запрещён"** panel (403-style) with
a link home. Guests are still redirected to `/login` (unchanged, and
allowed by the spec). Admins are unchanged.

```
loading                    -> spinner
unauthenticated            -> redirect to /login
authenticated, role!=admin -> "Доступ запрещён" panel   (was: redirect to /)
authenticated, role=admin  -> admin panel
```

Two `admin.denied.*` translation keys added (ru + kz).

The real security boundary is unchanged — every admin API call still
re-checks `users.role='admin'` server-side (`middleware.AdminOnly`).

---

## Diagnostics

### 1. Frontend routing — PASS
- `app/admin/page.tsx` ✔, `app/admin/layout.tsx` ✔, and
  `moderation/ listings/ users/ requests/ matches/ deposits/` all have a
  `page.tsx` ✔.
- No `middleware.ts` anywhere. `next.config.ts` has no `redirects`,
  `rewrites`, or route manipulation (only `images` + `output: standalone`).
- No catch-all / `not-found.tsx` at the app root — nothing can swallow
  `/admin`.
- The only `router.replace` / `redirect` in the admin path is in
  `RequireAdmin` (the bug).

### 2. Auth guard — was FAIL, now PASS
- `AuthProvider`: JWT in `localStorage` (`avtobirzhasi_token`), re-validated
  on mount via `GET /api/auth/me`; `getStoredToken()` is SSR-safe (returns
  `null` when `window` is undefined).
- `RequireAdmin` was the defect (see Root Cause).

### 3. Production build — PASS
`npm run build` output contains all seven admin routes:
```
○ /admin
○ /admin/deposits
○ /admin/listings
○ /admin/matches
○ /admin/moderation
○ /admin/requests
○ /admin/users
```

### 4. Admin navigation — PASS
`AdminSidebar` links → `/admin`, `/admin/moderation`, `/admin/listings`,
`/admin/users`, `/admin/requests`, `/admin/matches`, `/admin/deposits`.
Every target has a real `page.tsx`. No links to removed/stub pages.

### 5. Middleware — PASS (N/A)
No `middleware.ts` in the project. Nothing rewrites `/admin`.

### 6. i18n / locale routing — PASS
No locale in the URL. `<html lang="ru">` is hardcoded; `LanguageProvider`
is a pure client-side ru/kz toggle with no `/ru/*` or `/kz/*` path
segments. `/admin` is the correct and only path.

### 7. Production `curl` — route is fine, redirect was client-side
```
curl -I  https://avtobirzhasi.kz/admin   -> HTTP/2 200, content-type text/html,
                                            x-nextjs-prerender: 1, server: Caddy
curl -IL https://avtobirzhasi.kz/admin   -> HTTP/2 200 (no Location, no redirect hop)
```
No `/admin → /` or `/admin → /login` at the HTTP layer. The bounce to `/`
happened only in the browser after JS ran.

### 8. Production HTML response — PASS
`curl -s https://avtobirzhasi.kz/admin` returned:
- `<title>Dashboard — Админка</title>`
- markup for `AdminSidebar`, `RequireAdmin`, `Загрузка…`, a `/login` reference
- **no** `"Найдите автомобиль по вашей цене"` / `Hero` / `QuickSearch`
So the homepage was never in the server response — it was the
`router.replace("/")` after hydration.

### 9. Caddy — PASS
`Caddyfile.avtobirzhasi`: `api.avtobirzhasi.kz` reverse-proxies to `:8080`;
`avtobirzhasi.kz` reverse-proxies to `:3000`. No `handle /admin*`, no
`rewrite`, no `try_files`, no fallback. `/admin` reaches the Next.js
frontend untouched.

### 10. Production image currency — PASS
- `origin/main` = `c16639a` (Stage 12); `POST /api/uploads/images` on prod
  returns `401` → the current image is deployed.
- Stage 10 admin code (`AdminSidebar`, `RequireAdmin`, all admin pages) is
  present in the deployed frontend HTML.
- Not a stale-deploy problem.

### 11. Role model — PASS
`migrations/00009_add_user_role.sql` (`users.role`, `CHECK IN
('user','admin')`, default `'user'`) is in `origin/main` history and the
backend enforces it. Even with no admin row, `/admin` must not show the
homepage — which is exactly what this fix guarantees.

### 12. Admin API — PASS
`middleware.AdminOnly` (verified locally this stage):
- guest → `401`
- `role='user'` → `403 {"code":"FORBIDDEN"}`
- `role='admin'` → `200` (`GET /api/admin/stats`)
`/internal/*` not used from the browser (Caddy `handle /internal/* { respond 404 }`).

### 13. Local reproduction — PASS
`RequireAdmin` unit-tested for all three sessions (see below). Local dev
`/admin` SSR body = admin shell + `Загрузка…`, never homepage.

---

## Regression tests

`frontend/components/auth/RequireAdmin.test.tsx` (new, 4 cases):
- loading → spinner, no redirect
- guest → `router.replace("/login")`, **never** `replace("/")`, no admin content
- signed-in non-admin → "Доступ запрещён" panel, **`router.replace` never called**, no admin content
- admin → children render

(The non-admin case is the direct regression guard — it fails against the
old `router.replace("/")` code.)

---

## Checks

```
frontend: npm run test      → 15 files / 72 tests passing (+1 file, +4 tests)
          npx tsc --noEmit   → clean
          npm run lint       → 0 errors (1 pre-existing warning, ListingForm.tsx:59)
          npm run build      → Compiled successfully; all 7 /admin routes present
backend:  not modified — no backend checks needed
```

---

## ADMIN ROUTE AUDIT

```
Production /admin:                 FAIL before  →  fixed (pending deploy of this commit)
Route exists:                      PASS   (page.tsx + layout.tsx + 6 child page.tsx, in build output, on prod)
Admin page exists:                 PASS   (app/admin/page.tsx → AdminDashboardContent)
Admin layout:                      PASS   (app/admin/layout.tsx → RequireAdmin > AdminSidebar + children)
Auth guard:                        PASS   (after fix — explicit states, never redirects to "/")
Guest behavior:                    PASS   (redirect to /login)
User behavior:                     PASS after fix   (403 "Доступ запрещён" panel; was: homepage)
Admin behavior:                    PASS   (admin dashboard renders)
Middleware:                        PASS   (none exists; nothing rewrites /admin)
Caddy:                             PASS   (plain reverse_proxy to :3000, no /admin rule)
Production frontend image current: PASS   (origin/main c16639a deployed; Stage 10 admin code live)
Admin API:                         PASS   (401 / 403 / 200 by role)

ROOT CAUSE:
  RequireAdmin did `router.replace("/")` for an authenticated non-admin,
  dropping them on the marketing homepage — client-side, after hydration.
  The /admin route, build, deploy, Caddy config and server response were
  all correct.

FIX:
  RequireAdmin renders an explicit "Доступ запрещён" (403) panel for a
  signed-in non-admin instead of redirecting to "/". Guests still go to
  /login; admins unchanged. Added admin.denied.{title,body,home} (ru+kz)
  and a 4-case regression test.

FILES CHANGED:
  frontend/components/auth/RequireAdmin.tsx
  frontend/components/auth/RequireAdmin.test.tsx   (new)
  frontend/lib/i18n/translations.ts
  STAGE13_ADMIN_ROUTE_REPORT.md                    (new)
```

---

## Production Verification

_Filled in after this commit is pushed and the GitHub Actions deploy
completes._

Expected on `https://avtobirzhasi.kz/admin` after deploy:
- guest → `/login`
- signed-in non-admin → "Доступ запрещён" panel (no homepage)
- admin → admin dashboard

> Note: for an admin login to actually succeed on production, the account
> must have `users.role='admin'` set in the production database
> (`docker compose -f docker-compose.prod.yml exec postgres psql -U postgres
> -d avtobirzhsi_db -c "UPDATE users SET role='admin' WHERE phone='+7…';"`).
> That is orthogonal to this fix — an unpromoted account now sees the
> access-denied panel instead of the homepage.
