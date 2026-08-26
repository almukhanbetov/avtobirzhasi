# Stage 4 — Search & Frontend Completeness

Date: 2026-08-25
Branch: `main` (uncommitted, on top of Stages 1–3's uncommitted changes)
Scope: close the "real filters, remove mocks" gaps the completion audit found in Skill J (Search & Filters) and the broader frontend mock/orphan findings — the homepage's quick-search control didn't actually search, the homepage's "fresh listings" were 8 hardcoded fake cars, and two dead/misleading mock files still lived in the tree.

## Problem

From `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md`:
1. `QuickSearch.tsx` — the "Найти" button was a static `<Button href="/cars">`, ignoring every selected field; the model dropdown was a hardcoded 3-option list (Camry/Tucson/Rio) unrelated to the selected make.
2. `FreshListings.tsx` — rendered `mockCars.slice(0, 8)`, the same 8 fake cars regardless of what's actually in the database.
3. `lib/mock/dashboard.ts` — confirmed orphaned (no references anywhere).
4. `lib/mock/sellers.ts` — its `mockSellers` fixture array and `getSellerById` were dead code; the file's only real job was supplying the `Seller`/`SellerType` *type* to three other files (`lib/api/sellers.ts`, `SellerCard.tsx`, `VehiclePriceSidebar.tsx`), which is a type-organization problem more than a mock-data problem — but leaving a `Seller` type inside a file called `lib/mock/sellers.ts` next to fake fixture data is exactly the kind of "mock" the stage asked to remove.

## Solution

### QuickSearch — real filters
`components/home/QuickSearch.tsx` is now a controlled form: region/make selects, a free-text model input (matching how the real `/cars` filter sidebar handles model — a free-text `Input`, not a fixed dropdown, per `features/filters/FilterForm.tsx`), a year select, and the existing price-range select, all held in local state. Submitting builds a `URLSearchParams` from whatever was actually selected (omitting empty fields) and navigates to `/cars?...` — the exact same query param names `parseCarFilters` (`features/listings/filterCars.ts`) already reads, so no backend or param-parsing change was needed. The fabricated 3-option model dropdown is gone entirely, replaced by the same free-text pattern the real catalog page already uses.

### FreshListings — real data
`components/home/FreshListings.tsx` no longer imports `mockCars`. It now calls the same `listCars()` (`lib/api/cars.ts`) the `/cars` catalog page uses, with `sort: "newest", page: 1` and every other filter empty — and since the catalog's own page size is 8 (`backend/internal/handlers/cars.go`'s `pageSize = 8`), that single request already returns exactly the freshest 8 active listings with no client-side slicing needed. Wired through `useQuery` (same pattern as `ListingsContent`/`NotificationsContent`), with a proper loading skeleton, an error state, and — since an empty homepage section adds nothing over not showing it — the section renders nothing at all if the catalog is genuinely empty, rather than an empty grid or a confusing zero-state.

### Mock cleanup
- `lib/mock/dashboard.ts` — deleted (confirmed orphaned before deletion, same as Stage 3's `lib/mock/description.ts`).
- `lib/mock/sellers.ts` — deleted. `Seller`/`SellerType` moved to `types/seller.ts` (matching the existing `types/car.ts`/`types/dashboard.ts` convention); the three real call sites now import the type from there. The dead `mockSellers` fixture array and `getSellerById` helper were not carried over — they had zero live callers.
- `lib/mock/cars.ts` was **not** touched: `regions`, `makes`, and `years` are legitimate static reference lists (Kazakhstan regions, common makes, a year range) used to populate real dropdowns across `QuickSearch`, `FilterForm`, `ListingForm`, `RequestForm`, and this stage's own `ListingRow`/`RequestRow` edit forms — they aren't fake listing data. `mockCars` itself is still used in exactly one place: `components/exchange/ExchangeExample.tsx`, part of the `/exchange` marketing/explainer page. The original audit explicitly judged that page as intentionally illustrative (LOW severity, "by design," worth flagging but not a functional gap) — this stage left it alone rather than second-guessing that call; if the product later wants `/exchange`'s example to reflect a real live listing, that's a distinct, separate decision.

## Verification

Ran against the same live local instance (Postgres + Go API on port 8091, migrations 1–9, seed data) plus, new for this stage, an actual running Next.js dev server (port 3002 — 3000/3001 were both occupied by unrelated processes already running on this machine, one root-owned, neither touched) pointed at that backend via `NEXT_PUBLIC_API_URL`. This is the first stage in this series where the frontend was verified as a **live, running app** rather than by static analysis alone.

| Check | Result |
|---|---|
| `GET /` (homepage) | 200, no error boundary |
| `GET /cars` | 200 |
| `GET /cars?make=Toyota` | 200; server-rendered results are Toyota-only (RAV4, Land Cruiser Prado — real seeded models, confirmed via page HTML) |
| `GET /api/cars?model=RAV4` (the exact call the real `/cars` filters make) | Returns only `RAV4` |
| `GET /api/cars?...&sort=newest&page=1` (the exact call `FreshListings` makes) | 200, real seeded listings (Hyundai Solaris, etc.) — not `car-1..car-20` mock ids |
| Homepage's pre-hydration server HTML | Renders the loading skeleton (`animate-pulse` present) for `FreshListings`, not an error and not stale mock cards — correct for a client-fetched component's SSR pass |
| `GET /exchange` | 200 (unaffected by the `types/seller.ts` move or the mock cleanup) |
| `GET /cars/:id` for a real seeded listing | 200; page HTML contains the listing's actual stored description text verbatim ("Пробег 37000 км, коробка передач — автомат…") — re-confirms Stage 3's description fix still holds after this stage's changes |
| Zero `car-1`..`car-20` mock ids anywhere in the homepage's rendered output | Confirmed (`grep -c '"car-[0-9]'` → 0) |

**Not verified this pass**: the actual client-side swap from loading-skeleton to real cards after hydration on the homepage — this environment has no JS-executing browser tool, so that specific transition (which happens entirely in the browser after the page loads) couldn't be observed directly. Everything upstream of it — the exact query, the exact endpoint, the exact response data, and the component logic that renders it — was verified independently and is standard, already-proven-working React Query wiring identical to three other dashboard components in this codebase, so this is a low-risk gap, not an open question about correctness.

**Build:**
```
go build ./...     PASS
go vet ./...       PASS  (backend untouched this stage; re-run for regression only)
npx tsc --noEmit   PASS (0 errors)
npm run lint       PASS (0 errors, 1 pre-existing unrelated warning)
```
(`npm run build` was not re-run this stage since no new route/page was added or removed beyond Stage 3's; `tsc --noEmit` + the live dev server covering every changed file was judged sufficient — full `next build` was already re-verified clean in Stage 3 with a smaller diff and nothing since has changed the page/route structure.)

## What Changed

Frontend only: `components/home/QuickSearch.tsx`, `components/home/FreshListings.tsx`, `types/seller.ts` (new), `lib/mock/sellers.ts` (deleted), `lib/mock/dashboard.ts` (deleted), `lib/api/sellers.ts`, `components/cars/SellerCard.tsx`, `components/cars/VehiclePriceSidebar.tsx` (import path updates only).

## What Stage 4 Does Not Cover

- `/exchange`'s `ExchangeExample.tsx` still uses `mockCars` — deliberately left as-is (see above).
- No backend/API change this stage — `GET /api/cars` already supported everything both fixed components needed.
- Deposits/payment, admin stubs, automated tests, and CI/CD are unrelated to this stage — see the completion audit's remaining stages.
