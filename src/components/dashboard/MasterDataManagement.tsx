import { useState } from "react";
import { Plus, Edit2, Trash2, Save, X, Loader2 } from "lucide-react";
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
import type { MasterDataItem } from "@/hooks/use-master-data";

interface MasterDataManagementProps {
  title: string;
  description: string;
  api: {
    useGetAll: () => { data: MasterDataItem[] | undefined; isLoading: boolean };
    useCreate: () => {
      mutate: (name: string, options?: Record<string, unknown>) => void;
      isPending: boolean;
    };
    useUpdate: () => {
      mutate: (payload: { id: number; name: string }, options?: Record<string, unknown>) => void;
      isPending: boolean;
    };
    useDelete: () => {
      mutate: (id: number, options?: Record<string, unknown>) => void;
      isPending: boolean;
    };
  };
}

export function MasterDataManagement({ title, description, api }: MasterDataManagementProps) {
  const { data: items = [], isLoading } = api.useGetAll();
  const createItem = api.useCreate();
  const updateItem = api.useUpdate();
  const deleteItem = api.useDelete();

  const [isAdding, setIsAdding] = useState(false);
  const [addName, setAddName] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const [deletingItem, setDeletingItem] = useState<MasterDataItem | null>(null);

  const handleAdd = () => {
    if (!addName.trim()) return;
    createItem.mutate(addName, {
      onSuccess: () => {
        setIsAdding(false);
        setAddName("");
      },
    });
  };

  const handleUpdate = () => {
    if (!editName.trim() || !editingId) return;
    updateItem.mutate(
      { id: editingId, name: editName },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditName("");
        },
      },
    );
  };

  const handleDelete = () => {
    if (!deletingItem) return;
    deleteItem.mutate(deletingItem.id, {
      onSuccess: () => setDeletingItem(null),
    });
  };

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Management
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>

        <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-semibold text-foreground">Daftar {title}</h2>
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
                  <th className="border-b border-border px-3 py-3 font-medium">Nama</th>
                  <th className="border-b border-border px-3 py-3 font-medium">Tanggal Dibuat</th>
                  <th className="border-b border-border px-3 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isAdding && (
                  <tr className="bg-card-elevated/20">
                    <td className="border-b border-border/60 px-3 py-3">-</td>
                    <td className="border-b border-border/60 px-3 py-3">
                      <input
                        autoFocus
                        value={addName}
                        onChange={(e) => setAddName(e.target.value)}
                        placeholder="Masukkan nama..."
                        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                        onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                      />
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">-</td>
                    <td className="border-b border-border/60 px-3 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          onClick={handleAdd}
                          disabled={createItem.isPending || !addName.trim()}
                          className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                        >
                          {createItem.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => {
                            setIsAdding(false);
                            setAddName("");
                          }}
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
                ) : items.length === 0 && !isAdding ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-muted-foreground">
                      Belum ada data.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="transition-smooth hover:bg-card-elevated/40">
                      <td className="border-b border-border/60 px-3 py-3.5 text-muted-foreground font-mono">
                        {item.id}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5 text-foreground font-medium">
                        {editingId === item.id ? (
                          <input
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                            onKeyDown={(e) => e.key === "Enter" && handleUpdate()}
                          />
                        ) : (
                          item.name
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
                              disabled={updateItem.isPending || !editName.trim()}
                              className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600 hover:bg-emerald-500/20 dark:text-emerald-400"
                            >
                              {updateItem.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Save className="h-4 w-4" />
                              )}
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
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
                                setEditName(item.name);
                              }}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                            >
                              <Edit2 className="h-4 w-4" />
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

        {}
        <AlertDialog open={!!deletingItem} onOpenChange={(o) => !o && setDeletingItem(null)}>
          <AlertDialogContent className="rounded-xl border border-border-surface bg-surface-sidebar p-0 sm:max-w-md overflow-hidden text-foreground">
            <AlertDialogHeader className="px-6 pb-2 pt-6">
              <AlertDialogTitle className="text-xl font-bold">Hapus {title}</AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-muted-foreground mt-2">
                Apakah kamu yakin untuk menghapus <strong>{deletingItem?.name}</strong>? Tindakan
                ini tidak dapat dibatalkan.
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
                {deleteItem.isPending ? "Menghapus..." : "Hapus"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
