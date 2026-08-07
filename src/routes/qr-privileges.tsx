import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ShieldCheck,
  Search,
  X,
  ChevronRight,
  ChevronLeft,
  Loader2,
  CheckCircle2,
  AlertCircle,
  RefreshCcw,
  Shield,
  ShieldOff,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  usePrivilegeStations,
  useStationPrivilegeDetail,
  useSetStationPrivileges,
  useResetStationPrivileges,
  type StationPrivilegeInfo,
  type PrivilegeQrItem,
} from "@/hooks/use-privileges";

export const Route = createFileRoute("/qr-privileges")({
  head: () => ({
    meta: [
      { title: "Privilege QR - Sugity Integrated Systems" },
      { name: "description", content: "Kelola akses QR scan per akun station." },
    ],
  }),
  component: QrPrivilegesPage,
});

type ToastType = "success" | "error";
function Toast({ msg, type, onClose }: { msg: string; type: ToastType; onClose: () => void }) {
  return (
    <div
      className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 rounded-2xl px-5 py-3.5 shadow-2xl text-sm font-semibold animate-in slide-in-from-bottom-4 duration-300 ${
        type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
      }`}
    >
      {type === "success" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0" />
      )}
      {msg}
      <button onClick={onClose} className="ml-2 opacity-80 hover:opacity-100">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function StationCard({
  station,
  onManage,
}: {
  station: StationPrivilegeInfo;
  onManage: (s: StationPrivilegeInfo) => void;
}) {
  const isRestricted = station.privilege_mode === "restricted";
  return (
    <div className="rounded-2xl border border-border-surface bg-surface-section p-5 flex flex-col gap-4 transition-all hover:border-[#C05C30]/40 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: isRestricted ? "#2A1A0E" : "#1A2A1A" }}
          >
            {isRestricted ? (
              <Shield className="h-5 w-5" style={{ color: "#FB923C" }} />
            ) : (
              <ShieldOff className="h-5 w-5" style={{ color: "#4ade80" }} />
            )}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{station.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">
              {station.device_code} · {station.device_role}
            </p>
          </div>
        </div>
        <span
          className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
            isRestricted ? "bg-orange-500/10 text-orange-400" : "bg-emerald-500/10 text-emerald-400"
          }`}
        >
          {isRestricted ? `Restricted · ${station.privilege_count} QR` : "Default"}
        </span>
      </div>
      {station.location && <p className="text-[11px] text-muted-foreground">{station.location}</p>}
      <button
        id={`btn-manage-privilege-${station.id}`}
        onClick={() => onManage(station)}
        className="w-full rounded-xl border border-border bg-card-elevated/40 py-2.5 text-xs font-semibold text-foreground transition-smooth hover:bg-accent hover:border-[#C05C30]/60"
      >
        Atur Privilege
      </button>
    </div>
  );
}

function PrivilegeModal({
  station,
  onClose,
  onToast,
}: {
  station: StationPrivilegeInfo;
  onClose: () => void;
  onToast: (msg: string, type: "success" | "error") => void;
}) {
  const { data: detail, isLoading } = useStationPrivilegeDetail(station.id);
  const setPrivileges = useSetStationPrivileges();
  const resetPrivileges = useResetStationPrivileges();

  const [searchLeft, setSearchLeft] = useState("");
  const [searchRight, setSearchRight] = useState("");
  const [selectedLeft, setSelectedLeft] = useState<Set<number>>(new Set());
  const [selectedRight, setSelectedRight] = useState<Set<number>>(new Set());
  // Local state mirrors the allowed list
  const [allowedIds, setAllowedIds] = useState<Set<number> | null>(null);

  // Initialize allowedIds from API data (once)
  const effectiveAllowed: Set<number> = useMemo(() => {
    if (allowedIds !== null) return allowedIds;
    if (!detail) return new Set();
    return new Set(detail.qr_list.filter((q) => q.is_allowed).map((q) => q.id));
  }, [allowedIds, detail]);

  const allQrs: PrivilegeQrItem[] = detail?.qr_list ?? [];

  const leftList = useMemo(
    () =>
      allQrs
        .filter((q) => !effectiveAllowed.has(q.id))
        .filter(
          (q) =>
            !searchLeft ||
            q.part_name.toLowerCase().includes(searchLeft.toLowerCase()) ||
            q.qr_id.toLowerCase().includes(searchLeft.toLowerCase()),
        ),
    [allQrs, effectiveAllowed, searchLeft],
  );

  const rightList = useMemo(
    () =>
      allQrs
        .filter((q) => effectiveAllowed.has(q.id))
        .filter(
          (q) =>
            !searchRight ||
            q.part_name.toLowerCase().includes(searchRight.toLowerCase()) ||
            q.qr_id.toLowerCase().includes(searchRight.toLowerCase()),
        ),
    [allQrs, effectiveAllowed, searchRight],
  );

  const moveToRight = () => {
    if (selectedLeft.size === 0) return;
    const next = new Set(effectiveAllowed);
    selectedLeft.forEach((id) => next.add(id));
    setAllowedIds(next);
    setSelectedLeft(new Set());
  };

  const moveToLeft = () => {
    if (selectedRight.size === 0) return;
    const next = new Set(effectiveAllowed);
    selectedRight.forEach((id) => next.delete(id));
    setAllowedIds(next);
    setSelectedRight(new Set());
  };

  const toggleLeft = (id: number) => {
    const s = new Set(selectedLeft);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedLeft(s);
  };

  const toggleRight = (id: number) => {
    const s = new Set(selectedRight);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedRight(s);
  };

  const handleSave = () => {
    setPrivileges.mutate(
      { stationId: station.id, qrIds: Array.from(effectiveAllowed) },
      {
        onSuccess: () => {
          onToast(
            effectiveAllowed.size === 0
              ? `${station.name} direset ke open access.`
              : `Privilege disimpan: ${effectiveAllowed.size} QR diizinkan untuk ${station.name}.`,
            "success",
          );
          onClose();
        },
        onError: (e) => onToast(e.message, "error"),
      },
    );
  };

  const handleReset = () => {
    resetPrivileges.mutate(station.id, {
      onSuccess: () => {
        onToast(`${station.name} direset ke default (semua QR diizinkan).`, "success");
        onClose();
      },
      onError: (e) => onToast(e.message, "error"),
    });
  };

  const isPending = setPrivileges.isPending || resetPrivileges.isPending;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-border-surface bg-surface-section shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border-surface">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#C05C30]" />
              Pengaturan Privilege QR - {station.name}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Pindahkan QR ke kolom kanan untuk mengizinkan. Kosongkan kolom kanan = open access.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 hover:bg-accent text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden p-6">
          {isLoading ? (
            <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Memuat data QR...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 h-full min-h-[320px]">
              {/* Left: Available QRs */}
              <div className="flex flex-col rounded-2xl border border-border-surface bg-card overflow-hidden">
                <div className="px-4 pt-4 pb-2 border-b border-border-surface">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    QR Belum Diizinkan ({leftList.length})
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={searchLeft}
                      onChange={(e) => setSearchLeft(e.target.value)}
                      placeholder="Cari QR..."
                      className="w-full rounded-lg border border-border-surface bg-card-elevated pl-8 pr-3 py-2 text-xs outline-none focus:border-[#C05C30]"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
                  {leftList.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">Tidak ada QR</p>
                  ) : (
                    leftList.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => toggleLeft(q.id)}
                        className={`w-full text-left rounded-xl px-3 py-2.5 text-xs transition-smooth ${
                          selectedLeft.has(q.id)
                            ? "bg-[#C05C30]/20 border border-[#C05C30]/50"
                            : "hover:bg-card-elevated border border-transparent"
                        }`}
                      >
                        <span className="font-semibold text-foreground block truncate">
                          {q.part_name}
                        </span>
                        <span className="text-muted-foreground">
                          {q.qr_id} · {q.factory}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Center: Arrow buttons */}
              <div className="flex md:flex-col items-center justify-center gap-2">
                <button
                  onClick={moveToRight}
                  disabled={selectedLeft.size === 0}
                  title="Izinkan yang dipilih"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card-elevated text-foreground transition-smooth hover:bg-[#C05C30] hover:text-white hover:border-[#C05C30] disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={moveToLeft}
                  disabled={selectedRight.size === 0}
                  title="Cabut izin yang dipilih"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card-elevated text-foreground transition-smooth hover:bg-red-500 hover:text-white hover:border-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              {/* Right: Allowed QRs */}
              <div className="flex flex-col rounded-2xl border border-border-surface bg-card overflow-hidden">
                <div className="px-4 pt-4 pb-2 border-b border-border-surface">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    QR Diizinkan ({rightList.length})
                  </p>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      value={searchRight}
                      onChange={(e) => setSearchRight(e.target.value)}
                      placeholder="Cari QR..."
                      className="w-full rounded-lg border border-border-surface bg-card-elevated pl-8 pr-3 py-2 text-xs outline-none focus:border-[#C05C30]"
                    />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
                  {rightList.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">
                      Belum ada QR diizinkan
                    </p>
                  ) : (
                    rightList.map((q) => (
                      <button
                        key={q.id}
                        onClick={() => toggleRight(q.id)}
                        className={`w-full text-left rounded-xl px-3 py-2.5 text-xs transition-smooth ${
                          selectedRight.has(q.id)
                            ? "bg-emerald-500/20 border border-emerald-500/50"
                            : "hover:bg-card-elevated border border-transparent"
                        }`}
                      >
                        <span className="font-semibold text-foreground block truncate">
                          {q.part_name}
                        </span>
                        <span className="text-muted-foreground">
                          {q.qr_id} · {q.factory}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-border-surface">
          <button
            id={`btn-reset-privilege-${station.id}`}
            onClick={handleReset}
            disabled={isPending}
            className="inline-flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/10 px-4 py-2.5 text-xs font-semibold text-red-400 transition-smooth hover:bg-red-500/20 disabled:opacity-50"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Reset ke Default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isPending}
              className="rounded-full border border-border bg-card-elevated px-5 py-2.5 text-xs font-semibold text-foreground transition-smooth hover:bg-accent disabled:opacity-50"
            >
              Batal
            </button>
            <button
              id={`btn-save-privilege-${station.id}`}
              onClick={handleSave}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold text-white transition-smooth disabled:opacity-50"
              style={{ backgroundColor: isPending ? "#2A1A0E" : "#C05C30" }}
            >
              {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Simpan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function QrPrivilegesPage() {
  const { data: stations = [], isLoading, refetch } = usePrivilegeStations();
  const [selectedStation, setSelectedStation] = useState<StationPrivilegeInfo | null>(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  const showToast = (msg: string, type: "success" | "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4005);
  };

  const filtered = useMemo(
    () =>
      stations.filter(
        (s) =>
          !search ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          s.device_code.toLowerCase().includes(search.toLowerCase()),
      ),
    [stations, search],
  );

  const openCount = filtered.filter((s) => s.privilege_mode === "open").length;
  const restrictedCount = filtered.filter((s) => s.privilege_mode === "restricted").length;

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        {/* Page heading */}
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Sistem Keamanan
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl flex items-center gap-3">
            <ShieldCheck className="h-7 w-7 text-[#C05C30]" />
            Privilege QR
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Atur QR code mana saja yang boleh di-scan oleh setiap akun station. Kosongkan = semua QR
            diizinkan.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Station", value: stations.length, color: "text-foreground" },
            { label: "Open Access", value: openCount, color: "text-emerald-400" },
            { label: "Restricted", value: restrictedCount, color: "text-orange-400" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-border-surface bg-surface-section px-5 py-4"
            >
              <p className="text-xs text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Search + Refresh */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              id="input-search-stations"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari station..."
              className="w-full rounded-xl border border-border-surface bg-surface-section pl-10 pr-4 py-2.5 text-sm text-foreground outline-none focus:border-[#C05C30] placeholder:text-muted-foreground/60"
            />
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-card-elevated px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent transition-smooth"
          >
            <RefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {/* Station Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center h-48 gap-3 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Memuat data station...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground">
            <ShieldCheck className="h-8 w-8 opacity-30" />
            <p className="text-sm">Tidak ada station ditemukan.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((station) => (
              <StationCard key={station.id} station={station} onManage={setSelectedStation} />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedStation && (
        <PrivilegeModal
          station={selectedStation}
          onClose={() => setSelectedStation(null)}
          onToast={showToast}
        />
      )}

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
    </DashboardLayout>
  );
}
