# R.I.S.K.I Gate & Sugity Production Stock Scanner — Maintenance & Engineering Notes

This document consolidates all essential developer context, hardware workflow specifications, architecture guidelines, and migration instructions extracted from code comments across the repository. All code files have been stripped of comments to maintain clean, zero-noise source files. Refer to this guide for maintenance, upgrades, and onboarding.

---

## 1. System Architecture & @betogate Microservices

### Dual-Server Architecture
- **Main Backend (`server/index.ts`)**: Runs on Express (port configurable via `API_PORT`, default `4000`). Handles authentication, database queries, business logic, and core API routing.
- **Gate Microservice (`services/gate/server.ts`)**: A self-contained, additive Node.js microservice managing hardware communication. It operates two servers concurrently:
  1. **TCP Server (Port `4000` / `GATE_TCP_PORT`)**: Accepts persistent socket connections from field ESP32 units. Uses a 30s server-side keepalive ping and 90s dead-device assumption window.
  2. **HTTP API Server (Port `4001` / `GATE_HTTP_PORT`)**: Accepts internal command dispatches from the main backend and serves the Admin UI on `0.0.0.0` across all interfaces.
- **SSR Bridge (`server/ssr-node.mjs`)**: Minimal HTTP listener bridging the runtime-agnostic TanStack Start web-fetch handler (`dist/server/server.js`) to Node.js socket listeners. Strips `Origin`/`Referer` headers so internal proxied traffic is processed cleanly as same-origin server-to-server calls.

### Post-Scan Dispatch Hooks (`services/gate/gateHook.ts`)
- **Fire-and-Forget Policy**: Post-scan dispatch hooks are strictly additive and asynchronous (`setImmediate`). They **never throw**, **never block execution**, and **never alter** scan responses returned to the client.
- **Integration**: Called inside `qr.ts` only *after* `res.json()` has completed. Supports:
  - `dispatchToGateService({ qr_code_id: string })`: v3 flat dispatch (retained for legacy backward compatibility).
  - `triggerMachineWebhook({ machine_code, qr_code_id })`: v4 primary dispatch path.

### In-Memory IoT Scan Store (`server/routes/iotState.ts`)
- **Retrospective Scan State**: Lightweight memory store tracking in-flight gate open commands without TCP lock-in. Shape: `webhookPath -> { scanned: boolean, ts: number, resetTimer }`.
- **Hardware Polling**: ESP32 units poll `GET /iot/:mc/:qr` every 500ms to detect rising edges. Endpoints are public without JWT authorization since field ESP32 devices cannot negotiate tokens. Once processed, devices POST to `/iot/:mc/:qr/reset` to acknowledge and clear state. A TTL safety-net auto-resets unacknowledged scans.

---

## 2. Firmware & Hardware Specification (`firmware/esp32.ino`)

### R.I.S.K.I Gate v6.4.2 (Japanese Operational Spec)
- **ASCII & Romaji Naming Policy (`ponytail`)**: All program logic identifiers (variables, struct functions, enum states, constants) are written in strict ASCII Romaji (e.g., `sukyanShori`, `uebbuhukkuPooringuJikkou`, `JOUTAI_NINSHOU_ZUMI`). This avoids UTF-8 encoding failures across legacy Arduino compiler toolchains. Japanese script (Kanji/Hiragana/Katakana) is strictly restricted to serial console output and string literals.
- **Workflow & Relay Rules**: 
  - **Flow A**: Disabled (markdowned in code for reference). Do not re-enable without revising state machine timing.
  - **Flow B (Normal Cycle)**: 
    1. *No Pallet*: Limit switch (LS) not pressed; pallet is external.
    2. *Standby*: LS pressed; pallet seated, awaiting operator pull.
    3. *Pull & Alarm*: LS released; hardware alarm sounds immediately (alarm circuit is isolated and managed entirely by the hardware engineering team).
    4. *Scan Verification*: Operator scans part QR. System emits a **5-second relay pulse** (`JOUTAI_NINSHOU_ZUMI`). The hardware team's external controller monitors this 5s rising edge to silence the alarm and reset the workflow cycle.
  - **Flow C**: Pallet removed safely without error; system waiting for return cycle.
- **Silent HTTP Polling**: ESP32 polls server endpoints every 500ms (`HTTP_POORINGU_KANKAKU_MS`). At 115200 baud, calling `Serial.print` 4–5 times per second causes UART TX buffer saturation and CPU stuttering. Console logging during polling is suppressed by `HTTP_DEBAGGU_SHOUSAI` (defaults to `false`). Set to `true` exclusively during staging bench diagnostics.
- **Multi-QR Capacity**: Target QR IDs (`listen_qrs`) are stored in NVS as comma-separated strings. Current standard operating procedures cap maximum QRs per device (`SAIDAI_JUSHIN_QR_SUU`) at **8**. If station requirements exceed 8 parts per machine, dynamic memory allocation must be integrated into the scanner parsing loop.

---

## 3. Database Migrations & Security Infrastructure

### Migration Pattern (`server/migrate*.ts`)
- Migrations adhere to an **additive-only** design philosophy to prevent production locks:
  - `migrate-v2.ts`: Introduces `master_parts.machine` column and enforces unique key indexing on `stock_analytics`.
  - `migrate-v4.ts`: Backfills `part_id` across historical records by matching `part_name` case-insensitively.
- **Privilege Replacement Strategy**: QR privilege reassignments (`server/routes/privileges.ts`) operate via an atomic replacement transaction: existing access rows are wiped and replaced in a single BEGIN/COMMIT block to prevent race conditions.

### Security, Auth & Rate Limiting
- **Client-Side Auth (`src/lib/auth.ts`)**: Token handling runs natively via `localStorage` and built-in browser `atob()` decoding without heavy external dependencies.
- **Rate Limiting (`server/middleware/rateLimiter.ts`)**: Applied prior to login routing. If an IP triggers lockout (`≥ MAX_ATTEMPTS`), requests terminate immediately with an HTTP `429 Too Many Requests` and a `Retry-After` header. Successful logins (`200 OK`) clear accumulated penalty counters.
- **CORS & Origins (`server/middleware/securityMiddleware.ts`)**: Configure `ALLOWED_ORIGINS` in `.env` (comma-separated, e.g., `https://domain.com,http://192.168.1.100:3000`). Requests lacking origin headers (mobile clients, local cURL, loopback calls) are permitted by default as same-origin traffic.

---

## 4. Frontend Application Logic (Vite + TanStack Router)

### Dual-Portal Routing & Optimization (`src/routes/index.tsx`)
- **Lazy Landing Portal**: Unauthenticated visitors are presented with a lightweight, lazy-loaded production showcase (Resin Production System & Workstation Terminal). Authenticated station operators bypass rendering overhead and route immediately into `StockScan`.
- **Dynamic QR Dropdowns**: When a QR code is deleted or claimed, React Query invalidates the `qr-codes` cache, triggering automatic reconstitution of available part option Sets across master data selectors.
- **Camera FPS & Debounce Fixes (`src/routes/scan.tsx`)**: Camera hardware scanning at 25fps previously caused multi-firing events (up to 24 duplicate API calls per physical scan) and misidentified forced OUT events as IN. Strict debouncing and directional lock flags guarantee exact single-execution scan counts.
- **Linting Constraints (`eslint.config.js`)**: Contains strict programmatic formatting overrides for TanStack generated routes (`routeTree.gen.ts`). Maintain configuration integrity during automated routine updates.
