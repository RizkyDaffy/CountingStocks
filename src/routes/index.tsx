import { useMemo, useState, useEffect, useCallback, lazy, Suspense } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ChevronDown,
  Download,
  ExternalLink,
  QrCode,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Package,
  Loader2,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useQrCodes, useGenerateQrCode, type GenerateQrResult } from "@/hooks/use-qr-codes";
import { useMasterParts } from "@/hooks/use-master-parts";
import { useMesin } from "@/hooks/use-mesin";
import { FactoryApi } from "@/hooks/use-master-data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isTokenValid, isAuthorizedUser } from "@/lib/auth";

const DashboardLanding = lazy(() =>
  import("@/routes/dashboard").then((m) => ({ default: m.DashboardLandingPage })),
);

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Stock Scan - Manage & Buat QR Codes" },
      {
        name: "description",
        content: "Buat QR stock codes, track asal factory dan jumlah stock dengan dashboard.",
      },
      { property: "og:title", content: "Stock Scan - Manage & Buat QR Codes" },
      {
        property: "og:description",
        content: "Buat QR stock codes, track asal factory dan jumlah stock dengan dashboard.",
      },
    ],
  }),
  component: IndexPage,
});

function IndexPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      {!mounted ? (
        <div className="min-h-screen bg-background" />
      ) : isTokenValid() && isAuthorizedUser() ? (
        <StockScanPage />
      ) : (
        <DashboardLanding />
      )}
    </Suspense>
  );
}

function StockScanPage() {
  const [partName, setPartName] = useState("");
  const [factoryOrigin, setFactoryOrigin] = useState("");
  const [value, setValue] = useState("");
  const [machineOrigin, setMachineOrigin] = useState("");
  const [createdQr, setCreatedQr] = useState<GenerateQrResult | null>(null);

  const { data: masterParts = [] } = useMasterParts();
  const { data: mesinList = [] } = useMesin();
  const { data: factories = [] } = FactoryApi.useGetAll();

  const { data: history = [], isLoading } = useQrCodes();
  const generateQrCode = useGenerateQrCode();

  const claimedPartNames = useMemo(() => new Set(history.map((qr) => qr.part_name)), [history]);

  const canSubmit = useMemo(
    () => partName.trim() && factoryOrigin && value && Number(value) > 0 && machineOrigin,
    [partName, factoryOrigin, value, machineOrigin],
  );

  const handlePartChange = (val: string) => {
    setPartName(val);
    const selectedPart = masterParts.find((p) => p.part_name === val);
    if (selectedPart) {
      if (selectedPart.factory_origin) {
        setFactoryOrigin(selectedPart.factory_origin);
      }
      if (selectedPart.machine) {
        const machineObj = mesinList.find((m) => m.machine_code === selectedPart.machine);
        if (machineObj) {
          setMachineOrigin(`${machineObj.machine_code} - ${machineObj.machine_name}`);
        } else {
          // Fallback if not found in list, but we have the code
          setMachineOrigin(selectedPart.machine);
        }
      }
    }
  };

  const handleGenerate = () => {
    if (!canSubmit) return;

    generateQrCode.mutate(
      { partName: partName.trim(), factoryOrigin, value: Number(value), machineOrigin },
      {
        onSuccess: (data) => {
          setCreatedQr(data);
        },
      },
    );

    // Reset form but keep preview
    setPartName("");
    setValue("");
  };

  const handleReset = () => {
    setPartName("");
    setFactoryOrigin("");
    setValue("");
    setMachineOrigin("");
    setCreatedQr(null);
  };

  const handleDownload = useCallback(() => {
    if (!createdQr?.qrImageBase64) return;
    const link = document.createElement("a");
    link.href = createdQr.qrImageBase64;
    link.download = `QR-${createdQr.qrId || createdQr.batchId}.png`;
    link.click();
  }, [createdQr]);

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        {/* Page heading */}
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Stock Scan
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Kelola & Buat QR Codes
          </h1>
        </div>

        {/* Top card: form + preview */}
        <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.4fr_1fr]">
            {/* Form */}
            <div>
              <h2 className="text-base font-semibold text-foreground">Buat QR Code Stock Baru</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Isi form di bawah untuk membuat QR code asli dengan metadata yang tertanam.
              </p>

              <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Part Name">
                  <Select value={partName} onValueChange={handlePartChange}>
                    <SelectTrigger className="h-11 w-full rounded-xl border border-border-surface bg-card-elevated px-4 text-sm focus:border-[#C05C30]">
                      <SelectValue placeholder="Pilih Nama Part" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 rounded-xl border-border bg-card shadow-2xl">
                      <div className="p-1">
                        {masterParts
                          .filter(
                            (p) => p.status === "active" && !claimedPartNames.has(p.part_name),
                          )
                          .map((part) => (
                            <SelectItem
                              key={part.id}
                              value={part.part_name}
                              className="rounded-md focus:bg-accent focus:text-accent-foreground cursor-pointer"
                            >
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">
                                  {part.part_name}
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {part.part_number}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                      </div>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Homelane Factory">
                  <Select value={factoryOrigin} onValueChange={setFactoryOrigin}>
                    <SelectTrigger className="h-11 w-full rounded-xl border border-border-surface bg-card-elevated px-4 text-sm focus:border-[#C05C30]">
                      <SelectValue placeholder="Pilih Asal Factory" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 rounded-xl border-border bg-card shadow-2xl">
                      <div className="p-1">
                        {factories.map((f) => (
                          <SelectItem
                            key={f.id}
                            value={f.name}
                            className="rounded-md focus:bg-accent focus:text-accent-foreground cursor-pointer"
                          >
                            {f.name}
                          </SelectItem>
                        ))}
                      </div>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Homeline Machine" className="sm:col-span-2">
                  <SelectInput
                    id="field-machine-origin"
                    value={machineOrigin}
                    onChange={setMachineOrigin}
                    placeholder="Pilih Mesin"
                    options={mesinList
                      .filter((m) => m.status === "active")
                      .map((m) => `${m.machine_code} - ${m.machine_name}`)}
                  />
                </Field>
                <Field label="Unit Value" className="sm:col-span-2">
                  <TextInput
                    id="field-unit-value"
                    value={value}
                    onChange={setValue}
                    placeholder="Berapa Jumlah Stock nya (Unit Value)"
                    type="number"
                  />
                </Field>
              </div>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <button
                  id="btn-create-qr"
                  onClick={handleGenerate}
                  disabled={!canSubmit || generateQrCode.isPending}
                  className="inline-flex items-center gap-2 rounded-full px-[22px] py-[10px] text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed"
                  style={{
                    background: generateQrCode.isPending ? "#2A1A0E" : "#C05C30",
                    color: generateQrCode.isPending ? "#FB923C" : "#FEF3EC",
                    border: generateQrCode.isPending ? "1px solid #6B3D27" : "none",
                    boxShadow: generateQrCode.isPending
                      ? "none"
                      : "inset 0 1px 0 rgba(255,255,255,0.10)",
                    opacity: !canSubmit && !generateQrCode.isPending ? "0.5" : "1",
                  }}
                  onMouseEnter={(e) => {
                    if (!generateQrCode.isPending && canSubmit) {
                      e.currentTarget.style.background = "#A84D24";
                      e.currentTarget.style.boxShadow = "0 4px 20px rgba(192,92,48,0.40)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!generateQrCode.isPending) {
                      e.currentTarget.style.background = "#C05C30";
                      e.currentTarget.style.boxShadow = "inset 0 1px 0 rgba(255,255,255,0.10)";
                    }
                  }}
                >
                  {generateQrCode.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {generateQrCode.isPending ? "Membuat Sabar yah hehe..." : "Buat QR Code"}
                </button>
                <button
                  id="btn-reset-form"
                  onClick={handleReset}
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-transparent px-5 py-2.5 text-sm font-medium text-foreground transition-smooth hover:bg-accent"
                >
                  <RotateCcw className="h-4 w-4" />
                  Mengatur Ulang
                </button>
              </div>

              {generateQrCode.isError && (
                <p className="mt-3 text-xs text-destructive">
                  Error: {generateQrCode.error?.message}
                </p>
              )}
            </div>

            {/* Preview */}
            <div className="rounded-2xl border border-border-surface bg-surface-elevated p-5">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <QrCode className="h-4 w-4 text-muted-foreground" />
                QR Code Created
              </h3>

              <div className="mt-4 flex aspect-square w-full items-center justify-center rounded-2xl border border-dashed border-border-strong bg-card text-center overflow-hidden">
                {createdQr?.qrImageBase64 ? (
                  <div className="flex flex-col items-center gap-3 px-4 py-4 w-full">
                    {/* Real QR image */}
                    <img
                      src={createdQr.qrImageBase64}
                      alt={`QR code for ${createdQr.partName}`}
                      className="w-full max-w-[200px] rounded-xl"
                    />
                    <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      QR Generated · Status: IN
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      <span className="font-medium text-foreground">{createdQr.partName}</span>
                      {" · "}
                      {createdQr.factoryOrigin}
                      {" · "}
                      {createdQr.value} units
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 font-mono break-all px-2">
                      {createdQr.batchId}
                    </div>
                  </div>
                ) : generateQrCode.isPending ? (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-xs">Membuat QR nya Sabar Yah...</span>
                  </div>
                ) : (
                  <div className="px-6 text-sm text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-40" />
                    Isi Formnya Dulu dan Tekan "Buat QR Code"
                  </div>
                )}
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  id="btn-download-qr"
                  onClick={handleDownload}
                  disabled={!createdQr?.qrImageBase64}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-smooth hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Download className="h-4 w-4" />
                  Download QR
                </button>
                {createdQr?.qrImageBase64 && (
                  <Link
                    to="/qr-viewer"
                    search={{
                      img: createdQr.qrImageBase64,
                      label: createdQr.partName,
                      partname: createdQr.partName,
                      partnum:
                        masterParts.find((p) => p.part_name === createdQr.partName)?.part_number ||
                        "",
                      partmodel:
                        masterParts.find((p) => p.part_name === createdQr.partName)?.model || "",
                      machineOrigin: createdQr.row?.machine_origin || createdQr.machineOrigin || "",
                      factoryOrigin: createdQr.factoryOrigin || "",
                      updatedAt: createdQr.row?.updated_at || "",
                    }}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-smooth hover:bg-accent"
                    title="View full screen"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                )}
              </div>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-muted-foreground">
                Scan QR Code dengan aplikasi Camera atau Scanner, QR Code ini bersifat permanen
                (STATIS).
              </p>
            </div>
          </div>
        </section>

        {/* History */}
        <section className="mt-6 rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-foreground">History Pembuatan QR Code</h2>
              <span className="text-xs text-muted-foreground">
                {history.length} record{history.length !== 1 ? "s" : ""}
              </span>
            </div>
            <Link
              to="/all-qr"
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card-elevated/40 px-4 py-2 text-xs font-medium text-foreground transition-smooth hover:bg-accent"
            >
              Lihat semua QR
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="mt-4 -mx-2 overflow-x-auto px-2 scrollbar-thin">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <Th>Time</Th>
                  <Th>Part Name</Th>
                  <Th>Homelane Factory</Th>
                  <Th>Units</Th>
                  <Th>Status</Th>
                  <Th className="text-right">QR</Th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <Td>
                        <div className="h-2.5 w-20 rounded-full bg-card-elevated" />
                      </Td>
                      <Td>
                        <div className="h-3 w-32 rounded-full bg-card-elevated" />
                      </Td>
                      <Td>
                        <div className="h-2.5 w-20 rounded-full bg-card-elevated/70" />
                      </Td>
                      <Td>
                        <div className="h-2.5 w-14 rounded-full bg-card-elevated/70" />
                      </Td>
                      <Td>
                        <div className="h-5 w-10 rounded-full bg-card-elevated" />
                      </Td>
                      <Td className="text-right">
                        <div className="inline-flex justify-end">
                          <div className="h-8 w-8 rounded bg-card-elevated" />
                        </div>
                      </Td>
                    </tr>
                  ))
                ) : history.length === 0 ? (
                  <tr>
                    <Td colSpan={6} className="text-center">
                      No history yet.
                    </Td>
                  </tr>
                ) : (
                  history.slice(0, 5).map((row, i) => {
                    const dateObj = new Date(row.created_at);
                    const formattedDate = dateObj.toLocaleDateString("en-CA");

                    return (
                      <tr
                        key={row.id || i}
                        className="group transition-smooth hover:bg-card-elevated/40"
                      >
                        <Td>{formattedDate}</Td>
                        <Td className="text-foreground">{row.part_name}</Td>
                        <Td>{row.factory}</Td>
                        <Td>{row.units} units</Td>
                        <Td>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${
                              row.status === "in"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {row.status || "in"}
                          </span>
                        </Td>
                        <Td className="text-right">
                          <div className="inline-flex items-center gap-2">
                            {row.qr_image_base64 ? (
                              <img
                                src={row.qr_image_base64}
                                alt="QR"
                                className="h-8 w-8 rounded object-contain bg-white"
                              />
                            ) : (
                              <QrPlaceholder />
                            )}
                          </div>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}

/* ---------- subcomponents ---------- */

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="h-11 w-full rounded-xl border border-border-surface bg-card-elevated px-4 text-sm text-foreground placeholder:text-muted-foreground/70 outline-none transition-smooth focus:border-[#C05C30] focus:bg-card-elevated"
    />
  );
}

function SelectInput({
  id,
  value,
  onChange,
  placeholder,
  options,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-11 w-full appearance-none rounded-xl border border-border-surface bg-card-elevated px-4 pr-10 text-sm outline-none transition-smooth focus:border-[#C05C30] ${
          value ? "text-foreground" : "text-muted-foreground/70"
        }`}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((o) => (
          <option key={o} value={o} className="bg-card text-foreground">
            {o}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`border-b border-border px-3 py-3 font-medium text-muted-foreground ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td
      colSpan={colSpan}
      className={`border-b border-border/60 px-3 py-3.5 text-muted-foreground ${className}`}
    >
      {children}
    </td>
  );
}

function QrPlaceholder() {
  return (
    <div className="h-8 w-8 flex items-center justify-center rounded-md bg-foreground/90 text-background">
      <QrCode className="h-5 w-5" strokeWidth={1.6} />
    </div>
  );
}
