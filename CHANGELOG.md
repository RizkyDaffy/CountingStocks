# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/):

- MAJOR — non-reversible DB migration or breaking API change
- MINOR — new feature, reversible migration
- PATCH — bug fix, no migration

## [1.2.0] - 2026-09-03

### Added
- Self-update: "Update Sekarang" (banner + `/updates`) now pulls the newest release image and restarts the service automatically (admin only), instead of only reloading the page.
- New API endpoint `POST /api/update/run`: spawns a one-shot updater container (docker socket + host project dir) that runs pull, migration gate, and `docker compose up -d --no-build`.
- Progress feedback while updating (downloading / restarting), with health-poll until the new version is live.

### Changed
- `docker-compose.yml`: mounts `/var/run/docker.sock` and passes `HOST_PROJECT_DIR` (required for self-update).

### Fixed
- Removed unused IRIS SDK dependency (file:.iris-tmp) and its CI workflow clone steps.
- CI lint failures: `eslint --fix` + rule downgrades (`no-explicit-any`, `no-empty` to warn).
- `scripts/extract-changelog.js`: ESM import + accepts `v`-prefixed tags; release heredoc is now failure-tolerant.
- `.dockerignore`: excludes nested node_modules, `microservices/google-sheet` (was shipping 300MB+ into the build context), `brain/`, `.iris-tmp`.
- `scripts/deploy.ps1` v2: pulls image by full name (compose pull skipped buildable services), distinguishes gate refusal from infra failure, `--no-build` on restart.

## [1.1.0] - 2026-09-03

### Added
- New "Version & Update" page (`/updates`): shows installed version, update availability, last check time, new version details, and full release history.
- "Version & Update" entry in the Management sidebar section.
- Manual "Periksa Update" (check for update) action on the updates page.

## [1.0.0] - 2026-09-02

### Added
- Versioning baseline: app version exposed via `/api/health` (`version` field).
- Release manifest endpoint `/api/releases` (GitHub Releases, 5-minute cache).
- Client update banner: notifies users when a newer version is deployed, with changelog viewer and "later" dismiss.
- Release pipeline: GitHub Actions builds and publishes Docker image to GHCR on `v*` tags.
- Deployment script `scripts/deploy.ps1` with migration gate and health verification.
- Migration gate `migrations/schema-gate.ts` tracking applied versions in `schema_migrations` table; refuses to start against a newer database (rollback safety).

### Fixed
- `Dockerfile` now copies `guardian.js` (previously referenced a file not tracked in git).
- `migrations/` folder is now tracked in git; `npm run migrate*` scripts point to the correct paths.
- Database name default unified to `outindb` across `docker-compose.yml`, `db.ts`, and `config.ts` (single source of truth: `DB_NAME` env).
- `.env.example` and `.dockerignore` are now tracked so CI builds from a clean checkout succeed.
