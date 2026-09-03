import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Save, X, Loader2, AlertCircle, Link2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
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
import { ScApi, type ScItem } from "@/hooks/use-master-data";

export const Route = createFileRoute("/plant")({
  head: () => ({
    meta: [
      { title: "Plant & SC Management - Sugity Creatives" },
      { name: "description", content: "Kelola data Supply Chain" },
    ],
  }),
  component: PlantPage,
});

const INPUT =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary";

function PlantPage() {
  const { data: scList = [], isLoading } = ScApi.useGetAll();
  const createSc = ScApi.useCreate();
  const updateSc = ScApi.useUpdate();
  const deleteSc = ScApi.useDelete();

  const [isAdding, setIsAdding] = useState(false);
  const [addId, setAddId] = useState("");
  const [addScId, setAddScId] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editScId, setEditScId] = useState("");

  const [deletingItem, setDeletingItem] = useState<ScItem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetAdd = useCallback(() => {
    setIsAdding(false);
    setAddId("");
    setAddScId("");
    setSubmitError(null);
  }, []);

  const resetEdit = useCallback(() => {
    setEditingId(null);
    setEditScId("");
    setSubmitError(null);
  }, []);

  const handleAdd = useCallback(() => {
    setSubmitError(null);
    createSc.mutate(
      { id: addId.trim() || undefined, sc_id: addScId.trim() || addId.trim() },
      {
        onSuccess: () => resetAdd(),
        onError: (err) => setSubmitError(err.message),
      },
    );
  }, [addId, addScId, createSc, resetAdd]);

  const handleUpdate = useCallback(() => {
    if (!editingId) return;
    setSubmitError(null);
    updateSc.mutate(
      { id: editingId, sc_id: editScId },
      {
        onSuccess: () => resetEdit(),
        onError: (err) => setSubmitError(err.message),
      },
    );
  }, [editingId, editScId, updateSc, resetEdit]);

  const handleDelete = useCallback(() => {
    if (!deletingItem) return;
    deleteSc.mutate(deletingItem.id, {
      onSuccess: () => setDeletingItem(null),
    });
  }, [deletingItem, deleteSc]);

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Management
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Plant & SC Management
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola data Supply Chain (SC) untuk factory dan mesin.
          </p>
        </div>

        {submitError && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {submitError}
          </div>
        )}

        <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Daftar SC</h2>
            {!isAdding && (
              <button
                onClick={() => setIsAdding(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[#C05C30] px-4 py-2 text-sm font-medium text-white transition-smooth hover:bg-[#A84D24]"
              >
                <Plus className="h-4 w-4" />
                Tambah Baru
              </button>
            )}
          </div>

          <div className="-mx-2 overflow-x-auto px-2 scrollbar-thin">
            <table className="w-full min-w-[500px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="border-b border-border px-3 py-3 font-medium">ID</th>
                  <th className="border-b border-border px-3 py-3 font-medium">SC ID</th>
                  <th className="border-b border-border px-3 py-3 font-medium">Tanggal Dibuat</th>
                  <th className="border-b border-border px-3 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isAdding && (
                  <tr className="bg-card-elevated/20">
                    <td className="border-b border-border/60 px-3 py-3">
                      <input
                        autoFocus
                        value={addId}
                        onChange={(e) => setAddId(e.target.value)}
                        placeholder="ID (auto jika kosong)..."
                        className={INPUT}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                      />
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">
                      <input
                        value={addScId}
                        onChange={(e) => setAddScId(e.target.value)}
                        placeholder="SC ID..."
                        className={INPUT}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                      />
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">-</td>
                    <td className="border-b border-border/60 px-3 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={handleAdd}
                          disabled={createSc.isPending}
                          className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                        >
                          {createSc.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={resetAdd}
                          className="rounded-lg bg-red-500/10 p-2 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : scList.length === 0 && !isAdding ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <Link2 className="h-10 w-10 text-muted-foreground/40" />
                        <span>Belum ada data SC.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  scList.map((item) => (
                    <tr key={item.id} className="transition-smooth hover:bg-card-elevated/40">
                      <td className="border-b border-border/60 px-3 py-3.5 font-mono text-xs text-muted-foreground">
                        {editingId === item.id ? (
                          <span className="text-foreground font-medium">{item.id}</span>
                        ) : (
                          item.id
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5 font-medium text-foreground">
                        {editingId === item.id ? (
                          <input
                            autoFocus
                            value={editScId}
                            onChange={(e) => setEditScId(e.target.value)}
                            className={INPUT}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                          />
                        ) : (
                          item.sc_id
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5 text-muted-foreground text-xs">
                        {new Date(item.created_at).toLocaleDateString("en-CA")}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5 text-right">
                        {editingId === item.id ? (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={handleUpdate}
                              disabled={updateSc.isPending || !editScId.trim()}
                              className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                            >
                              {updateSc.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={resetEdit}
                              className="rounded-lg bg-red-500/10 p-2 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={() => {
                                setEditingId(item.id);
                                setEditScId(item.sc_id);
                              }}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => setDeletingItem(item)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <AlertDialog open={!!deletingItem} onOpenChange={(o) => !o && setDeletingItem(null)}>
          <AlertDialogContent className="rounded-xl border border-border-surface bg-surface-sidebar p-0 sm:max-w-md overflow-hidden text-foreground">
            <AlertDialogHeader className="px-6 pb-2 pt-6">
              <AlertDialogTitle className="text-xl font-bold">Hapus SC</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground mt-2">
                Apakah kamu yakin untuk menghapus SC <strong>{deletingItem?.sc_id}</strong>?
                Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="bg-card-elevated px-6 py-4 flex flex-row justify-end gap-3 border-t border-border-surface">
              <AlertDialogCancel className="mt-0 border-border hover:bg-accent hover:text-foreground text-foreground">
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleDelete();
                }}
                className="bg-red-500 hover:bg-red-600 text-white border-0"
              >
                {deleteSc.isPending ? "Menghapus..." : "Hapus"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
