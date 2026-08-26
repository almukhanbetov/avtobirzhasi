# Stage 3 — Listings & Buyer Requests Completion

Date: 2026-08-25
Branch: `main` (uncommitted, on top of Stages 1–2's uncommitted changes)
Scope: close the "edit/delete, validation, description" gaps the completion audit found in Skills B (Car Listings) and C (Buyer Requests) — sellers/buyers had no self-service UI for their own content, buyer requests had no delete/cancel capability at all, malformed IDs 500'd instead of 400ing, and the listing detail page showed fake generated text instead of the real description.

## Problem

From `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md`:
1. `ListingRow.tsx`/`RequestRow.tsx` rendered only "open"/"details" links — no edit, no delete, no cancel action anywhere, even though the listing `PATCH`/`DELETE` API already existed.
2. Buyer requests had **no delete/cancel endpoint at all**, in the API or the UI.
3. Malformed UUID path params (`GET /api/cars/not-a-uuid`) returned 500, not 400.
4. `DescriptionSection.tsx` always rendered `generateDescription()` from a mock module, never the real, stored `car.description`.

## Solution

### Backend

**New: `requireUUIDParam` validation helper** (`backend/internal/handlers/validation.go`) — validates a path param looks like a UUID before it ever reaches a repository/SQL call, and writes `400 VALIDATION_ERROR` itself if not. Applied consistently across every `:id`/`:listingId` handler in the module: `cars.go` (`Get`, `Similar`), `listings.go` (`Update`, `Archive`), `requests.go` (`Update`, `Cancel`), `favorites.go` (`Add`, `Remove`), `matches.go` (`Get`), `deposits.go` (`Pay`), `notifications.go` (`MarkRead`), `sellers.go` (`Get`), `moderation.go` (`Approve`, `Reject`). This was scoped to all handlers rather than just listings/requests since it's the same mechanical, low-risk fix everywhere and leaving some endpoints 500 while others 400 would be a worse, inconsistent outcome.

**New: `DELETE /api/requests/:id` (`Cancel`)** — `backend/internal/handlers/requests.go`, `backend/internal/repository/buyer_requests.go` (`SetStatus`, mirroring `ListingRepository.SetStatus`). Soft-deletes a buyer request (`status → 'archived'`), same pattern as `ListingsHandler.Archive`. Ownership-checked via a new shared `loadOwnedRequest` helper (mirroring `loadOwnedListing`), used by both `Update` and `Cancel` now.

**Field-level validation** added via Gin binding tags:
- `updateListingRequest`: `price` → `omitempty,min=1`; `mileageKm` → `omitempty,min=0`; `region`/`color` → `omitempty,min=1` (reject explicit-but-empty strings).
- `updateRequestRequest`: `region` → `omitempty,min=1`.

No migration, no new table, no change to the money-relevant paths (deposits, matching, price engine) — this stage only touched listings/requests handlers and repositories.

### Frontend

- `types/car.ts` — added the missing `description?: string` field (the backend already sent it; the frontend type just didn't declare it).
- `components/cars/DescriptionSection.tsx` — now renders `car.description?.trim()`, falling back to an honest "seller didn't add a description" message (new i18n key `description.empty`, RU+KZ) instead of fabricated text pretending to be the seller's own words.
- `lib/mock/description.ts` — deleted (confirmed orphaned by grep before removal — its only caller was `DescriptionSection.tsx`).
- `lib/api/listings.ts` — added `updateListing`/`archiveListing`.
- `lib/api/requests.ts` — added `updateRequest`/`cancelRequest`.
- `components/dashboard/ListingRow.tsx` — rewritten as a self-contained client component (same pattern as `FavoriteButton.tsx`'s own-hooks-and-mutation style) with an inline edit form (price — hidden/locked with an explanatory note when `isExchange`, matching the Stage 2 backend block; mileage; region; color; description) and a delete button with a native `confirm()` guard. Edit/delete are disabled once a listing leaves `active`/`moderation` (i.e. once it's `frozen` in a live match, or already `archived`) — the backend doesn't enforce this itself (same as `Archive` never checked status before), so this is a deliberate frontend safety rail to stop a user from mutating a listing mid-deal through the UI, not a claim that the backend now blocks it too.
- `components/dashboard/RequestRow.tsx` — same treatment: inline edit (region only — `currentOffer` is not offered as a field at all, consistent with Stage 2's block) and a cancel button, both disabled unless `status === 'active'`.
- New i18n keys (RU+KZ): `row.edit`, `row.save`, `row.saving`, `row.cancelEdit`, `row.delete`, `row.deleting`, `row.deleteConfirm`, `row.cancelRequest`, `row.cancelingRequest`, `row.cancelRequestConfirm`, `row.exchangePriceLocked`, `description.empty`.

## Verification

**Backend — live, via `curl` against a local instance** (same running dev environment as Stage 2, restarted to pick up the new build; fresh seed data):

| Test | Expected | Actual |
|---|---|---|
| `GET /api/cars/not-a-uuid` | 400 | `400 {"code":"VALIDATION_ERROR","message":"Некорректный идентификатор"}` |
| `GET /api/sellers/not-a-uuid` | 400 | same |
| `GET /api/cars/<valid-but-nonexistent-uuid>` | 404 (unaffected regression check) | 404 |
| Create buyer request, then `PATCH region: ""` | 400 | `400 VALIDATION_ERROR` |
| `DELETE /api/requests/:id` as owner | 204, `status → archived` | 204; DB confirms `archived` |
| `DELETE` the same request again | idempotent (no crash) | 204 again |
| A different user (`Eve3`) tries `DELETE` on someone else's request | 403 | `403 {"code":"FORBIDDEN","message":"Это не ваша заявка"}` |
| `PATCH` a non-exchange listing's `mileageKm: -5` | 400 | `400 VALIDATION_ERROR` |
| `PATCH` the same listing's `mileageKm: 35000` | 200, applied | 200, `mileageKm: 35000` |

**Backend build:**
```
go build ./...   PASS
go vet ./...     PASS
gofmt -l .       1 pre-existing, unrelated finding (models.go)
go test ./...    no test files (Stage 6)
```

**Frontend:**
```
npx tsc --noEmit   PASS (0 errors)
npm run lint       PASS (0 errors, 1 pre-existing unrelated warning — ListingForm.tsx react-hooks/incompatible-library)
npm run build      PASS — all 25 routes generated, Turbopack, TS check clean
```

**Not done this pass**: a real click-through in a browser. This environment has no browser-automation tool available, so the new `ListingRow`/`RequestRow` edit/delete UI was verified by (a) clean TypeScript compilation, (b) clean production build, and (c) confirming the exact request shapes `updateListing`/`archiveListing`/`updateRequest`/`cancelRequest` send match the backend's binding tags and route wiring field-for-field (cross-checked directly against the handler source, and against the same endpoints' curl-verified behavior above) — not by loading the page. This should be spot-checked in a browser before considering Stage 3 fully closed.

## What Changed

Backend: `validation.go` (new), `cars.go`, `listings.go`, `requests.go`, `favorites.go`, `matches.go`, `deposits.go`, `notifications.go`, `sellers.go`, `moderation.go`, `repository/buyer_requests.go`.
Frontend: `types/car.ts`, `components/cars/DescriptionSection.tsx`, `lib/mock/description.ts` (deleted), `lib/api/listings.ts`, `lib/api/requests.ts`, `components/dashboard/ListingRow.tsx`, `components/dashboard/RequestRow.tsx`, `lib/i18n/translations.ts`.

## What Stage 3 Does Not Cover

- The listing/request `Archive`/`Cancel` handlers still don't check status server-side before archiving (same pre-existing gap noted in the original audit) — Stage 3 only added a frontend guard against triggering this through the UI mid-match; a direct API call could still archive a `frozen` listing. Not fixed here since it's a distinct, narrower finding than what Stage 3 was scoped to, and touching match-adjacent state felt like it belonged with Stage 2's business-safety work in spirit but wasn't in the audit's P0/P1 list for this stage.
- No dedicated routed edit *page* was built — edit is inline-in-row, which covers the "can a user self-serve edit/delete" gap without the larger scope of a full `/dashboard/listings/[id]/edit` page. If the product later wants a richer edit experience (e.g. re-uploading photos, changing make/model by delisting-and-relisting flows), that's a bigger, separate feature.
- Image editing (add/remove/reorder photos post-creation) is still not possible — out of scope, not previously flagged by the audit either.
- Real-time push notifications, deposits/payment, admin stubs, tests, and CI/CD are unrelated to this stage — see the completion audit's remaining stages.
