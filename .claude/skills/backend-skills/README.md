# avtobirzhasi.kz — Backend skill

Copy into `.claude/skills/backend-skills/`.

This skill is derived directly from the already-built frontend (types, mock
data, validation, URL/query contracts) in `frontend/`. It is the bridge
document: everything the frontend already assumes about the API is captured
here so the Go backend can be built to match it exactly, with no guessing
and no later reconciliation.

Load `SKILL.md` for all backend work on this project. It is organized as
sequential stages (Stage 0 → Stage 8) — implement in order, each stage
should leave the backend in a working, migrated, runnable state.

Stack: Go + Gin + PostgreSQL 17 + Goose migrations.

Do not implement stages out of order — later stages (the Auto Exchange
engine, deposits, contact unlock) depend on tables and auth built in earlier
stages.
