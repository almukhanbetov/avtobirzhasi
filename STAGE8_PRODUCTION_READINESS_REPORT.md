# Stage 8 — Production Readiness

Date: 2026-08-26
Branch: `main`
Scope: operational/reliability hardening only. No product feature, business-logic, matching/deposit/auth, or UI change was made — everything below is health checks, shutdown behavior, database persistence/backup, logging, secrets hygiene, Docker/proxy/network configuration, timeouts, pool sizing, and background-job lifecycle. Stage 6 (tests) and Stage 7 (CI/CD gates) are unchanged by this stage; their pipeline still runs against everything below and still gates production deploy.

## Current Production Architecture

```
Internet
  ↓ HTTPS (auto-provisioned by Caddy, redirect from HTTP is Caddy's default)
Caddy  (avtobirzhasi.kz, www → :3000 ; api.avtobirzhasi.kz → :8080, /internal/* blocked)
  ↓                                        ↓
Frontend (Next.js, Docker, :3000)   Go API (Gin, Docker, :8080)
                                            ↓ pgx pool (10 max conns, bounded retry on startup)
                                     PostgreSQL 17 (Docker, named volume, :5433→127.0.0.1 only)
```

- All three application services run as Docker containers via `docker-compose.prod.yml`, `restart: unless-stopped`, on a single VPS.
- `backend`/`frontend`/`postgres` all bind to `127.0.0.1` only — Caddy is the only thing exposed to the internet, terminating TLS and reverse-proxying in.
- Postgres data lives in the named volume `avtobirzhasi_pgdata` — not a bind mount, not `docker compose down -v`'d by anything in this stage.
- The Auto Exchange daily-tick scheduler runs as a goroutine inside the single `backend` process (single-instance MVP, documented as an accepted limitation in `.claude/skills/backend-skills/SKILL.md` — not something Stage 8 was asked to change).
- Migrations (Goose) run automatically as part of `deploy` (Stage 7), from a one-off container built from the image about to go live, before that image is cut over to serving traffic.
- CI/CD (Stage 7) gates all of the above: `backend-quality` → `frontend-quality` → `docker-build` → `build-and-push` → `deploy`, unchanged by this stage.

## Health Checks

**Before**: `GET /api/health` (`backend/internal/handlers/health.go`) returned a static `{"status":"ok"}` — it proved the Gin process was alive and routing, nothing else. A backend that could accept a connection but had lost its database connection would still report healthy.

**After**: the same endpoint now calls `pool.Ping(ctx)` (2s bound) and returns `503 {"status":"unavailable"}` if the database is unreachable, `200 {"status":"ok"}` otherwise. No connection string, hostname, or stack trace is ever included in the response.

**Live-verified locally** (not just read/reasoned about):
```
$ curl -s -w '\nHTTP %{http_code}\n' http://localhost:8099/api/health
{"status":"ok"}
HTTP 200

$ docker stop avtobirzhasi_postgres   # dev container, NOT production
$ curl -s -w '\nHTTP %{http_code}\n' http://localhost:8099/api/health
{"status":"unavailable"}
HTTP 503

$ docker start avtobirzhasi_postgres
$ curl -s -w '\nHTTP %{http_code}\n' http://localhost:8099/api/health
{"status":"ok"}
HTTP 200
```

## Graceful Shutdown

**Before**: `router.Run(":" + cfg.Port)` — Gin's own thin wrapper around `http.ListenAndServe`, blocking forever with no signal handling. A SIGTERM (which is exactly what `docker compose up -d`/`docker stop`/a container restart sends) hard-killed the process mid-request.

**After**: `cmd/api/main.go` now derives a `context.Context` from `signal.NotifyContext(ctx, SIGINT, SIGTERM)`, runs the server via an explicit `&http.Server{}` in a goroutine, and on signal calls `srv.Shutdown(shutdownCtx)` (15s bound) before the deferred `pool.Close()` runs. The daily-tick scheduler goroutine now selects on the same context and exits its loop instead of being silently killed.

**Live-verified locally**:
```
2026/08/26 11:29:24 shutdown signal received, draining in-flight requests
2026/08/26 11:29:24 daily tick scheduler stopping
2026/08/26 11:29:24 server shut down cleanly
```
(process confirmed exited — `pgrep` found nothing after the log line, no force-kill needed)

## Database Persistence

`docker-compose.prod.yml`'s `postgres` service is unchanged in this regard: `volumes: - avtobirzhasi_pgdata:/var/lib/postgresql/data`, a named (not bind-mounted, not `tmpfs`) volume declared under the compose file's top-level `volumes:`. `docker compose restart`, `up -d`, or container recreation (e.g. a new image tag) all reuse this same volume — only `docker compose down -v` or an explicit `docker volume rm` would destroy it, and neither was run, added, or suggested by this stage. Verified via `docker compose -f docker-compose.prod.yml config` (see Deployment Smoke Test) that the volume declaration renders correctly.

## Migration Safety

Unchanged from Stage 7, re-verified this stage:
- `backend/migrations/00009_add_user_role.sql` exists, is additive-only (`ALTER TABLE users ADD COLUMN role ... DEFAULT 'user'`), and has a working, non-destructive `Down` (`DROP COLUMN role`) — confirmed by reading the file directly.
- `deploy`'s SSH script (`.github/workflows/deploy.yml`, added Stage 7) runs `docker compose run --rm --entrypoint sh backend -c './goose -dir migrations postgres "$DATABASE_URL" up'` from the freshly-pulled image, under the script's pre-existing `set -e` — a migration failure stops the script before `docker compose up -d` ever runs, so a failed migration blocks the deploy rather than cutting over to code that expects a schema that isn't there.
- No destructive rollback was added or considered — a failed migration is a blocked deploy, not an auto-reverted schema, exactly as scoped.

## Production Migration Verification

```
PRODUCTION ADMIN ROLE MIGRATION (users.role, 00009):
NOT VERIFIED
```
This environment has no access to the production VPS or its database — the same limitation both the original completion audit and `STAGE7_CICD_QUALITY_GATES_REPORT.md` already flagged for anything requiring live VPS state. Nothing in this stage attempted to bypass that by, e.g., guessing at credentials or connecting to a production-shaped hostname. Confirming this requires a human with VPS/DB access to run `SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='role';` (or equivalent) against the real database, or to check `goose -dir migrations postgres "$DATABASE_URL" status` there.

## Backups

**Before**: no backup script, no documented schedule, no retention policy existed anywhere in the repository (confirmed by `find`/`grep` across the repo before writing anything).

**After**: `scripts/backup-db.sh` — `docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges | gzip` into a timestamped file (`avtobirzhasi_<UTC timestamp>.sql.gz`) under `BACKUP_DIR` (default `./backups`, overridable), then prunes files older than `RETENTION_DAYS` (default 14, overridable). Reads `POSTGRES_DB`/`POSTGRES_USER` from `.env` (the same file `docker compose` itself already reads on the VPS) — **no password is read, stored, or passed anywhere in the script**: `pg_dump` runs *inside* the postgres container over its local Unix socket, which the official `postgres` image's default `pg_hba.conf` trusts unconditionally for local connections (the same reason `psql` already works inside that container without `-W`).

Scheduling itself (cron/systemd timer on the VPS) was **not** set up — this repository has no access to the VPS's crontab, and Stage 8 was scoped to providing the mechanism, not silently mutating VPS system configuration it can't verify. A one-line documented next step: `0 3 * * * cd /path/to/deploy && ./scripts/backup-db.sh >> /var/log/avtobirzhasi-backup.log 2>&1` in the VPS operator's crontab.

**Backup creation: PASS** — verified end-to-end this stage against the local dev database (not production):
```
$ BACKUP_DIR=/tmp/.../backup-test RETENTION_DAYS=14 ./scripts/backup-db.sh
Backing up database 'avtobirzhsi_db' -> .../avtobirzhasi_20260826T063533Z.sql.gz
Backup written: .../avtobirzhasi_20260826T063533Z.sql.gz (12K)
Pruning backups older than 14 days in .../backup-test
```

## Restore Verification

`scripts/restore-db.sh <dump.sql.gz> [target-db-name]` — creates a **new** database (default name `avtobirzhasi_restore_check`, never the real `$POSTGRES_DB`), restores the dump into it via `psql`, lists the resulting tables, and prints the one-line command to drop the scratch database when done. It **refuses to run** if the target name equals `$POSTGRES_DB` (the real production database name), exiting 1 with an explicit message instead.

**Restore verification: PASS** — verified end-to-end this stage, restoring the exact dump produced above into a scratch database, then dropping it:
```
$ ./scripts/restore-db.sh .../avtobirzhasi_20260826T063533Z.sql.gz avtobirzhasi_smoketest_restore
...
Restore verification — tables now in 'avtobirzhasi_smoketest_restore':
 public | buyer_requests | table | postgres
 public | deposits       | table | postgres
 public | favorites      | table | postgres
 ... (9 tables total, matching the schema exactly)
$ docker exec avtobirzhasi_postgres psql -U postgres -d postgres -c "DROP DATABASE avtobirzhasi_smoketest_restore;"
DROP DATABASE
```
Also verified the safety guard directly:
```
$ ./scripts/restore-db.sh fake.sql.gz avtobirzhsi_db
Refusing to restore into 'avtobirzhsi_db' — that is the production database name.
Pick a different target-db argument.
$ echo $?
1
```
**Never run against the live production database** — both the dry-run of the guard and the real restore-into-scratch test used the local dev Postgres container only. All temporary `.env`/`backend.env`/`frontend.env` files created solely to exercise these scripts locally were deleted immediately after (confirmed via `git status` showing nothing untracked left behind).

## Logs

Reviewed every `log.*` call site in `backend/cmd` and `backend/internal` (grep, not sampling): startup (`database connected`, `listening on :PORT`), the new bounded-retry attempts (`database ping attempt N/10 failed: ...`), shutdown (`shutdown signal received...`, `daily tick scheduler stopping`, `server shut down cleanly`), background job failures (`scheduled daily tick failed: ...`) and, new this stage, job panics (`daily tick panicked (recovered): ...`). Gin's default logger logs method/path/status/latency/client IP per request — not headers or bodies. **Nothing logs a password, JWT, cookie, or full request/response payload anywhere in the codebase** (confirmed by grep for `log\.` across every `.go` file — the only sensitive-adjacent value ever passed to a log call is an error's `%v`, and no code path wraps a raw password/token into an error string). Migration failures are surfaced in the GitHub Actions job log (Stage 7's SSH script output), not through the Go app's own logger, since migrations don't run through the app process.

## Secrets

Re-audited this stage, in addition to Stage 7's check:
- `git ls-files | grep -i env` → only `.env.example`, `backend.env.example`, `backend/.env.example`, `frontend.env.example` — no real `.env`/`backend.env`/`frontend.env` tracked.
- Repo-wide grep for password/secret-shaped literals and private-key headers found nothing beyond the same documented placeholders already noted in Stage 7.
- The two new scripts (`backup-db.sh`, `restore-db.sh`) were specifically designed to need **zero** password handling (see Backups above) — there was no secret to accidentally hardcode or leak in the first place.
- `JWT_SECRET` and `POSTGRES_PASSWORD` are read from environment only (`config.Load()`, `docker-compose.prod.yml`'s `${...}` interpolation from `.env`/`backend.env`) — neither appears as a literal anywhere in source.
- Deploy credentials (`DOCKERHUB_*`, `VPS_*`) remain exactly as GitHub Secrets, unchanged by this stage.
- No secret value is printed by this report or any script's output.

## Docker Reliability

**Docker healthcheck** — before this stage, only `postgres` had one; `backend`/`frontend` had none (`restart: unless-stopped` alone doesn't detect "process is up but broken," only "process exited"). Added to both:
```yaml
backend:
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:8080/api/health"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 10s
frontend:
  healthcheck:
    test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://127.0.0.1:3000/"]
    interval: 10s
    timeout: 5s
    retries: 5
    start_period: 10s
```
The backend healthcheck calls the *same* `/api/health` this stage taught to check DB connectivity — Docker's notion of "healthy" now genuinely means "can serve a real request," not just "process didn't crash." `frontend`'s `depends_on` was upgraded from a bare `- backend` to `backend: condition: service_healthy`, so the frontend container only starts once the backend can actually answer requests, not merely once its process has started.

Both `wget` invocations were verified to actually work **inside the real built images** (Alpine's busybox `wget` — no `curl` needed, keeping the images as minimal as before):
```
$ docker exec avtobirzhasi_backend_smoketest wget --no-verbose --tries=1 --spider http://127.0.0.1:8098/api/health
remote file exists   (exit 0)
$ docker exec avtobirzhasi_frontend_smoketest wget --no-verbose --tries=1 --spider http://127.0.0.1:3099/
remote file exists   (exit 0)
```

**Restart policy** — unchanged: `restart: unless-stopped` on all three long-running services, exactly as before. The new one-shot migration step (Stage 7, `docker compose run`) correctly has no restart policy of its own — `run` containers aren't managed by `restart:` regardless.

**Startup dependency safety** — Docker-level ordering (`depends_on: condition: service_healthy`) already existed for `backend→postgres` and now also for `frontend→backend`. Added a second, independent layer inside the Go process itself: `db.NewPool` now retries its initial `Ping` up to 10 times, 2s apart (a bounded ~20s wait, not indefinite), instead of a single `Ping` that `log.Fatalf`s immediately. This means a Postgres that's technically "healthy" per its own healthcheck but momentarily not yet accepting new connections (a narrow real-world race) no longer needs a full container restart-loop to recover — the backend's own process absorbs a short delay itself.

## TLS / Reverse Proxy

`Caddyfile.avtobirzhasi` (read in full, unchanged by this stage — it was already correct):
- `avtobirzhasi.kz, www.avtobirzhasi.kz { reverse_proxy 127.0.0.1:3000 }` and `api.avtobirzhasi.kz { ... reverse_proxy 127.0.0.1:8080 }` — correct split, matching the two application containers' published ports.
- Caddy provisions HTTPS (Let's Encrypt/ZeroSSL) and redirects HTTP→HTTPS **automatically** for any bare-domain site block like these two — this is Caddy's default behavior, not something this config has to spell out.
- `handle /internal/* { respond 404 }` on the API block is still present and is load-bearing: `middleware.LocalOnly()` authorizes purely by TCP peer address, which is indistinguishable from Caddy's own proxying IP — without this block, every visitor on the internet would reach the moderation/admin-stats/daily-tick endpoints. Confirmed still in the file, untouched.
- No WebSocket usage exists anywhere in the app (confirmed: notifications are polled/reloaded, not pushed — a known, separately-tracked gap in the completion audit, not something to fix here), so no WS-specific Caddy directive is needed.
- **Not verified**: whether this snippet is actually merged into the VPS's live Caddy config today. This repository has no VPS access, and the file's own header already documents this as a manual merge step for a human operator — consistent with how both prior audits treated this exact question.
```
TLS config correctness: PASS
TLS live on production: NOT VERIFIED
```

## CORS

`backend/internal/middleware/cors.go`, unchanged (already correct, re-verified this stage): explicit allow-list — `http://localhost:3000`, `https://avtobirzhasi.kz`, `https://www.avtobirzhasi.kz` — never `*`. `AllowCredentials: true` is paired correctly with a concrete origin list (browsers reject `*` + credentials combinations anyway, so this is the only valid configuration for a credentialed API, and it's what's actually configured).

## Timeouts

**Before**: `router.Run(...)` used Gin's internal zero-value `http.Server{}` — no `ReadHeaderTimeout`, `ReadTimeout`, `WriteTimeout`, or `IdleTimeout` at all. A slow or stalled client could hold a connection open indefinitely (the classic Slowloris-shaped risk), and there was no protection against a hung handler holding a write open forever.

**After** (`backend/cmd/api/main.go`):
```go
ReadHeaderTimeout: 5 * time.Second
ReadTimeout:       15 * time.Second
WriteTimeout:      30 * time.Second
IdleTimeout:       60 * time.Second
```
Sized generously enough not to interfere with any real request this API serves (largest payloads are JSON listing/request bodies with a handful of image URLs, not file uploads) while bounding how long a single stalled connection can occupy a server goroutine.

## Database Pool

**Before**: `pgxpool.New(ctx, dsn)` with no explicit `Config` — pgx's implicit defaults apply (`MaxConns` = `max(4, runtime.NumCPU())`, `MaxConnLifetime` = 1h, `MaxConnIdleTime` = 30m, no `MinConns`). These aren't unreasonable, but they were never actually *reviewed or set*, only inherited silently.

**After** (`backend/internal/db/db.go`): explicit, reviewed values — `MaxConns=10`, `MinConns=2`, `MaxConnLifetime=1h`, `MaxConnIdleTime=30m`. 10 is comfortably under Postgres's own default `max_connections=100`, leaving headroom for `cmd/seed` or a manual `psql` session running alongside the API — not an arbitrarily large number picked without reference to the actual Postgres instance's capacity. Startup validation is now the bounded-retry `Ping` described under Startup Dependency Safety above, rather than a single unconditional one.

## Background Jobs

`runDailyTickScheduler` (`backend/cmd/api/main.go`):
- **Runs once per instance**: unchanged — started exactly once, from `main()`, as a single goroutine. Multi-instance/distributed safety remains explicitly out of scope (documented MVP limitation, not a Stage 8 target).
- **Stops correctly on shutdown**: **new this stage** — the scheduler now `select`s on the same signal-derived `ctx.Done()` the HTTP server shuts down on, logging `daily tick scheduler stopping` and returning cleanly instead of being silently killed with the rest of the process. Verified live in the Graceful Shutdown section above.
- **Failure is logged**: unchanged, already correct — a `RunDailyTick` error is logged and the loop continues to the next tick rather than exiting.
- **A panic doesn't kill the whole process**: **new this stage** — `runTickSafely` wraps the actual tick call in a `defer recover()`, logging `daily tick panicked (recovered): ...` instead of letting an unhandled panic propagate and crash the entire API (which, unlike a panic inside an HTTP handler, would *not* have been caught by Gin's own `Recovery()` middleware — that only wraps request-handling goroutines, not this background one).

## Deployment Smoke Test

Ran (all non-destructive, nothing in the forbidden list — `down -v`/`volume prune`/`system prune` — was ever executed):
```
$ docker compose -f docker-compose.prod.yml config
```
Rendered cleanly with both new healthchecks, the upgraded `frontend: depends_on: backend: condition: service_healthy`, and the unchanged named volume — confirmed via a temporary, git-ignored `.env`/`backend.env`/`frontend.env` (copied from the tracked `.example` files) that was deleted immediately after, never committed.

```
$ docker build ./backend    → succeeded (includes this stage's health.go/db.go/main.go changes)
$ docker build ./frontend   → succeeded (frontend untouched this stage, rebuilt only to re-verify)
```

**A full `docker compose -f docker-compose.prod.yml up` was deliberately not run locally.** `docker-compose.prod.yml` and this machine's own local dev setup (`backend/docker-compose.yml`) share the exact same explicit Compose project name (`avtobirzhasi`) and the exact same `container_name` for Postgres (`avtobirzhasi_postgres`) — both files say so directly in their own comments, precisely because a past incident on this machine saw an implicit project-name collision destroy a different, unrelated project's container. Running `docker compose -f docker-compose.prod.yml up` from this checkout would not create an isolated environment; it would operate on the *same already-running dev Postgres container* this session has been actively using for Stage 6/7/8's own test suites. Instead, each piece was verified independently and safely:
- `docker compose config` — full file, including the new healthchecks, syntactically and referentially valid.
- Both Dockerfiles — build successfully with this stage's code changes.
- The healthcheck commands — actually run inside standalone containers (`docker run`, isolated names, no compose project involved) started from the just-built images, confirmed exit 0.
- The health endpoint's DB-down behavior — exercised against the real local dev Postgres container being stopped/started (not deleted; its volume was never touched).
- Backup/restore — exercised via the real scripts against the real local dev database, using temporary env files deleted immediately after, writing only to `/tmp`'s scratch directory (never into the repo).

This is treated as **PASS with a documented safety exception**, not a skipped check.

## CI/CD Regression

`.github/workflows/deploy.yml` was **not modified** by this stage — the pipeline shape from Stage 7 (`backend-quality` → `frontend-quality` → `docker-build` → `build-and-push` → `deploy`, with `needs`/`if`/`concurrency` exactly as documented in `STAGE7_CICD_QUALITY_GATES_REPORT.md`) is untouched. Everything this stage changed (`backend/cmd/api/main.go`, `backend/internal/db/db.go`, `backend/internal/handlers/health.go`, `docker-compose.prod.yml`) is exactly the kind of change those gates exist to catch — and all of it was re-verified green locally through the same commands those gates run (see Backend/Frontend Verification below), so the next real push will hit gates that already know how to evaluate this stage's changes without any pipeline edits.

## Backend Verification
```
$ cd backend
$ go build ./...
(clean)
$ go vet ./...
(clean)
$ TEST_DATABASE_URL=postgres://postgres:***@localhost:5435/avtobirzhsi_test?sslmode=disable go test -p 1 ./...
ok  	avtobirzhasi/backend/internal/handlers
ok  	avtobirzhasi/backend/internal/service
```
All 22 Stage 6 tests still pass unmodified — Stage 8 did not touch `exchange.go`, `deposits.go`, `phone.go`, or any handler business logic, only `main.go`/`db.go`/`health.go`.

## Frontend Verification
```
$ cd frontend
$ npm run test
Test Files  5 passed (5)
     Tests  33 passed (33)
$ npx tsc --noEmit
(clean)
$ npm run lint
✖ 1 problem (0 errors, 1 warning)   ← pre-existing, unrelated (ListingForm.tsx React Compiler note)
$ npm run build
✓ Compiled successfully, 27 routes
```
Frontend was not touched by this stage at all; re-run only to confirm Stage 8's backend/infra changes didn't regress it (they don't touch the same files).

## Production Readiness Matrix

| Area | Status | Evidence |
|---|---|---|
| Health endpoint | PASS | `/api/health` checks DB via `pool.Ping`, 503 on failure; live-verified 200→503→200 |
| Docker health | PASS | Healthchecks added to backend+frontend; `wget` command verified working inside the actual built images |
| Graceful shutdown | PASS | SIGTERM → drain → clean exit, live-verified with a real process and signal |
| DB persistence | PASS | Named volume unchanged, untouched; `docker compose config` confirms the declaration |
| Migration safety | PASS | `00009` additive+reversible; deploy blocks cutover on migration failure (Stage 7, unchanged) |
| Production migration applied | NOT VERIFIED | No VPS/production DB access from this environment |
| Backup creation | PASS | `scripts/backup-db.sh` written and verified end-to-end against local dev DB |
| Backup restore | PASS | `scripts/restore-db.sh` written and verified end-to-end into a scratch DB; guard against restoring over prod-named DB verified |
| Secrets | PASS | No real secret committed anywhere; new scripts need no password at all |
| Logging | PASS | Startup/shutdown/retry/job-failure/panic-recovery all logged; nothing sensitive ever logged (grepped) |
| Restart policy | PASS | `unless-stopped` on all long-running services, unchanged; one-shot migration container correctly has none |
| TLS | PASS (config) / NOT VERIFIED (live) | Caddy snippet correct (auto-HTTPS+redirect, `/internal/*` blocked); actual live VPS state unverifiable from here |
| CORS | PASS | Explicit allow-list, never `*`, correctly paired with `AllowCredentials: true` |
| Server timeouts | PASS | `ReadHeaderTimeout`/`ReadTimeout`/`WriteTimeout`/`IdleTimeout` added, replacing Gin's zero-value defaults |
| DB pool | PASS | Explicit `MaxConns=10`/`MinConns=2`/lifetime/idle limits + bounded-retry startup ping |
| Job lifecycle | PASS | Scheduler now ctx-cancellable and panic-recovered; single-instance-by-design, unchanged |
| CI/CD | PASS | Unmodified Stage 7 pipeline; all Stage 8 changes re-verified green through the same gate commands |

## Remaining Production Risks

- **Nothing in this stage has run on the real VPS.** Every "PASS" above for code/config correctness is a local, independently-reproduced verification (real signals, real container stop/start, real `docker build`, real `pg_dump`/restore) — not a live production run. The production-specific items (migration applied, TLS actually merged) are honestly marked `NOT VERIFIED`, not assumed.
- **No automated backup schedule exists yet** — `scripts/backup-db.sh` works, but nothing on the VPS currently calls it on a timer; that's one crontab line a human operator still needs to add.
- **No off-VPS backup storage.** `BACKUP_DIR` defaults to a local directory on the same machine as the database it's backing up — a full VPS/disk loss would take the backups with it. Shipping backups off-host (S3-compatible storage, another machine, etc.) is a reasonable next step this stage didn't attempt, since it would require provisioning a destination this environment can't verify.
- **Multi-instance/distributed job safety is still explicitly out of scope** — the daily-tick scheduler is safe for exactly one running backend instance, by design; nothing here changes that, and running two backend replicas would double-apply the daily price movement.
- **No log aggregation/alerting** — logs go to each container's stdout only (`docker compose logs` on the VPS); nothing pages a human if the health check starts failing or the daily tick starts erroring repeatedly. Docker's own healthcheck will mark the container `unhealthy` (visible via `docker compose ps`), but nothing currently watches that automatically.
- **Security headers (HSTS, CSP, X-Frame-Options, etc.) are not configured in Caddy** — deliberately left alone this stage per the explicit "no big security-hardening rewrite" scope; noted here as a real, separate gap rather than silently fixed or silently ignored.
- Everything already listed as a gap in `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md` that Stage 8 was explicitly told not to touch (payment gateway, edit/delete UI, QuickSearch, FreshListings, admin sections, self-service flows) remains exactly as it was — this stage did not narrow the product-completeness gap, only the operational one.

## Files Changed

- `backend/internal/handlers/health.go` — DB-connectivity check, 503 on failure
- `backend/internal/db/db.go` — explicit pool limits, bounded-retry startup ping
- `backend/cmd/api/main.go` — graceful shutdown, HTTP server timeouts, scheduler now ctx-cancellable + panic-recovered
- `docker-compose.prod.yml` — healthchecks for `backend`/`frontend`, `frontend`'s `depends_on` upgraded to `condition: service_healthy`
- `scripts/backup-db.sh` — new
- `scripts/restore-db.sh` — new
- `STAGE8_PRODUCTION_READINESS_REPORT.md` — this file
- `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md` — scoped update (Production Readiness, CI/CD cross-reference, Database, Security note, Overall Completion)

No migration, no business-logic file (`service/exchange.go`, `service/deposits.go`, any handler's actual product behavior), no frontend file, and no `.github/workflows/deploy.yml` change. No `git commit`/`git push` performed.
