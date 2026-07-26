# Skill: Backend — avtobirzhasi.kz (Go + Gin + PostgreSQL 17 + Goose)

## Goal

Build the backend so it matches the frontend's existing data contract
exactly. The frontend (`frontend/`) was built first, against mock data, and
already fixes the shape of every entity, every enum value, every filter
param, and the exact math of the Auto Exchange mechanism. Nothing here is
speculative — it is extracted from:

- `frontend/types/car.ts`, `frontend/types/dashboard.ts`
- `frontend/lib/mock/cars.ts`, `sellers.ts`, `dashboard.ts`
- `frontend/lib/validation/auth.ts`
- `frontend/features/listings/filterCars.ts`
- `frontend/components/exchange/ExchangeSimulator.tsx`

When the backend is done, swapping frontend mock imports for real `fetch`
calls in `lib/api/*` should require no changes to component code — only the
data source changes.

## Stack

- Go 1.25 (already installed)
- Gin (HTTP router/middleware)
- PostgreSQL 17 (already running locally, port 5432)
- Goose for migrations (already installed, `goose -version` → v3.27.1)
- `golang-jwt/jwt` for auth tokens
- `golang.org/x/crypto/bcrypt` for password hashing
- No ORM required — plain `database/sql` + `pgx` driver, or `sqlx` if it
  reduces boilerplate. Do not introduce a heavy ORM (GORM etc.) unless asked.

## Project layout

```
backend/
  cmd/
    api/
      main.go
  internal/
    config/           # env loading
    db/               # pgx pool setup
    middleware/        # auth (JWT), CORS, request logging
    models/            # Go structs mirroring the tables below
    repository/         # SQL queries, one file per table
    handlers/           # Gin handlers, one file per resource
    service/           # business logic (exchange engine, deposit flow)
  migrations/          # goose .sql files
  go.mod
  go.sum
  docker-compose.yml   # local Postgres 17 — see Environment section
  .env.example
```

## Environment

PostgreSQL runs in Docker via `backend/docker-compose.yml`, **not** the
machine's system Postgres service. Start it with:
```
cd backend && docker compose up -d
```

`.env` (never commit real secrets, only `.env.example`):
```
POSTGRES_DB=avtobirzhsi_db
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<password>
POSTGRES_PORT=5435

DATABASE_URL=postgres://postgres:<password>@localhost:5435/avtobirzhsi_db?sslmode=disable
JWT_SECRET=<random>
PORT=8080
```

Port **5435**, not 5432 — this machine runs several unrelated Postgres
instances (a system-wide service on 5432, and other projects' Docker
containers on 5433/5434), so this project claims its own port.

**`docker-compose.yml` must keep its top-level `name: avtobirzhasi` key.**
Docker Compose defaults to the parent directory's basename as the project
name, and at least one *other*, unrelated project on this machine also
uses a folder literally named `backend/`. Without an explicit `name:`,
`docker compose up` here can collide with and recreate/destroy that other
project's container (this happened once — the other project's container
was destroyed, though its data survived only because it happened to live
in a separately-named volume). Never remove that key, and never assume a
bare directory name is a safe Compose project name on this machine.

Do not assume sudo/interactive Postgres admin access to the *system*
Postgres service is available from the agent's shell — this project no
longer depends on that service at all now that it has its own container.

## Domain model → tables

Every enum below is a closed set taken verbatim from the frontend types.
Use `varchar` + `CHECK (col IN (...))` for these, not native Postgres
`ENUM` types — check constraints are trivial to extend later with a plain
`ALTER TABLE`, whereas `ALTER TYPE ... ADD VALUE` has transaction
restrictions that complicate Goose migrations.

### `users`
Backs both the login/register flow (`lib/validation/auth.ts`) and the
`Seller` shape (`lib/mock/sellers.ts`) — a user acting as a seller *is* a
`Seller`.

| column | type | notes |
|---|---|---|
| id | uuid pk | `gen_random_uuid()` |
| name | text not null | |
| phone | text not null unique | **always stored normalized** as `+7XXXXXXXXXX` — see Auth section |
| password_hash | text not null | bcrypt |
| email | text | nullable, not in mock data flow yet but Profile page shows one |
| region | text | nullable |
| account_type | varchar not null default 'private' | `CHECK IN ('private','dealer')` — maps to frontend `SellerType` |
| rating | numeric(2,1) not null default 5.0 | |
| reviews_count | int not null default 0 | |
| created_at | timestamptz not null default now() | this is the source of `Seller.since` (frontend renders `"с {year} года"` — format at the API layer, don't store the string) |
| updated_at | timestamptz not null default now() | |

`Seller.activeListings` is **not** a column — compute it as
`count(*) from listings where user_id = $1 and status in ('active','frozen')`.

### `listings`
Backs `Car` + `SellerListing`.

| column | type | notes |
|---|---|---|
| id | uuid pk | this is the `car-N` id the frontend routes to at `/cars/:id` |
| user_id | uuid fk users | the seller |
| make | text not null | |
| model | text not null | |
| year | int not null | |
| price | bigint not null | tenge, integer (no decimals — see `formatTenge`) |
| mileage_km | int not null | |
| region | text not null | one of the fixed region list, see Reference data below |
| transmission | varchar not null | `CHECK IN ('automatic','manual')` |
| fuel_type | varchar not null | `CHECK IN ('petrol','diesel','hybrid','electric','gas')` |
| body_type | varchar not null | `CHECK IN ('sedan','suv','crossover','hatchback','coupe','universal')` |
| drivetrain | varchar not null | `CHECK IN ('fwd','rwd','awd')` |
| engine_volume | numeric(3,1) not null | e.g. `2.5` |
| engine_power | int not null | horsepower |
| color | text not null | |
| steering_wheel | varchar not null default 'left' | `CHECK IN ('left','right')` |
| description | text | freeform, shown on `/cars/:id` |
| status | varchar not null default 'moderation' | `CHECK IN ('active','frozen','moderation','archived')` — new listings start `moderation` |
| is_exchange | boolean not null default false | true if this listing participates in Auto Exchange |
| initial_price | bigint | only set when `is_exchange`; `price` decays from this, see Exchange engine |
| exchange_started_at | timestamptz | only set when `is_exchange` |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |

`dailyChangePercent` and `PriceMovement` on the frontend are always ±1 by
convention (seller = −1, buyer = +1) — do not add a column for this, derive
it from `is_exchange` + role in the API response.

**Resolved deviation from the mock fixtures (Stage 3):** three of the
frontend's 20 mock `Car` fixtures (Kia Rio, Toyota RAV4, Kia K5) set
`exchangeRole: "buyer"` directly on a car — a mock-only simplification the
frontend used to preview a "buyer's target car" next to a seller listing
(see `components/exchange/ExchangeExample.tsx`). A `listings` row can only
be the seller side under this schema (a buyer's rising offer belongs to
`buyer_requests`, which has no photographed car — see Stage 4). The seed
data and `toCarResponse` therefore always report `exchangeRole: "seller"`
and `dailyChangePercent: -1` for any `is_exchange` listing, regardless of
what those three mock fixtures said. If a "buyer wants this exact car"
preview is still wanted once Stage 4 exists, model it as a nullable
`reference_listing_id` on `buyer_requests`, not a buyer role on `listings`.

### `listing_images`
Backs `Car.images` (the gallery — frontend always expects at least one).

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| listing_id | uuid fk listings on delete cascade | |
| url | text not null | |
| position | int not null default 0 | gallery order; position 0 is also `Car.imageUrl` |

### `buyer_requests`
Backs `BuyerRequest`.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users | the buyer |
| make | text not null | |
| model | text not null | |
| year_from | int not null | |
| year_to | int not null | |
| region | text not null | |
| initial_offer | bigint not null | |
| current_offer | bigint not null | decays upward daily, see Exchange engine |
| status | varchar not null default 'active' | `CHECK IN ('active','frozen','moderation','archived')` |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |

### `matches`
Backs `MatchDeal`. One match ties exactly one listing to one buyer_request.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| listing_id | uuid fk listings not null | |
| buyer_request_id | uuid fk buyer_requests not null | |
| final_price | bigint not null | the listing's `price` at the moment gap ≤ tolerance |
| deposit_amount | bigint not null | `round(final_price * 0.01)` |
| seller_deposit_paid | boolean not null default false | |
| buyer_deposit_paid | boolean not null default false | |
| status | varchar not null default 'awaiting_deposit' | see state machine below |
| deadline | timestamptz not null | `created_at + interval '48 hours'` (confirm exact window with product; frontend just shows whatever deadline the API returns) |
| created_at | timestamptz not null default now() | |
| updated_at | timestamptz not null default now() | |

**Status is a derived state machine**, keep it in sync on every write to the
two `*_deposit_paid` booleans (in the same transaction/query, e.g. via a
`CASE` in the `UPDATE`, or recompute in the service layer before saving):

```
expired / cancelled   -> terminal, set explicitly (never derived)
seller=false buyer=false -> awaiting_deposit
seller=true  buyer=false -> seller_deposit_paid
seller=false buyer=true  -> buyer_deposit_paid
seller=true  buyer=true  -> confirmed
```

This exactly matches `lib/labels/dashboard.ts` → `matchStatusLabels` and the
mock fixtures in `lib/mock/dashboard.ts` (match-1: buyer paid only → status
`buyer_deposit_paid`; match-2: both paid → `confirmed`).

### `deposits`
Backs `Deposit`. Each match gets exactly two rows, created at match time.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| match_id | uuid fk matches not null | |
| user_id | uuid fk users not null | |
| role | varchar not null | `CHECK IN ('seller','buyer')` |
| amount | bigint not null | copy of `matches.deposit_amount` |
| status | varchar not null default 'pending' | `CHECK IN ('pending','paid','refunded')` |
| created_at | timestamptz not null default now() | |
| paid_at | timestamptz | |
| refunded_at | timestamptz | |

### `notifications`
Backs `Notification`.

| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users not null | |
| type | varchar not null | `CHECK IN ('match_found','deposit_required','deposit_received','contacts_open','match_expired')` |
| message | text not null | pre-rendered Russian text, same as `lib/mock/dashboard.ts` examples — build the message string server-side, frontend just displays it |
| read | boolean not null default false | |
| related_match_id | uuid fk matches | nullable |
| related_listing_id | uuid fk listings | nullable |
| created_at | timestamptz not null default now() | |

### `favorites`
| column | type | notes |
|---|---|---|
| id | uuid pk | |
| user_id | uuid fk users not null | |
| listing_id | uuid fk listings not null | |
| created_at | timestamptz not null default now() | |
| | | `UNIQUE (user_id, listing_id)` |

## Reference data (seed, not enforced by FK)

These lists are hardcoded in the frontend (`lib/mock/cars.ts`) — keep the
same values as the initial valid set so filter dropdowns keep working, but
do **not** hard-constrain `listings.region` / `.make` with a DB-level FK to
a lookup table unless the product later needs it; a plain text column is
enough for MVP.

Regions: Алматы, Астана, Шымкент, Караганда, Актобе, Павлодар, Атырау,
Усть-Каменогорск.

Makes (seed set, not exhaustive): Toyota, Hyundai, Kia, BMW, Volkswagen,
Mercedes-Benz, Chevrolet, Lada, Lexus, Skoda.

## Goose migrations — order

One migration per table, in FK dependency order. Suggested filenames
(goose sequential numbering):

```
migrations/
  00001_create_users.sql
  00002_create_listings.sql
  00003_create_listing_images.sql
  00004_create_buyer_requests.sql
  00005_create_matches.sql
  00006_create_deposits.sql
  00007_create_notifications.sql
  00008_create_favorites.sql
```

Every migration must have both `-- +goose Up` and `-- +goose Down` and must
be reversible. Add indexes in the same migration as the table:

- `listings`: index on `(status)`, `(is_exchange)`, `(user_id)`, and a
  composite `(make, model, region)` for catalog filtering.
- `buyer_requests`: index on `(status)`, `(is_exchange... )` n/a — status +
  `(user_id)`.
- `matches`: index on `(status)`, `(listing_id)`, `(buyer_request_id)`.
- `notifications`: index on `(user_id, read)`.
- `favorites`: the unique constraint already covers lookups.

## Auth

Must accept exactly what `lib/validation/auth.ts` produces and validates —
the frontend already normalizes phone numbers before it would ever hit the
API in a real integration, but the backend must not assume that and should
re-validate/normalize defensively with the same rule:

```
input "8XXXXXXXXXX" | "7XXXXXXXXXX" | "XXXXXXXXXX" (bare 10 digits)
  -> normalize to "+7XXXXXXXXXX"
reject anything else with 400
```

Endpoints:
- `POST /api/auth/register` — body `{name, phone, password}` → creates
  user with `account_type='private'`, returns `{token, user}`.
- `POST /api/auth/login` — body `{phone, password}` → `{token, user}`.
- `GET /api/auth/me` — JWT-protected, returns the current user shaped like
  the frontend `Seller` type plus `email`/`region`.

JWT in `Authorization: Bearer <token>` header. Store the secret in env, not
in code. Never log passwords or tokens.

## API endpoints — grouped by frontend page

Response envelopes should mirror the frontend types field-for-field
(camelCase JSON, not snake_case — translate at the handler layer) so
`lib/api/*` clients can be thin passthroughs.

### `/cars` (catalog) → `features/listings/filterCars.ts`
`GET /api/cars` — query params, all optional, exact names:
`region, make, model, yearFrom, yearTo, priceFrom, priceTo, bodyType,
transmission, drivetrain, fuelType, sort, page`

`sort` ∈ `newest | price-asc | price-desc | year-desc` (default `newest`).
Page size: 8 (`CATALOG_PAGE_SIZE`). Only return `status='active'` listings
(public catalog never shows `moderation`/`frozen`/`archived`).

Response:
```json
{
  "items": [ /* Car[] shaped exactly like frontend/types/car.ts */ ],
  "total": 0,
  "totalPages": 0,
  "page": 1
}
```

### `/cars/:id` (detail) → `app/cars/[id]/page.tsx`
`GET /api/cars/:id` → full `Car` (all images, seller summary embedded or a
separate `GET /api/sellers/:id`), plus `description`.
`GET /api/cars/:id/similar` → `Car[]`, same-`bodyType` or same-`make`,
excluding self, limit 4 (mirrors `components/cars/SimilarCars.tsx`).

### Listings management (seller) → `/sell/new`, dashboard "Мои объявления"
- `POST /api/listings` (auth) — create, status starts `moderation`.
- `PATCH /api/listings/:id` (auth, owner only)
- `DELETE /api/listings/:id` (auth, owner only) — soft delete → `archived`.
- `GET /api/dashboard/listings` (auth) → this user's listings, any status.

### Buyer requests → `/exchange/new`, dashboard "Заявки на покупку"
- `POST /api/requests` (auth)
- `PATCH /api/requests/:id` (auth, owner only)
- `GET /api/dashboard/requests` (auth)

### Favorites → `/dashboard/favorites`
- `GET /api/favorites` (auth) → `Car[]`
- `POST /api/favorites/:listingId` (auth)
- `DELETE /api/favorites/:listingId` (auth)

### Matches & deposits → `/dashboard/matches`, `/dashboard/deposits`
- `GET /api/dashboard/matches` (auth) → `MatchDeal[]` for the current user
  (either as seller or buyer side), including `role`.
- `GET /api/matches/:id` (auth, party to the match only) → full detail;
  **only include the counterpart's phone number if `status='confirmed'`**
  — see Contact unlock rule below. This is the one place the backend must
  never trust the frontend: always re-check `status` server-side before
  returning a phone number, per `nextjs-frontend-architecture` skill's
  "Never expose private phone numbers until backend explicitly returns
  them for an authorized confirmed Match."
- `GET /api/dashboard/deposits` (auth) → `Deposit[]`
- `POST /api/deposits/:id/pay` (auth, owner of that deposit only) — mock
  payment (no real payment gateway): sets `status='paid'`, `paid_at=now()`,
  recomputes the parent match's derived status, and if this was the second
  deposit, triggers the contact-unlock notifications (see below).

### Dashboard overview → `/dashboard`
`GET /api/dashboard/overview` (auth):
```json
{
  "activeListings": 0,
  "buyerRequests": 0,
  "activeMatches": 0,
  "favorites": 0,
  "tasks": [
    {"type": "deposit_required", "matchId": "...", "message": "...", "deadline": "..."},
    {"type": "moderation", "listingId": "...", "message": "..."},
    {"type": "notification", "notificationId": "...", "message": "..."}
  ]
}
```
`tasks` mirrors what `app/dashboard/page.tsx` currently computes client-side
from mock arrays — move that derivation server-side so the frontend just
renders what it's given.

### Notifications → `/dashboard/notifications`
- `GET /api/notifications` (auth)
- `PATCH /api/notifications/:id/read` (auth, owner only)

## The Auto Exchange engine (the core business logic)

This is the signature feature — get the numbers exactly right, they are
already fixed by `components/exchange/ExchangeSimulator.tsx`:

- Daily rate: **1%** (`0.01`), same for both sides.
- Seller price: `price *= (1 - 0.01)` once per day, only while
  `is_exchange = true` and `status = 'active'`.
- Buyer offer: `current_offer *= (1 + 0.01)` once per day, only while the
  request is `is_exchange`-equivalent (buyer requests are inherently
  Auto Exchange participants — there's no "buy now" buyer request) and
  `status = 'active'`.
- Match tolerance: gap ≤ **2%**, computed as
  `abs(listing.price - request.current_offer) / listing.price * 100 <= 2`.
- **On Match**: freeze both rows (`status = 'frozen'`) so the daily job
  skips them going forward, create the `matches` row with
  `final_price = listing.price` (the listing's price at the moment of
  match — not an average), create two `deposits` rows
  (`amount = round(final_price * 0.01)`, `status='pending'`), create a
  `match_found` notification for both the seller and the buyer, deadline
  = `now() + 48h` (confirm with product before shipping; not fixed by the
  frontend beyond "a deadline exists").
- **On expiry** (deadline passed, match not `confirmed`/`cancelled`): set
  match `status = 'expired'`, unfreeze both the listing and the request
  back to `status = 'active'` (they resume moving from their price at
  freeze time, not their original starting price), refund any `paid`
  deposit (`status = 'refunded'`), notify both parties
  (`match_expired`).
- **On both deposits paid**: set match `status = 'confirmed'`, create
  `contacts_open` notifications for both parties. This is the only
  transition that unlocks phone numbers via `GET /api/matches/:id`.

Implement the daily price-movement + matching pass as a scheduled job
(a simple `time.Ticker` goroutine checked at startup, or `robfig/cron` if
you want real cron syntax — either is fine, this doesn't need to be
distributed-safe for a single-instance MVP). Also expose it as an internal
debug endpoint (e.g. `POST /internal/jobs/run-daily-tick`, not part of the
public API, no auth needed only if bound to localhost) so it can be
triggered manually during development instead of waiting a real day.

Do not implement any of this logic in the frontend. The frontend only ever
displays numbers the API returns — re-read
`nextjs-frontend-architecture`'s "Frontend must NOT contain core business
rules that belong to backend" before touching any of this.

## Error handling & response shape

Match the frontend's existing tone (`nextjs-frontend-architecture`: "Do not
expose raw backend error messages if they are technical"). Standard error
body:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human-readable, Russian, no stack traces" } }
```
4xx for client errors (bad filters, not owner, not authenticated), 5xx only
for genuine server faults, logged server-side with full detail but never
echoed to the client.

## Staged implementation roadmap

Work through these in order. Each stage should build, run, and be
independently testable (`go build ./...`, hit the new endpoints with
`curl`) before moving to the next.

**Stage 0 — Scaffolding**
`go.mod`, Gin server with a `/healthz` route, config loading from `.env`,
Postgres connection pool, Goose wired to `migrations/`. Confirm
`goose -dir migrations postgres "$DATABASE_URL" up` runs cleanly against an
empty database.

**Stage 1 — Schema**
All 8 migrations above, up and down both tested
(`goose up`, `goose down`, `goose up` again).

**Stage 2 — Auth**
Register, login, `GET /me`, JWT middleware. Manually verify with `curl`
using phone formats `8707...`, `7707...`, bare 10-digit, and `+7707...` —
all four must succeed identically.

**Stage 3 — Public catalog**
`GET /api/cars` (all filters + sort + pagination), `GET /api/cars/:id`,
`GET /api/cars/:id/similar`. Seed the database with data shaped like
`lib/mock/cars.ts`'s 20 fixtures so the frontend catalog can be pointed at
this and look identical to the mock version.

**Stage 4 — Listings & requests CRUD**
Create/update/archive for both seller listings and buyer requests, owner
authorization checks.

**Stage 5 — Favorites**

**Stage 6 — Exchange engine**
Daily job, match creation, expiry sweep, the internal manual-trigger
endpoint. This is the highest-risk stage — write it so the job is
idempotent (safe to run twice for the same day) before wiring a real
scheduler.

**Stage 7 — Deposits & contact unlock**
`POST /api/deposits/:id/pay`, derived match status transitions,
notification creation, the phone-number-only-after-`confirmed` rule on
`GET /api/matches/:id`.

**Stage 8 — Dashboard aggregation & notifications**
`GET /api/dashboard/overview` (with the `tasks` derivation moved from
frontend to backend), notifications list + mark-read.

**Stage 9 — Frontend integration** *(frontend-side work, listed here only
for sequencing)*
Replace `lib/mock/*` imports with `lib/api/*` fetch clients per
`nextjs-frontend-architecture`'s "centralize backend calls" rule. Do this
resource by resource, verifying each page still renders identically before
moving to the next, rather than swapping everything at once.
