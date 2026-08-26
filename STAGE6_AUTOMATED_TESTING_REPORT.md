# Stage 6 — Automated Testing

Date: 2026-08-26
Branch: `main`
Scope: close the "no test files" gap flagged explicitly in `STAGE2_CORE_BUSINESS_SAFETY_REPORT.md`'s Build Verification section (`go test ./...   no test files (pre-existing gap; Stage 6 of this roadmap)`), and give the frontend a test runner it never had. No production code was changed — this stage is tests and test infrastructure only.

## Problem

Neither the backend nor the frontend had a single test file before this stage. Every business-safety guarantee shipped in Stages 1–5 (self-match prevention, price/offer bypass blocking, deposit double-pay/ownership checks, the exchange engine's math) had been verified exactly once, by hand, with `curl`, against a live dev instance — real verification, but with no way to catch a regression the next time someone touches that code.

## What was built

### Backend (`backend/`)

**Test database.** A dedicated `avtobirzhsi_test` database inside the same local `avtobirzhasi_postgres` container (port 5435) — migrated with the same 10 Goose migrations as dev, never touched by dev data. `internal/testutil/testutil.go` resolves its DSN from `TEST_DATABASE_URL`, falling back to `DATABASE_URL` with the dbname swapped, so a contributor's existing `.env` is enough to run integration tests with zero extra setup. Tests skip (not fail) if the test database is unreachable.

**`internal/testutil`** — shared fixtures used by every integration test: `SetupDB` (connects + truncates all tables), `InsertUser`, `InsertListing`, `InsertBuyerRequest`, `InsertMatch` (creates the match plus its two pending deposits, exactly like `tryCreateMatch` does), and `IssueTestToken` (signs a JWT identical in shape to `AuthService.issueToken`, so handler tests can authenticate without the real register/login flow).

**22 tests across 5 files:**

| File | Covers |
|---|---|
| `service/phone_test.go` | `NormalizeKzPhone` — all 4 accepted input shapes (8-prefix, 7-prefix, bare 10-digit, already-normalized), plus rejection cases. Pure, no DB. |
| `service/deposits_test.go` | `deriveMatchStatus` (pure). Integration: full pay flow to `confirmed` + `contacts_open`/`deposit_received` notification counts, double-pay rejection, wrong-user rejection (and that a rejected Pay leaves the deposit untouched), unknown-deposit rejection, a failing `PaymentProvider` leaving the deposit `pending` (transaction rollback). |
| `service/exchange_test.go` | `formatTenge` (pure). Integration: **self-match is never created even when the price gap is already inside tolerance** (the exact Stage 2 regression), a genuine match between two different users still forms correctly, daily decay/growth math (±1%), overdue-match expiry (reactivates both sides, refunds a paid deposit, notifies both parties), and that running the daily tick twice doesn't double-expire the same match. |
| `handlers/listings_update_test.go` | **`PATCH price` on an `is_exchange` listing → 409 `EXCHANGE_MANAGED_FIELD`, price unchanged** (the other Stage 2 regression), other fields stay editable on the same listing, price stays editable on a non-exchange listing, and PATCHing someone else's listing → 403. Real HTTP requests via `httptest.Server` against the real Gin router + JWT middleware + real DB. |
| `handlers/requests_update_test.go` | `PATCH currentOffer` → 409 unconditionally (buyer requests have no non-exchange variant), `region` stays editable. |

All 22 pass:
```
go test -p 1 ./...
ok  	avtobirzhasi/backend/internal/handlers	0.329s
ok  	avtobirzhasi/backend/internal/service	0.717s
```

**Important operational note for Stage 7 (CI/CD):** tests must run with `go test -p 1 ./...`, not the bare `go test ./...`. Go runs different packages' tests as separate concurrent processes by default; since `handlers` and `service` both integration-test against the *same* shared `avtobirzhsi_test` database, concurrent `TRUNCATE ... CASCADE` calls from two packages at once produced a real Postgres deadlock (`SQLSTATE 40P01`) and, separately, one package's truncate wiping out fixture rows another package's test had just inserted — both observed and fixed by adding `-p 1` during this stage. The CI workflow (`.github/workflows/deploy.yml` today only builds/deploys) will need `-p 1` when a test-gate job is added.

### Frontend (`frontend/`)

Had no test runner, no config, no test script at all. Added:
- **Vitest 4** + `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom` as devDependencies.
- `vitest.config.mts` (jsdom environment, `@/*` alias matching `tsconfig.json`).
- `npm run test` → `vitest run`.

**33 tests across 5 files**, all pure-logic (no components yet — see Not Covered below):

| File | Covers |
|---|---|
| `features/listings/filterCars.test.ts` | `parseCarFilters` defaults, invalid-sort fallback, all 4 sort options, page clamping, numeric range parsing (blank/invalid → null), model trimming, first-value-of-duplicate-param handling; `countActiveFilters`. |
| `lib/format/money.test.ts` | `formatTenge` grouping + zero; `formatMileage` grouping + zero. (Caught a real gotcha worth flagging: `Intl.NumberFormat("ru-RU")`'s group separator is U+00A0 non-breaking space, not a plain space — visually identical, so a naive hand-written expectation string silently fails equality. Tests use the correct character explicitly.) |
| `lib/format/plural.test.ts` | `pluralizeCars` — Kazakh's invariant form, Russian's 1/2-4/5+ agreement, and the 11–14 teens exception. |
| `lib/validation/auth.test.ts` | `loginSchema`/`registerSchema` phone normalization — the same 4 shapes as the backend's `phone_test.go`, verifying both sides agree; password length; password-confirmation mismatch. |
| `lib/url/searchParams.test.ts` | `getParam` (plain/array/missing), `buildHref` (carry-forward + override, delete-on-empty, bare pathname, multi-value array params). |

All pass:
```
npx vitest run
Test Files  5 passed (5)
     Tests  33 passed (33)
```

`npx tsc --noEmit` and `npm run lint` both still pass with no new errors/warnings (the one existing `ListingForm.tsx` React Compiler warning is pre-existing and unrelated).

## What Stage 6 Does Not Cover

- **No frontend component tests.** `@testing-library/react` is installed and configured, but this stage only wrote tests for pure `lib`/`features` logic — no component was rendered. Next.js 16's App Router APIs (`next/navigation`, Server Components) may need specific handling not yet set up; a future pass adding component tests should read `frontend/AGENTS.md`'s warning about this Next.js version's API differences before assuming React Testing Library patterns from training data still apply verbatim.
- **No auth/JWT-issuing service tests** (`AuthService.Register`/`Login`) — these hash passwords with bcrypt, which is deliberately slow; worth a dedicated (possibly parallel-tolerant, since it doesn't touch the shared test DB rows other tests use) test file rather than folding into this stage.
- **No repository-layer unit tests** — the repository methods are exercised indirectly through the handler and service integration tests above, but nothing tests `ListingRepository`/`BuyerRequestRepository`/etc. in isolation.
- **No moderation/admin handler tests, no dashboard aggregation tests, no notification-read tests.**
- **No CI wiring.** Nothing in `.github/workflows/deploy.yml` runs any of these tests yet — that is explicitly Stage 7's scope, noted here only so Stage 7 knows about the `-p 1` requirement and the two DSN env vars (`TEST_DATABASE_URL` for backend, none needed for frontend).
- **No frontend `avtobirzhsi_test`-equivalent** — frontend tests are pure and need no backend at all, so there is no analogous isolation concern there.

## Files Added

- `backend/internal/testutil/testutil.go`
- `backend/internal/service/{phone,deposits,exchange}_test.go`
- `backend/internal/handlers/{listings_update,requests_update}_test.go`
- `frontend/vitest.config.mts`
- `frontend/{features/listings,lib/format,lib/validation,lib/url}/*.test.ts`
- `frontend/package.json` — added `test` script and 5 devDependencies

No migration, no model change, no production handler/service code touched.
