# Stage 7 — CI/CD Quality Gates

Date: 2026-08-26
Branch: `main`
Scope: make production deploy depend on backend/frontend quality checks. No product features, no matching/exchange/deposits/auth/UI changes, no new business tests (Stage 6 already covers that), no commit/push. Only `.github/workflows/deploy.yml` was changed for behavior; this report and a scoped update to `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md` are the only other changes.

## Previous CI/CD State

`.github/workflows/deploy.yml` had exactly two jobs:

```
push main
  → build-and-push (docker build + push backend image, docker build + push frontend image)
  → deploy (needs: build-and-push; SSH into VPS; docker compose pull; docker compose up -d)
```

- Triggered on every push to `main`, full stop — no `pull_request` trigger, no quality job of any kind.
- No `go build`/`go vet`/`go test` step anywhere.
- No `npm run lint`/`npm run test`/`tsc`/`npm run build` step anywhere.
- No Docker build *verification* step distinct from the real push — the only way a build failure was ever caught was the production push itself failing.
- No migration step at all. `backend/Dockerfile` bundles a pinned `goose` binary specifically so migrations *could* be run against production without installing Go on the VPS (confirmed by that Dockerfile's own comment), but nothing in the workflow or the container's `ENTRYPOINT` ever invoked it — migrations were a fully manual, undocumented-in-CI SSH step (confirmed in `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md`'s Manual Developer Dependencies #2).
- No `concurrency` block — two pushes to `main` close together could race two simultaneous SSH deploys against the same VPS.
- No `timeout-minutes` on either job.
- No `permissions` block (workflow ran under whatever the repo's default `GITHUB_TOKEN` permissions were).
- Secrets were already used correctly: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `VPS_HOST`, `VPS_PORT`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PATH` all came from `${{ secrets.* }}`, none hardcoded, none echoed to logs — verified again this stage, unchanged.

## Risks Before Stage 7

- A backend change that compiles but is logically wrong (e.g. reintroducing the self-match bug Stage 2 fixed) would ship straight to production — nothing in CI would have caught it, even though Stage 6 now has a test that would catch exactly that regression.
- A frontend change with a TypeScript error, a lint violation, or a broken `next build` would only be discovered when the production image build itself failed *during the real push*, i.e. after Docker Hub credentials were already used and partway into the pipeline — or worse, if the error were something `next build` doesn't catch (a runtime-only bug), it wouldn't be caught at all.
- A migration that fails on the production database would leave the deploy in an undefined state — the old script had no migration step, so this risk was "migrations never run automatically" rather than "migrations run but errors are ignored," but either way schema drift between code and the live database was possible without any signal.
- Two near-simultaneous merges to `main` could trigger two overlapping SSH sessions against the same VPS, each doing `docker compose pull && up -d` — no protection against interleaved container recreation.
- A PR could not be quality-checked before merge at all; the only signal was "does it build after merging."

## New Pipeline

```
Push / PR (branches: [main])
        ↓
  ┌─────────────────┬──────────────────┐
  │ Backend Quality  │ Frontend Quality │   (parallel, both required)
  └─────────────────┴──────────────────┘
        ↓
  Docker Build Verification (needs both quality jobs)
        ↓
  ── PR stops here ──          ── push to main only, past this point ──
        ↓
  Build & Push Images (needs backend-quality, frontend-quality, docker-build)
        ↓
  Deploy to Production (needs build-and-push)
```

`backend-quality` and `frontend-quality` run in parallel (no `needs` between them) since they're independent; `docker-build` needs both; `build-and-push` and `deploy` additionally carry `if: github.event_name == 'push' && github.ref == 'refs/heads/main'` so a PR run never reaches them even though a skipped-dependency would already skip them by default — this is deliberate defense in depth, the same "check it twice at the point that actually matters" pattern Stage 2 used for the self-match guard.

## Backend Gate

Job `backend-quality`, `working-directory: backend`, `timeout-minutes: 10`:

1. Spin up a GitHub Actions **service container** — `postgres:17-alpine`, ephemeral, destroyed with the runner — with a health check (`pg_isready`) gating the later steps.
2. `actions/setup-go@v5` pinned via `go-version-file: backend/go.mod` (currently Go 1.25), with its built-in module cache.
3. `go install github.com/pressly/goose/v3/cmd/goose@v3.27.1` — the exact version pinned in `backend/Dockerfile`, so CI migrates the test database the same way production migrates.
4. `goose -dir migrations postgres "$TEST_DATABASE_URL" up` against the service container.
5. `go build ./...`
6. `go vet ./...`
7. `go test -p 1 ./...` — **not** the bare `go test ./...`. See Test Database below for why.

Any of these failing fails the job, which blocks every job downstream via `needs`.

## Frontend Gate

Job `frontend-quality`, `working-directory: frontend`, `timeout-minutes: 10`. Uses the real script names from `frontend/package.json` — no new test framework introduced (Stage 6 already chose Vitest; this stage did not touch it):

1. `actions/setup-node@v4`, Node 24 (matching `frontend/Dockerfile`'s `node:24-alpine`), with npm's cache.
2. `npm ci`
3. `npm run test` → `vitest run` (33 tests from Stage 6)
4. `npm run lint` → `eslint`
5. `npx tsc --noEmit`
6. `npm run build` → `next build`

## Docker Gate

Job `docker-build`, `needs: [backend-quality, frontend-quality]`, `timeout-minutes: 15`. Builds both production Dockerfiles exactly as the real deploy does — `docker/build-push-action@v6` with `push: false` for both `./backend` and `./frontend` (the frontend build gets the same `NEXT_PUBLIC_API_URL` build-arg the real push uses, so this is a faithful rehearsal, not a stripped-down one). Neither image is loaded or pushed anywhere, and this job needs zero registry credentials — a PR from a fork can run this gate with no secret exposure. Verified locally this stage (see Local Verification) using the identical Dockerfiles and build-args; both images built cleanly.

## Deployment Gate

```yaml
build-and-push:
  needs: [backend-quality, frontend-quality, docker-build]
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
deploy:
  needs: build-and-push
  if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

`needs` is the actual gate — GitHub Actions treats a failed (or skipped) required job as making its dependents skip too. The explicit `if` on both jobs additionally guarantees a PR run can never reach the real push or the SSH deploy, even in a hypothetical future edit that loosens `needs`.

**Concurrency protection** (item 13): both `build-and-push` and `deploy` share one `concurrency: group: avtobirzhasi-production-deploy` with `cancel-in-progress: false`. A second push's pipeline queues behind the first's `build-and-push` + `deploy` rather than either racing it or cancelling a deploy that might be mid-SSH-script. Only one production deploy can be in flight at a time.

**Timeouts** (item 14): every job now has `timeout-minutes` (10 for the quality jobs and deploy, 15 for the two Docker-building jobs, sized to what a cold Docker layer cache build realistically takes).

**Permissions** (item 15): a workflow-level `permissions: contents: read` was added — nothing here needs to write issues, packages, or PR comments, and no job overrides it upward. `write-all` is never used.

## Test Database

CI never touches production data — there is no `DATABASE_URL` pointing at anything real anywhere in `backend-quality`. The job starts a **GitHub Actions service container** (`postgres:17-alpine`), migrates it with the project's own Goose migrations, and points the tests at it via `TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/avtobirzhsi_test?sslmode=disable` — the exact environment-variable name `backend/internal/testutil/testutil.go` (Stage 6) already looks for, so no test code changed.

The credentials for this container (`postgres`/`postgres`) are not secrets — they're thrown away with the runner at the end of the job and never touch anything durable. This mirrors the local dev setup (`avtobirzhsi_test` inside the local `avtobirzhasi_postgres` container).

**Why `-p 1` specifically**: verified locally during Stage 6 that `go test ./...` (default parallel-by-package) makes the `handlers` and `service` packages' integration tests hit the *same* shared test database concurrently — this produced a real Postgres deadlock (`SQLSTATE 40P01`) on `TRUNCATE ... CASCADE` in one run, and in another run one package's truncate silently wiped out fixture rows another package's test had just inserted, surfacing as a confusing "deposit not found" failure instead of a deadlock. `go test -p 1 ./...` forces packages to run sequentially, eliminating both failure modes. This was carried into the CI step verbatim.

## Migration Safety

**Before this stage**: nobody and nothing ran migrations automatically. `backend/Dockerfile` bundles a pinned `goose` binary next to the API binary specifically so this could be done without installing Go on the VPS, but no caller ever existed — an operator had to SSH in and run it by hand, with no CI awareness of whether it had been done or whether it succeeded.

**After this stage**, the `deploy` job's SSH script gained one line, inserted between `pull` and `up -d`:

```bash
set -e
cd "${{ secrets.VPS_PATH }}"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml run --rm --entrypoint sh backend -c './goose -dir migrations postgres "$DATABASE_URL" up'
docker compose -f docker-compose.prod.yml up -d
docker image prune -f
docker compose -f docker-compose.prod.yml ps
```

- `docker compose run` creates a one-off container from the **freshly pulled** backend image (not the old, still-running one), so migrations always run from the code version about to be deployed.
- `--entrypoint sh -c '...'` is necessary because the image's real `ENTRYPOINT` is `./api`; overriding it to a shell lets `"$DATABASE_URL"` — which Compose injects into the container from the same `environment:` block the real `backend` service already uses — expand correctly *inside the container*, rather than being read from the SSH session's own (unrelated) shell environment.
- The script already had `set -e` from before this stage. That single line is what makes this a real gate: if `goose ... up` exits non-zero, the script stops immediately, the SSH action reports failure, the `deploy` job fails, and **`docker compose up -d` never runs** — the old containers keep serving the old (still-schema-compatible) code instead of being cut over to new code that might expect a schema that failed to apply.
- `goose up` is idempotent — re-running it against a database already at the latest version is a documented no-op, so a retry of a transient failure (e.g. a flaky SSH connection) is safe.
- No destructive rollback was added, per this stage's explicit scope — a failed migration blocks the deploy, it does not attempt to auto-revert the schema.

**Not verified live**: this repository has no access to the real VPS from this environment (consistent with how both prior audits flagged VPS-dependent claims as unverifiable from here). The change was verified by (a) reading the exact Compose service definition it depends on, (b) confirming `docker compose run` inherits a service's `environment:`/`depends_on` exactly as `up` does, and (c) building the real `backend/Dockerfile` locally this stage to confirm `./goose` is actually present at the path this command assumes. It has not been exercised against the production VPS itself.

## Secrets

Re-checked this stage, in addition to the pre-existing correct usage:
- Repo-wide grep for hardcoded password/secret-shaped literals and private-key headers found nothing beyond documented placeholders (`<your-dockerhub-username>`, `<generate-a-real-password>`, etc.) in the tracked `*.env.example` files.
- `git ls-files | grep -i env` shows only `.env.example`, `backend.env.example`, `backend/.env.example`, `frontend.env.example` are tracked — no real `.env`/`backend.env`/`frontend.env` is in the repository.
- No secret value was created, read, or modified by this stage — only the workflow's *use* of already-existing GitHub Secrets changed (the new `docker-build` job uses none at all; `backend-quality`/`frontend-quality` use none; `build-and-push`/`deploy` still use exactly the same seven secrets as before).
- No secret is echoed to logs anywhere in the new or existing steps.

## Failure Matrix

| Failure | Deploy |
|---|---|
| backend build | BLOCKED |
| backend vet | BLOCKED |
| backend tests | BLOCKED |
| frontend tests | BLOCKED |
| TypeScript | BLOCKED |
| lint | BLOCKED |
| frontend build | BLOCKED |
| Docker build | BLOCKED |
| migration (`goose up`) | BLOCKED (new — production containers never cut over) |
| all pass | ALLOWED |

Scenario walkthroughs (§17 of the task, logical — nothing was actually broken on purpose):

- **Scenario A — backend test fails**: `backend-quality` fails → `docker-build`, `build-and-push`, `deploy` all skip (each needs a job that never succeeded). No image is pushed, no SSH happens.
- **Scenario B — frontend test fails**: same shape via `frontend-quality`.
- **Scenario C — frontend build fails**: `npm run build` is the last step of `frontend-quality`; failing it fails the job exactly like a failing test would, same downstream skip.
- **Scenario D — Docker build fails**: `backend-quality`/`frontend-quality` may both have passed, but `docker-build` failing still blocks `build-and-push` and `deploy` — this is the scenario the old pipeline *did* already catch (a Docker build failure always failed the real push before), now caught one job earlier, before any registry credentials are used.
- **Scenario E — all gates pass**: `backend-quality` ✅, `frontend-quality` ✅, `docker-build` ✅ → `build-and-push` runs (only on a `push` to `main`) → `deploy` runs → migration step must also succeed for `up -d` to execute.

## Local Verification

Backend:
```
$ go build ./...
OK
$ go vet ./...
OK
$ TEST_DATABASE_URL=postgres://postgres:***@localhost:5435/avtobirzhsi_test?sslmode=disable go test -p 1 ./...
ok  	avtobirzhasi/backend/internal/handlers	(cached)
ok  	avtobirzhasi/backend/internal/service	(cached)
```

Frontend:
```
$ npm run test
Test Files  5 passed (5)
     Tests  33 passed (33)
$ npx tsc --noEmit
(no output — clean)
$ npm run lint
✖ 1 problem (0 errors, 1 warning)   ← pre-existing, unrelated (React Compiler note in ListingForm.tsx)
$ npm run build
✓ Compiled successfully ... 27 routes generated
```

Docker (this stage, local rehearsal of the new `docker-build` job):
```
$ docker build -t avtobirzhasi-backend:ci-verify ./backend
[exited with code 0]
$ docker build -t avtobirzhasi-frontend:ci-verify --build-arg NEXT_PUBLIC_API_URL=https://api.avtobirzhasi.kz/api ./frontend
✓ Compiled successfully, 27 routes, image exported
```
Both verification images were removed locally afterward (`docker rmi`) — they were never intended to persist.

## Files Changed

- `.github/workflows/deploy.yml` — rewritten: added `backend-quality`, `frontend-quality`, `docker-build` jobs; added `pull_request` trigger; added `needs`/`if` gating on `build-and-push` and `deploy`; added the migration step inside `deploy`'s SSH script; added workflow-level `permissions: contents: read`; added `timeout-minutes` to every job; added `concurrency` to `build-and-push`/`deploy`. The pre-existing `build-and-push`/`deploy` step content (Docker Hub login, image tags, SSH deploy target, `docker compose` commands) is otherwise unchanged.
- `STAGE7_CICD_QUALITY_GATES_REPORT.md` — this file.
- `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md` — scoped update to the Automated Testing, CI/CD, Production Readiness skill sections and the Overall Completion Score table (see next section for exactly what changed).

No application code, migration, test file, or UI file was touched.

## Remaining CI/CD Risks

- **Nothing here has actually run on GitHub's infrastructure yet** — this was all verified by (a) `yaml.safe_load`-validating the workflow's structure and job graph, (b) reproducing every command locally (`go build`/`vet`/`test`, `npm run test`/`lint`/`tsc`/`build`, both `docker build`s) with results matching what the corresponding CI step would run, and (c) reasoning through the `needs`/`if`/`concurrency` graph by hand. The first real push or PR against this workflow is the actual first live test of it.
- **The migration step has never run against the real VPS.** No VPS access exists from this environment (same limitation both prior audits flagged). If the production `backend` service's `environment:`/`depends_on` ever drifts from what's assumed here, the exact one-liner may need adjusting.
- **No post-deploy smoke test.** `docker compose ps` at the end of the SSH script shows container state but doesn't verify the API actually answers a request after cutover — a container that starts but crash-loops wouldn't fail this pipeline.
- **No automated rollback.** A bad deploy that passes all gates (i.e., a regression Stage 6's 55 tests don't happen to cover) still requires a human to re-run the workflow against an older commit or SSH in manually — Stage 7 was explicitly scoped to gates, not a rollback system.
- **CI cost/time**: the two Docker-build jobs (verification + real push) now build every image twice per push to `main` (once to verify, once for real) — `type=gha` layer caching should make the second build mostly cache hits, but this wasn't measured against GitHub's actual cache backend.
- **Backend test coverage gaps are unchanged from Stage 6** (auth service, repositories in isolation, admin/moderation/dashboard handlers, frontend components) — Stage 7 gates whatever tests exist, it does not add coverage. A regression in an untested area still ships if it doesn't break build/vet/lint/tsc.
