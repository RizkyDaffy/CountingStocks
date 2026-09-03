import { useCallback, useRef, useState } from "react";
import { fetchApi } from "@/lib/api";

export type SelfUpdatePhase = "idle" | "starting" | "updating" | "restarting" | "done" | "error";

const POLL_INTERVAL_MS = 3000;
const TIMEOUT_MS = 5 * 60_000;

async function fetchHealthVersion(): Promise<string | null> {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

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
  const timer = useRef<number | null>(null);

  const trigger = useCallback(async () => {
    setPhase("starting");
    setMessage("");
    let target: string;
    try {
      const data = await fetchApi<{ started: boolean; targetVersion: string; message?: string }>(
        "/update/run",
        { method: "POST" },
      );
      if (data.started === false) {
        setPhase("idle");
        setMessage(data.message ?? "Tidak ada pembaruan.");
        return;
      }
      target = data.targetVersion;
    } catch (err) {
      setPhase("error");
      setMessage(err instanceof Error ? err.message : "Gagal memulai pembaruan");
      return;
    }

    setPhase("updating");
    const deadline = Date.now() + TIMEOUT_MS;
    const poll = async () => {
      if (Date.now() > deadline) {
        setPhase("error");
        setMessage(
          "Pembaruan memakan waktu terlalu lama. Periksa server atau jalankan deploy.ps1 di host.",
        );
        return;
      }
      const version = await fetchHealthVersion();
      if (version === target) {
        setPhase("done");
        window.location.reload();
        return;
      }
      setPhase(version === null ? "restarting" : "updating");
      timer.current = window.setTimeout(poll, POLL_INTERVAL_MS);
    };
    timer.current = window.setTimeout(poll, POLL_INTERVAL_MS);
  }, []);

  return { phase, message, trigger };
}
