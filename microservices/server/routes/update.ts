import { Router, type Request, type Response, type NextFunction } from "express";
import http from "node:http";
import { APP_VERSION } from "../version.js";

const router = Router();

const REGISTRY = process.env.REGISTRY?.trim() || "ghcr.io/rizkydaffy/counting-stock";
const GITHUB_REPO = process.env.GITHUB_REPO?.trim() || "RizkyDaffy/CountingStocks";
const SWAPPER_IMAGE = "docker:cli";
const DOCKER_SOCKET = "/var/run/docker.sock";
const IN_FLIGHT_TIMEOUT_MS = 15 * 60_000;

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

async function spawnSwapper(targetImage: string): Promise<string> {
  const containerName = `counting-stock-updater-${Date.now()}`;
  const projectDir = process.env.HOST_PROJECT_DIR?.trim() as string;

  await dockerPullImage("docker", "cli");

  const script = [
    "set -e",
    `echo "[updater] pulling ${targetImage}"`,
    `docker pull '${targetImage}'`,
    "cd /project",
    'echo "[updater] running migration gate"',
    `IMAGE='${targetImage}' docker compose run --rm --no-deps counting-stock npm run migrate:gate`,
    'echo "[updater] gate passed, recreating service"',
    `IMAGE='${targetImage}' docker compose up -d --no-build counting-stock`,
    'echo "[updater] done"',
  ].join("\n");

  const create = await dockerRequest("POST", `/containers/create?name=${containerName}`, {
    Image: SWAPPER_IMAGE,
    Cmd: ["sh", "-c", script],
    Labels: { "counting-stock.updater": "true" },
    HostConfig: {
      AutoRemove: true,
      Binds: [`${DOCKER_SOCKET}:${DOCKER_SOCKET}`, `${projectDir}:/project:ro`],
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

router.post("/run", requireAdmin, async (_req, res) => {
  try {
    const projectDir = process.env.HOST_PROJECT_DIR?.trim();
    if (!projectDir) {
      return res.status(400).json({
        success: false,
        error:
          "HOST_PROJECT_DIR belum diatur. Tambahkan path project di server ke .env lalu jalankan deploy.ps1.",
      });
    }

    if (inFlight && Date.now() - inFlight.startedAt < IN_FLIGHT_TIMEOUT_MS) {
      return res.status(409).json({
        success: false,
        error: `Pembaruan ke ${inFlight.targetImage} sedang berjalan. Tunggu sampai selesai.`,
      });
    }

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
      await spawnSwapper(targetImage);
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
