import { useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, Pencil, Trash2, Save, X, Loader2, AlertCircle, Factory } from "lucide-react";
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
import { FactoryApi, ScApi, type FactoryItem } from "@/hooks/use-master-data";

export const Route = createFileRoute("/factory")({
  head: () => ({
    meta: [
      { title: "Factory Management - Sugity Creatives" },
      { name: "description", content: "Kelola data factory" },
    ],
  }),
  component: FactoryPage,
});

const INPUT =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary";
const SELECT =
  "h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary appearance-none cursor-pointer";

function FactoryPage() {
  const { data: factories = [], isLoading } = FactoryApi.useGetAll();
  const { data: scList = [] } = ScApi.useGetAll();
  const createFactory = FactoryApi.useCreate();
  const updateFactory = FactoryApi.useUpdate();
  const deleteFactory = FactoryApi.useDelete();

  const [isAdding, setIsAdding] = useState(false);
  const [addName, setAddName] = useState("");
  const [addCode, setAddCode] = useState("");
  const [addSc, setAddSc] = useState("");

  const [editingUuid, setEditingUuid] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editSc, setEditSc] = useState("");

  const [deletingItem, setDeletingItem] = useState<FactoryItem | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const resetAdd = useCallback(() => {
    setIsAdding(false);
    setAddName("");
    setAddCode("");
    setAddSc("");
    setSubmitError(null);
  }, []);

  const resetEdit = useCallback(() => {
    setEditingUuid(null);
    setEditName("");
    setEditCode("");
    setEditSc("");
    setSubmitError(null);
  }, []);

  const handleAdd = useCallback(() => {
    if (!addName.trim()) return;
    setSubmitError(null);
    createFactory.mutate(
      {
        factory_name: addName.trim(),
        factory_code: addCode.trim(),
        factory_sc: addSc,
      },
      {
        onSuccess: () => resetAdd(),
        onError: (err) => setSubmitError(err.message),
      },
    );
  }, [addName, addCode, addSc, createFactory, resetAdd]);

  const handleUpdate = useCallback(() => {
    if (!editName.trim() || !editingUuid) return;
    setSubmitError(null);
    updateFactory.mutate(
      {
        uuid: editingUuid,
        factory_name: editName.trim(),
        factory_code: editCode.trim(),
        factory_sc: editSc,
      },
      {
        onSuccess: () => resetEdit(),
        onError: (err) => setSubmitError(err.message),
      },
    );
  }, [editName, editCode, editSc, editingUuid, updateFactory, resetEdit]);

  const handleDelete = useCallback(() => {
    if (!deletingItem) return;
    deleteFactory.mutate(deletingItem.uuid, {
      onSuccess: () => setDeletingItem(null),
    });
  }, [deletingItem, deleteFactory]);

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Management
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Factory Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola daftar pabrik/factory beserta kode dan SC.
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
            <h2 className="text-base font-semibold text-foreground">Daftar Factory</h2>
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
            <table className="w-full min-w-[700px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="border-b border-border px-3 py-3 font-medium">UUID</th>
                  <th className="border-b border-border px-3 py-3 font-medium">Nama</th>
                  <th className="border-b border-border px-3 py-3 font-medium">Kode</th>
                  <th className="border-b border-border px-3 py-3 font-medium">SC ID</th>
                  <th className="border-b border-border px-3 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isAdding && (
                  <tr className="bg-card-elevated/20">
                    <td className="border-b border-border/60 px-3 py-3 text-xs text-muted-foreground">
                      (auto)
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">
                      <input
                        autoFocus
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        placeholder="Nama factory..."
                        className={INPUT}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                      />
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">
                      <input
                        value={addCode}
                        onChange={(e) => setAddCode(e.target.value)}
                        placeholder="Kode..."
                        className={INPUT}
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                      />
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">
                      <div className="relative">
                        <select
                          value={addSc}
                          onChange={(e) => setAddSc(e.target.value)}
                          className={SELECT}
                        >
                          <option value="">Pilih SC...</option>
                          {scList.map((sc) => (
                            <option key={sc.id} value={sc.id}>
                              {sc.sc_id}
                            </option>
                          ))}
                        </select>
                        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                          ▾
                        </div>
                      </div>
                    </td>
                    <td className="border-b border-border/60 px-3 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={handleAdd}
                          disabled={createFactory.isPending || !addName.trim()}
                          className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                        >
                          {createFactory.isPending ? (
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
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : factories.length === 0 && !isAdding ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-3">
                        <Factory className="h-10 w-10 text-muted-foreground/40" />
                        <span>Belum ada data factory.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  factories.map((item) => (
                    <tr key={item.uuid} className="transition-smooth hover:bg-card-elevated/40">
                      <td className="border-b border-border/60 px-3 py-3.5 font-mono text-xs text-muted-foreground">
                        {item.uuid}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5 font-medium text-foreground">
                        {editingUuid === item.uuid ? (
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className={INPUT}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                          />
                        ) : (
                          item.factory_name
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5 text-foreground">
                        {editingUuid === item.uuid ? (
                          <input
                            value={editCode}
                            onChange={(e) => setEditCode(e.target.value)}
                            className={INPUT}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                          />
                        ) : (
                          item.factory_code || "-"
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5 text-muted-foreground">
                        {editingUuid === item.uuid ? (
                          <div className="relative">
                            <select
                              value={editSc}
                              onChange={(e) => setEditSc(e.target.value)}
                              className={SELECT}
                            >
                              <option value="">Pilih SC...</option>
                              {scList.map((sc) => (
                                <option key={sc.id} value={sc.id}>
                                  {sc.sc_id}
                                </option>
                              ))}
                            </select>
                            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
                              ▾
                            </div>
                          </div>
                        ) : (
                          item.factory_sc || "-"
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5 text-right">
                        {editingUuid === item.uuid ? (
                          <div className="inline-flex gap-2">
                            <button
                              onClick={handleUpdate}
                              disabled={updateFactory.isPending || !editName.trim()}
                              className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                            >
                              {updateFactory.isPending ? (
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
                                setEditingUuid(item.uuid);
                                setEditName(item.factory_name);
                                setEditCode(item.factory_code);
                                setEditSc(item.factory_sc);
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
              <AlertDialogTitle className="text-xl font-bold">Hapus Factory</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground mt-2">
                Apakah kamu yakin untuk menghapus <strong>{deletingItem?.factory_name}</strong>?
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
                {deleteFactory.isPending ? "Menghapus..." : "Hapus"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
