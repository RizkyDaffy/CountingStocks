import { Router, type Request, type Response, type NextFunction } from "express";
import http from "node:http";
import fs from "node:fs";
import { APP_VERSION } from "../version.js";

const router = Router();

const REGISTRY = process.env.REGISTRY?.trim() || "ghcr.io/rizkydaffy/counting-stock";
const GITHUB_REPO = process.env.GITHUB_REPO?.trim() || "RizkyDaffy/CountingStocks";
const SWAPPER_IMAGE = "docker:cli";
const DOCKER_SOCKET = "/var/run/docker.sock";
const UPDATE_LOG = "/app/logs/update.log";
const IN_FLIGHT_TIMEOUT_MS = 10 * 60_000;

let inFlight: { targetImage: string; startedAt: number } | null = null;

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "admin") {
    return res
      .status(403)
      .json({ success: false, error: "Forbidden: hanya admin dapat memperbarui" });
  }
  next();
}

function dockerRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const payload = body === undefined ? null : JSON.stringify(body);
    const req = http.request(
      {
        socketPath: DOCKER_SOCKET,
        path,
        method,
        headers: { Host: "docker", ...(payload ? { "Content-Type": "application/json" } : {}) },
      },
      (res) => {
        let text = "";
        res.on("data", (chunk: Buffer) => (text += chunk.toString()));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
      },
    );
    req.setTimeout(10 * 60_000, () => req.destroy(new Error("Docker API request timed out")));
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function dockerPullImage(name: string, tag: string): Promise<void> {
  const res = await dockerRequest(
    "POST",
    `/images/create?fromImage=${encodeURIComponent(name)}&tag=${encodeURIComponent(tag)}`,
  );
  if (res.status >= 400) {
    throw new Error(`Gagal pull image ${name}:${tag} (Docker API ${res.status})`);
  }
  if (res.text.includes('"error"')) {
    throw new Error(`Gagal pull image ${name}:${tag}: ${res.text.slice(0, 500)}`);
  }
}

async function latestReleaseTag(): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=1`, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "counting-stock",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API responded ${res.status}`);
  }
  const raw: Array<Record<string, unknown>> = await res.json();
  if (raw.length === 0 || typeof raw[0].tag_name !== "string") {
    throw new Error("Tidak ada GitHub Release yang terbit");
  }
  return raw[0].tag_name;
}

// Discover the compose project + host working dir of THIS container.
// Priority: HOST_PROJECT_DIR env (set from the host .env via compose - always
// the real host path) over container labels. Labels get poisoned: the updater
// recreates this container with `--project-directory /project`, so the stored
// working_dir label becomes "/project", which is not a valid host path.
async function composeContext(): Promise<{ project: string; workingDir: string }> {
  const dir = process.env.HOST_PROJECT_DIR?.trim();
  if (dir) {
    return {
      project: process.env.COMPOSE_PROJECT_NAME?.trim() || "control-stock",
      workingDir: dir,
    };
  }
  try {
    const cid = process.env.HOSTNAME || "";
    if (!cid) throw new Error("HOSTNAME kosong");
    const res = await dockerRequest("GET", `/containers/${cid}/json`);
    if (res.status >= 400) {
      throw new Error(`Docker API ${res.status}`);
    }
    const labels = (JSON.parse(res.text) as { Config?: { Labels?: Record<string, string> } }).Config
      ?.Labels;
    const project = labels?.["com.docker.compose.project"];
    const workingDir = labels?.["com.docker.compose.project.working_dir"];
    if (!project || !workingDir) throw new Error("label compose tidak ada");
    return { project, workingDir };
  } catch {
    throw new Error(
      "Tidak bisa menemukan project compose. Set HOST_PROJECT_DIR di .env server lalu jalankan deploy.ps1.",
    );
  }
}

async function spawnUpdater(
  targetImage: string,
  project: string,
  workingDir: string,
): Promise<string> {
  const containerName = `counting-stock-updater-${Date.now()}`;
  // Windows hosts: label paths use backslashes; bind sources want forward slashes.
  const hostProjectDir = workingDir.replace(/\\/g, "/");

  await dockerPullImage("docker", "cli");

  const tag = targetImage.split(":").pop() as string;
  const gsheetImage = `${REGISTRY}-gsheet:${tag}`;
  const composeArgs = `-p '${project}' --project-directory /project -f /project/docker-compose.yml`;
  const script = [
    "set -e",
    "LOG=/logs/update.log",
    `export IMAGE='${targetImage}' GSHEET_IMAGE='${gsheetImage}'`,
    `echo "[deploy] Image: ${targetImage}" > "$LOG"`,
    `say() { echo "$1" | tee -a "$LOG"; }`,
    `try() { "$@" >> "$LOG" 2>&1 || { say "[deploy] FAILED: $*"; exit 1; } }`,
    `say "[deploy] Pulling image..."`,
    `try docker pull '${targetImage}'`,
    `say "[deploy] Pulling gsheet image..."`,
    `try docker pull '${gsheetImage}'`,
    `say "[deploy] Running migration gate..."`,
    // Sanity: the compose file must be visible through the mount before gate.
    `[ -f /project/docker-compose.yml ] || { say "[deploy] FAILED: /project/docker-compose.yml not found - HOST_PROJECT_DIR wrong"; exit 1; }`,
    // compose run --rm can hit the same Windows removal race as up -d; retry.
    `n=0; until docker compose ${composeArgs} run --rm --no-deps counting-stock npm run migrate:gate >> "$LOG" 2>&1; do`,
    `  n=$((n+1)); say "[deploy] migration gate attempt $n failed - retrying in 5s..."`,
    `  if [ $n -ge 3 ]; then say "[deploy] FAILED: docker compose run --rm --no-deps counting-stock npm run migrate:gate"; exit 1; fi`,
    `  sleep 5`,
    `done`,
    `say "[deploy] Gate passed. Restarting service..."`,
    // Windows Docker Desktop sometimes races container removal during
    // stop->rm->recreate ("removal ... already in progress"). Retry clears it.
    `n=0; until docker compose ${composeArgs} up -d --no-build counting-stock gsheet >> "$LOG" 2>&1; do`,
    `  n=$((n+1)); say "[deploy] compose up attempt $n failed - retrying in 5s..."`,
    `  if [ $n -ge 5 ]; then say "[deploy] FAILED: docker compose up -d --no-build counting-stock gsheet"; exit 1; fi`,
    `  sleep 5`,
    `done`,
    `say "[deploy] Update selesai. Aplikasi menyala kembali..."`,
  ].join("\n");

  const create = await dockerRequest("POST", `/containers/create?name=${containerName}`, {
    Image: SWAPPER_IMAGE,
    Cmd: ["sh", "-c", script],
    Labels: { "counting-stock.updater": "true" },
    HostConfig: {
      AutoRemove: true,
      Binds: [
        `${DOCKER_SOCKET}:${DOCKER_SOCKET}`,
        `${hostProjectDir}:/project:ro`,
        `${project}_app-logs:/logs`,
      ],
    },
  });
  if (create.status >= 400) {
    throw new Error(
      `Gagal membuat container updater (Docker API ${create.status}): ${create.text.slice(0, 300)}`,
    );
  }

  const start = await dockerRequest("POST", `/containers/${containerName}/start`);
  if (start.status >= 400) {
    await dockerRequest("DELETE", `/containers/${containerName}?force=1`).catch(() => undefined);
    throw new Error(`Gagal menjalankan container updater (Docker API ${start.status})`);
  }
  return containerName;
}

router.get("/logs", requireAdmin, async (_req, res) => {
  try {
    let lines: string[] = [];
    if (fs.existsSync(UPDATE_LOG)) {
      lines = fs
        .readFileSync(UPDATE_LOG, "utf8")
        .split("\n")
        .filter((l) => l !== "");
    }
    res.json({ success: true, data: { lines, version: APP_VERSION } });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Gagal membaca log pembaruan",
    });
  }
});

router.post("/run", requireAdmin, async (req, res) => {
  try {
    const force = req.query.force === "1";
    if (inFlight && Date.now() - inFlight.startedAt < IN_FLIGHT_TIMEOUT_MS && !force) {
      return res.status(409).json({
        success: false,
        error: `Pembaruan ke ${inFlight.targetImage} sedang berjalan. Tunggu sampai selesai.`,
      });
    }

    const { project, workingDir } = await composeContext();
    const tag = await latestReleaseTag();
    const version = tag.replace(/^v/, "");
    const targetImage = `${REGISTRY}:${tag}`;

    if (version === APP_VERSION) {
      return res.json({
        success: true,
        data: { started: false, targetVersion: version, message: "Sudah berada di versi terbaru." },
      });
    }

    inFlight = { targetImage, startedAt: Date.now() };

    try {
      await spawnUpdater(targetImage, project, workingDir);
    } catch (err) {
      inFlight = null;
      throw err;
    }

    res.json({
      success: true,
      data: { started: true, targetVersion: version, image: targetImage },
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Gagal memulai pembaruan",
    });
  }
});

export default router;
