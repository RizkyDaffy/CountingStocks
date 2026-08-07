import { useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Pencil, Trash2, Package, Loader2, AlertCircle } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useMasterParts, useDeleteMasterPart, type MasterPart } from "@/hooks/use-master-parts";

export const Route = createFileRoute("/master-data/")({
  head: () => ({
    meta: [
      { title: "Master Data - Sugity Creatives" },
      { name: "description", content: "Kelola Data Master Part" },
    ],
  }),
  component: MasterDataPage,
});

function MasterDataPage() {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<MasterPart | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: parts = [], isLoading } = useMasterParts(search);
  const deletePart = useDeleteMasterPart();

  const confirmDelete = useCallback((part: MasterPart) => {
    setDeleteError(null);
    setDeleteTarget(part);
  }, []);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deletePart.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (e) => setDeleteError(e.message),
    });
  }, [deleteTarget, deletePart]);

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        {}
        <div className="mb-6">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Master Parts List
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kelola Data Master Part
          </h1>
        </div>

        {}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="search-master-part"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Nomor Part, Nama atau Model nya"
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-smooth focus:border-[#c05c30]/60 dark:bg-card-elevated"
            />
          </div>
          <Link
            to="/master-data/create"
            id="btn-buat-part"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#c05c30] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-smooth hover:brightness-110 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Buat Part Baru
          </Link>
        </div>

        {}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  {[
                    "Image",
                    "Part Number",
                    "Part Name",
                    "Model / Category",
                    "Status",
                    "Actions",
                  ].map((col) => (
                    <th
                      key={col}
                      className={`border-b border-border bg-card-elevated/50 px-4 py-3.5 font-semibold ${col === "Actions" ? "text-right" : ""}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-14 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : parts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-14 text-center text-sm text-muted-foreground"
                    >
                      {search
                        ? `Tidak ada part yang cocok dengan "${search}"`
                        : "Belum ada master part. Klik Buat Part Baru untuk memulai."}
                    </td>
                  </tr>
                ) : (
                  parts.map((part) => (
                    <PartRow key={part.id} part={part} onDelete={confirmDelete} />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10">
              <Trash2 className="h-6 w-6 text-red-500" />
            </div>
            <h3 className="mt-4 text-base font-semibold text-foreground">Hapus Part?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{deleteTarget.part_number}</span> -{" "}
              {deleteTarget.part_name} akan dihapus secara permanen.
            </p>
            {deleteError && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {deleteError}
              </div>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="rounded-xl border border-border bg-transparent px-4 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-accent"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={deletePart.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-smooth hover:bg-red-600 disabled:opacity-50"
              >
                {deletePart.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function PartRow({ part, onDelete }: { part: MasterPart; onDelete: (p: MasterPart) => void }) {
  return (
    <tr className="group transition-smooth hover:bg-card-elevated/40">
      {/* Image */}
      <td className="border-b border-border/60 px-4 py-3.5">
        {part.image_base64 ? (
          <img
            src={part.image_base64}
            alt={part.part_name}
            className="h-12 w-12 rounded-lg object-cover border border-border"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-muted text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Package className="h-5 w-5" />
          </div>
        )}
      </td>

      {/* Part Number */}
      <td className="border-b border-border/60 px-4 py-3.5">
        <span className="font-mono text-[13px] font-semibold text-[#c05c30]">
          {part.part_number}
        </span>
      </td>

      {/* Part Name */}
      <td className="border-b border-border/60 px-4 py-3.5">
        <div className="text-[13.5px] font-medium text-foreground">{part.part_name}</div>
        {part.customer && <div className="text-[11px] text-muted-foreground">{part.customer}</div>}
      </td>

      {/* Model / Category */}
      <td className="border-b border-border/60 px-4 py-3.5">
        <div className="text-[13.5px] font-medium text-foreground">{part.model || "-"}</div>
        {part.category && (
          <div className="text-[11px] italic text-muted-foreground">{part.category}</div>
        )}
      </td>

      {/* Status */}
      <td className="border-b border-border/60 px-4 py-3.5">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
            part.status === "active"
              ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {part.status === "active" ? "Active" : "Inactive"}
        </span>
      </td>

      {/* Actions */}
      <td className="border-b border-border/60 px-4 py-3.5 text-right">
        <div className="inline-flex items-center gap-1">
          <Link
            to="/master-data/create"
            search={{ editId: part.id }}
            id={`btn-edit-${part.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#c05c30] transition-smooth hover:bg-[#c05c30]/10"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            id={`btn-delete-${part.id}`}
            onClick={() => onDelete(part)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-destructive/10 hover:text-destructive"
            title="Hapus"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
