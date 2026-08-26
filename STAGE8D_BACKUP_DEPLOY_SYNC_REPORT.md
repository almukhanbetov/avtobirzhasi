# Stage 8D — Production Backup & Deploy Sync

Date: 2026-08-26
Branch: `main` (uncommitted working tree on top of `3ca8c1f`)
Scope: close the operational gap Stage 8C found — the backup mechanism Stage 8 built was never actually deployed to the VPS — and make infrastructure-file delivery to production deterministic. No product/business-logic/UI change.

**Important framing for this whole report**: this AI environment has no working SSH credential for the production VPS (established across Stages 8B/8C — DNS-confirmed IP `37.140.243.250`, SSH port `22122` open, but every key/username combination available locally was rejected). Everything below that requires a live production result is therefore reported as **implemented and verified as thoroughly as possible without VPS access** (local simulation, dry-run reasoning, and reuse of the exact commands already proven correct in Stage 8), clearly distinguished from what can only be confirmed once this is actually pushed and deployed.

## Current Deployment Architecture

Confirmed by reading `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, and Stage 8C's operator-reported findings — not assumed:

```
GitHub (push to main)
  ↓
backend-quality / frontend-quality / docker-build   (Stage 7 gates)
  ↓
build-and-push: docker build/push backend+frontend images → Docker Hub
  ↓
deploy (SSH to VPS):
    docker compose -f docker-compose.prod.yml pull    ← pulls IMAGES only
    docker compose -f docker-compose.prod.yml run ... goose ... up
    docker compose -f docker-compose.prod.yml up -d
```

- `docker-compose.prod.yml` on the VPS: **placed there once, manually, at initial setup** — nothing in the pipeline ever updated it. Confirmed by Stage 8C: the operator found it lacked Stage 8's healthcheck blocks until checked directly.
- `scripts/`: **did not exist on the VPS at all** before this stage — confirmed directly by Stage 8C (`scripts/backup-db.sh on VPS: NOT PRESENT / NOT EXECUTABLE`).
- Caddy config: still a manual, human-merged snippet (`Caddyfile.avtobirzhasi`) — unrelated to the Docker deploy pipeline entirely, out of this stage's scope beyond a documentation clarification (see Caddy/Internal Verification below).
- Whether `$VPS_PATH` is a git checkout: **unknown, and deliberately not assumed.** The task explicitly says not to `git pull` unless it's confirmed to be one, and no VPS access exists to confirm it either way — so this stage does not rely on git at all on the server side, sidestepping the question entirely.

**Root cause**: the deploy job was built (correctly, for what it does) to treat the VPS as a Docker Compose target — pull images, run migrations, restart containers. It was never built to treat the VPS as a deployment target for *repository files themselves*. Every one of Stage 8's operational improvements that lives in a file rather than in the Docker image (the compose healthchecks, the backup scripts) inherited this blind spot silently.

## Infrastructure Sync

**New**: a `Sync infrastructure files to VPS` step, added to the `deploy` job in `.github/workflows/deploy.yml`, immediately before the existing `Deploy over SSH` step and gated by the exact same `needs`/`if`/`concurrency` (so it only ever runs on a real push-to-main deploy, never a PR):

```yaml
- name: Checkout
  uses: actions/checkout@v4

- name: Sync infrastructure files to VPS
  uses: appleboy/scp-action@v1.0.0
  with:
    host: ${{ secrets.VPS_HOST }}
    port: ${{ secrets.VPS_PORT }}
    username: ${{ secrets.VPS_USER }}
    key: ${{ secrets.VPS_SSH_KEY }}
    source: |
      docker-compose.prod.yml
      scripts/backup-db.sh
      scripts/restore-db.sh
    target: ${{ secrets.VPS_PATH }}
    overwrite: true
```

Design choices, deliberately:
- **`scp`, not `git pull` or a fresh checkout** — per the task's explicit constraint. `appleboy/scp-action` (same author/family as the `appleboy/ssh-action` already used in this file, so no new unfamiliar dependency) tars up exactly the given paths, preserving `scripts/`'s relative structure, and extracts them at `target` — it does not need `$VPS_PATH` to be a git repository at all, sidestepping that unknown entirely.
- **Exactly 3 files, named explicitly** — `docker-compose.prod.yml`, `scripts/backup-db.sh`, `scripts/restore-db.sh`. Nothing else: no `.env`/`backend.env`/`frontend.env` (those live only on the VPS and are correctly never in the repo), no test files, no source code, no `Caddyfile.avtobirzhasi` (Caddy is intentionally still a separate, human-merged concern — see below).
- **Uses the same 4 secrets** (`VPS_HOST`/`VPS_PORT`/`VPS_USER`/`VPS_SSH_KEY`) already used by the SSH deploy step — no new secret was created or requested.
- **Failure is visible by construction** (task item 15): this is a normal GitHub Actions step with no `continue-on-error`. If the SCP transfer fails for any reason (auth, network, disk full, permissions), the step fails, the job fails, and — because it runs *before* `Deploy over SSH` — the subsequent SSH step (and therefore `docker compose up -d`) never runs at all. A failed sync cannot silently continue into a deploy using stale files.

## Backup Script Deployment

The `Deploy over SSH` step now begins with:
```bash
cd "${{ secrets.VPS_PATH }}"
chmod +x scripts/backup-db.sh scripts/restore-db.sh
```
Since the sync step above already placed fresh copies there in the same job run, this line's only job is to guarantee the executable bit survives the transfer (scp/tar can be inconsistent about preserving file modes depending on the source filesystem) — cheap, idempotent, safe to run every deploy.

**Not yet verified live**: this literally cannot be confirmed to have worked until the workflow actually runs against the real VPS. See Files Changed / Remaining Production Risks for what happens next.

## Production Backup Creation

Added to the end of the `Deploy over SSH` script, after the containers are back up:
```bash
mkdir -p backups
BACKUP_DIR=./backups RETENTION_DAYS=14 ./scripts/backup-db.sh
LATEST_BACKUP=$(ls -t ./backups/avtobirzhasi_*.sql.gz 2>/dev/null | head -1)
if [ -z "$LATEST_BACKUP" ] || [ ! -s "$LATEST_BACKUP" ]; then
  echo "ERROR: no non-empty backup file found after backup-db.sh ran" >&2
  exit 1
fi
echo "Backup verified: $LATEST_BACKUP ($(du -h "$LATEST_BACKUP" | cut -f1))"
```
This means **every future production deploy produces and verifies a real backup as part of the deploy itself**, not just installs a mechanism that might run later unobserved — and because it's inside the same `set -e` script, a backup that silently produced an empty or missing file **fails the deploy job visibly**, satisfying task item 15 for this specific step too.

This exact `mkdir`/`BACKUP_DIR=.../backup-db.sh`/`ls -t`/non-empty-check sequence was dry-run against the local dev database this stage (not production — no VPS access):
```
$ BACKUP_DIR=<scratch dir> RETENTION_DAYS=14 ./scripts/backup-db.sh
Backing up database 'avtobirzhsi_db' -> <scratch dir>/avtobirzhasi_20260826T114300Z.sql.gz
Backup written: ... (12K)
$ LATEST_BACKUP=$(ls -t <scratch dir>/avtobirzhasi_*.sql.gz | head -1)
Backup verified: <scratch dir>/avtobirzhasi_20260826T114300Z.sql.gz (12K)
```
Status: **mechanism PASS (local rehearsal); production execution NOT VERIFIED until this deploys.**

## Restore Verification

Not re-run this stage. `scripts/restore-db.sh` is unchanged from Stage 8, where it was already verified end-to-end (backup → restore into a scratch database → schema check → drop the scratch database) against local dev data, including its refusal to target the real database name. Per this task's own guidance ("не рисковать production ради PASS"), an automatic restore-into-scratch-DB step was deliberately **not** added to every production deploy — doing so would run an extra, non-trivial operation (creating and dropping a database inside the production Postgres instance) on every single deploy for a check that doesn't need that frequency, and this AI environment has no way to observe its output if something went subtly wrong on the actual production data. Restore verification against the actual first production backup this pipeline produces is a reasonable one-off follow-up (same `scripts/restore-db.sh <dump> <scratch-name>` command Stage 8 already used locally), better done once by a human who can watch it directly, than automated blindly.

Status: `NOT VERIFIED` (deliberately, not by oversight) — does not block Stage 9 per this task's own criteria.

## Backup Retention

Unchanged from Stage 8 — re-confirmed by reading `scripts/backup-db.sh` again this stage:
```bash
find "$BACKUP_DIR" -maxdepth 1 -name 'avtobirzhasi_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete
```
`-maxdepth 1` (never descends into subdirectories) plus the `avtobirzhasi_*.sql.gz` name glob (can only ever match files this same script created) together guarantee this can never touch anything outside its own backup directory, and specifically can never touch `/var/backups/dpkg.*` or any other system backup path noted in Stage 8C's findings — those live in a completely different directory (`/var/backups`) that this script never references at all. `RETENTION_DAYS=14` is set explicitly in both the new cron line and the new immediate-backup-after-deploy call. Code-level: **PASS**. Live pruning behavior on the VPS: not yet observable (needs 14+ days of real daily backups to exercise the delete path for real).

## Backup Schedule

**New** — added to the `Deploy over SSH` script, installed/refreshed idempotently on every deploy:
```bash
BACKUP_CRON_MARKER="avtobirzhasi-backup (managed by .github/workflows/deploy.yml)"
BACKUP_CRON_LINE="0 3 * * * cd ${{ secrets.VPS_PATH }} && PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin BACKUP_DIR=${{ secrets.VPS_PATH }}/backups RETENTION_DAYS=14 ./scripts/backup-db.sh >> ${{ secrets.VPS_PATH }}/backups/backup.log 2>&1 # $BACKUP_CRON_MARKER"
( crontab -l 2>/dev/null | grep -vF "$BACKUP_CRON_MARKER" ; echo "$BACKUP_CRON_LINE" ) | crontab -
crontab -l | grep -qF "$BACKUP_CRON_MARKER"
```
Design:
- **Per-user crontab, not a systemd timer.** The task allowed either ("допустим cron, если это проще и безопаснее"); a systemd timer would need to know the VPS user's sudo/systemd-management privileges, which are unknown from CI, while per-user crontab needs none beyond what already runs `docker compose` today.
- **Daily at 03:00 server time** — a plain, non-aggressive frequency, matching the task's "не придумывай агрессивную частоту."
- **Idempotent and non-destructive to unrelated cron state**: only the one line carrying the exact marker comment is ever stripped before being re-added; nothing else in the user's crontab is read, modified, or reordered. This is the standard, well-established `crontab -l | grep -v MARKER; echo NEWLINE | crontab -` idiom — real `crontab` reads all of stdin into a buffer before writing anything (an atomic replace), so it does not race with itself the way a naive `sort file > file` would.
- **The last line is a hard assertion**: if the marker isn't present in the crontab immediately after the install, the script exits non-zero (via `set -e`, since `grep -q` returns failure), and the whole deploy is reported as failed rather than silently leaving no schedule installed.

This exact sequence (marker stripping, idempotent re-add, unrelated-entry preservation, final assertion) was dry-run tested this stage against a faithful local simulation of `crontab -l`/`crontab -` semantics (buffer-then-write, matching real crontab's actual behavior — an earlier, naive fake using a plain `cat > file` was caught losing unrelated entries due to a read/write race, and was corrected before trusting the design):
```
run 1: installs the line, unrelated pre-existing cron entry untouched
run 2 (simulating a second deploy): marker count stays at 1 (no duplicate),
        unrelated entry still present
```
Status: **logic PASS (locally simulated); live installation on the VPS NOT VERIFIED until this deploys.**

## Backup Logging

- **Success/failure signal**: `backup-db.sh`'s own exit code (`0` = wrote a file and pruned; non-zero = failed, e.g. `pg_dump` erroring) is what both the immediate post-deploy check and the daily cron rely on — the immediate check turns a bad exit into a failed, visible deploy; the cron redirects stdout+stderr to `${VPS_PATH}/backups/backup.log` (`>> ... 2>&1`), so a failed 03:00 run leaves a readable trace an operator can `tail`.
- No new logging/observability stack was added, per the task's explicit "не нужен новый observability stack" — this is exit-code-plus-a-log-file, nothing more.

## Off-host Backup

```
NOT IMPLEMENTED
```
Unchanged, deliberately — no cloud/object-storage provider was introduced this stage, per the task's explicit instruction. Recorded as a separate, standing production risk (see below), and per the task's own stated criteria this alone does not block Stage 9.

## Caddy / Internal Verification

Per the task's instruction to document, not rewrite: `Caddyfile.avtobirzhasi`'s comment on the `/internal/*` block was updated to accurately reflect Stage 8C's finding — the backend's own `LocalOnly()`/`Auth()`/`AdminOnly()` chain was directly confirmed on production (Stage 8C) to independently return the correct 401/403 responses regardless of this Caddy block's own live-merge state. The Caddy rule itself is **unchanged** (still `handle /internal/* { respond 404 }`) — only its accompanying comment was corrected to stop overstating it as the sole safeguard, and to point at where the real evidence lives. No Caddy config, no RBAC code, was rewritten. Per the task's explicit rule — "если backend RBAC работает независимо от Caddy — считать security requirement выполненным" — this item is treated as **closed**.

## CI/CD Regression

Confirmed by parsing the updated `.github/workflows/deploy.yml`:
```
backend-quality:    needs=None,                                    unchanged
frontend-quality:   needs=None,                                    unchanged
docker-build:       needs=[backend-quality, frontend-quality],     unchanged
build-and-push:     needs=[backend-quality, frontend-quality, docker-build], if=push&&main, unchanged
deploy:             needs=build-and-push,                          if=push&&main, unchanged
```
The two new steps (`Checkout`, `Sync infrastructure files to VPS`) were added *inside* the existing `deploy` job, which still `needs: build-and-push` exactly as before — they do not create a new job, do not change any `needs` edge, and do not loosen any `if` condition. A PR still never reaches this job at all. **PASS — Stage 7's gates are unweakened.**

## Local Verification

Backend (unchanged this stage — confirms nothing regressed):
```
$ go build ./...      clean
$ go vet ./...         clean
$ go test -p 1 ./...   ok: internal/handlers, internal/service (22 tests, unchanged)
```
Frontend (unchanged this stage):
```
$ npm run test    Test Files 5 passed, Tests 33 passed
$ npx tsc --noEmit    clean
$ npm run lint    0 errors, 1 pre-existing unrelated warning
$ npm run build   27 routes, succeeds
```
Workflow YAML: `python3 -c "import yaml; yaml.safe_load(...)"` — valid; job graph re-printed and matches the table above exactly.

## Remaining Production Risks

- **Nothing in this stage has been exercised against the real VPS.** Every "PASS" above for the new sync/backup/cron logic is a local simulation or a dry run against dev data, chosen specifically to be as faithful as possible to what will really happen (down to correcting a race-condition bug found in the first draft of the cron test harness) — but the actual first live test is the next real push to `main`. Until then, `docker-compose.prod.yml` on the VPS still lacks Stage 8's healthchecks and `scripts/` still doesn't exist there — Stage 8D is implemented, not yet deployed.
- **This commit has not been pushed.** Exactly as with Stage 7 and Stage 8B, this AI environment has no working git-push credential for this repository — a human needs to commit and push before any of this takes effect, and before the next deploy's job status (checkable via the same public GitHub API technique used in Stage 8B, without needing VPS access) can confirm the sync/backup/cron steps actually succeeded for real.
- **No off-host backup destination.** A full VPS/disk failure would still take local backups with it. Deliberately out of scope this stage.
- **Restore has not been verified against an actual production-produced backup file** (only against dev data, in Stage 8) — recommended as a human-supervised one-off after the first real production backup exists, not as an automated per-deploy step.
- **14 days haven't passed yet** — the retention `find ... -delete` logic is code-verified but has never actually deleted a real file in production (nothing is old enough to prune yet).
- Every product-completeness gap already listed in `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md` remains untouched — this stage is backup/deploy-sync infrastructure only.

## Files Changed

- `.github/workflows/deploy.yml` — added `Checkout` + `Sync infrastructure files to VPS` (`appleboy/scp-action@v1.0.0`) steps to the `deploy` job; extended `Deploy over SSH`'s script with `chmod +x` on the backup scripts, idempotent daily-backup cron installation, and an immediate post-deploy backup-and-verify step. `needs`/`if`/`concurrency` on every job unchanged.
- `Caddyfile.avtobirzhasi` — comment-only correction on the `/internal/*` block, no rule change.
- `STAGE8D_BACKUP_DEPLOY_SYNC_REPORT.md` — this file.
- `AVTOBIRZHASI_PROJECT_COMPLETION_AUDIT.md` — scoped update (see below).

No application code, no migration, no test file, no UI file.

---

## Live Verification (2026-08-26, post-push)

The first push of this stage's `deploy.yml` (commit `63e81cb`) **failed** on the new `Sync infrastructure files to VPS` step: `tar: Cowardly refusing to create an empty archive`. Root cause: `appleboy/scp-action`'s underlying tool (`drone-scp`) parses its `source` input as a `urfave/cli` `StringSlice` sourced from an environment variable, which splits on `,` by default — **not** on newlines. The original YAML used a multi-line block (`source: |` with one path per line), which arrives at the tool as one single string containing literal `\n` characters — an invalid path/glob that matches nothing, so `tar` had zero files to archive.

**Reproduced exactly, then fixed, before pushing again**: downloaded the real `drone-scp v1.8.0` Linux binary locally and ran it directly with `INPUT_SOURCE` set both ways —
```
newline-joined  → tar: Cowardly refusing to create an empty archive   (reproduces the CI failure exactly)
comma-joined    → tar succeeds; ssh connection attempted next (fails only on the fake host/key used for this local test)
```
and confirmed the fixed, comma-joined form (`source: "docker-compose.prod.yml,scripts/backup-db.sh,scripts/restore-db.sh"`) produces a tar archive containing exactly the 3 intended files with `scripts/`'s relative directory preserved:
```
$ tar -tzf <archive>
docker-compose.prod.yml
scripts/backup-db.sh
scripts/restore-db.sh
```
Fixed in commit `40f579f` and pushed. **Real GitHub Actions run, commit `40f579f`** (https://github.com/almukhanbetov/avtobirzhasi/actions/runs/32966975734), **all 5 jobs succeeded**:

| Job | Conclusion |
|---|---|
| Backend Quality | success |
| Frontend Quality | success |
| Docker Build Verification | success |
| Build & Push Images | success |
| Deploy to Production | success — both `Sync infrastructure files to VPS` and `Deploy over SSH` steps succeeded |

`Deploy over SSH` succeeding is itself strong evidence the embedded backup-verification assertion passed (`set -e` plus an explicit `exit 1` on a missing/empty backup file would have failed this exact step otherwise) — but this was independently confirmed directly on the VPS by the operator, not just inferred from job status:

```
Infrastructure sync:            PASS
backup-db.sh deployed:          PASS
restore-db.sh deployed:         PASS
Production backup creation:     PASS — /var/www/avtobirzhasi/backups/avtobirzhasi_20260826T125104Z.sql.gz
Backup archive integrity:       PASS — gzip -t exit code 0
Manual backup script exit code: 0
Backup logging:                 PASS — backup.log shows successful creation + retention pruning
Backup schedule:                PASS — cron entry installed for the avtobirzhasi backup marker
Retention:                      PASS — configured for 14 days
Off-host backup:                NOT IMPLEMENTED (unchanged, explicitly non-blocking)
```

This closes every item this stage set out to close except off-host backup, which was explicitly out of scope. **Stage 8D is complete and confirmed live**, not just implemented.

No `git commit`/`git push` was performed *by this AI session* beyond what the user explicitly directed and executed themselves — see this stage's conversation history for the exact commit/push/verify sequence.
