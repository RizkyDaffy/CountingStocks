import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawn } from "child_process";
import { existsSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = __dirname;
const IS_PROD = process.env.NODE_ENV === "production";
const BACKEND_SRC = resolve(APP_DIR, "server", "index.ts");
const FRONTEND_DIST = resolve(APP_DIR, "dist", "server", "assets", "worker-entry-*.js");
const SSR_ENTRY = resolve(APP_DIR, "server", "ssr-node.mjs");
const SSR_BUILD = resolve(APP_DIR, "dist", "server", "server.js");

function isHttpAccessLog(line) {
  try {
    const obj = JSON.parse(line.trim());
    return (
      typeof obj.timestamp === "string" &&
      typeof obj.method === "string" &&
      typeof obj.path === "string" &&
      typeof obj.status === "number"
    );
  } catch {
    return false;
  }
}

function spawnProcess(label, cmd, args, opts = {}) {
  const child = spawn(cmd, args, {
    cwd: APP_DIR,
    stdio: ["inherit", "pipe", "pipe"],
    shell: true,
    env: { ...process.env },
    ...opts,
  });

  child.stdout.on("data", (chunk) => {
    const filtered = chunk
      .toString()
      .split("\n")
      .filter((line) => !isHttpAccessLog(line))
      .join("\n");
    if (filtered.trim().length > 0) {
      process.stdout.write(`[${label}] ${filtered.trimEnd()}\n`);
    }
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[${label}] ${chunk.toString().trimEnd()}\n`);
  });

  child.on("error", (err) => {
    console.error(`[guardian] Failed to spawn ${label}: ${err.message}`);
    process.exit(1);
  });

  child.on("close", (code) => {
    console.log(`[guardian] ${label} exited with code ${code}.`);
    process.exit(code ?? 0);
  });

  return child;
}

const api = spawnProcess("api", "npx", ["tsx", BACKEND_SRC]);

if (IS_PROD && existsSync(SSR_BUILD)) {
  spawnProcess("ssr", "node", [SSR_ENTRY], {
    env: {
      ...process.env,
      PORT: process.env.SSR_PORT || "3000",
    },
  });
} else if (IS_PROD) {
  console.warn(`[guardian] Production mode but ${SSR_BUILD} not found.`);
  console.warn("[guardian] Run `npm run build` before starting in production.");
}

function shutdown(signal) {
  console.log(`[guardian] Received ${signal}, shutting down…`);
  api.kill(signal);
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
