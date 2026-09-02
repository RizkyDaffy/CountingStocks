import { Router } from "express";
import { APP_VERSION } from "../version.js";

const router = Router();

const GITHUB_REPO = process.env.GITHUB_REPO?.trim() || "RizkyDaffy/CountingStocks";
const CACHE_TTL_MS = 5 * 60 * 1000;

interface ReleaseEntry {
  tag: string;
  name: string;
  body: string;
  published_at: string;
  url: string;
}

interface ReleasesPayload {
  current: string;
  latest: string;
  releases: ReleaseEntry[];
}

let cache: { at: number; payload: ReleasesPayload } | null = null;

function stripLeadingV(tag: string): string {
  return tag.replace(/^v/, "");
}

async function fetchReleases(): Promise<ReleasesPayload> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases?per_page=20`, {
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
  const releases: ReleaseEntry[] = raw.map((r) => ({
    tag: String(r.tag_name ?? ""),
    name: String(r.name ?? ""),
    body: typeof r.body === "string" ? r.body : "",
    published_at: String(r.published_at ?? ""),
    url: String(r.html_url ?? ""),
  }));
  return {
    current: APP_VERSION,
    latest: releases.length > 0 ? stripLeadingV(releases[0].tag) : APP_VERSION,
    releases,
  };
}

router.get("/releases", async (_req, res) => {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return res.json({ success: true, data: cache.payload });
  }
  try {
    const payload = await fetchReleases();
    cache = { at: Date.now(), payload };
    res.json({ success: true, data: payload });
  } catch (err: unknown) {
    if (cache) {
      return res.json({ success: true, data: cache.payload });
    }
    res.json({
      success: true,
      data: { current: APP_VERSION, latest: APP_VERSION, releases: [] } satisfies ReleasesPayload,
      ...(err instanceof Error ? { error: err.message } : {}),
    });
  }
});

export default router;
