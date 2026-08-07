import { createServer, request as httpRequest } from "node:http";
import { Readable } from "node:stream";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve, dirname, extname, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HANDLER_PATH = resolve(__dirname, "..", "dist", "server", "server.js");
const CLIENT_DIR = resolve(__dirname, "..", "dist", "client");
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const API_TARGET_HOST = process.env.API_PROXY_HOST || "127.0.0.1";
const API_TARGET_PORT = Number(process.env.API_PORT || 4005);

const MIME = {
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".html": "text/html; charset=utf-8",
};

function proxyApi(req, res) {
  const { origin: _o, referer: _r, ...passHeaders } = req.headers;
  void _o;
  void _r;
  const proxyReq = httpRequest(
    {
      host: API_TARGET_HOST,
      port: API_TARGET_PORT,
      method: req.method,
      path: req.url,
      headers: { ...passHeaders, host: `${API_TARGET_HOST}:${API_TARGET_PORT}` },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 502, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (err) => {
    console.error("[ssr] api proxy error:", err.message);
    if (!res.headersSent) res.statusCode = 502;
    res.end("Bad Gateway");
  });
  req.pipe(proxyReq);
}

async function tryStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  if (urlPath === "/" || urlPath.endsWith("/")) return false;
  const safe = normalize(urlPath).replace(/^([/\\])+/, "");
  const full = resolve(CLIENT_DIR, safe);
  if (!full.startsWith(CLIENT_DIR + sep) && full !== CLIENT_DIR) return false;
  let info;
  try {
    info = await stat(full);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;
  const ext = extname(full).toLowerCase();
  const type = MIME[ext] || "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("Content-Type", type);
  res.setHeader("Content-Length", info.size);
  if (urlPath.startsWith("/assets/")) {
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  }
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  createReadStream(full).pipe(res);
  return true;
}

const mod = await import(pathToFileURL(HANDLER_PATH).href);
const handler = mod.default ?? mod;
if (typeof handler?.fetch !== "function") {
  console.error("[ssr] Handler at", HANDLER_PATH, "has no fetch() export");
  process.exit(1);
}

function buildWebRequest(req) {
  const url = `http://${req.headers.host || "localhost"}${req.url}`;
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) for (const item of v) headers.append(k, item);
    else headers.set(k, v);
  }
  const init = { method: req.method, headers };
  if (req.method && req.method !== "GET" && req.method !== "HEAD") {
    init.body = Readable.toWeb(req);
    init.duplex = "half";
  }
  return new Request(url, init);
}

async function writeWebResponse(webRes, res) {
  res.statusCode = webRes.status;
  webRes.headers.forEach((val, key) => {
    if (key.toLowerCase() === "set-cookie") {
      const cookies =
        typeof webRes.headers.getSetCookie === "function" ? webRes.headers.getSetCookie() : [val];
      res.setHeader("Set-Cookie", cookies);
    } else {
      res.setHeader(key, val);
    }
  });
  if (webRes.body) {
    Readable.fromWeb(webRes.body).pipe(res);
  } else {
    res.end();
  }
}

const server = createServer(async (req, res) => {
  try {
    const path = (req.url || "/").split("?")[0];
    if (path === "/api" || path.startsWith("/api/")) {
      proxyApi(req, res);
      return;
    }
    if (await tryStatic(req, res)) return;
    const webReq = buildWebRequest(req);
    const webRes = await handler.fetch(webReq);
    await writeWebResponse(webRes, res);
  } catch (err) {
    console.error("[ssr] request failed:", err);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Internal Server Error");
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[ssr] listening on http://${HOST}:${PORT}`);
});

function shutdown(signal) {
  console.log(`[ssr] received ${signal}, closing…`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
