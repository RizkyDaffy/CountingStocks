# ── Stage 1: Builder ─────────────────────────────────────────────────────────
# Full Node + all devDependencies needed to compile TypeScript and bundle Vite.
FROM node:22-alpine AS builder

WORKDIR /app

# Install deps first (layer-cached unless package*.json changes)
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY . .

# Build the Vite SSR bundle (outputs to dist/)
RUN npm run build

# ── Stage 2: Production runner ────────────────────────────────────────────────
# Slim image — no devDependencies, no source, no build tooling.
FROM node:22-alpine AS runner

WORKDIR /app

# Install only production deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# Copy the compiled artifacts from the builder stage
COPY --from=builder /app/dist ./dist

# Copy the Express API server source (run with tsx at runtime)
# tsx is listed as a devDep so we need it explicitly — copy from builder
COPY --from=builder /app/node_modules/.bin/tsx /usr/local/bin/tsx
COPY --from=builder /app/node_modules/tsx ./node_modules/tsx
COPY microservices/server ./microservices/server
COPY microservices/services ./microservices/services

# Copy the process manager that boots both servers
COPY guardian.js ./guardian.js

# Copy env example as reference (actual secrets come from docker-compose / runtime env)
COPY .env.example .env.example

# Expose ports
# 3000 = Vite SSR / TanStack Start (frontend)
# 4000 = Express API server (backend)
EXPOSE 3000 4000

# Health-check — pings the Express health endpoint every 30 s
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:4000/api/health || exit 1

# Run both servers via the project's own guardian.js process manager
CMD ["node", "guardian.js"]
