import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
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
import {
  useTeiteiList,
  useTeiteiParts,
  useCreateTeitei,
  useUpdateTeitei,
  useDeleteTeitei,
  type TeiteiItem,
} from "@/hooks/use-teitei";

export const Route = createFileRoute("/teitei")({
  head: () => ({
    meta: [
      { title: "Teitei Management - Sugity Creatives" },
      { name: "description", content: "Kelola nilai teitei per master part" },
    ],
  }),
  component: TeiteiPage,
});

function TeiteiPage() {
  const { data: items = [], isLoading } = useTeiteiList();
  const { data: parts = [] } = useTeiteiParts();
  const createTeitei = useCreateTeitei();
  const updateTeitei = useUpdateTeitei();
  const deleteTeitei = useDeleteTeitei();

  const [isAdding, setIsAdding] = useState(false);
  const [newPartId, setNewPartId] = useState("");
  const [newValue, setNewValue] = useState("1");
  const [newMin, setNewMin] = useState("0");
  const [newQtyDay, setNewQtyDay] = useState("0");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editMin, setEditMin] = useState("");
  const [editQtyDay, setEditQtyDay] = useState("");
  const [deleting, setDeleting] = useState<TeiteiItem | null>(null);

  const usedPartIds = new Set(items.map((i) => i.masterPartId));
  const availableParts = parts.filter((p) => !usedPartIds.has(p.id));

  const handleAdd = () => {
    if (!newPartId || !newValue) return;
    createTeitei.mutate(
      {
        masterPartId: Number(newPartId),
        teiteiValue: Number(newValue),
        minVal: Number(newMin),
        qtyPerDay: Number(newQtyDay),
      },
      {
        onSuccess: () => {
          setIsAdding(false);
          setNewPartId("");
          setNewValue("1");
          setNewMin("0");
          setNewQtyDay("0");
        },
      },
    );
  };

  const handleUpdate = (id: number) => {
    updateTeitei.mutate(
      {
        id,
        teiteiValue: Number(editValue),
        minVal: Number(editMin),
        qtyPerDay: Number(editQtyDay),
      },
      { onSuccess: () => setEditingId(null) },
    );
  };

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Management
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Teitei Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Atur nilai teitei untuk setiap master part (digunakan dalam perhitungan stock
            analytics).
          </p>
        </div>

        <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-base font-semibold text-foreground">Daftar Teitei</h2>
            {!isAdding && (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                disabled={availableParts.length === 0}
                className="inline-flex items-center gap-2 rounded-full bg-[#C05C30] px-4 py-2 text-sm font-medium text-white transition-smooth hover:bg-[#A84D24] disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Tambah Baru
              </button>
            )}
          </div>

          <div className="-mx-2 overflow-x-auto px-2 scrollbar-thin">
            <table className="w-full min-w-[600px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                  <th className="border-b border-border px-3 py-3 font-medium">Part Number</th>
                  <th className="border-b border-border px-3 py-3 font-medium">Part Name</th>
                  <th className="border-b border-border px-3 py-3 font-medium">Model</th>
                  <th className="border-b border-border px-3 py-3 font-medium">Teitei</th>
                  <th className="border-b border-border px-3 py-3 font-medium">Min</th>
                  <th className="border-b border-border px-3 py-3 font-medium">Qty/Day</th>
                  <th className="border-b border-border px-3 py-3 font-medium text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isAdding && (
                  <tr className="bg-card-elevated/20">
                    <td colSpan={2} className="border-b border-border/60 px-3 py-3">
                      <select
                        value={newPartId}
                        onChange={(e) => setNewPartId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm"
                      >
                        <option value="">Pilih master part…</option>
                        {availableParts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.partNumber} - {p.partName}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">-</td>
                    <td className="border-b border-border/60 px-3 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={newValue}
                        onChange={(e) => setNewValue(e.target.value)}
                        className="h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm"
                      />
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newMin}
                        onChange={(e) => setNewMin(e.target.value)}
                        className="h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm"
                      />
                    </td>
                    <td className="border-b border-border/60 px-3 py-3">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newQtyDay}
                        onChange={(e) => setNewQtyDay(e.target.value)}
                        className="h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm"
                      />
                    </td>
                    <td className="border-b border-border/60 px-3 py-3 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={handleAdd}
                          disabled={createTeitei.isPending || !newPartId}
                          className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"
                        >
                          {createTeitei.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsAdding(false);
                            setNewPartId("");
                          }}
                          className="rounded-lg bg-red-500/10 p-2 text-red-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                ) : items.length === 0 && !isAdding ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-muted-foreground">
                      Belum ada data teitei.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => (
                    <tr key={item.id} className="transition-smooth hover:bg-card-elevated/40">
                      <td className="border-b border-border/60 px-3 py-3.5 font-mono text-[#c05c30]">
                        {item.partNumber}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5">{item.partName}</td>
                      <td className="border-b border-border/60 px-3 py-3.5 text-muted-foreground">
                        {item.model || "-"}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm"
                          />
                        ) : (
                          item.teiteiValue
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editMin}
                            onChange={(e) => setEditMin(e.target.value)}
                            className="h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm"
                          />
                        ) : (
                          (item.minVal ?? 0)
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5">
                        {editingId === item.id ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editQtyDay}
                            onChange={(e) => setEditQtyDay(e.target.value)}
                            className="h-9 w-24 rounded-lg border border-border bg-card px-3 text-sm"
                          />
                        ) : (
                          (item.qtyPerDay ?? 0)
                        )}
                      </td>
                      <td className="border-b border-border/60 px-3 py-3.5 text-right">
                        {editingId === item.id ? (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => handleUpdate(item.id)}
                              disabled={updateTeitei.isPending}
                              className="rounded-lg bg-emerald-500/10 p-2 text-emerald-600"
                            >
                              <Save className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="rounded-lg bg-red-500/10 p-2 text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingId(item.id);
                                setEditValue(String(item.teiteiValue));
                                setEditMin(String(item.minVal ?? 0));
                                setEditQtyDay(String(item.qtyPerDay ?? 0));
                              }}
                              className="rounded-lg p-2 text-muted-foreground hover:bg-accent"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleting(item)}
                              className="rounded-lg p-2 text-red-500 hover:bg-red-500/10"
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

        <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus Teitei</AlertDialogTitle>
              <AlertDialogDescription>
                Hapus teitei untuk <strong>{deleting?.partNumber}</strong>?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  if (deleting) {
                    deleteTeitei.mutate(deleting.id, {
                      onSuccess: () => setDeleting(null),
                    });
                  }
                }}
                className="bg-red-500 hover:bg-red-600"
              >
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
