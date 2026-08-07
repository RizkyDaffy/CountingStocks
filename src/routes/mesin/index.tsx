import { useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  CirclePlay,
  Loader2,
  AlertCircle,
  MonitorCog,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useMesin, useDeleteMesin, useToggleMesinStatus, type Mesin } from "@/hooks/use-mesin";

export const Route = createFileRoute("/mesin/")({
  head: () => ({
    meta: [
      { title: "Mesin Management - Sugity Creatives" },
      { name: "description", content: "Kelola Data Mesin" },
    ],
  }),
  component: MesinPage,
});

function MesinPage() {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Mesin | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: mesinList = [], isLoading } = useMesin(search);
  const deleteMesin = useDeleteMesin();
  const toggleStatus = useToggleMesinStatus();

  const confirmDelete = useCallback((m: Mesin) => {
    setDeleteError(null);
    setDeleteTarget(m);
  }, []);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMesin.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (e) => setDeleteError(e.message),
    });
  }, [deleteTarget, deleteMesin]);

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        {}
        <div className="mb-6">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Machine Management
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kelola Data Mesin
          </h1>
        </div>

        {}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="search-mesin"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Kode Mesin atau Namanya..."
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-smooth focus:border-[#c05c30]/60 dark:bg-card-elevated"
            />
          </div>
          <Link
            to="/mesin/create"
            id="btn-tambah-mesin"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#c05c30] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-smooth hover:brightness-110 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Tambah Mesin
          </Link>
        </div>

        {}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  {["Machine Code", "Machine Name", "Description", "Status", "Actions"].map(
                    (col) => (
                      <th
                        key={col}
                        className={`border-b border-border bg-card-elevated/50 px-5 py-3.5 font-semibold ${col === "Actions" ? "text-right" : ""}`}
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : mesinList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-14 text-center text-sm text-muted-foreground"
                    >
                      {search ? (
                        `Tidak ada mesin yang cocok dengan "${search}"`
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <MonitorCog className="h-10 w-10 text-muted-foreground/40" />
                          <span>
                            Belum ada data mesin. Klik <strong>Tambah Mesin</strong> untuk memulai.
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  mesinList.map((m) => (
                    <MesinRow
                      key={m.id}
                      mesin={m}
                      onDelete={confirmDelete}
                      onToggle={() => toggleStatus.mutate(m.id)}
                      isToggling={toggleStatus.isPending}
                    />
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
            <h3 className="mt-4 text-base font-semibold text-foreground">Hapus Mesin?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{deleteTarget.machine_code}</span> -{" "}
              {deleteTarget.machine_name} akan dihapus secara permanen.
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
                disabled={deleteMesin.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-smooth hover:bg-red-600 disabled:opacity-50"
              >
                {deleteMesin.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function MesinRow({
  mesin,
  onDelete,
  onToggle,
  isToggling,
}: {
  mesin: Mesin;
  onDelete: (m: Mesin) => void;
  onToggle: () => void;
  isToggling: boolean;
}) {
  return (
    <tr className="group transition-smooth hover:bg-card-elevated/40">
      {/* Machine Code */}
      <td className="border-b border-border/60 px-5 py-4">
        <span className="font-mono text-[13px] font-bold text-blue-500 dark:text-blue-400">
          {mesin.machine_code}
        </span>
      </td>

      {/* Machine Name */}
      <td className="border-b border-border/60 px-5 py-4">
        <span className="text-[13.5px] font-medium text-foreground">{mesin.machine_name}</span>
      </td>

      {/* Description */}
      <td className="border-b border-border/60 px-5 py-4 text-muted-foreground">
        <span className="text-[13px]">{mesin.description || "-"}</span>
      </td>

      {/* Status */}
      <td className="border-b border-border/60 px-5 py-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
            mesin.status === "active"
              ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {mesin.status === "active" ? "Active" : "Inactive"}
        </span>
      </td>

      {/* Actions */}
      <td className="border-b border-border/60 px-5 py-4 text-right">
        <div className="inline-flex items-center gap-1">
          {/* Edit */}
          <Link
            to="/mesin/create"
            search={{ editId: mesin.id }}
            id={`btn-edit-mesin-${mesin.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-blue-500 dark:text-blue-400 transition-smooth hover:bg-blue-500/10"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          {/* Toggle status */}
          <button
            id={`btn-toggle-mesin-${mesin.id}`}
            onClick={onToggle}
            disabled={isToggling}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-smooth disabled:opacity-50 ${
              mesin.status === "active"
                ? "text-emerald-500 hover:bg-emerald-500/10"
                : "text-muted-foreground hover:bg-accent"
            }`}
            title={mesin.status === "active" ? "Nonaktifkan" : "Aktifkan"}
          >
            <CirclePlay className="h-4 w-4" />
          </button>
          {/* Delete */}
          <button
            id={`btn-delete-mesin-${mesin.id}`}
            onClick={() => onDelete(mesin)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-red-400 transition-smooth hover:bg-red-500/10 hover:text-red-500"
            title="Hapus"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
