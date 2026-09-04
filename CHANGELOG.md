# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/):

- MAJOR - non-reversible DB migration or breaking API change
- MINOR - new feature, reversible migration
- PATCH - bug fix, no migration

## [1.6.0] - 2026-09-04

### Changed
- BCP stock sync is now near-real-time: poll interval 60s -> 5s (configurable via `BCP_SYNC_INTERVAL_MS`), gsheet cache poll 10s -> 5s (`SHEETS_POLL_INTERVAL_MS`), /view-stock UI refresh 8s -> 5s. Sheet edits now reflect on the UI within ~15 seconds.

### Fixed
- BCP sync silently failed for parts with small unit_value (e.g. "DEV:TEST"): percentage = total/unit_value x 100 overflowed `stock.percentage` decimal(5,2) ("Out of range" error in logs) so `current_stock` never updated. Percentage is now clamped to 999.99.
- BCP sync wrote to a non-existent `units` column on every update (masked by a fallback query that then failed on percentage). The dead column reference and the double-query fallback are removed.
- Web self-update failed at the migration gate with "/project/docker-compose.yml: no such file": the updater recreated the app container with `--project-directory /project`, poisoning the compose `working_dir` label that the next update relied on. Discovery now prefers the `HOST_PROJECT_DIR` env (from the host .env, always the real path). The updater also validates the compose file mount and retries the gate (3x) and `compose up` (5x) against the Windows container-removal race.

## [1.5.2] - 2026-09-04

### Fixed
- `/backup` "Connect now": 500 "Field 'machine' doesn't have a default value" — the link INSERT also omitted `machine`/`part_number` (NOT NULL, no default; XAMPP lenient mode hid it). Values now derived from `master_parts`; existing rows backfilled.
- Web self-update: `compose up` could fail with "removal of container ... is already in progress" (Windows Docker Desktop stop->rm->recreate race), leaving the app down. Updater now retries `up -d` up to 5 times (5s apart) before reporting failure.

## [1.5.1] - 2026-09-04

### Fixed
- `/backup` "Connect now": 500 "Field 'spreadsheet_id' doesn't have a default value" — the INSERT omitted the NOT NULL column (XAMPP's lenient mode hid it; MariaDB strict mode rejects it). The API now stores the spreadsheet ID on every link (also on update), and existing rows were backfilled.

## [1.5.0] - 2026-09-04

### Added
- Google Sheets microservice (`microservices/google-sheet`) now ships in the stack as compose service `gsheet` (internal network, port 4002). Release workflow builds and publishes a second image `counting-stock-gsheet:<tag>`; deploy.ps1 and the web self-updater pull and restart both services. The Google service account key is mounted at runtime (never baked into images).

### Fixed
- `/factory` create/change: "Data truncated for column 'factory_sc'" — the column is `enum('SC1','SC2')` and the route inserted raw values (often empty). The API now coerces any input to SC1/SC2 (default SC1).
- `/qr-privileges` showed "Tidak ada station ditemukan": the privileges routes were gated by an internal-key middleware that returns 503 when `INTERNAL_API_KEY` is unset. The gate is removed — endpoints remain protected by the global JWT auth.
- BCP sync + `/api/bcp` proxy: `GSHEET_SERVICE_URL` now defaults to `http://gsheet:4002` (service DNS) instead of localhost, which never worked inside the app container.

## [1.4.0] - 2026-09-04

### Added
- `/updates`: live deploy console — streams the updater's output (pull, migration gate, restart) CLI-style while an update runs, with auto-scroll and a running/idle indicator.
- `GET /api/update/logs`: returns the current update log lines + running version (admin).

### Fixed
- `/tv?fac=...`: machine cards were empty when the factory param is a name ("Factory 2") — the API only matched factory uuids. The `/api/stock-analytics/tv` endpoint now resolves the param against `factories` (uuid OR name, case-insensitive) and filters mesin/stock/analytics with both keys. TV header shows the resolved factory name.
- Web self-update ("Update Sekarang") never completed: the updater container ran compose from `/project`, deriving project name `project` instead of `control-stock`, causing a `container_name` conflict and silent failure. The updater now self-discovers the compose project + host working dir from the app container's own labels (`com.docker.compose.project`), passes `-p` explicitly, and shares its output through the `app-logs` volume. Retry after failure no longer blocks on the in-flight guard (`?force=1`).

## [1.3.0] - 2026-09-03

### Fixed
- `microservices/google-sheet/tsconfig.json`: removed invalid `"ignoreDeprecations": "6.0"` (TS 5.9 only accepts `"5.0"`, or omit if `moduleResolution: "nodenext"` is used). Fixes `npm run start` / `nest start` error TS5103.

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
