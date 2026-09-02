import { useState, useEffect, useCallback } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useCreateUser, useUpdateUser, useUsers } from "@/hooks/use-users";
import { FactoryApi } from "@/hooks/use-master-data";

const searchSchema = z.object({ editId: z.number().optional() });

export const Route = createFileRoute("/users/create")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [{ title: "Tambah User - Sugity Creatives" }],
  }),
  component: CreateUserPage,
});

const INPUT =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted-foreground outline-none transition-smooth focus:border-[#c05c30]/60 dark:bg-card-elevated";

const SELECT =
  "h-11 w-full rounded-xl border border-border bg-background px-3.5 text-sm text-foreground outline-none transition-smooth focus:border-[#c05c30]/60 appearance-none cursor-pointer dark:bg-card-elevated";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-foreground">
        {label}
        {required && <span className="ml-0.5 text-[#c05c30]"> *</span>}
      </label>
      {children}
    </div>
  );
}

function CreateUserPage() {
  const navigate = useNavigate();
  const { editId } = Route.useSearch();
  const isEdit = !!editId;

  const { data: allUsers = [] } = useUsers();
  const editUser = isEdit ? allUsers.find((u) => u.id === editId) : null;

  const createUser = useCreateUser();
  const updateUser = useUpdateUser();

  const [username, setUsername] = useState("");
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "operator" | "usertv">("operator");
  const [status, setStatus] = useState<"active" | "inactive">("active");
  const [tvFactory, setTvFactory] = useState("");
  const [tvShift, setTvShift] = useState<"A" | "B">("A");
  const [tvTheme, setTvTheme] = useState<"default" | "dark" | "white">("default");

  const { data: factories = [] } = FactoryApi.useGetAll();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (editUser) {
      setUsername(editUser.username);
      setNik(editUser.nik ?? "");
      setRole((editUser.role as string) === "viewer" ? "usertv" : editUser.role);
      setStatus(editUser.status);
      setTvFactory(editUser.tv_factory ?? "");
      setTvShift(editUser.tv_shift ?? "A");
      setTvTheme((editUser.tv_theme as "default" | "dark" | "white") ?? "default");
    }
  }, [editUser]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      const payload = {
        username: username.trim(),
        nik: nik.trim(),
        password: password || undefined,
        role,
        status,
        tvFactory: role === "usertv" ? tvFactory : "",
        tvShift: role === "usertv" ? tvShift : "A",
        tvTheme: role === "usertv" ? tvTheme : "default",
      };

      if (isEdit && editId) {
        updateUser.mutate(
          { id: editId, ...payload },
          {
            onSuccess: () => {
              setSuccess(true);
              setTimeout(() => navigate({ to: "/users" }), 900);
            },
            onError: (err) => setSubmitError(err.message),
          },
        );
      } else {
        if (!password) {
          setSubmitError("Password wajib diisi untuk user baru.");
          return;
        }
        createUser.mutate(payload as typeof payload & { password: string }, {
          onSuccess: () => {
            setSuccess(true);
            setTimeout(() => navigate({ to: "/users" }), 900);
          },
          onError: (err) => setSubmitError(err.message),
        });
      }
    },
    [
      username,
      nik,
      password,
      role,
      status,
      tvFactory,
      tvShift,
      tvTheme,
      isEdit,
      editId,
      createUser,
      updateUser,
      navigate,
    ],
  );

  const isPending = createUser.isPending || updateUser.isPending;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl animate-in fade-in duration-300">
        {}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {isEdit ? "Edit User" : "Tambah User"}
            </span>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isEdit ? "Edit Data Pengguna" : "Tambah User Baru"}
            </h1>
          </div>
          <Link
            to="/users"
            className="text-sm font-semibold text-[#c05c30] transition-smooth hover:opacity-80"
          >
            Back to List
          </Link>
        </div>

        {}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 sm:p-8"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {}
            <Field label="Username" required>
              <input
                id="input-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. scanner1"
                required
                className={INPUT}
              />
            </Field>

            {}
            <Field label="NIK">
              <input
                id="input-nik"
                type="text"
                value={nik}
                onChange={(e) => setNik(e.target.value)}
                placeholder="e.g. EMP001"
                className={INPUT}
              />
            </Field>

            {}
            <Field
              label={isEdit ? "Password Baru (kosongkan jika tidak diubah)" : "Password"}
              required={!isEdit}
            >
              <input
                id="input-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isEdit ? "Kosongkan jika tidak ingin mengubah" : "Min. 6 karakter"}
                required={!isEdit}
                className={INPUT}
              />
            </Field>

            {}
            <Field label="Role" required>
              <div className="relative">
                <select
                  id="input-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as "admin" | "operator" | "usertv")}
                  className={SELECT}
                >
                  <option value="admin">Admin</option>
                  <option value="operator">Operator</option>
                  <option value="usertv">User TV</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ▾
                </div>
              </div>
            </Field>

            {}
            <Field label="Status" required>
              <div className="relative">
                <select
                  id="input-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as "active" | "inactive")}
                  className={SELECT}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ▾
                </div>
              </div>
            </Field>
          </div>

          {role === "usertv" && (
            <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <Field label="Factory (TV)" required>
                <div className="relative">
                  <select
                    value={tvFactory}
                    onChange={(e) => setTvFactory(e.target.value)}
                    required
                    className={SELECT}
                  >
                    <option value="">Pilih factory…</option>
                    {factories.map((f) => (
                      <option key={f.uuid} value={f.factory_name}>
                        {f.factory_name}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ▾
                  </div>
                </div>
              </Field>
              <Field label="Shift" required>
                <div className="relative">
                  <select
                    value={tvShift}
                    onChange={(e) => setTvShift(e.target.value as "A" | "B")}
                    className={SELECT}
                  >
                    <option value="A">Shift A</option>
                    <option value="B">Shift B</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ▾
                  </div>
                </div>
              </Field>
              <Field label="Theme" required>
                <div className="relative">
                  <select
                    value={tvTheme}
                    onChange={(e) => setTvTheme(e.target.value as "default" | "dark" | "white")}
                    className={SELECT}
                  >
                    <option value="default">Default (system)</option>
                    <option value="dark">Dark</option>
                    <option value="white">White</option>
                  </select>
                  <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    ▾
                  </div>
                </div>
              </Field>
            </div>
          )}

          {}
          {submitError && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}

          {}
          {success && (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              User berhasil {isEdit ? "diperbarui" : "dibuat"}! Mengalihkan…
            </div>
          )}

          {}
          <div className="mt-8 flex justify-end gap-3">
            <Link
              to="/users"
              className="inline-flex items-center rounded-xl border border-border bg-card-elevated px-5 py-2.5 text-sm font-semibold text-foreground transition-smooth hover:bg-accent"
            >
              Cancel
            </Link>
            <button
              id="btn-save-user"
              type="submit"
              disabled={isPending || success}
              className="inline-flex items-center gap-2 rounded-xl bg-[#c05c30] px-6 py-2.5 text-sm font-bold text-white transition-smooth hover:brightness-110 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Update User" : "Simpan User"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
