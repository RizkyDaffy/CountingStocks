import { useCallback, useState, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Download, ExternalLink, QrCode, Search } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useQrCodes, useDeleteQrCode, type QrItem } from "@/hooks/use-qr-codes";
import { useMasterParts } from "@/hooks/use-master-parts";
import { Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/all-qr")({
  head: () => ({
    meta: [
      { title: "Semua QR Codes - Sugity Creatives" },
      { name: "description", content: "Complete archive of created QR stock codes." },
    ],
  }),
  component: AllQrPage,
});

function downloadQr(item: QrItem) {
  if (!item.qr_image_base64) return;
  const link = document.createElement("a");
  link.href = item.qr_image_base64;
  link.download = `${item.qr_id}-${item.part_name.replace(/\s+/g, "-")}.png`;
  link.click();
}

function AllQrPage() {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [selectedQrId, setSelectedQrId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QrItem | null>(null);
  const navigate = useNavigate();

  const { data: filtered = [], isLoading } = useQrCodes(query);
  const deleteQr = useDeleteQrCode();
  const { data: masterParts = [] } = useMasterParts();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".qr-wrapper")) {
        setSelectedQrId(null);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  const confirmDelete = () => {
    if (deleteTarget) {
      deleteQr.mutate(deleteTarget.id, {
        onSuccess: () => {
          setDeleteTarget(null);
          setSelectedQrId(null);
        },
      });
    }
  };

  const handleOpen = useCallback(
    (item: QrItem) => {
      if (!item.qr_image_base64) return;
      const part = masterParts.find((p) => p.part_name === item.part_name);
      navigate({
        to: "/qr-viewer",
        search: {
          img: item.qr_image_base64,
          label: item.part_name,
          partname: item.part_name,
          partnum: part?.part_number || "",
          partmodel: part?.model || "",
          machineOrigin: item.machine_origin || part?.machine || "",
          factoryOrigin: item.factory || "",
          updatedAt: item.updated_at || "",
        },
      });
    },
    [navigate, masterParts],
  );

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        <Link
          to="/"
          className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-smooth hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Stock Scan
        </Link>

        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Archive
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Semua Kode QR</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Koleksi lengkap kode QR yang dibuat di seluruh pabrik.
          </p>
        </div>

        <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="search-qr"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari ID atau Part…"
                className="h-10 w-full rounded-full border border-transparent bg-card-elevated pl-9 pr-4 text-sm outline-none transition-smooth focus:border-primary/60"
              />
            </div>
            <div className="inline-flex rounded-full bg-card-elevated p-1 text-xs">
              {(["grid", "list"] as const).map((v) => (
                <button
                  key={v}
                  id={`view-${v}`}
                  onClick={() => setView(v)}
                  className={`rounded-full px-4 py-1.5 capitalize transition-smooth ${
                    view === v ? "bg-[#C05C30] text-white" : "text-muted-foreground"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          {view === "grid" ? (
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {isLoading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="rounded-2xl border border-border-surface bg-card p-4 animate-pulse"
                    >
                      {/* QR image placeholder */}
                      <div className="aspect-square w-full rounded-xl bg-card-elevated" />
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="h-2.5 w-20 rounded-full bg-card-elevated" />
                          <div className="h-4 w-8 rounded-full bg-card-elevated" />
                        </div>
                        <div className="h-3.5 w-3/4 rounded-full bg-card-elevated" />
                        <div className="h-2.5 w-1/2 rounded-full bg-card-elevated/70" />
                        <div className="h-2 w-16 rounded-full bg-card-elevated/50" />
                      </div>
                      <div className="mt-3 flex gap-2">
                        <div className="h-8 flex-1 rounded-full bg-card-elevated" />
                        <div className="h-8 w-8 rounded-full bg-card-elevated" />
                      </div>
                    </div>
                  ))
                : filtered.map((item) => {
                    const formattedDate = new Date(item.created_at).toLocaleDateString("en-CA");
                    const hasQrImage = !!item.qr_image_base64;

                    return (
                      <div
                        key={item.id}
                        className="group rounded-2xl border border-border-surface bg-card p-4 transition-smooth hover:bg-card"
                      >
                        {/* QR display */}
                        <div
                          className="qr-wrapper flex aspect-square items-center justify-center rounded-xl overflow-hidden bg-white relative cursor-pointer"
                          onClick={() => setSelectedQrId(item.id)}
                        >
                          {hasQrImage ? (
                            <img
                              src={item.qr_image_base64!}
                              alt={`QR for ${item.part_name}`}
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-foreground/90 text-background">
                              <QrCode className="h-16 w-16" strokeWidth={1.5} />
                            </div>
                          )}

                          {selectedQrId === item.id && (
                            <div className="absolute inset-0 bg-black/60 flex items-center justify-center animate-in fade-in duration-200">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeleteTarget(item);
                                }}
                                className="rounded-full bg-red-500 p-3 text-white shadow-[0_4px_14px_rgba(239,68,68,0.4)] transition-smooth hover:bg-red-600 hover:scale-110"
                                aria-label="Delete QR"
                              >
                                <Trash2 className="h-6 w-6" />
                              </button>
                            </div>
                          )}
                        </div>

                        <div className="mt-4">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                              {item.qr_id}
                            </div>
                            {item.status && (
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  item.status === "in"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}
                              >
                                {item.status}
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 truncate text-sm font-semibold text-foreground">
                            {item.part_name}
                          </div>
                          <div className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.factory} · {item.units} units
                          </div>
                          <div className="mt-0.5 text-[10px] text-muted-foreground/60">
                            {formattedDate}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-2">
                          <button
                            id={`btn-download-${item.qr_id}`}
                            onClick={() => downloadQr(item)}
                            disabled={!hasQrImage}
                            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-smooth hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                            title={hasQrImage ? "Download QR image" : "No QR image available"}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Download
                          </button>
                          <button
                            id={`btn-open-${item.qr_id}`}
                            onClick={() => handleOpen(item)}
                            disabled={!hasQrImage}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Open full-screen QR"
                            title={hasQrImage ? "Open full-screen" : "No QR image available"}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
              {!isLoading && filtered.length === 0 && (
                <div className="col-span-full py-16 text-center text-sm text-muted-foreground">
                  No QR codes match your search.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 -mx-2 overflow-x-auto px-2 scrollbar-thin">
              <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    <th className="border-b border-border px-3 py-3 font-medium">ID</th>
                    <th className="border-b border-border px-3 py-3 font-medium">Part Name</th>
                    <th className="border-b border-border px-3 py-3 font-medium">Factory</th>
                    <th className="border-b border-border px-3 py-3 font-medium">Units</th>
                    <th className="border-b border-border px-3 py-3 font-medium">Status</th>
                    <th className="border-b border-border px-3 py-3 font-medium">Created</th>
                    <th className="border-b border-border px-3 py-3 font-medium text-right">QR</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="border-b border-border/60 px-3 py-3.5">
                          <div className="h-2.5 w-24 rounded-full bg-card-elevated font-mono" />
                        </td>
                        <td className="border-b border-border/60 px-3 py-3.5">
                          <div className="h-3 w-32 rounded-full bg-card-elevated" />
                        </td>
                        <td className="border-b border-border/60 px-3 py-3.5">
                          <div className="h-2.5 w-20 rounded-full bg-card-elevated/70" />
                        </td>
                        <td className="border-b border-border/60 px-3 py-3.5">
                          <div className="h-2.5 w-10 rounded-full bg-card-elevated/70" />
                        </td>
                        <td className="border-b border-border/60 px-3 py-3.5">
                          <div className="h-5 w-10 rounded-full bg-card-elevated" />
                        </td>
                        <td className="border-b border-border/60 px-3 py-3.5">
                          <div className="h-2.5 w-16 rounded-full bg-card-elevated/70" />
                        </td>
                        <td className="border-b border-border/60 px-3 py-3.5 text-right">
                          <div className="inline-flex items-center gap-2">
                            <div className="h-8 w-8 rounded bg-card-elevated" />
                            <div className="h-8 w-8 rounded-full bg-card-elevated" />
                            <div className="h-8 w-8 rounded-full bg-card-elevated" />
                            <div className="h-8 w-8 rounded-full bg-card-elevated" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center py-8 text-muted-foreground border-b border-border/60"
                      >
                        No QR codes found.
                      </td>
                    </tr>
                  ) : (
                    filtered.map((item) => {
                      const formattedDate = new Date(item.created_at).toLocaleDateString("en-CA");
                      const hasQrImage = !!item.qr_image_base64;

                      return (
                        <tr key={item.id} className="transition-smooth hover:bg-card-elevated/40">
                          <td className="border-b border-border/60 px-3 py-3.5 text-muted-foreground font-mono text-xs">
                            {item.qr_id}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3.5 text-foreground font-medium">
                            {item.part_name}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3.5 text-muted-foreground">
                            {item.factory}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3.5 text-foreground">
                            {item.units}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3.5">
                            {item.status ? (
                              <span
                                className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                  item.status === "in"
                                    ? "bg-emerald-500/10 text-emerald-400"
                                    : "bg-red-500/10 text-red-400"
                                }`}
                              >
                                {item.status}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground/40">-</span>
                            )}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3.5 text-muted-foreground">
                            {formattedDate}
                          </td>
                          <td className="border-b border-border/60 px-3 py-3.5 text-right">
                            <div className="inline-flex items-center gap-2">
                              {/* QR thumbnail */}
                              {hasQrImage ? (
                                <img
                                  src={item.qr_image_base64!}
                                  alt="QR"
                                  className="h-8 w-8 rounded object-contain bg-white"
                                />
                              ) : (
                                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground/90 text-background">
                                  <QrCode className="h-5 w-5" strokeWidth={1.6} />
                                </div>
                              )}
                              {/* Download */}
                              <button
                                id={`list-download-${item.qr_id}`}
                                onClick={() => downloadQr(item)}
                                disabled={!hasQrImage}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Download QR"
                                title="Download"
                              >
                                <Download className="h-4 w-4" />
                              </button>
                              {/* Open viewer */}
                              <button
                                id={`list-open-${item.qr_id}`}
                                onClick={() => handleOpen(item)}
                                disabled={!hasQrImage}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Open full-screen"
                                title="View full-screen"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => setDeleteTarget(item)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-500 transition-smooth hover:bg-red-500/10 hover:text-red-600"
                                aria-label="Delete QR"
                                title="Delete QR"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Delete Confirmation Modal */}
        <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
          <AlertDialogContent className="rounded-xl border border-border-surface bg-surface-sidebar p-0 sm:max-w-md overflow-hidden text-foreground">
            <AlertDialogHeader className="px-6 pb-2 pt-6">
              <AlertDialogTitle className="text-xl font-bold">Hapus QR Code</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground mt-2">
                Apakah kamu yakin untuk menghapus <strong>{deleteTarget?.part_name}</strong> (
                {deleteTarget?.qr_id})? Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="bg-card-elevated px-6 py-4 flex flex-row justify-end gap-3 sm:justify-end border-t border-border-surface">
              <AlertDialogCancel className="mt-0 border-border hover:bg-accent hover:text-foreground text-foreground">
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmDelete();
                }}
                className="bg-red-500 hover:bg-red-600 text-white border-0"
              >
                {deleteQr.isPending ? "Menghapus..." : "Hapus"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
