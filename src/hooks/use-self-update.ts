import { useCallback, useEffect, useRef, useState } from "react";
import { fetchApi } from "@/lib/api";

export type SelfUpdatePhase = "idle" | "starting" | "updating" | "restarting" | "done" | "error";

const LOG_POLL_MS = 1500;
const TIMEOUT_MS = 10 * 60_000;

export function selfUpdatePhaseLabel(phase: SelfUpdatePhase): string {
  switch (phase) {
    case "starting":
      return "Menyiapkan...";
    case "updating":
      return "Mengunduh pembaruan...";
    case "restarting":
      return "Memulai ulang layanan...";
    case "done":
      return "Selesai, memuat ulang...";
    case "error":
      return "Gagal, coba lagi";
    default:
      return "Update Sekarang";
  }
}

export function useSelfUpdate() {
  const [phase, setPhase] = useState<SelfUpdatePhase>("idle");
  const [message, setMessage] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const timer = useRef<number | null>(null);
  const deadline = useRef(0);
  const target = useRef("");
  const stopped = useRef(true);

  const clearTimer = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => clearTimer, []);

  const finish = useCallback(() => {
    clearTimer();
    setPhase("done");
    window.setTimeout(() => window.location.reload(), 1500);
  }, []);

  const fail = useCallback((msg: string) => {
    clearTimer();
    setPhase("error");
    setMessage(msg);
  }, []);

  const poll = useCallback(() => {
    if (stopped.current) return;
    if (Date.now() > deadline.current) {
      fail(
        "Pembaruan memakan waktu terlalu lama. Periksa server atau jalankan deploy.ps1 di host.",
      );
      return;
    }
    timer.current = window.setTimeout(async () => {
      if (stopped.current) return;
      try {
        const data = await fetchApi<{ lines: string[]; version: string }>("/update/logs");
        if (stopped.current) return;
        setLines(data.lines);
        const failed = data.lines.find((l) => l.includes("[deploy] FAILED:"));
        if (failed) {
          fail(failed);
          return;
        }
        if (data.version === target.current) {
          finish();
          return;
        }
        setPhase("updating");
      } catch {
        // Server is restarting mid-update - keep waiting.
        if (stopped.current) return;
        setPhase((p) => (p === "done" ? p : "restarting"));
        setLines((prev) =>
          prev[prev.length - 1] === "[deploy] menunggu layanan menyala kembali..."
            ? prev
            : [...prev, "[deploy] menunggu layanan menyala kembali..."],
        );
      }
      poll();
    }, LOG_POLL_MS);
  }, [fail, finish]);

  const trigger = useCallback(async () => {
    clearTimer();
    const isRetry = phase === "error";
    setPhase("starting");
    setMessage("");
    setLines([]);
    let targetVersion: string;
    try {
      const data = await fetchApi<{ started: boolean; targetVersion: string; message?: string }>(
        `/update/run${isRetry ? "?force=1" : ""}`,
        { method: "POST" },
      );
      if (data.started === false) {
        setPhase("idle");
        setMessage(data.message ?? "Tidak ada pembaruan.");
        return;
      }
      targetVersion = data.targetVersion;
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Gagal memulai pembaruan");
      return;
    }

    target.current = targetVersion;
    deadline.current = Date.now() + TIMEOUT_MS;
    stopped.current = false;
    setPhase("updating");
    poll();
  }, [phase, poll]);

  return { phase, message, lines, trigger };
}
