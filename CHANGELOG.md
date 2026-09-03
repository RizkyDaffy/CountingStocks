# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/):

- MAJOR — non-reversible DB migration or breaking API change
- MINOR — new feature, reversible migration
- PATCH — bug fix, no migration

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
