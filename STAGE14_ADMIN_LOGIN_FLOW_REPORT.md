# Stage 14 — Admin login / role / redirect flow

Focused audit and fix: after logging in, an account shown in the UI as
**"Admin"** landed on `https://avtobirzhasi.kz/dashboard` (the normal user
dashboard) instead of `/admin`.

**Not touched:** FreedomPay, photo upload, matching engine, pricing engine,
Stage 13 `RequireAdmin` (no integration change needed), Caddy, deployment
architecture, unrelated UI.

---

## ROOT CAUSE

`frontend/features/auth/LoginForm.tsx` redirected **unconditionally**:

```js
const { token, user } = await login(values);
setSession(token, user);
router.push("/dashboard");   // <-- same target for every role
```

`user.role` was already in the login response and simply never consulted.
`RegisterForm.tsx` had the same unconditional `push("/dashboard")`.

Secondary gaps found in the same flow:
- `/login` had **no guard** for an already-authenticated visitor — an admin
  (or anyone) revisiting `/login` just saw the form again.
- There was **no visible "Админ-панель" entry** anywhere for an admin —
  the only way to `/admin` was to type the URL.

The backend and Stage 13 `RequireAdmin` were **not** at fault (see below).

---

## Diagnostics

### 1. Production user record — UNVERIFIED (no read path from here)
This environment has no SSH credential for the production VPS and no
password for the production "Admin" account, so `users.role` for that row
could not be read directly. **The displayed name "Admin" proves nothing** —
`name` and `role` are independent columns. See **ADMIN ROLE DATA ISSUE**
below for the exact read-only query to run.

What *is* known: the screenshot shows the account on `/dashboard` with the
normal-user sidebar — but the old code sent **every** role there, so that
is consistent with either `role='admin'` or `role='user'`.

### 2. Role schema — PASS
- `migrations/00009_add_user_role.sql`: `users.role varchar NOT NULL
  DEFAULT 'user' CHECK (role IN ('user','admin'))`.
- `models.User.Role` is scanned from that column; `toUserResponse` copies
  it into the `role` JSON field.
- Verified locally: a `role='admin'` row → `GET /api/auth/me` returns
  `"role":"admin"`; a default row → `"role":"user"`.

### 3. Login flow (frontend) — was FAIL
`LoginForm` / `RegisterForm` → `router.push("/dashboard")`, no role check,
no `callbackUrl`/`returnUrl` handling anywhere. This was the defect.

### 4. Backend login / me response — PASS
- `POST /api/auth/login` → `{ token, user: toUserResponse(user) }`, and
  `toUserResponse` includes `Role` (`backend/internal/handlers/response.go`).
- `POST /api/auth/register` → same shape.
- `GET /api/auth/me` → `toUserResponse`, role read **fresh from the DB**
  every call (`AuthService.GetUser` → `users.FindByID`).
- The JWT carries only `sub`/`iat`/`exp` — **no role claim** — so promoting
  a user takes effect on their next `/me` (i.e. next app load), and can
  never be spoofed via a tampered token.
- `AuthProvider` re-validates the stored token against `/me` on mount, so
  role is never left stale after a refresh.
- Verified locally: login role = `admin` / `user` correctly; `/me` role
  matches.

---

## FIX

| File | Change |
|---|---|
| `frontend/lib/auth/postAuthPath.ts` **(new)** | `postAuthPath(user)` → `user?.role === "admin" ? "/admin" : "/dashboard"`. The single source of truth for "where does a session land". Role is the only input — never name/phone/email. |
| `frontend/features/auth/LoginForm.tsx` | `router.push("/dashboard")` → `router.replace(postAuthPath(user))` (uses the fresh login response; `replace` so Back doesn't return to the form). |
| `frontend/features/auth/RegisterForm.tsx` | same, via the shared helper (new accounts are always `role='user'` → `/dashboard`; kept consistent and future-proof). |
| `frontend/features/auth/RedirectIfAuthenticated.tsx` **(new)** | Rendered on `/login`: once `status === "authenticated"`, `router.replace(postAuthPath(user))`. Waits for `"authenticated"` specifically so a token still validating on mount doesn't bounce prematurely. |
| `frontend/app/login/page.tsx` | mounts `<RedirectIfAuthenticated />`. |
| `frontend/components/layout/AuthStatus.tsx` | profile dropdown: an `"Админ-панель"` → `/admin` link shown **only** when `user.role === "admin"` (above "Личный кабинет"). |
| `frontend/components/layout/MobileMenu.tsx` | same admin link in the mobile auth section. |
| `frontend/lib/i18n/translations.ts` | `header.adminPanel` (ru + kz). |

`RequireAdmin` (Stage 13) is unchanged — it already does guest → `/login`,
non-admin → "Доступ запрещён", admin → children, and the manual-`/admin`
case the spec allows.

---

## Regression tests (new)

- `features/auth/LoginForm.test.tsx` — normal user login → `replace("/dashboard")` (not `/admin`); admin login → `replace("/admin")` (not `/dashboard`), **by role, explicitly not by the name "Admin"**; failed login → no redirect.
- `features/auth/RedirectIfAuthenticated.test.tsx` — loading / guest → no redirect; authed user → `/dashboard`; authed admin → `/admin`.
- `components/layout/AuthStatus.test.tsx` — admin sees `"Админ-панель"` → `/admin`; normal user does **not**, but still sees "Личный кабинет" → `/dashboard`.
- `components/auth/RequireAdmin.test.tsx` (Stage 13, still green) — guest → `/login`, non-admin → "Доступ запрещён", admin → children.

---

## Checks

```
frontend: npm run test      → 18 files / 81 tests passing (+3 files, +9 tests)
          npx tsc --noEmit   → clean
          npm run lint       → 0 errors (1 pre-existing warning, ListingForm.tsx:59)
          npm run build      → Compiled successfully
backend:  not modified — no backend checks run
```

Local end-to-end (running dev servers): `POST /api/auth/login` and
`GET /api/auth/me` return `role: "admin"` for the promoted account and
`role: "user"` for a fresh one; the redirect decision is driven purely by
that `role` (regression tests above).

---

## ADMIN ROLE DATA ISSUE

```
Current display name:   Admin
Actual DB role:         UNKNOWN — could not be read from this environment
```

Before assuming the fix is enough, confirm the production row. **Read-only
first** (on the VPS, in the project dir):

```bash
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d avtobirzhsi_db -c \
  "SELECT id, phone, name, role, created_at FROM users WHERE name = 'Admin' OR role = 'admin';"
```

Then:
- **If that row already has `role = 'admin'`** → nothing to change; deploy
  this fix and the account will land on `/admin` on the next login.
- **If it is `role = 'user'`** and this account is genuinely meant to be an
  administrator → promote **only that exact id**:

  ```bash
  docker compose -f docker-compose.prod.yml exec postgres \
    psql -U postgres -d avtobirzhsi_db -c \
    "UPDATE users SET role = 'admin' WHERE id = '<exact-id-from-SELECT>' RETURNING id, phone, name, role;"
  ```

  No bulk update, no update-by-name, `password_hash` untouched. Then in the
  browser: **logout → login again** (the session's cached `user` object and
  any older token need to be refreshed via `/me`).

---

## Production Verification

_Filled in after this commit is pushed, the GitHub Actions deploy
completes, and the production role is confirmed._

Expected:
```
A. logout
B. login as normal user   -> https://avtobirzhasi.kz/dashboard
C. logout
D. login as admin         -> https://avtobirzhasi.kz/admin
E. admin header dropdown   -> "Админ-панель" link present (→ /admin)
F. normal user             -> no "Админ-панель" link
G. open /admin manually:   normal user -> "Доступ запрещён"
                           admin       -> admin dashboard
```

---

## ADMIN LOGIN FLOW VERIFICATION

```
Production DB admin role:          UNVERIFIED  (needs the read-only SELECT above — no DB path from this environment)
/api/auth/login role:              PASS   (returns user.role; verified locally admin + user)
/api/auth/me role:                 PASS   (fresh from DB every call; verified locally)
Normal user redirect:              PASS   (→ /dashboard — regression test + local API)
Admin redirect:                    PASS   (→ /admin — regression test; by role, not name)
Admin menu link:                   PASS   (AuthStatus + MobileMenu, role-gated; regression test)
Normal user admin link hidden:     PASS   (regression test)
RequireAdmin regression:           PASS   (Stage 13 tests still green)
Production verification:           PENDING deploy + prod role confirmation

ROOT CAUSE:
  LoginForm/RegisterForm did router.push("/dashboard") for every role —
  user.role (already in the login response) was never checked. No
  already-authenticated guard on /login, and no visible admin-panel link.

FIX:
  Shared postAuthPath(user) helper (role-only). LoginForm/RegisterForm
  redirect via it (admin -> /admin, else -> /dashboard). New
  RedirectIfAuthenticated on /login. Role-gated "Админ-панель" link in the
  header dropdown and mobile menu. RequireAdmin untouched.

FILES CHANGED:
  frontend/lib/auth/postAuthPath.ts                      (new)
  frontend/features/auth/RedirectIfAuthenticated.tsx     (new)
  frontend/features/auth/LoginForm.tsx
  frontend/features/auth/RegisterForm.tsx
  frontend/app/login/page.tsx
  frontend/components/layout/AuthStatus.tsx
  frontend/components/layout/MobileMenu.tsx
  frontend/lib/i18n/translations.ts
  frontend/features/auth/LoginForm.test.tsx              (new)
  frontend/features/auth/RedirectIfAuthenticated.test.tsx (new)
  frontend/components/layout/AuthStatus.test.tsx         (new)
  STAGE14_ADMIN_LOGIN_FLOW_REPORT.md                     (new)
```

### Note
The throwaway account `+77000013013` ("S13 Verify") registered on
production during Stage 13 verification is still present (`role='user'`) —
delete it from `/admin/users` once an admin session exists, or with
`DELETE FROM users WHERE phone='+77000013013';` on the prod DB.
