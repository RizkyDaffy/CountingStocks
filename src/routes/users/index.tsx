import { useState, useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Search, Pencil, Trash2, Loader2, AlertCircle, Users } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useUsers, useDeleteUser, type AppUser } from "@/hooks/use-users";

export const Route = createFileRoute("/users/")({
  head: () => ({
    meta: [
      { title: "User Management - Sugity Creatives" },
      { name: "description", content: "Kelola Data Pengguna" },
    ],
  }),
  component: UsersPage,
});

function UsersPage() {
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { data: users = [], isLoading } = useUsers(search);
  const deleteUser = useDeleteUser();

  const confirmDelete = useCallback((u: AppUser) => {
    setDeleteError(null);
    setDeleteTarget(u);
  }, []);

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteUser.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
      onError: (e) => setDeleteError(e.message),
    });
  }, [deleteTarget, deleteUser]);

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        {}
        <div className="mb-6">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            User Management
          </span>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Kelola Data Pengguna
          </h1>
        </div>

        {}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="search-users"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Username, NIK, atau Role..."
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-smooth focus:border-[#c05c30]/60 dark:bg-card-elevated"
            />
          </div>
          <Link
            to="/users/create"
            id="btn-tambah-user"
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#c05c30] px-5 py-2.5 text-[13.5px] font-semibold text-white transition-smooth hover:brightness-110 active:scale-[0.97]"
          >
            <Plus className="h-4 w-4" />
            Tambah User
          </Link>
        </div>

        {}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-sm">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                  {["Username", "NIK", "Role", "Status", "Actions"].map((col) => (
                    <th
                      key={col}
                      className={`border-b border-border bg-card-elevated/50 px-5 py-3.5 font-semibold ${col === "Actions" ? "text-right" : ""}`}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-14 text-center text-sm text-muted-foreground"
                    >
                      {search ? (
                        `Tidak ada user yang cocok dengan "${search}"`
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <Users className="h-10 w-10 text-muted-foreground/40" />
                          <span>
                            Belum ada user. Klik <strong>Tambah User</strong> untuk memulai.
                          </span>
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  users.map((u) => <UserRow key={u.id} user={u} onDelete={confirmDelete} />)
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
            <h3 className="mt-4 text-base font-semibold text-foreground">Hapus User?</h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{deleteTarget.username}</span> akan
              dihapus secara permanen.
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
                disabled={deleteUser.isPending}
                className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-smooth hover:bg-red-600 disabled:opacity-50"
              >
                {deleteUser.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

function UserRow({ user, onDelete }: { user: AppUser; onDelete: (u: AppUser) => void }) {
  const roleColors: Record<string, string> = {
    admin: "bg-purple-500/10 text-purple-500 dark:text-purple-400",
    operator: "bg-blue-500/10 text-blue-500 dark:text-blue-400",
    usertv: "bg-muted text-muted-foreground",
    viewer: "bg-muted text-muted-foreground",
  };

  return (
    <tr className="group transition-smooth hover:bg-card-elevated/40">
      <td className="border-b border-border/60 px-5 py-4">
        <span className="font-mono text-[13px] font-bold text-[#c05c30]">{user.username}</span>
      </td>
      <td className="border-b border-border/60 px-5 py-4 text-muted-foreground text-[13px]">
        {user.nik || "-"}
      </td>
      <td className="border-b border-border/60 px-5 py-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${roleColors[user.role] ?? "bg-muted text-muted-foreground"}`}
        >
          {user.role}
        </span>
      </td>
      <td className="border-b border-border/60 px-5 py-4">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${user.status === "active" ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}
        >
          {user.status}
        </span>
      </td>
      <td className="border-b border-border/60 px-5 py-4 text-right">
        <div className="inline-flex items-center gap-1">
          <Link
            to="/users/create"
            search={{ editId: user.id }}
            id={`btn-edit-user-${user.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-blue-500 dark:text-blue-400 transition-smooth hover:bg-blue-500/10"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </Link>
          <button
            id={`btn-delete-user-${user.id}`}
            onClick={() => onDelete(user)}
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
