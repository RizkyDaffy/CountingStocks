import { useState, useMemo, useEffect } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  ChevronRight,
  ChevronLeft,
  Search,
  Link2,
  Unlink,
  Sparkles,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  ArrowRight,
  FileSpreadsheet,
  AlertCircle,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  useBcpLinks,
  useBcpParts,
  useBcpSheets,
  useBcpSheetRows,
  useSaveBcpLink,
  useDeleteBcpLink,
  useTriggerBcpSync,
  type BcpPart,
  type SheetTab,
} from "@/hooks/use-bcp";

type BackupSearchParams = {
  manageId?: string;
};

export const Route = createFileRoute("/backup")({
  validateSearch: (search: Record<string, unknown>): BackupSearchParams => ({
    manageId: search.manageId ? String(search.manageId) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Business Continuity Plan - Sugity Creatives" },
      { name: "description", content: "Koneksikan part ke Google Sheet sebagai sumber data stok." },
    ],
  }),
  component: BcpPage,
});

//    Wizard steps
type Step = "parts" | "sheets" | "rows";

function BcpPage() {
  const { manageId } = Route.useSearch();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("parts");
  const [selectedPart, setSelectedPart] = useState<BcpPart | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<SheetTab | null>(null);
  const [successNotice, setSuccessNotice] = useState<{
    partName: string;
    sheetTitle: string;
    rowKey: string;
  } | null>(null);

  const { data: allParts = [] } = useBcpParts("");

  // Handle manageId from URL query param e.g. /backup?manageId=12
  useEffect(() => {
    if (manageId && allParts.length > 0 && !selectedPart) {
      const found = allParts.find((p) => String(p.id) === String(manageId));
      if (found) {
        setSelectedPart(found);
        setStep("sheets");
      }
    }
  }, [manageId, allParts, selectedPart]);

  const reset = () => {
    setStep("parts");
    setSelectedPart(null);
    setSelectedSheet(null);
    if (manageId) {
      navigate({ to: "/backup", search: {} });
    }
  };

  const handleSelectPart = (p: BcpPart) => {
    setSelectedPart(p);
    setStep("sheets");
    navigate({ to: "/backup", search: { manageId: String(p.id) } });
  };

  const handleSelectSheet = (s: SheetTab) => {
    setSelectedSheet(s);
    setStep("rows");
  };

  const handleSuccess = (info: { partName: string; sheetTitle: string; rowKey: string }) => {
    setSuccessNotice(info);
    reset();
  };

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Inventory BCP
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Business Continuity Plan (BCP)
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Hubungkan part yang belum terimplementasi sistem scanner / automasi ke Google Sheet.
            Data stok di &quot;Lihat Stock&quot; akan otomatis diperbarui setiap kali data di Google
            Sheet diisi.
          </p>
        </div>

        {/* Success Banner */}
        {successNotice && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-400">
            <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Operation successful!</p>
              <p className="text-xs text-foreground/90 mt-0.5">
                Part{" "}
                <span className="font-semibold text-emerald-400">
                  &quot;{successNotice.partName}&quot;
                </span>{" "}
                sekarang terkoneksi dan mendengarkan data dari tab{" "}
                <span className="font-semibold">&quot;{successNotice.sheetTitle}&quot;</span> pada
                baris <span className="font-semibold">&quot;{successNotice.rowKey}&quot;</span>.
              </p>
            </div>
            <button
              onClick={() => setSuccessNotice(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ✕
            </button>
          </div>
        )}

        {/* Breadcrumb Navigation */}
        <div className="mb-4">
          <Breadcrumb
            step={step}
            part={selectedPart}
            sheet={selectedSheet}
            onGoStep={(target) => {
              if (target === "parts") reset();
              else if (target === "sheets" && selectedPart) {
                setStep("sheets");
                setSelectedSheet(null);
              }
            }}
          />
        </div>

        {/* Step panels */}
        <div className="mt-2">
          {step === "parts" && <StepParts onSelect={handleSelectPart} />}
          {step === "sheets" && selectedPart && (
            <StepSheets part={selectedPart} onSelect={handleSelectSheet} onBack={() => reset()} />
          )}
          {step === "rows" && selectedPart && selectedSheet && (
            <StepRows
              part={selectedPart}
              sheet={selectedSheet}
              onBack={() => {
                setStep("sheets");
                setSelectedSheet(null);
              }}
              onDone={handleSuccess}
            />
          )}
        </div>

        {/* Existing links table */}
        <ExistingLinks />
      </div>
    </DashboardLayout>
  );
}

//    Breadcrumb

function Breadcrumb({
  step,
  part,
  sheet,
  onGoStep,
}: {
  step: Step;
  part: BcpPart | null;
  sheet: SheetTab | null;
  onGoStep: (target: Step) => void;
}) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground flex-wrap bg-surface-section px-4 py-2.5 rounded-2xl border border-border-surface">
      <button
        onClick={() => onGoStep("parts")}
        className={`px-2 py-1 rounded-lg transition-smooth hover:bg-surface-elevated hover:text-foreground ${
          step === "parts" ? "font-bold text-[#C05C30] bg-[#C05C30]/10" : ""
        }`}
      >
        1. bcp (Pilih Part)
      </button>

      {part && (
        <>
          <ChevronRight className="h-3.5 w-3.5 opacity-50 shrink-0" />
          <button
            onClick={() => onGoStep("sheets")}
            className={`px-2 py-1 rounded-lg transition-smooth hover:bg-surface-elevated hover:text-foreground truncate max-w-[200px] ${
              step === "sheets" ? "font-bold text-[#C05C30] bg-[#C05C30]/10" : ""
            }`}
          >
            2. {part.part_name} (Pilih Sheet)
          </button>
        </>
      )}

      {sheet && (
        <>
          <ChevronRight className="h-3.5 w-3.5 opacity-50 shrink-0" />
          <span
            className={`px-2 py-1 rounded-lg font-bold text-[#C05C30] bg-[#C05C30]/10 truncate max-w-[200px]`}
          >
            3. {sheet.sheetTitle} (Pilih Baris Part)
          </span>
        </>
      )}
    </nav>
  );
}

//    Step 1: Select Part

function StepParts({ onSelect }: { onSelect: (p: BcpPart) => void }) {
  const [search, setSearch] = useState("");
  const { data: parts = [], isLoading } = useBcpParts(search);
  const { data: links = [] } = useBcpLinks();

  const linkedIds = useMemo(() => new Set(links.map((l) => l.part_id)), [links]);

  return (
    <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <span className="text-xs font-mono text-[#C05C30] font-semibold uppercase tracking-wider">
            Tahap 1
          </span>
          <h2 className="text-base font-semibold text-foreground">
            Pilih Part yang Ingin Dikoneksikan
          </h2>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari part name / number…"
            className="h-10 w-full rounded-full border border-border-surface bg-card-elevated pl-9 pr-4 text-sm outline-none transition-smooth focus:border-[#C05C30]"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : parts.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Tidak ada data part ditemukan.
        </p>
      ) : (
        <ul className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {parts.map((p) => {
            const linked = linkedIds.has(p.id);
            return (
              <li key={p.id}>
                <button
                  onClick={() => onSelect(p)}
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-border-surface bg-surface-elevated px-4 py-3.5 text-left transition-smooth hover:bg-surface-hover hover:border-[#C05C30]/40"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground group-hover:text-[#C05C30]">
                      {p.part_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">{p.part_number}</span>
                      {p.machine ? ` · MC#${p.machine}` : ""}
                      {p.factory_origin ? ` · ${p.factory_origin}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {linked ? (
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                        Linked
                      </span>
                    ) : (
                      <span className="rounded-full bg-card px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        Not Linked
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

//    Step 2: Select Sheet Tab

function StepSheets({
  part,
  onSelect,
  onBack,
}: {
  part: BcpPart;
  onSelect: (s: SheetTab) => void;
  onBack: () => void;
}) {
  const { data: sheets = [], isLoading, refetch } = useBcpSheets();

  return (
    <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-surface bg-card-elevated text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
            title="Kembali ke pilih part"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <span className="text-xs font-mono text-[#C05C30] font-semibold uppercase tracking-wider">
              Tahap 2
            </span>
            <h2 className="text-base font-semibold text-foreground">
              Silahkan Pilih Shift Sheet untuk:{" "}
              <span className="text-[#C05C30]">{part.part_name}</span>
            </h2>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-surface bg-card-elevated text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
          title="Refresh daftar sheet"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Pilih worksheet tab pada Google Spreadsheet tempat data part ini diinput:
      </p>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : sheets.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Tidak ada sheet tersedia. Pastikan Google Sheet Service aktif dan terhubung.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {sheets.map((s) => (
            <button
              key={s.sheetId}
              onClick={() => onSelect(s)}
              className="group flex items-center justify-between gap-3 rounded-2xl border border-border-surface bg-surface-elevated p-4 text-left transition-smooth hover:bg-surface-hover hover:border-[#C05C30]/40"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C05C30]/10 text-[#C05C30]">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground group-hover:text-[#C05C30]">
                    {s.sheetTitle}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">Sheet ID: {s.sheetId}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

//    Step 3: Match Row in Sheet

function normalise(s: string) {
  return s.trim().toUpperCase().replace(/\s+/g, " ");
}

function similarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return 1;
  const ta = new Set(na.split(/\W+/).filter(Boolean));
  const tb = new Set(nb.split(/\W+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return (2 * common) / (ta.size + tb.size);
}

function isHeaderRow(name: string): boolean {
  const n = name.trim().toUpperCase();
  return (
    n.startsWith("DATA STOCK") ||
    n === "NAMA PART" ||
    n === "PART NAME" ||
    n === "MESIN" ||
    n === "MACHINE" ||
    n === "MODEL PART" ||
    n.startsWith("TANGGAL")
  );
}

function StepRows({
  part,
  sheet,
  onBack,
  onDone,
}: {
  part: BcpPart;
  sheet: SheetTab;
  onBack: () => void;
  onDone: (info: { partName: string; sheetTitle: string; rowKey: string }) => void;
}) {
  const [search, setSearch] = useState("");
  const { data: rawValues = [], isLoading, refetch } = useBcpSheetRows(String(sheet.sheetId));
  const saveMutation = useSaveBcpLink();

  // Extract data rows (skip banners / empty rows / header label rows)
  const dataRows = useMemo(() => {
    return rawValues
      .filter((row) => row.length >= 2 && row[1]?.trim() && !isHeaderRow(row[1]))
      .map((row) => ({
        machine: row[0] ?? "",
        name: row[1] ?? "",
        model: row[2] ?? "",
        rawRow: row,
        sim: similarity(part.part_name, row[1] ?? ""),
      }));
  }, [rawValues, part.part_name]);

  // Exact / 100% Match auto-suggest
  const exactMatch = useMemo(() => {
    return dataRows.find((r) => r.sim === 1.0);
  }, [dataRows]);

  const filtered = useMemo(() => {
    if (!search) return dataRows;
    const q = normalise(search);
    return dataRows.filter(
      (r) =>
        normalise(r.name).includes(q) ||
        normalise(r.model).includes(q) ||
        normalise(r.machine).includes(q),
    );
  }, [dataRows, search]);

  const handleLink = async (rowName: string) => {
    try {
      await saveMutation.mutateAsync({
        partId: part.id,
        partName: part.part_name,
        sheetId: sheet.sheetId,
        sheetTitle: sheet.sheetTitle,
        rowKey: rowName,
      });
      onDone({
        partName: part.part_name,
        sheetTitle: sheet.sheetTitle,
        rowKey: rowName,
      });
    } catch {
      // Error state captured by saveMutation.isError
    }
  };

  return (
    <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-surface bg-card-elevated text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
            title="Kembali ke pilih sheet"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div>
            <span className="text-xs font-mono text-[#C05C30] font-semibold uppercase tracking-wider">
              Tahap 3
            </span>
            <h2 className="text-base font-semibold text-foreground">
              Silahkan Pilih Baris Part di Sheet:{" "}
              <span className="text-[#C05C30]">{sheet.sheetTitle}</span>
            </h2>
            <p className="text-xs text-muted-foreground">
              Koneksikan target:{" "}
              <span className="font-semibold text-foreground">{part.part_name}</span>
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-surface bg-card-elevated text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
          title="Refresh data baris sheet"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Auto-suggest Highlight */}
      {exactMatch && (
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Auto Suggest - Matched 100%
                </span>
              </div>
              <p className="text-sm font-semibold text-foreground truncate mt-0.5">
                {exactMatch.name}
              </p>
              <p className="text-xs text-muted-foreground">
                MC#{exactMatch.machine} {exactMatch.model ? `· ${exactMatch.model}` : ""}
              </p>
            </div>
          </div>
          <button
            onClick={() => handleLink(exactMatch.name)}
            disabled={saveMutation.isPending}
            className="rounded-full bg-emerald-500 px-5 py-2 text-xs font-bold text-white transition-smooth hover:bg-emerald-600 disabled:opacity-50 shrink-0"
          >
            {saveMutation.isPending ? "Menghubungkan…" : "Hubungkan Sekarang"}
          </button>
        </div>
      )}

      {/* Search and Filter */}
      <div className="relative mb-3.5 max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama part / model di sheet…"
          className="h-10 w-full rounded-full border border-border-surface bg-card-elevated pl-9 pr-4 text-sm outline-none transition-smooth focus:border-[#C05C30]"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          {search
            ? "Tidak ada baris yang sesuai pencarian."
            : "Data sheet kosong atau tidak ditemukan baris part."}
        </div>
      ) : (
        <ul className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
          {filtered.map((row, i) => {
            const pct = Math.round(row.sim * 100);
            return (
              <li key={i}>
                <button
                  onClick={() => handleLink(row.name)}
                  disabled={saveMutation.isPending}
                  className="group flex w-full items-center justify-between gap-3 rounded-2xl border border-border-surface bg-surface-elevated px-4 py-3.5 text-left transition-smooth hover:bg-surface-hover hover:border-[#C05C30]/40 disabled:opacity-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground group-hover:text-[#C05C30]">
                      {row.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      MC#{row.machine}
                      {row.model ? ` · ${row.model}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    {pct >= 60 && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          pct === 100
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-amber-500/10 text-amber-400"
                        }`}
                      >
                        {pct}% Match
                      </span>
                    )}
                    <Link2 className="h-4 w-4 text-muted-foreground group-hover:text-[#C05C30]" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {saveMutation.isError && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Gagal menyimpan link: {(saveMutation.error as Error).message}</span>
        </div>
      )}
    </section>
  );
}

//    Existing Links Table

function ExistingLinks() {
  const { data: links = [], isLoading, refetch } = useBcpLinks();
  const deleteMutation = useDeleteBcpLink();
  const syncMutation = useTriggerBcpSync();

  return (
    <section className="mt-8 rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="h-5 w-5 text-[#C05C30]" />
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Part Terkoneksi BCP ({links.length})
            </h2>
            <p className="text-xs text-muted-foreground">
              Data stok part ini diambil dari Google Sheet dan disinkronkan ke Lihat Stock
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending || links.length === 0}
            className="inline-flex items-center gap-1.5 rounded-full border border-border-surface bg-card-elevated px-3.5 py-2 text-xs font-semibold text-foreground transition-smooth hover:bg-accent disabled:opacity-50"
            title="Tarik data terbaru dari Google Sheet sekarang"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${syncMutation.isPending ? "animate-spin" : ""}`} />
            {syncMutation.isPending ? "Syncing…" : "Sync Now"}
          </button>
          <button
            onClick={() => refetch()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-surface bg-card-elevated text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
            title="Refresh list"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {syncMutation.isError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Gagal sinkronisasi Google Sheet: {(syncMutation.error as Error).message}</span>
        </div>
      )}

      {deleteMutation.isError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-500/10 border border-red-500/20 p-3 text-xs text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>Gagal menghapus link: {(deleteMutation.error as Error).message}</span>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-2xl bg-card animate-pulse" />
          ))}
        </div>
      ) : links.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Belum ada part yang terkoneksi ke Google Sheet. Pilih part pada wizard di atas untuk
          memulai.
        </div>
      ) : (
        <div className="space-y-2.5">
          {links.map((link) => (
            <div
              key={link.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border-surface bg-surface-elevated px-4 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">{link.part_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                  <span className="font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    {link.sheet_title}
                  </span>
                  <span>→</span>
                  <span className="font-medium text-foreground truncate max-w-md">
                    {link.row_key}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  onClick={() => deleteMutation.mutate(link.id)}
                  disabled={deleteMutation.isPending}
                  title="Hapus / Putuskan Koneksi"
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 transition-smooth hover:bg-red-500/20 disabled:opacity-50"
                >
                  <Unlink className="h-3.5 w-3.5" />
                  Putuskan
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
