# Stage 12 — Listing Photo Upload

Focused audit and fix of "adding a photo in the listing form does nothing /
images don't upload."

**Not touched:** FreedomPay, payment flow, matching engine, price engine,
production data. Production payment stays disabled.

---

## ROOT CAUSE

**There was no file upload anywhere in the project.** The "photo" feature
was a *paste-a-URL* text field (`ImageUrlField.tsx`), by design — its own
comment said so: *"There's no upload/storage backend … so sellers paste
image links instead of uploading files."*

Concretely, the reported symptoms:

1. **"Nothing happens on click"** — there was no file picker. The control
   was `<input type="url">` + a `+` button. Clicking `+` with the field
   empty hit `if (!trimmed) return;` and silently did nothing.
2. **"Images don't upload"** — nothing was ever uploaded. Even a correctly
   pasted image URL from a non-Unsplash host would not render on the
   catalog card / detail gallery, because those use `next/image` and
   `next.config.ts` `remotePatterns` only allowed `images.unsplash.com`.
   The in-form preview used a plain `<img>`, so it *looked* fine until you
   published.

There was no bug to fix in an upload path — the path did not exist. Per the
chosen scope ("full file upload, local + infra"), it was built.

---

## What was built

### Backend — `POST /api/uploads/images` + `GET /uploads/:name`

| | |
|---|---|
| **HTTP METHOD / ROUTE (upload)** | `POST /api/uploads/images` (JWT-protected) |
| **HTTP METHOD / ROUTE (serve)** | `GET /uploads/:name` (public, on the engine, outside `/api`) |
| **EXPECTED FILE FIELD** | `images` (multipart, repeatable) — matches `FormData.append("images", file)` |
| **MAX FILE SIZE** | 5 MiB per file (`maxImageBytes`) |
| **MAX FILE COUNT** | 10 per request (`maxImagesPerRequest`); form also caps a listing at 10 |
| **ACCEPTED TYPES** | `image/jpeg`, `image/png`, `image/webp` — detected by content sniff (`http.DetectContentType`), never the filename or client `Content-Type` |
| **STORAGE** | local filesystem, `UPLOAD_DIR` (`./uploads` dev, `/data/uploads` prod on a named Docker volume) |
| **RETURNED** | `{ "urls": ["<PUBLIC_UPLOAD_BASE_URL>/uploads/<32-hex>.<ext>"] }`, submission order |
| **FILENAME** | 16 random bytes hex + extension; `Serve` only accepts names matching `^[a-f0-9]{32}\.(jpg|png|webp)$` → no path traversal, no directory listing |
| **ATOMICITY** | any rejected file fails the whole request; partial writes are cleaned up |

Frontend field name (`images`) **matches** backend field name (`images`) —
no mismatch.

New files: `backend/internal/handlers/uploads.go`,
`backend/internal/handlers/uploads_test.go`,
`backend/internal/handlers/uploads_listing_integration_test.go`.
Wired in `cmd/api/main.go` (`os.MkdirAll(UploadDir)`, route registration).
Config: `UploadDir`, `PublicUploadBaseURL` in `internal/config/config.go`.

`POST /api/listings` is unchanged — it still takes `images: []string`; the
frontend uploads first, then submits the returned URLs as JSON, exactly
like external URLs before.

### Frontend

| File | Change |
|---|---|
| `features/listings/ImageUploadField.tsx` | **new** — replaces `ImageUrlField`. Hidden `<input type="file" accept=… multiple>`, visible "Добавить фото" button → `inputRef.current.click()`. On select: client-side validate (type / 5 MB / count), upload batch, append returned URLs to the RHF field array. Object-URL preview while in flight, `revokeObjectURL` in `finally` + on unmount. `input.value` reset after every pick so re-selecting the same file re-fires `onChange`. Errors shown inline (never swallowed). |
| `features/listings/ImageUrlField.tsx` | **deleted** |
| `lib/api/uploads.ts` | **new** — `uploadListingImages(token, files)`; builds `FormData`, no manual `Content-Type`. Exports shared limits. |
| `lib/api/client.ts` | `apiFetch` now passes a `FormData` body through untouched (no JSON stringify, no `Content-Type` header) so the browser sets the multipart boundary. |
| `lib/validation/listing.ts` | `images` array `.max(10)`; message wording. |
| `lib/i18n/translations.ts` | `listingForm.addPhoto` / `photoHint` / `uploadingPhotos` / `photoTypeError` / `photoSizeError` / `photoCountError` / `photoUploadError` (ru + kz); dropped unused `photoUrlPlaceholder`. |
| `next.config.ts` | `remotePatterns` += `http://localhost:8080/uploads/**` and `https://api.avtobirzhasi.kz/uploads/**` so `next/image` on cards/gallery renders uploaded photos. |

New tests: `features/listings/ImageUploadField.test.tsx`,
`lib/api/uploads.test.ts`.

### Infra (production persistence)

| File | Change |
|---|---|
| `docker-compose.prod.yml` | backend service: `UPLOAD_DIR=/data/uploads`, `PUBLIC_UPLOAD_BASE_URL=https://api.avtobirzhasi.kz` (set in `environment:` so a deploy can't forget them), `volumes: - avtobirzhasi_uploads:/data/uploads`; new named volume `avtobirzhasi_uploads`. Survives every container recreation. |
| `backend/Dockerfile` | `RUN mkdir -p /data/uploads` (mount-point ownership). |
| `Caddyfile.avtobirzhasi` | comment only — `/uploads/*` is already forwarded by the existing `api.avtobirzhasi.kz` catch-all `reverse_proxy 127.0.0.1:8080`. **No Caddy rule change needed.** |
| `backend/.env.example`, `backend.env.example` | document the two new vars. |
| `backend/.gitignore` | ignore local `/uploads/`. |

No architectural redesign — local filesystem + a persistent volume is the
minimum that works, and it matches how Postgres data is already handled.

---

## Verified locally (throwaway backend on :8090, dev DB)

Real 2×2 PNG uploaded → `201 {"urls":["…/uploads/f3f806…​.png"]}` → listing
created with that URL → `imageUrl`/`images` populated in the create
response **and** in `GET /api/dashboard/listings` (`car.imageUrl`) → `GET`
of the served URL returned `HTTP 200 image/png`, bytes identical → traversal
name `../etc/passwd` → `404` → text file sent as `.png` → `400`. Cleaned up
after.

---

## PHOTO UPLOAD AUDIT

```
Add Photo click:            PASS   (button → inputRef.current.click(); type="button")
File picker opens:          PASS   (real hidden <input type="file" accept multiple>)
onChange fires:             PASS   (input.value reset each time → repeat same-file works)
Frontend state receives File: PASS (FileList → File[], validated, kept through upload)
Preview:                    PASS   (object-URL while uploading, revoked on settle + unmount;
                                    committed photos render from served URL)
FormData:                   PASS   (FormData.append("images", file); browser sets boundary;
                                    apiFetch no longer forces application/json)
Upload HTTP request:        PASS   (POST /api/uploads/images, multipart, Authorization: Bearer)
Backend multipart parsing:  PASS   (c.MultipartForm(); MaxBytesReader guard; field "images")
File storage:               PASS   (UPLOAD_DIR, random hex name, O_EXCL; prod = named volume)
Database image reference:   PASS   (listing_images.url, unchanged create path)
API returns image:          PASS   (car_response imageUrl/images; verified live)
Card image:                 PASS   (next/image + remotePatterns for the api /uploads host)
Detail page image:          PASS   (Gallery, same remotePatterns)
Edit listing images:        NOT IN SCOPE — no edit-photos API or UI exists today
                                    (updateListingRequest = price/mileage/description/region/color
                                    only; no /sell/edit page). Flagged, not expanded.
Delete/remove image:        PARTIAL — remove-before-submit works in the form (RHF remove()).
                                    Orphan-file GC on listing archive: NOT IN SCOPE
                                    (archive is a soft delete; files are never deleted).
Backend tests:              PASS   (go build ./… ; go vet ./… ; go test -p 1 ./… — all ok)
Frontend tests:             PASS   (tsc --noEmit clean; vitest 14 files / 68 tests;
                                    eslint 0 errors, 1 pre-existing warning in ListingForm)
Build:                      PASS   (next build — Compiled successfully; backend go build ok)
ROOT CAUSE:                 No upload feature existed — the field only accepted pasted URLs,
                            and pasted non-Unsplash URLs failed next/image's remotePatterns.
```

### Tool output

```
backend:  go build ./...      → ok
          go vet ./...         → ok
          go test -p 1 ./...   → ok (config, handlers, service; repos/etc have no tests)
frontend: npx tsc --noEmit     → ok
          npm run lint         → 0 errors, 1 warning (ListingForm.tsx:59 watch() —
                                 pre-existing, present on a clean tree)
          npm run test         → 14 files, 68 tests, all passing
          npm run build        → Compiled successfully
```

---

## FILES CHANGED

**Backend (new)**
- `backend/internal/handlers/uploads.go`
- `backend/internal/handlers/uploads_test.go`
- `backend/internal/handlers/uploads_listing_integration_test.go`

**Backend (modified)**
- `backend/cmd/api/main.go`
- `backend/internal/config/config.go`
- `backend/Dockerfile`
- `backend/.env.example`
- `backend/.gitignore`

**Frontend (new)**
- `frontend/features/listings/ImageUploadField.tsx`
- `frontend/features/listings/ImageUploadField.test.tsx`
- `frontend/lib/api/uploads.ts`
- `frontend/lib/api/uploads.test.ts`

**Frontend (modified)**
- `frontend/features/listings/ListingForm.tsx`
- `frontend/features/listings/ImageUrlField.tsx` *(deleted)*
- `frontend/lib/api/client.ts`
- `frontend/lib/validation/listing.ts`
- `frontend/lib/i18n/translations.ts`
- `frontend/next.config.ts` *(remotePatterns + `dangerouslyAllowLocalIP` in dev — see Runtime Verification)*

**Infra**
- `docker-compose.prod.yml`
- `Caddyfile.avtobirzhasi`
- `backend.env.example`

---

## Deploy / restart notes

- **Local:** restart the backend (`go run ./cmd/api`) and the frontend
  dev server — the backend needs the new routes, the frontend needs the
  `next.config.ts` changes (`remotePatterns` + dev-only
  `dangerouslyAllowLocalIP`). No `.env` change required locally
  (defaults: `UPLOAD_DIR=./uploads`, `PUBLIC_UPLOAD_BASE_URL=http://localhost:8080`).
- **Production:** `docker compose -f docker-compose.prod.yml up -d` creates
  the `avtobirzhasi_uploads` volume and injects the two env vars. No
  Caddy change. **Never `docker compose down -v`** — that destroys the
  uploads volume (and pgdata).
- Pre-existing listings keep whatever URL strings they already have
  (Unsplash seed data etc.) — unaffected.

## Known follow-ups (not done — out of the reported problem's scope)

1. Edit-listing photo management (add/remove images on an existing
   listing) — needs a new `PATCH` capability and a `/sell/edit` UI.
2. Orphan-file cleanup when a listing is archived, and when a photo is
   removed in the form before submit (the uploaded file stays on disk).
3. Server-side image re-encoding / thumbnailing (currently the original
   file is served as-is).

---

## Runtime Verification (2026-08-28)

Live check against the restarted servers — backend `go run ./cmd/api`
(`:8080`), frontend `next dev` (`:3000`), local Postgres. Test account
`+77018887766` ("S12 Verify"), test listing `1c5fa066-…`.

### One issue found and fixed

**`next/image` could not display uploaded photos in local dev** — the Next
16 image optimizer rejects any upstream that resolves to a private IP
(`http://localhost:8080` → `127.0.0.1`) with
`"url" parameter is not allowed` / `resolved to private ip`. This is a
Next 16 SSRF guard, new since the `remotePatterns` entry was written.

Fix (photo-display only, no scope change): `next.config.ts` →
`images.dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production"`.
Dev gets local-IP optimization; production keeps the guard on because
photos there come from `https://api.avtobirzhasi.kz` (a public IP).
Re-verified: optimizer returns `200` for jpg/png/webp after the change.
`tsc`, `vitest` (14 files / 68 tests), `next build` all still green.

### Results

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | "Добавить фото" opens the native file picker | **PASS** | Button `type="button"` → `inputRef.current.click()`; asserted by `ImageUploadField.test.tsx` ("Add Photo button opens the hidden file input", `HTMLInputElement.prototype.click` spy). Real hidden `<input type="file" accept="image/jpeg,image/png,image/webp" multiple>`. |
| 2 | Valid JPG/PNG/WebP shows a preview | **PASS** | Component test: valid file → `uploadListingImages` called → committed `<img>` in grid. Object-URL preview shown while in flight. |
| 3 | Invalid file shows a visible error | **PASS** | Runtime: `POST /api/uploads/images` with a text file → `400 {"code":"UNSUPPORTED_MEDIA_TYPE","message":"Поддерживаются только фото в формате JPG, PNG или WebP"}`. Component test: non-image / >5 MB → inline red error, no upload. Oversize (>5 MiB) → `413`. |
| 4 | Create a test listing with one photo | **PASS** | `POST /api/listings` (3 photos) → `201`, listing `1c5fa066-…`. |
| 5 | `POST /api/uploads/images` succeeds | **PASS** | `201 {"urls":["http://localhost:8080/uploads/40907ff0….jpg", "…4f3d4790….png", "…cb7cfad8….webp"]}`. |
| 6 | Listing stores the returned image URL | **PASS** | Create response `imageUrl`/`images` = the uploaded URLs; DB `listing_images` has 3 rows, positions 0–2, URLs exact. |
| 7 | Open the created listing | **PASS** | `GET /api/cars/1c5fa066-…` → `200` with `images` array (after moderation → active); frontend `GET /cars/1c5fa066-…` → `200`, HTML contains the `_next/image?url=…uploads/40907ff0…` srcset. (`GET /api/cars/:id` correctly `404`s while status is `moderation`.) |
| 8 | Uploaded image is displayed | **PASS** (after fix) | `GET /_next/image?url=<upload>&w=640&q=75` → `200 image/jpeg` for jpg, png and webp. Direct `GET /uploads/40907ff0….jpg` → `200 image/jpeg`, bytes identical to the source file. |
| 9 | `GET /uploads/:name` returns 200 | **PASS** | `200`, `Content-Type: image/jpeg`, `Cache-Control: public, max-age=31536000, immutable`. Bogus/traversal names → `404`. |
| 10 | Page refresh does not lose the image | **PASS** | Re-fetched optimizer URL and direct `/uploads/` URL repeatedly → `200`; `GET /api/cars/:id` still returns all 3 images; files present on disk in `backend/uploads/`. Survives backend restart (already on disk; prod uses the named volume). |

### Tool re-run after the fix

```
frontend: npx tsc --noEmit   → ok
          npm run test        → 14 files / 68 tests passing
          npm run build       → Compiled successfully
backend:  unchanged since implementation — go build / vet / test still green
```

### Notes

- The DOM-interaction steps (1–3) are verified by the `ImageUploadField`
  component tests (jsdom) plus the live HTTP checks above; there is no
  browser-automation tool in this environment for a literal click-through.
- The test listing `1c5fa066-…` and its 3 uploaded files were left in
  place (status `active`) so the photo can be eyeballed at
  `http://localhost:3000/cars/1c5fa066-57c3-45bf-8b0e-7dc276ea6bfc`.
  Delete the `+77018887766` user / listing to clean up.
- Both dev servers were restarted by this verification (the backend still
  on `:8080` was the stale pre-Stage-12 process; the frontend needed the
  `next.config.ts` change) and were left running.

---

## Production Deployment Verification

### Pre-deployment inspection

| Item | Finding |
|---|---|
| Branch / base commit | `main` @ `e4813fa` (Stage 11) |
| `POST /api/uploads/images` exists | Yes — `RegisterUploadsRoutes` → `api.POST("/uploads/images", middleware.Auth(jwtSecret), h.UploadImages)` |
| `GET /uploads/:name` exists | Yes — `static.GET("/uploads/:name", h.Serve)`, mounted on the engine (outside `/api`), name gated by `^[a-f0-9]{32}\.(jpg\|png\|webp)$` |
| Persistent volume | `docker-compose.prod.yml`: `volumes: [avtobirzhasi_uploads:/data/uploads]` on `backend`; top-level named volume `avtobirzhasi_uploads`. `docker compose config` confirms `type: volume` (not bind, not anonymous). |
| Survives backend restart / container recreation / new deploy | Yes — files live on the named volume, which is independent of container lifecycle. Each deploy does `docker compose up -d` (recreates the backend container from the new image) but the volume persists. **Never `docker compose down -v`.** |
| Files only in an ephemeral layer? | No — `UPLOAD_DIR=/data/uploads` is the volume mount. `RUN mkdir -p /data/uploads` in the Dockerfile only prepares the mountpoint; the volume is mounted over it at runtime. |
| Production `UPLOAD_DIR` | `/data/uploads` (compose `environment:`) |
| Production `PUBLIC_UPLOAD_BASE_URL` | `https://api.avtobirzhasi.kz` (compose `environment:`) — the established API host; `/uploads/*` and `/api/*` are the same origin |
| Caddy proxying | `api.avtobirzhasi.kz { … reverse_proxy 127.0.0.1:8080 }` is a catch-all — `/api/*` **and** `/uploads/*` both reach the backend. No Caddy change needed; `Caddyfile.avtobirzhasi` got a clarifying comment only (and Caddyfile is not deploy-synced anyway). |
| `next/image` production host | `next.config.ts` `remotePatterns` includes `https://api.avtobirzhasi.kz/uploads/**`; `dangerouslyAllowLocalIP` is `false` in a production build (`NODE_ENV === "production"`). |
| Localhost URL into prod `listing_images`? | The upload flow can't produce one — in prod `PublicUploadBaseURL` is the HTTPS API host, so `UploadImages` only ever returns `https://api.avtobirzhasi.kz/uploads/…`. (`POST /api/listings` does not validate arbitrary URL hosts in `images[]` — pre-existing behavior, unchanged, out of scope.) |
| CI/CD path | `.github/workflows/deploy.yml`: push to `main` → quality gates → docker-build verify → build & push images → deploy job scps `docker-compose.prod.yml` to the VPS and runs `docker compose pull` + goose migrations + `up -d`. The compose change ships automatically. |

### Pre-deployment quality checks (local, full working tree)

```
backend:  go build ./...      → ok
          go vet ./...         → ok
          go test -p 1 ./...   → ok (config, handlers, service)
frontend: npm run test         → 14 files / 68 tests passing
          npx tsc --noEmit     → ok
          npm run lint          → 0 errors (1 pre-existing warning, ListingForm.tsx:59)
          npm run build         → Compiled successfully
docker:   docker compose -f docker-compose.prod.yml config → valid (exit 0)
```

Committed tree re-verified in an isolated worktree: `go build ./...` + `go vet ./...` → ok.

### Commit

`e2fa0a7` — `feat: seller photo upload for listings (Stage 12)` — 22 files,
Stage-12-only (the pending FreedomPay `isTruthy` change in `config.go` and
its `config_test.go` were deliberately kept out of this commit).

### Push / deploy

_Filled in after `git push origin main` and the GitHub Actions run._

### Production smoke verification

_Filled in after the deploy completes._
