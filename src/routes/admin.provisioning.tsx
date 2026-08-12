import { useState, useEffect, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  Search,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Usb,
  Cpu,
  Save,
  Wifi,
  Server,
  Factory,
  Link2,
  Info,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { fetchApi } from "@/lib/api";

export const Route = createFileRoute("/admin/provisioning")({
  head: () => ({
    meta: [
      { title: "USB Provisioning - Sugity Integrated Systems" },
      { name: "description", content: "Zero-Touch WebSerial Provisioning untuk ESP32." },
    ],
  }),
  component: ProvisioningPage,
});

type QRItem = {
  id: number;
  qr_id: string;
  part_name: string;
  factory: string;
  machine_origin?: string;
};

type MachineItem = {
  id: number;
  machine_code: string;
  machine_name: string;
  factory?: string;
  status?: string;
};

function Toast({
  msg,
  type,
  onClose,
}: {
  msg: string;
  type: "success" | "error" | "info";
  onClose: () => void;
}) {
  const bg =
    type === "success" ? "bg-emerald-500" : type === "error" ? "bg-red-500" : "bg-blue-500";
  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl text-sm font-semibold text-white animate-in slide-in-from-bottom-4 duration-300 ${bg}`}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100">
        X
      </button>
    </div>
  );
}

function buildWebhookPath(machineCode: string, selectedQrs: Set<string>): string {
  if (!machineCode) return "—";
  const mc = machineCode.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (selectedQrs.size === 1) {
    const qr = encodeURIComponent(Array.from(selectedQrs)[0]);
    return `/webhook/${mc}/${qr}`;
  }
  if (selectedQrs.size > 1) {
    return `/webhook/${mc}`;
  }
  return `—`;
}
function ProvisioningPage() {

  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [isLoadingMachines, setIsLoadingMachines] = useState(true);
  const [selectedMachine, setSelectedMachine] = useState<MachineItem | null>(null);
  const [machineSearch, setMachineSearch] = useState("");

  const [qrs, setQrs] = useState<QRItem[]>([]);
  const [isLoadingQrs, setIsLoadingQrs] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedQrs, setSelectedQrs] = useState<Set<string>>(new Set());

  const [serialPort, setSerialPort] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [serialLog, setSerialLog] = useState<string>("");

  const [ssid, setSsid] = useState("");
  const [pass, setPass] = useState("");
  const [serverIp, setServerIp] = useState("");

  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [isPushing, setIsPushing] = useState(false);

  const showToast = (msg: string, type: "success" | "error" | "info") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    loadMachines();
    if (typeof window !== "undefined") {
      setServerIp(window.location.hostname);
    }
  }, []);

  const loadMachines = async () => {
    setIsLoadingMachines(true);
    try {
      const data = await fetchApi<{ data: MachineItem[] }>("/mesin");
      setMachines((data as any)?.data || data || []);
    } catch (err: any) {
      showToast("Gagal memuat daftar mesin: " + err.message, "error");
    } finally {
      setIsLoadingMachines(false);
    }
  };

  const loadQrsForMachine = useCallback(async (machine: MachineItem) => {
    setIsLoadingQrs(true);
    setQrs([]);
    setSelectedQrs(new Set());
    setSearch("");
    try {
      const data = await fetchApi<any>(
        `/qr?machine_code=${encodeURIComponent(machine.machine_code)}`,
      );
      const rows: QRItem[] = (data as any)?.data || data || [];
      setQrs(rows);
      if (rows.length === 0) {
        showToast(`Tidak ada QR terdaftar untuk mesin ${machine.machine_code}.`, "info");
      }
    } catch (err: any) {
      showToast("Gagal memuat QR: " + err.message, "error");
    } finally {
      setIsLoadingQrs(false);
    }
  }, []);

  const selectMachine = (machine: MachineItem) => {
    setSelectedMachine(machine);
    loadQrsForMachine(machine);
  };

  const connectSerial = async () => {
    if (!("serial" in navigator)) {
      showToast(
        "Browser Anda tidak mendukung WebSerial. Gunakan Chrome atau Edge.", //pr
        "error",
      );
      return;
    }
    try {
      // @ts-ignore
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
      setSerialPort(port);
      setIsConnected(true);
      showToast("ESP32 berhasil terhubung!", "success");
      readSerialLoop(port);
    } catch (err: any) {
      console.error(err);
      showToast("Gagal terhubung ke ESP32", "error");
    }
  };

  const readSerialLoop = async (port: any) => {
    const textDecoder = new TextDecoderStream();
    port.readable.pipeTo(textDecoder.writable);
    const reader = textDecoder.readable.getReader();

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          setSerialLog((prev) => prev + value);
        }
      }
    } catch (err) {
      console.error("Serial read error", err);
    } finally {
      reader.releaseLock();
    }
  };

  const pushConfig = async () => {
    if (!serialPort) {
      showToast("Serial belum terhubung!", "error");
      return;
    }
    if (!selectedMachine) {
      showToast("Pilih mesin terlebih dahulu!", "error");
      return;
    }
    if (selectedQrs.size === 0) {
      showToast("Pilih minimal 1 QR!", "error");
      return;
    }
    if (!ssid || !pass || !serverIp) {
      showToast("WiFi SSID, Password, dan IP harus diisi!", "error");
      return;
    }

    setIsPushing(true);

    // Normalize machine_code to lowercase path segment per spec
    const mcNormalized = selectedMachine.machine_code.toLowerCase().replace(/[^a-z0-9]/g, "");
    const listenQrsArr = Array.from(selectedQrs);

    // Determine webhook_path: QR-scoped if single QR, machine-level if multi
    const webhookPath =
      listenQrsArr.length === 1
        ? `/webhook/${mcNormalized}/${encodeURIComponent(listenQrsArr[0])}`
        : `/webhook/${mcNormalized}`;

    // v4 provisioning payload — matches @karakurigate NVS schema exactly
    const payload = {
      cmd: "config",
      wifi_ssid: ssid,
      wifi_pass: pass,
      server_ip: serverIp,
      port: Number(import.meta.env.VITE_API_PORT) || 4000,
      machine_code: mcNormalized,
      listen_qrs: listenQrsArr,
      webhook_path: webhookPath,
    };

    const jsonStr = JSON.stringify(payload) + "\n";

    try {
      const textEncoder = new TextEncoderStream();
      textEncoder.readable.pipeTo(serialPort.writable);
      const writer = textEncoder.writable.getWriter();
      await writer.write(jsonStr);
      writer.releaseLock();
      showToast("Konfigurasi berhasil dikirim ke ESP32!", "success");
      setSerialLog(
        (prev) => prev + `\n[SENT CONFIG] ${new Date().toLocaleTimeString()}\n` + jsonStr,
      );
    } catch (err) {
      console.error("Write error", err);
      showToast("Gagal mengirim konfigurasi", "error");
    } finally {
      setIsPushing(false);
    }
  };

  const toggleQr = (qrId: string) => {
    const next = new Set(selectedQrs);
    if (next.has(qrId)) {
      next.delete(qrId);
    } else {
      next.add(qrId);
    }
    setSelectedQrs(next);
  };

  const filteredMachines = machines.filter(
    (m) =>
      !machineSearch ||
      m.machine_code.toLowerCase().includes(machineSearch.toLowerCase()) ||
      m.machine_name.toLowerCase().includes(machineSearch.toLowerCase()),
  );

  const filteredQrs = qrs.filter(
    (q) =>
      !search ||
      q.part_name.toLowerCase().includes(search.toLowerCase()) ||
      q.qr_id.toLowerCase().includes(search.toLowerCase()),
  );

  const webhookPreview = selectedMachine
    ? buildWebhookPath(selectedMachine.machine_code, selectedQrs)
    : "—";

  const isWebhookQrScoped = selectedQrs.size === 1 && !!selectedMachine;
  const isWebhookMachineLevel = selectedQrs.size > 1 && !!selectedMachine;

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Sistem Hardware
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl flex items-center gap-3">
            <Usb className="h-7 w-7 text-[#C05C30]" />
            ESP32 USB Provisioning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Zero-Touch Serial Setup: Sambungkan ESP32 via USB, pilih mesin dan QR, lalu kirim
            konfigurasi tanpa flashing ulang.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr_380px] gap-6">
          <div className="flex flex-col gap-4 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="rounded-2xl border border-border-surface bg-surface-section p-5 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Factory className="h-4 w-4 text-[#C05C30]" />
                  Pilih Machine
                </h2>
                {selectedMachine && (
                  <span className="text-xs font-bold px-2 py-1 bg-[#C05C30]/20 text-[#C05C30] rounded-md">
                    {selectedMachine.machine_code}
                  </span>
                )}
              </div>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={machineSearch}
                  onChange={(e) => setMachineSearch(e.target.value)}
                  placeholder="Cari mesin..."
                  className="w-full rounded-lg border border-border-surface bg-card-elevated pl-8 pr-3 py-2 text-sm outline-none focus:border-[#C05C30]"
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
                {isLoadingMachines ? (
                  <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm">Memuat daftar mesin...</span>
                  </div>
                ) : filteredMachines.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-8">
                    Tidak ada mesin ditemukan.
                  </div>
                ) : (
                  filteredMachines.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => selectMachine(m)}
                      className={`w-full text-left rounded-xl px-4 py-3 text-sm transition-smooth border ${selectedMachine?.id === m.id
                          ? "bg-[#C05C30]/20 border-[#C05C30]/50"
                          : "bg-card hover:bg-card-elevated border-border-surface"
                        }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-foreground block">
                            {m.machine_code}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {m.machine_name}
                            {m.factory ? ` · ${m.factory}` : ""}
                          </span>
                        </div>
                        {selectedMachine?.id === m.id && (
                          <CheckCircle2 className="h-4 w-4 text-[#C05C30] shrink-0" />
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 h-[calc(100vh-220px)] min-h-[500px]">
            <div className="rounded-2xl border border-border-surface bg-surface-section p-5 flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#C05C30]" />
                  Pilih QR Codes
                  {selectedMachine && (
                    <span className="text-xs font-normal text-muted-foreground">
                      — {selectedMachine.machine_code}
                    </span>
                  )}
                </h2>
                <span className="text-xs font-bold px-2 py-1 bg-surface-elevated rounded-md">
                  {selectedQrs.size} terpilih
                </span>
              </div>

              {/* Recommendation nudge */}
              <div className="flex items-start gap-2 text-xs text-muted-foreground bg-surface-elevated rounded-lg px-3 py-2 mb-3">
                <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-blue-400" />
                <span>
                  <span className="text-blue-400 font-semibold">Direkomendasikan:</span> 1 QR per
                  ESP32 untuk performa &amp; isolasi terbaik.
                </span>
              </div>

              {!selectedMachine ? (
                <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                  ← Pilih mesin terlebih dahulu
                </div>
              ) : (
                <>
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Cari QR..."
                      className="w-full rounded-lg border border-border-surface bg-card-elevated pl-8 pr-3 py-2 text-sm outline-none focus:border-[#C05C30]"
                    />
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
                    {isLoadingQrs ? (
                      <div className="flex items-center justify-center h-full gap-2 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="text-sm">
                          Memuat QR untuk {selectedMachine.machine_code}...
                        </span>
                      </div>
                    ) : filteredQrs.length === 0 ? (
                      <div className="text-center text-sm text-muted-foreground py-8">
                        Tidak ada QR ditemukan untuk mesin ini.
                      </div>
                    ) : (
                      filteredQrs.map((q) => (
                        <button
                          key={q.id}
                          onClick={() => toggleQr(q.qr_id)}
                          className={`w-full text-left rounded-xl px-4 py-3 text-sm transition-smooth border ${selectedQrs.has(q.qr_id)
                              ? "bg-[#C05C30]/20 border-[#C05C30]/50"
                              : "bg-card hover:bg-card-elevated border-border-surface"
                            }`}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <span className="font-semibold text-foreground block">
                                {q.part_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {q.qr_id} &middot; {q.factory}
                              </span>
                            </div>
                            {selectedQrs.has(q.qr_id) && (
                              <CheckCircle2 className="h-4 w-4 text-[#C05C30] shrink-0" />
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Live webhook preview */}
            <div
              className={`rounded-xl border px-4 py-3 text-xs font-mono flex items-center gap-2 ${webhookPreview !== "—"
                  ? isWebhookQrScoped
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                    : "border-amber-500/30 bg-amber-500/5 text-amber-400"
                  : "border-border-surface bg-surface-section text-muted-foreground"
                }`}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate">
                <span className="opacity-60">Webhook aktif: </span>
                <span className="font-bold">{webhookPreview}</span>
              </span>
              {isWebhookMachineLevel && (
                <span className="text-[10px] text-amber-400 shrink-0">multi-QR</span>
              )}
              {isWebhookQrScoped && (
                <span className="text-[10px] text-emerald-400 shrink-0">✓ QR-scoped</span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-border-surface bg-surface-section p-5">
              <h2 className="text-sm font-semibold flex items-center gap-2 mb-4">
                <Cpu className="h-4 w-4 text-[#C05C30]" />
                Koneksi Serial
              </h2>

              <div className="flex items-center gap-3 mb-4">
                <button
                  id="connect-esp32-btn"
                  onClick={connectSerial}
                  disabled={isConnected}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-smooth ${isConnected
                      ? "bg-emerald-500/20 text-emerald-400 cursor-not-allowed"
                      : "bg-[#C05C30] text-white hover:bg-[#A04A26]"
                    }`}
                >
                  {isConnected ? "Terhubung" : "Connect ESP32"}
                </button>
              </div>

              {isConnected && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400 text-xs font-medium flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Serial port aktif. Siap menerima konfigurasi.
                </div>
              )}

              <div className="space-y-4 border-t border-border-surface pt-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Wifi className="w-3 h-3" /> WiFi SSID
                  </label>
                  <input
                    id="wifi-ssid-input"
                    value={ssid}
                    onChange={(e) => setSsid(e.target.value)}
                    placeholder="Nama WiFi Pabrik"
                    className="w-full rounded-lg border border-border-surface bg-card-elevated px-3 py-2 text-sm outline-none focus:border-[#C05C30]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> WiFi Password
                  </label>
                  <input
                    id="wifi-pass-input"
                    value={pass}
                    onChange={(e) => setPass(e.target.value)}
                    type="password"
                    placeholder="Password WiFi"
                    className="w-full rounded-lg border border-border-surface bg-card-elevated px-3 py-2 text-sm outline-none focus:border-[#C05C30]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider flex items-center gap-1">
                    <Server className="w-3 h-3" /> IP Server Gate
                  </label>
                  <input
                    id="server-ip-input"
                    value={serverIp}
                    onChange={(e) => setServerIp(e.target.value)}
                    placeholder="192.168.1.100"
                    className="w-full rounded-lg border border-border-surface bg-card-elevated px-3 py-2 text-sm outline-none focus:border-[#C05C30]"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    IP komputer yang menjalankan API Server (port{" "}
                    {import.meta.env.VITE_API_PORT || 4000}).
                  </p>
                </div>

                {/* Summary before push */}
                {selectedMachine && selectedQrs.size > 0 && (
                  <div className="rounded-xl border border-border-surface bg-surface-elevated px-4 py-3 text-xs space-y-1.5">
                    <div className="text-muted-foreground font-semibold uppercase tracking-wider mb-2">
                      Ringkasan Konfigurasi
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mesin</span>
                      <span className="font-semibold">{selectedMachine.machine_code}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">QR terpilih</span>
                      <span className="font-semibold">{selectedQrs.size} QR</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-muted-foreground shrink-0">Webhook path</span>
                      <span className="font-mono font-semibold text-right truncate text-[10px]">
                        {webhookPreview}
                      </span>
                    </div>
                  </div>
                )}

                <button
                  id="push-config-btn"
                  onClick={pushConfig}
                  disabled={!isConnected || isPushing || !selectedMachine || selectedQrs.size === 0}
                  className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-surface-elevated border border-[#C05C30] py-3 text-sm font-semibold text-[#C05C30] transition-smooth hover:bg-[#C05C30] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPushing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan &amp; Hubungkan
                </button>
              </div>
            </div>

            {/* Serial Log Terminal */}
            <div className="rounded-2xl border border-border-surface bg-[#0a0d14] p-4 flex-1 flex flex-col min-h-[200px]">
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center justify-between">
                <span>SERIAL TERMINAL</span>
                <button onClick={() => setSerialLog("")} className="hover:text-foreground">
                  Clear
                </button>
              </div>
              <div className="flex-1 overflow-y-auto font-mono text-[11px] text-emerald-400 whitespace-pre-wrap">
                {serialLog || "Menunggu data dari ESP32..."}
              </div>
            </div>
          </div>
        </div>
      </div>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
