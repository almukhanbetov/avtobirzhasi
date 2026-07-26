# Skill: Next.js Frontend Architecture — avtobirzhasi.kz

## Stack
Use:
- Next.js App Router;
- TypeScript;
- Tailwind CSS;
- TanStack Query for server API state where appropriate;
- Zod for validation;
- React Hook Form for forms;
- Lucide icons.

## Backend
Backend is separate:
- Go
- Gin
- PostgreSQL 17
- Goose migrations

Frontend must NOT contain core business rules that belong to backend.

Do not calculate authoritative:
- match eligibility;
- deposit status;
- final match price;
- listing freeze state;
- contact unlock authorization
only on the frontend.

The UI may display calculated values received from API, but backend remains source of truth.

## Recommended frontend structure

frontend/
  app/
    (public)/
      page.tsx
      cars/
      exchange/
      buy/
      sell/
    dashboard/
    auth/
  components/
    ui/
    layout/
    cars/
    exchange/
    dashboard/
  features/
    auth/
    listings/
    filters/
    matches/
    deposits/
    favorites/
  lib/
    api/
    auth/
    format/
    validation/
  types/
  public/

## Data fetching
Prefer:
- Server Components for public SEO-friendly content;
- Client Components only where interaction requires them;
- TanStack Query for interactive authenticated data and mutations.

Do not mark entire pages `"use client"` unnecessarily.

## API layer
Centralize backend calls.

Example:
lib/api/client.ts
lib/api/listings.ts
lib/api/matches.ts

Do not scatter fetch() calls throughout UI components.

## Formatting
Money:
- use Intl.NumberFormat for Kazakhstan-style tenge output;
- preserve backend numeric precision;
- never concatenate price strings manually.

Dates:
- use consistent locale formatting.

## Forms
Create flows for:
- sell vehicle;
- buyer request;
- login/register;
- filters.

Large forms should be multi-step when it improves comprehension.

## Error states
Every request must handle:
- loading;
- empty;
- validation error;
- API error;
- success.

Do not expose raw backend error messages if they are technical.

## SEO
Public car detail pages should have:
- metadata;
- canonical URL;
- descriptive title;
- Open Graph data where useful.

## Performance
- next/image;
- responsive image sizes;
- dynamic import for heavy optional UI;
- avoid unnecessary client-side JS;
- skeletons for async content;
- paginate or virtualize large results where needed.

## Security
Do not trust route guards only in UI.
Backend must authorize every protected operation.
Never store secrets in NEXT_PUBLIC variables.
Do not expose private phone numbers until backend explicitly returns them for an authorized confirmed Match.

## Code quality
- no 1000-line page components;
- split by domain;
- avoid premature generic abstractions;
- prefer clear names;
- no duplicated status rendering logic;
- create shared status maps for Match/listing labels.
