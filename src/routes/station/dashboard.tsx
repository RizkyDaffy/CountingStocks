import { useState, useCallback, useEffect, useRef } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  isStationTokenValid,
  getStationDevice,
  clearStationAuth,
  type StationDevice,
} from "@/lib/auth";
import { useStationScan } from "@/hooks/use-station-scan";
import { useScanSound } from "@/hooks/use-scan-sound";
import type { ProcessQrResult } from "@/hooks/use-qr-process";

export const Route = createFileRoute("/station/dashboard")({
  head: () => ({
    meta: [
      { title: "Station Scanner - Sugity Integrated Systems" },
      { name: "description", content: "Scanner station untuk proses Scan IN/OUT." },
    ],
  }),
  component: StationDashboardPage,
});

function extractToken(rawValue: string): string | null {
  const trimmed = rawValue.trim();
  try {
    if (trimmed.includes("token=")) {
      const url = new URL(trimmed.startsWith("http") ? trimmed : `http://x?${trimmed}`);
      const t = url.searchParams.get("token");
      if (t) return t;
    }
  } catch {
    /* not a URL */
  }
  // Format 2: Direct JWT (three dot-separated parts)
  if (trimmed.split(".").length === 3) return trimmed;
  // Format 3: Short opaque token (new system) - ≤16 URL-safe alphanumeric chars
  if (/^[A-Za-z0-9_-]{1,16}$/.test(trimmed)) return trimmed;
  return null;
}

type ScanEntry = {
  id: string;
  result: ProcessQrResult;
  timestamp: Date;
};

function StationDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [device, setDevice] = useState<StationDevice | null>(null);
  const [scanInput, setScanInput] = useState("");
  const [history, setHistory] = useState<ScanEntry[]>([]);
  const [scanError, setScanError] = useState<string | null>(null);
  const [privilegeError, setPrivilegeError] = useState(false);
  const [partstats, setPartstats] = useState<"reguler" | "bcp">("reguler");
  const inputRef = useRef<HTMLInputElement>(null);

  const [cooldown, setCooldown] = useState(false);
  const [cooldownSec, setCooldownSec] = useState(0);
  const cooldownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stationScan = useStationScan();
  const { playInfo, playSuccess, playWarning } = useScanSound();

  const startCooldown = useCallback(() => {
    // Clear any leftover interval from a previous cooldown
    if (cooldownIntervalRef.current) clearInterval(cooldownIntervalRef.current);
    setCooldown(true);
    setCooldownSec(5);
    cooldownIntervalRef.current = setInterval(() => {
      setCooldownSec((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownIntervalRef.current!);
          cooldownIntervalRef.current = null;
          setCooldown(false);
          // Re-focus after cooldown ends
          setTimeout(() => inputRef.current?.focus(), 50);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    setMounted(true);
    setDevice(getStationDevice());
    // Auto-focus the scan input on mount
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Station guard: if no valid station token → redirect to station login
  useEffect(() => {
    if (mounted && !isStationTokenValid()) {
      window.location.replace("/station/login");
    }
  }, [mounted]);

  const handleLogout = useCallback(() => {
    clearStationAuth();
    window.location.replace("/station/login");
  }, []);

  const handleScan = useCallback(
    (raw: string) => {
     
      if (cooldown) return;
      const token = extractToken(raw);
      if (!token) {
        // Invalid QR - play warning immediately
        playWarning();
        setScanError("QR tidak valid - tidak mengandung token inventori yang dikenali.");
        setScanInput("");
        return;
      }

      // Valid token detected - play info sound immediately on scan attempt
      playInfo();
      setScanError(null);
      const forceAction: "SCAN_IN" | "SCAN_OUT" =
        device?.device_role === "OUT" ? "SCAN_OUT" : "SCAN_IN";

      stationScan.mutate(
        { token, forceAction, partstats },
        {
          onSuccess: (result) => {
            // Success - play success sound immediately when server responds
            playSuccess();
            setHistory((prev) => [
              {
                id: `${Date.now()}-${Math.random()}`,
                result,
                timestamp: new Date(),
              },
              ...prev.slice(0, 19), // keep last 20 entries
            ]);
            setScanInput("");
            // Re-focus for next scan
            setTimeout(() => inputRef.current?.focus(), 100);
            startCooldown();
          },
          onError: (err) => {
            // Error - play warning sound immediately when server responds
            playWarning();
           if (err.message === "QR_NOT_ALLOWED") {
              setPrivilegeError(true);
              setScanInput("");
              setTimeout(() => setPrivilegeError(false), 5000);
              setTimeout(() => inputRef.current?.focus(), 100);
              return;
            }
            setScanError(err.message || "Scan gagal. Coba lagi.");
            setScanInput("");
            setTimeout(() => inputRef.current?.focus(), 100);
          },
        },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [device, stationScan, playInfo, playSuccess, playWarning, cooldown, startCooldown],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = scanInput.trim();
        if (val) handleScan(val);
      }
    },
    [scanInput, handleScan],
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLInputElement>) => {
      // On paste: grab the pasted text and immediately process
      const pasted = e.clipboardData.getData("text");
      if (pasted.trim()) {
        e.preventDefault();
        setScanInput(pasted.trim());
        // Defer so state has updated
        setTimeout(() => handleScan(pasted.trim()), 0);
      }
    },
    [handleScan],
  );

  // Focus re-claimer
  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 100);

  // SSR / pre-mount: show neutral loader
  if (!mounted) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ backgroundColor: "var(--station-bg, #F0EFED)" }}
      >
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-200 border-t-[#C05C30]" />
      </div>
    );
  }

  const role = device?.device_role ?? "IN";
  const roleLabel = role === "OUT" ? "OUT" : "IN";

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--station-bg, #F0EFED)" }}
    >
      {/* Top-right logout button */}
      <div className="flex justify-end p-4">
        <button
          id="btn-keluar-station"
          onClick={handleLogout}
          className="rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all"
          style={{ backgroundColor: "#C05C30" }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#A84E26")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C05C30")}
        >
          Keluar dari Station
        </button>
      </div>

      {/* Main content */}
      <div className="flex flex-col items-center flex-1 px-4 py-6 w-full max-w-2xl mx-auto">
        {/* Title */}
        <h1
          className="text-3xl sm:text-4xl font-extrabold text-center mb-2 tracking-tight"
          style={{ color: "var(--station-text, #2D2D2D)" }}
        >
          STATION ({roleLabel})
        </h1>
        <p
          className="text-base sm:text-lg font-semibold text-center mb-8"
          style={{ color: "var(--station-subtext, #57534E)" }}
        >
          Scan QR Code Pallet untuk proses ({roleLabel})
        </p>
        {device && (
          <p
            className="text-xs text-center mb-6"
            style={{ color: "var(--station-footer, #9CA3AF)" }}
          >
            {device.name} · {device.location || "No Location"}
          </p>
        )}

        {/* Scan input area */}
        <div
          className="w-full rounded-2xl shadow-sm mb-4 relative"
          style={{ backgroundColor: "var(--station-card, #FFFFFF)" }}
        >
          <input
            ref={inputRef}
            id="station-scan-input"
            type="text"
            value={scanInput}
            onChange={(e) => setScanInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={cooldown ? "" : "Klik Disini, SCAN QR HERE...."}
            className="w-full rounded-2xl px-6 py-5 text-base text-center outline-none bg-transparent transition-opacity duration-300"
            style={{
              color: "var(--station-text, #2D2D2D)",
              // Visual feedback: dim the input while in cooldown
              // Do NOT use `disabled` - keeps focus alive
              opacity: cooldown ? 0.35 : 1,
              pointerEvents: cooldown ? "none" : "auto",
              cursor: cooldown ? "not-allowed" : "text",
            }}
            autoComplete="off"
            // readOnly during cooldown keeps focus + prevents keyboard pop on mobile
            readOnly={cooldown}
          />
          {/* ── Cooldown overlay (additive) ─────────────────────────────── */}
          {cooldown && (
            <div
              className="absolute inset-0 flex items-center justify-center gap-2 rounded-2xl pointer-events-none"
              style={{ backgroundColor: "rgba(192,92,48,0.07)" }}
            >
              {/* Spinning ring - tier-1 loading style */}
              <span
                className="inline-block h-4 w-4 rounded-full border-2 border-orange-200 border-t-[#C05C30] animate-spin flex-shrink-0"
                aria-hidden="true"
              />
              <span className="text-sm font-semibold tracking-wide" style={{ color: "#C05C30" }}>
                Harap tunggu&hellip; {cooldownSec}s
              </span>
            </div>
          )}
        </div>

        {/* Partstats Switcher */}
        <div
          className="w-full flex rounded-2xl border bg-white mb-4 shadow-sm overflow-hidden"
          style={{ borderColor: "var(--station-border, #D1D5DB)" }}
        >
          <button
            onClick={() => {
              setPartstats("reguler");
              focusInput();
            }}
            className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
              partstats === "reguler"
                ? "bg-[#C05C30] text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            Reguler Part
          </button>
          <button
            onClick={() => {
              setPartstats("bcp");
              focusInput();
            }}
            className={`flex-1 py-3.5 text-sm font-semibold transition-all ${
              partstats === "bcp"
                ? "bg-[#C05C30] text-white"
                : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
            }`}
          >
            BCP Part
          </button>
        </div>

        {/* Helper text */}
        <p className="text-xs text-center mb-4" style={{ color: "var(--station-footer, #9CA3AF)" }}>
          Gunakan Scanner - Tempel QR token nya atau isi URL
          <br />
          Scan QR dengan Google Lens / SCANNER - salin URL yang muncul, lalu tempel di sini.
        </p>

        {/* Processing indicator */}
        {stationScan.isPending && (
          <div className="flex items-center gap-2 mb-4 text-sm" style={{ color: "#C05C30" }}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Memproses...
          </div>
        )}

        {/* Error */}
        {scanError && (
          <div className="w-full flex items-start gap-2 rounded-xl px-4 py-3 mb-4 text-sm text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-400">
            <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {scanError}
          </div>
        )}

        {/* Privilege Error Toast - "Proses dibatalkan: QR yang di-scan tidak diizinkan" */}
        {privilegeError && (
          <div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-2xl px-6 py-4 shadow-2xl text-sm font-bold text-white animate-in slide-in-from-bottom-4 duration-300"
            style={{ backgroundColor: "#DC2626", maxWidth: "calc(100vw - 2rem)" }}
          >
            <XCircle className="h-5 w-5 shrink-0" />
            Proses dibatalkan: QR yang di-scan tidak diizinkan
          </div>
        )}

        {/* Scan History */}
        <div
          className="w-full rounded-2xl shadow-sm p-5 mt-2"
          style={{ backgroundColor: "var(--station-card, #FFFFFF)" }}
        >
          <p
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--station-text, #2D2D2D)" }}
          >
            Informasi Scan Tebaru:
          </p>
          <div
            className="border-t mb-4"
            style={{ borderColor: "var(--station-border, #E5E7EB)" }}
          />

          {history.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm" style={{ color: "var(--station-footer, #9CA3AF)" }}>
                Yah belum ada nih data
              </p>
              <p className="text-sm" style={{ color: "var(--station-footer, #9CA3AF)" }}>
                nya, coba scan dulu yah
              </p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto pr-1" style={{ maxHeight: "320px" }}>
              {history.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 rounded-xl p-3"
                  style={{ backgroundColor: "var(--station-bg, #F0EFED)" }}
                >
                  {entry.result.action === "SCAN_IN" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-orange-500 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-sm font-semibold truncate"
                        style={{ color: "var(--station-text, #2D2D2D)" }}
                      >
                        {entry.result.partName}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          entry.result.action === "SCAN_IN"
                            ? "bg-green-100 text-green-700"
                            : "bg-orange-100 text-orange-700"
                        }`}
                      >
                        {entry.result.action === "SCAN_IN" ? "IN" : "OUT"}
                      </span>
                    </div>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--station-footer, #9CA3AF)" }}
                    >
                      {entry.result.factoryOrigin} ·{" "}
                      {entry.timestamp.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                      })}
                    </p>
                    <p
                      className="text-xs mt-0.5"
                      style={{ color: "var(--station-subtext, #57534E)" }}
                    >
                      {entry.result.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <p className="text-xs text-center pb-6" style={{ color: "var(--station-footer, #9CA3AF)" }}>
        Copyright @2026 Sugity Integrated Systems
      </p>
    </div>
  );
}
