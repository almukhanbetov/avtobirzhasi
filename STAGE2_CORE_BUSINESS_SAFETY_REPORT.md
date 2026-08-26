# Stage 2 — Core Business Safety

Date: 2026-08-25
Branch: `main` (uncommitted, on top of Stage 1's uncommitted changes)
Scope: fix the two P0/P1 blockers from `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md` — no self-match guard in the matching engine, and no protection against manually bypassing the daily ±1% price/offer mechanic. No other findings touched.

## Problem

The completion audit found two gaps in the Auto Exchange engine's fairness guarantees:

1. **Self-match**: `createMatches`'s SQL join and `tryCreateMatch` never compared `listing.user_id` to `buyer_request.user_id`. A user with both a matching listing and a matching buyer request of their own would trade with themselves.
2. **Price bypass**: `PATCH /api/listings/:id` and `PATCH /api/requests/:id` let the owner set `price`/`currentOffer` directly, with no check tied to `is_exchange` or status — defeating the entire premise of a fair, time-based convergence mechanic.

## Solution

### Self-match guard (defense in depth, two layers)
- `backend/internal/service/exchange.go`, `createMatches`: added `l.user_id <> br.user_id` to the candidate-pair SQL join, so a self-owned pair is never even selected as a candidate.
- `tryCreateMatch`: added an explicit `listingUserID == requestUserID` check under the same row-locked transaction that already re-checks status, right before a Match would be created — belt-and-suspenders in case a future caller ever produces candidate pairs by another path.

### Price/offer bypass block
- `backend/internal/handlers/listings.go`, `Update`: if the request includes `price` **and** the listing's `is_exchange` flag is true, the whole PATCH is rejected with `409 EXCHANGE_MANAGED_FIELD` before any field is applied. Non-exchange listings (`is_exchange=false`, i.e. regular classifieds) are unaffected — their price remains freely editable, since nothing manages it automatically. Other fields (`description`, `mileageKm`, `region`, `color`) are unaffected on exchange listings too — only `price` is blocked.
- `backend/internal/handlers/requests.go`, `Update`: every buyer request is inherently an Auto Exchange participant (there is no `is_exchange` flag on that table, confirmed in the schema and the `BuyerRequest` model). So `currentOffer` is now rejected unconditionally with the same `409 EXCHANGE_MANAGED_FIELD` error whenever present in the request body; `region` remains editable. The now-dead “apply `currentOffer` to the update map” branch was removed rather than left unreachable.

Both blocks fire on the field being *present in the request body*, not on its value — so `{"price": 5000000}` on an exchange listing is rejected the same as `{"price": 1}`; there's no way to "sneak" a value under a status window, since the check doesn't depend on the listing's current status at all, only on `is_exchange`.

## Code Changed

- `backend/internal/service/exchange.go` — `createMatches` query, `tryCreateMatch`
- `backend/internal/handlers/listings.go` — `Update`
- `backend/internal/handlers/requests.go` — `Update`

No migration, no model change, no other handler touched.

## Live Verification

Run against the existing local dev environment (`avtobirzhasi_postgres` container, migrations 1–9 already applied, API run via `go run ./cmd/api` on port 8091 to avoid a conflict with an unrelated process already bound to 8080), fresh seed data (`go run ./cmd/seed`) plus purpose-built test fixtures created via real HTTP requests.

**Self-match:**

| Step | Result |
|---|---|
| Seller "SelfMatch Tester" creates an Auto Exchange listing (Toyota SelfMatchCar, 10,000,000 ₸) | 201, approved via moderation → `active` |
| Same user creates a buyer request for the same make/model/region/year, offer 9,950,000 (0.5% gap — well within the 2% tolerance) | 201, `active` |
| `run-daily-tick` | `matchesCreated: 0` — listing stayed `active` (not frozen), zero rows in `matches` for this listing. Self-match correctly suppressed even though the price gap was already inside tolerance. |
| A second, unrelated user ("Real Buyer") creates a genuinely matching buyer request against the same listing | 201 |
| `run-daily-tick` again | `matchesCreated: 1` — the match formed **only** between the listing and the unrelated buyer's request; the seller's own request never matched at any point (confirmed by DB query joining `matches`→`listings`→`buyer_requests`, showing `buyer_user ≠ seller_user`) |

This confirms both that self-matching is blocked and that ordinary (non-self) matching is unaffected — a direct regression check on the exact mechanic Stage 2 touched.

**Price/offer bypass:**

| Test | Expected | Actual |
|---|---|---|
| `PATCH` `price` on an `is_exchange=true` listing | 409 | `409 {"error":{"code":"EXCHANGE_MANAGED_FIELD","message":"Цена управляется автообменом и не может быть изменена вручную"}}` |
| `PATCH` `description` on the same exchange listing | 200, applied | 200, description updated, price untouched |
| `PATCH` `price` on a freshly created `is_exchange=false` listing | 200, applied (regression check — non-exchange listings must remain editable) | 200, price changed 5,000,000 → 4,500,000 |
| `PATCH` `currentOffer` on a buyer request | 409 | `409 {"error":{"code":"EXCHANGE_MANAGED_FIELD","message":"Предложение управляется автообменом и не может быть изменено вручную"}}` |
| `PATCH` `region` on the same buyer request | 200, applied (regression check — other fields still editable) | 200, region changed |

## Build Verification

```
go build ./...   PASS
go vet ./...     PASS
gofmt -l .       1 pre-existing, unrelated finding (internal/models/models.go — not touched, not introduced by this stage)
go test ./...    no test files (pre-existing gap; Stage 6 of this roadmap)
```

## Regression Check

The genuine (non-self) match created during self-match testing progressed to `awaiting_deposit` exactly as before (`matches.status`), confirming the deposit/contact-unlock path downstream of matching was not affected by either change.

## What Stage 2 Does Not Cover

- No frontend change was needed — neither `ListingRow.tsx`/`RequestRow.tsx` nor any other component currently exposes a price/offer edit control, so there was no UI surface presenting this bypass to a real user in the first place; the risk was API-only. Stage 3 adds real edit UI, which will need to respect this same `EXCHANGE_MANAGED_FIELD` response (e.g. don't render a price field at all for exchange listings) — noted for that stage.
- Malformed-UUID 500s, the mock deposit/payment gap, the stub admin sections, automated tests, and CI/CD gates are unrelated to this stage's scope and remain open — see the completion audit's Remaining Work section.

## Remaining Risks

- These fixes exist only in the uncommitted local working tree, same as Stage 1's — nothing has been committed or deployed.
- The `EXCHANGE_MANAGED_FIELD` error code is new API surface; any future frontend edit form (Stage 3) must handle it explicitly rather than showing a generic error.
