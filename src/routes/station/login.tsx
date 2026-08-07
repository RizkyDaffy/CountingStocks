import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, AlertCircle } from "lucide-react";
import { fetchApi } from "@/lib/api";
import { setStationAuth, type StationDevice } from "@/lib/auth";

export const Route = createFileRoute("/station/login")({
  head: () => ({
    meta: [
      { title: "Login Scanner - Sugity Integrated Systems" },
      { name: "description", content: "Login untuk perangkat scanner station." },
    ],
  }),
  component: StationLoginPage,
});

type StationLoginResponse = {
  token: string;
  device: StationDevice;
};

function StationLoginPage() {
  const [deviceCode, setDeviceCode] = useState("");
  const [pin, setPin] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!deviceCode.trim() || !pin.trim()) return;
      setError(null);
      setIsLoading(true);
      try {
        const data = await fetchApi<StationLoginResponse>("/devices/station-login", {
          method: "POST",
          body: JSON.stringify({ device_code: deviceCode.trim(), pin }),
        });
        setStationAuth(data.token, data.device);
        window.location.replace("/station/dashboard");
      } catch (err) {
        setError((err as Error).message || "Login gagal. Coba lagi.");
        setIsLoading(false);
      }
    },
    [deviceCode, pin],
  );

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-between py-10 px-4"
      style={{ backgroundColor: "var(--station-bg, #F0EFED)" }}
    >
      {}
      <div />

      {}
      <div
        className="w-full max-w-md rounded-2xl shadow-sm p-8 sm:p-10"
        style={{ backgroundColor: "var(--station-card, #FFFFFF)" }}
      >
        <h1
          className="text-2xl font-semibold text-center mb-8 tracking-tight"
          style={{ color: "var(--station-text, #2D2D2D)" }}
        >
          Login SCANNER
        </h1>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {}
          <div>
            <label
              htmlFor="station-device-code"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--station-label, #4B5563)" }}
            >
              ID Perangkat
            </label>
            <input
              id="station-device-code"
              type="text"
              value={deviceCode}
              onChange={(e) => setDeviceCode(e.target.value)}
              placeholder="Contoh: scanner1"
              autoComplete="off"
              required
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all focus:ring-2"
              style={{
                borderColor: "var(--station-border, #D1D5DB)",
                backgroundColor: "var(--station-input-bg, #FFFFFF)",
                color: "var(--station-text, #2D2D2D)",
              }}
            />
          </div>

          {}
          <div>
            <label
              htmlFor="station-pin"
              className="block text-sm font-medium mb-1.5"
              style={{ color: "var(--station-label, #4B5563)" }}
            >
              PIN Perangkat
            </label>
            <input
              id="station-pin"
              type="password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              required
              className="w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all focus:ring-2"
              style={{
                borderColor: "var(--station-border, #D1D5DB)",
                backgroundColor: "var(--station-input-bg, #FFFFFF)",
                color: "var(--station-text, #2D2D2D)",
              }}
            />
          </div>

          {}
          <button
            id="btn-masuk-scanner"
            type="submit"
            disabled={isLoading || !deviceCode.trim() || !pin.trim()}
            className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            style={{ backgroundColor: "#C05C30" }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#A84E26")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C05C30")}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Memverifikasi...
              </>
            ) : (
              "Masuk Scanner"
            )}
          </button>
        </form>
      </div>

      {}
      <p className="text-xs text-center" style={{ color: "var(--station-footer, #9CA3AF)" }}>
        Copyright @2026 Sugity Integrated Systems
      </p>
    </div>
  );
}
