import { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ScanLine,
  ShieldCheck,
  CircleDot,
  ChevronRight,
  History,
  CheckCircle2,
  XCircle,
  ArrowLeftRight,
  Loader2,
  RotateCcw,
  AlertCircle,
  Camera,
  ImageUp,
  Link2,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useProcessQr, useQrHistory, type ProcessQrResult } from "@/hooks/use-qr-process";
import { useScanSound } from "@/hooks/use-scan-sound";

export const Route = createFileRoute("/scan")({
  head: () => ({
    meta: [
      { title: "Scan QR - Sugity Creatives" },
      {
        name: "description",
        content: "Scan QR codes to toggle IN/OUT status with your device camera.",
      },
      { property: "og:title", content: "Scan QR - Sugity Creatives" },
    ],
  }),
  component: ScanPage,
});

function isCameraApiAvailable(): boolean {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.mediaDevices !== "undefined" &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

function ScanPage() {
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const lastScannedRef = useRef<string>("");
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scanModeRef = useRef<"auto" | "forceIn" | "forceOut">("forceIn");
  const processingRef = useRef(false);

  const [mode, setMode] = useState<"live" | "file" | "url">("live");
  const [scanMode, setScanMode] = useState<"auto" | "forceIn" | "forceOut">("forceIn");
  const [scanning, setScanning] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [scanResult, setScanResult] = useState<ProcessQrResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [manualUrl, setManualUrl] = useState("");
  const [fileDecoding, setFileDecoding] = useState(false);

  useEffect(() => {
    scanModeRef.current = scanMode;
  }, [scanMode]);
  useEffect(() => {
    processingRef.current = isProcessing;
  }, [isProcessing]);

  useEffect(() => {
    if (!isCameraApiAvailable()) {
      setMode("file");
    }
  }, []);

  const processQr = useProcessQr();
  const { data: history = [] } = useQrHistory();
  const { playInfo, playSuccess, playWarning } = useScanSound();

  const extractToken = useCallback((rawValue: string): string | null => {
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
  }, []);

  const handleDetected = useCallback(
    (rawValue: string) => {
      const currentMode = scanModeRef.current;

      // Synchronous multi-fire guard - blocks all frames while one mutation is in flight
      if (processingRef.current) return;

      // In auto mode keep dedup; in force mode allow re-scanning same QR after cooldown
      if (currentMode === "auto" && lastScannedRef.current === rawValue) return;

      // Lock immediately (synchronous - prevents next camera frame)
      processingRef.current = true;
      lastScannedRef.current = rawValue;

      const token = extractToken(rawValue);
      if (!token) {
        // Invalid token - play warning immediately
        playWarning();
        setScanError("QR detected but does not contain a valid inventory token.");
        lastScannedRef.current = "";
        processingRef.current = false;
        return;
      }

      // Valid token - play info sound immediately on detection
      playInfo();
      setScanError(null);
      setIsProcessing(true);
      setScanResult(null);

      // Map scanMode → forceAction (undefined = auto-toggle)
      const forceAction =
        currentMode === "forceIn" ? "SCAN_IN" : currentMode === "forceOut" ? "SCAN_OUT" : undefined;

      processQr.mutate(
        { token, forceAction },
        {
          onSuccess: (result) => {
            // Success - play success sound immediately when server responds
            playSuccess();
            setScanResult(result);
            setIsProcessing(false);
            processingRef.current = false;
            if (cooldownRef.current) clearTimeout(cooldownRef.current);
            // Force mode: 5s cooldown to prevent accidental rapid multi-scan.
            // Auto mode: 3s to prevent accidental double-toggle.
            const cooldownMs = currentMode !== "auto" ? 5000 : 3000;
            cooldownRef.current = setTimeout(() => {
              lastScannedRef.current = "";
            }, cooldownMs);
          },
          onError: (err) => {
            // Error - play warning sound immediately when server responds
            playWarning();
            setScanError(err.message || "Failed to process QR code.");
            setIsProcessing(false);
            processingRef.current = false;
            lastScannedRef.current = "";
          },
        },
      );
    },
    [extractToken, processQr, playInfo, playSuccess, playWarning],
  );

  useEffect(() => {
    lastScannedRef.current = "";
    if (cooldownRef.current) clearTimeout(cooldownRef.current);
  }, [scanMode]);

  const startScanner = useCallback(async () => {
    setCameraError(null);

    if (!isCameraApiAvailable()) {
      setCameraError(
        "Live camera memerlukan HTTPS. Gunakan 'Capture Photo' di bawah - ini akan berfungsi di semua perangkat (kayaknya sih).",
      );
      setMode("file");
      return;
    }

    try {
      const { Html5Qrcode } = await import("html5-qrcode");

      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
        } catch {
          /* ignore */
        }
        scannerRef.current = null;
      }

      const scanner = new Html5Qrcode("qr-reader", { verbose: false });
      scannerRef.current = scanner as unknown as { stop: () => Promise<void> };

      await scanner.start(
        { facingMode: "environment" },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        {
          fps: 25,
          qrbox: { width: 300, height: 300 },
          aspectRatio: 1.0,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true, // native BarcodeDetector API - 2-5× faster
          },
          rememberLastUsedCamera: true,
        } as any,
        (text) => handleDetected(text),
        () => {
          /* scan miss - silent */
        },
      );

      setScanning(true);
      setCameraStarted(true);
    } catch (err: unknown) {
      const msg = String((err as Error).message || err).toLowerCase();
      let friendly = "Could not start the camera.";

      if (msg.includes("permission") || msg.includes("notallowed")) {
        friendly = "Camera permission denied. Allow camera access in your browser settings.";
      } else if (
        msg.includes("https") ||
        msg.includes("secure") ||
        msg.includes("streaming not supported") ||
        msg.includes("getUserMedia is not defined")
      ) {
        friendly =
          "Live camera membutuhkan HTTPS. Gunakan 'Capture Photo' di bawah - ini akan berfungsi di semua perangkat (kayaknya sih).";
        setMode("file");
      } else if (msg.includes("notfound") || msg.includes("no camera")) {
        friendly = "No camera found on this device.";
      }

      setCameraError(friendly);
      setScanning(false);
    }
  }, [handleDetected]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    setScanning(false);
  }, []);

  const toggleScanning = useCallback(async () => {
    if (scanning) await stopScanner();
    else await startScanner();
  }, [scanning, startScanner, stopScanner]);

  const handleFileCapture = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setFileDecoding(true);
      setScanError(null);
      setScanResult(null);
      lastScannedRef.current = "";

      try {
        const { Html5Qrcode } = await import("html5-qrcode");

        // Ensure a throwaway DOM element exists for the scanner
        let tempDiv = document.getElementById("qr-file-reader");
        if (!tempDiv) {
          tempDiv = document.createElement("div");
          tempDiv.id = "qr-file-reader";
          tempDiv.style.display = "none";
          document.body.appendChild(tempDiv);
        }

        const scanner = new Html5Qrcode("qr-file-reader", { verbose: false });
        // scanFile: decodes QR from an image file - no camera API / HTTPS required
        const decoded = await scanner.scanFile(file, /* showImage: */ false);
        handleDetected(decoded);
      } catch {
        // File decode failed - play warning immediately
        playWarning();
        setScanError(
          "Could not decode a QR code from this image. Make sure the QR is clear and well-lit, then try again.",
        );
      } finally {
        setFileDecoding(false);
        if (e.target) e.target.value = "";
      }
    },
    [handleDetected, playWarning],
  );

  const handleManualSubmit = useCallback(() => {
    const trimmed = manualUrl.trim();
    if (!trimmed) return;
    lastScannedRef.current = "";
    handleDetected(trimmed);
    setManualUrl("");
  }, [manualUrl, handleDetected]);

  const handleReset = useCallback(() => {
    setScanResult(null);
    setScanError(null);
    lastScannedRef.current = "";
  }, []);

  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => {});
      if (cooldownRef.current) clearTimeout(cooldownRef.current);
    };
  }, []);

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-6xl animate-in fade-in duration-300">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Scanner
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
              Scan a QR Code
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Scan untuk otomatis mengubah status IN/OUT pada barang.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-[11.5px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-[#a4c9e9]" />
            Terlindungi dan Aman · JWT Terverifikasi
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.35fr_1fr]">
          {/* Scanner card */}
          <section className="rounded-3xl border border-border-surface bg-card p-5 sm:p-6">
            {/* Mode tabs */}
            <div className="flex gap-2 mb-4">
              {[
                { key: "live", label: "Camera Langsung", icon: Camera },
                { key: "file", label: "Gunakan Photo", icon: ImageUp },
                { key: "url", label: "Gunakan Scanner", icon: Link2 },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  id={`scan-mode-${key}`}
                  onClick={async () => {
                    if (scanning) await stopScanner();
                    setScanError(null);
                    setCameraError(null);
                    setMode(key as "live" | "file" | "url");
                  }}
                  className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium transition-smooth ${
                    mode === key
                      ? "bg-[#C05C30] text-white"
                      : "bg-card-elevated text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <div className="mb-4 flex items-center gap-2">
              <span className="shrink-0 text-[11.5px] text-muted-foreground">Action:</span>
              <div className="flex flex-1 gap-1.5 rounded-xl bg-card-elevated p-1">
                {(["forceIn", "forceOut"] as const).map((m) => {
                  const labels: Record<string, string> = {
                    auto: "Auto",
                    forceIn: "Mode IN",
                    forceOut: "Mode OUT",
                  };
                  const colors: Record<string, string> = {
                    auto:
                      scanMode === "auto"
                        ? "bg-[#a4c9e9] text-[oklch(0.2_0.04_250)]"
                        : "text-muted-foreground hover:text-foreground",
                    forceIn:
                      scanMode === "forceIn"
                        ? "bg-emerald-500 text-white"
                        : "text-muted-foreground hover:text-foreground",
                    forceOut:
                      scanMode === "forceOut"
                        ? "bg-[#c05c30] text-white"
                        : "text-muted-foreground hover:text-foreground",
                  };
                  return (
                    <button
                      key={m}
                      id={`action-mode-${m}`}
                      onClick={() => setScanMode(m)}
                      className={`flex-1 rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-smooth ${colors[m]}`}
                    >
                      {labels[m]}
                    </button>
                  );
                })}
              </div>
              <span
                className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  scanMode === "auto"
                    ? "bg-[#a4c9e9]/20 text-[#a4c9e9]"
                    : scanMode === "forceIn"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : "bg-red-500/15 text-red-400"
                }`}
              >
                {scanMode === "auto"
                  ? "Toggle"
                  : scanMode === "forceIn"
                    ? "Always IN"
                    : "Always OUT"}
              </span>
            </div>

            {mode === "live" && (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-[12.5px] font-medium text-foreground/90">
                    <CircleDot
                      className={`h-3.5 w-3.5 ${scanning ? "text-emerald-400" : "text-muted-foreground"}`}
                    />
                    {scanning ? "Live · Kamera Aktif" : cameraStarted ? "Dijeda" : "Kamera Mati"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">25 FPS · ARIS</div>
                </div>

                <div className="relative w-full overflow-hidden rounded-2xl bg-[oklch(0.12_0_0)] aspect-square">
                  <div
                    id="qr-reader"
                    className="h-full w-full [&>video]:h-full [&>video]:w-full [&>video]:object-cover [&>img]:hidden [&_button]:hidden [&_select]:hidden [&_span]:hidden"
                    style={{ minHeight: "260px" }}
                  />
                  {!cameraStarted && (
                    <div className="absolute inset-0 flex items-center justify-center bg-[oklch(0.12_0_0)]">
                      <div
                        className="absolute inset-0 opacity-[0.15]"
                        style={{
                          backgroundImage:
                            "linear-gradient(to right,oklch(0.3 0 0) 1px,transparent 1px),linear-gradient(to bottom,oklch(0.3 0 0) 1px,transparent 1px)",
                          backgroundSize: "28px 28px",
                        }}
                      />
                      <div className="relative flex h-[60%] w-[60%] items-center justify-center">
                        {[
                          "left-0 top-0 border-l-2 border-t-2 rounded-tl-2xl",
                          "right-0 top-0 border-r-2 border-t-2 rounded-tr-2xl",
                          "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-2xl",
                          "right-0 bottom-0 border-r-2 border-b-2 rounded-br-2xl",
                        ].map((pos, i) => (
                          <span
                            key={i}
                            className={`absolute h-10 w-10 border-[#a4c9e9] ${pos}`}
                            style={{ boxShadow: "0 0 20px -4px #a4c9e9aa" }}
                          />
                        ))}
                        <div className="rounded-full bg-black/40 px-3 py-1.5 text-[11px] text-white/80 backdrop-blur">
                          Klik 'Start Camera' untuk memulai yah...
                        </div>
                      </div>
                    </div>
                  )}
                  {cameraStarted && scanning && (
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <div className="relative h-[60%] w-[60%]">
                        {[
                          "left-0 top-0 border-l-2 border-t-2 rounded-tl-2xl",
                          "right-0 top-0 border-r-2 border-t-2 rounded-tr-2xl",
                          "left-0 bottom-0 border-l-2 border-b-2 rounded-bl-2xl",
                          "right-0 bottom-0 border-r-2 border-b-2 rounded-br-2xl",
                        ].map((pos, i) => (
                          <span
                            key={i}
                            className={`absolute h-10 w-10 border-[#a4c9e9] ${pos}`}
                            style={{ boxShadow: "0 0 20px -4px #a4c9e9aa" }}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {cameraError && (
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-destructive/10 p-3 text-xs text-destructive">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{cameraError}</span>
                  </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                  <button
                    id="btn-toggle-camera"
                    onClick={toggleScanning}
                    className="inline-flex items-center gap-2 rounded-full bg-[#C05C30] px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth hover:brightness-95"
                  >
                    <ScanLine className="h-4 w-4" />
                    {scanning ? "Pause Camera" : cameraStarted ? "Resume Camera" : "Start Camera"}
                  </button>
                  <button
                    id="btn-reset-scan"
                    onClick={handleReset}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card-elevated text-foreground/80 transition-smooth hover:bg-accent"
                    aria-label="Mengatur Ulang"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </button>
                </div>
              </>
            )}

            {mode === "file" && (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-dashed border-border-strong bg-card-elevated/30 p-6 text-center">
                  <Camera className="mx-auto mb-3 h-10 w-10 text-[#a4c9e9] opacity-80" />
                  <p className="text-sm font-medium text-foreground">Ambil Foto dari QR Code</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Berfungsi di semua perangkat seluler - tidak memerlukan HTTPS.
                    <br />
                    Kamera bawaan Anda akan terbuka untuk menangkap QR.
                  </p>
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <label
                      id="btn-capture-qr"
                      htmlFor="file-capture-input"
                      className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#C05C30] px-5 py-2.5 text-[13px] font-semibold text-white transition-smooth hover:brightness-95"
                    >
                      {fileDecoding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                      {fileDecoding ? "Decoding..." : "Buka Kamera / Pilih Gambar"}
                    </label>
                    <input
                      id="file-capture-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileCapture}
                      className="hidden"
                    />
                    <button
                      onClick={handleReset}
                      className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-transparent px-4 py-2.5 text-sm text-foreground transition-smooth hover:bg-accent"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Mengatur Ulang
                    </button>
                  </div>
                </div>
                <div className="rounded-xl bg-card-elevated/30 p-3 text-[11.5px] text-muted-foreground">
                  <strong className="text-foreground">Cara kerjanya:</strong> Tekan tombol untuk
                  membuka kamera Anda. Jepret kode QR. Aplikasi akan mendekodenya dan mengubah
                  status IN/OUT secara otomatis.
                </div>
              </div>
            )}

            {mode === "url" && (
              <div className="flex flex-col gap-4">
                <div className="rounded-2xl border border-dashed border-border-strong bg-card-elevated/30 p-5">
                  <Link2 className="mb-3 h-8 w-8 text-[#a4c9e9] opacity-80" />
                  <p className="text-sm font-medium text-foreground">
                    Tempel QR token nya atau isi URL
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Scan QR dengan Google Lens / SCANNER - salin URL yang muncul, lalu tempel di
                    sini.
                  </p>
                  <div className="mt-4 flex gap-2">
                    <input
                      id="input-manual-url"
                      type="text"
                      value={manualUrl}
                      onChange={(e) => setManualUrl(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()}
                      placeholder="http://...?token=eyJ... or paste JWT"
                      className="flex-1 h-10 rounded-xl border border-transparent bg-card-elevated px-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:border-primary/60"
                    />
                    <button
                      id="btn-manual-submit"
                      onClick={handleManualSubmit}
                      disabled={!manualUrl.trim() || isProcessing}
                      className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-smooth hover:opacity-90 disabled:opacity-40"
                    >
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Process"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {(isProcessing || scanResult || scanError) && (
              <div className="mt-4">
                {isProcessing && (
                  <div className="flex items-center gap-3 rounded-2xl border border-border bg-card-elevated/40 p-4">
                    <Loader2 className="h-5 w-5 animate-spin text-[#a4c9e9]" />
                    <div>
                      <div className="text-sm font-medium text-foreground">Processing scan...</div>
                      <div className="text-xs text-muted-foreground">Toggling IN/OUT status</div>
                    </div>
                  </div>
                )}

                {scanError && !isProcessing && (
                  <div className="flex items-start gap-3 rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    <div>
                      <div className="text-sm font-medium text-destructive">Scan Failed</div>
                      <div className="text-xs text-muted-foreground">{scanError}</div>
                    </div>
                  </div>
                )}

                {scanResult && !isProcessing && (
                  <div
                    className={`rounded-2xl border p-4 ${
                      scanResult.newStatus === "in"
                        ? "border-emerald-500/30 bg-emerald-500/10"
                        : "border-red-500/30 bg-red-500/10"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                          scanResult.newStatus === "in"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {scanResult.newStatus === "in" ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : (
                          <ArrowLeftRight className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">
                            {scanResult.action === "SCAN_IN" ? "Scanned IN" : "Scanned OUT"}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              scanResult.newStatus === "in"
                                ? "bg-emerald-500 text-white"
                                : "bg-red-500 text-white"
                            }`}
                          >
                            {scanResult.newStatus}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">{scanResult.partName}</span>
                          {" · "}
                          {scanResult.factoryOrigin}
                          {" · "}
                          {scanResult.value} units
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {scanResult.message}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Side panel */}
          <aside className="space-y-6">
            <div className="rounded-3xl border border-border-surface bg-card p-5 sm:p-6">
              <h2 className="text-[13px] font-semibold tracking-wide">Scan Methods</h2>
              <ul className="mt-4 space-y-4 text-[12.5px] text-muted-foreground">
                <li className="flex gap-2.5">
                  <Camera className="mt-0.5 h-4 w-4 shrink-0 text-[#a4c9e9]" />
                  <span>
                    <strong className="text-foreground">Camera Langsung</strong> - Membutuhkan HTTPS
                    , 25 FPS dengan ARIS native untuk scan tercepat.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <ImageUp className="mt-0.5 h-4 w-4 shrink-0 text-[#a4c9e9]" />
                  <span>
                    <strong className="text-foreground">Ambil Gambar</strong> - Berfungsi di semua
                    perangkat seluler melalui HTTP. Membuka kamera bawaan untuk mengambil foto QR.
                  </span>
                </li>
                <li className="flex gap-2.5">
                  <Link2 className="mt-0.5 h-4 w-4 shrink-0 text-[#a4c9e9]" />
                  <span>
                    <strong className="text-foreground">Tempel URL</strong> - Scan dengan SCANNER,
                    salin URL yang ditampilkan, tempel di sini dan tekan Process.
                  </span>
                </li>
              </ul>
            </div>

            {/* Recent History */}
            <div className="rounded-3xl border border-border-surface bg-card p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-2 text-[13px] font-semibold tracking-wide">
                  <History className="h-4 w-4 text-muted-foreground" />
                  Scan Terbaru
                </h2>
                <Link
                  to="/task-history"
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] text-[#a4c9e9] transition-smooth hover:bg-sidebar-hover"
                >
                  Lihat semua
                  <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>

              <ul className="mt-3 divide-y divide-border">
                {history.length === 0 ? (
                  <li className="py-4 text-center text-xs text-muted-foreground">No scans yet.</li>
                ) : (
                  history.slice(0, 6).map((r) => {
                    const diffMin = Math.floor(
                      (Date.now() - new Date(r.created_at).getTime()) / 60000,
                    );
                    const timeLabel =
                      diffMin < 1
                        ? "Just now"
                        : diffMin < 60
                          ? `${diffMin} min lalu`
                          : `${Math.floor(diffMin / 60)} J lalu`;
                    const isIn = r.action === "SCAN_IN";

                    return (
                      <li
                        key={r.id}
                        className="flex items-center gap-3 py-3 transition-smooth hover:bg-sidebar-hover/40"
                      >
                        <div
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            isIn ? "bg-emerald-500/10" : "bg-red-500/10"
                          }`}
                        >
                          <span
                            className={`text-[10px] font-bold ${isIn ? "text-emerald-400" : "text-red-400"}`}
                          >
                            {isIn ? "IN" : "OUT"}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="truncate text-[13px] font-medium">{r.label}</span>
                            <span className="rounded-full bg-card-elevated px-2 py-0.5 text-[10.5px] text-muted-foreground">
                              {r.qr_id}
                            </span>
                          </div>
                          <div className="truncate text-[11.5px] text-muted-foreground">
                            {r.factory} · {timeLabel}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </aside>
        </div>
      </div>
    </DashboardLayout>
  );
}
