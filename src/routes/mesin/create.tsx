import { useState, useCallback, useEffect } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useCreateMesin, useUpdateMesin, useMesin } from "@/hooks/use-mesin";
import { FactoryApi, ScApi } from "@/hooks/use-master-data";
import { useTvDashboard } from "@/hooks/use-tv-dashboard";
import { MinimumStockGrid } from "@/components/mesin/MinimumStockGrid";
import "@/routes/tv.css";

const searchSchema = z.object({
  editId: z.string().optional(),
});

export const Route = createFileRoute("/mesin/create")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Tambah Mesin - Sugity Creatives" },
      { name: "description", content: "Tambah atau edit data mesin" },
    ],
  }),
  component: CreateMesinPage,
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

function CreateMesinPage() {
  const navigate = useNavigate();
  const { editId } = Route.useSearch();
  const isEdit = !!editId;

  const { data: mesinList = [] } = useMesin();
  const editMesin = isEdit ? mesinList.find((m) => m.uuid === editId) : null;

  const createMesin = useCreateMesin();
  const updateMesin = useUpdateMesin();

  const [machineCode, setMachineCode] = useState("");
  const [machineName, setMachineName] = useState("");
  const [machineDesc, setMachineDesc] = useState("");
  const [machineStatus, setMachineStatus] = useState<"active" | "inactive">("active");
  const [machineFactory, setMachineFactory] = useState("");
  const [machineSc, setMachineSc] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: factories = [] } = FactoryApi.useGetAll();
  const { data: scList = [] } = ScApi.useGetAll();
  const { data: stockPreview } = useTvDashboard(machineFactory, "A", !!machineFactory);

  useEffect(() => {
    if (editMesin) {
      setMachineCode(editMesin.machine_code);
      setMachineName(editMesin.machine_name);
      setMachineDesc(editMesin.machine_desc ?? "");
      setMachineStatus(editMesin.machine_status);
      setMachineFactory(editMesin.machine_factory ?? "");
      setMachineSc(editMesin.machine_sc || "SC1");
    }
  }, [editMesin]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setSubmitError(null);

      const payload = {
        machineCode: machineCode.trim(),
        machineName: machineName.trim(),
        machineDesc: machineDesc.trim(),
        machineFactory: machineFactory.trim(),
        machineSc: machineSc || "SC1",
        machineStatus,
      };

      if (isEdit && editId) {
        updateMesin.mutate(
          { uuid: editId, ...payload },
          {
            onSuccess: () => {
              setSuccess(true);
              setTimeout(() => navigate({ to: "/mesin" }), 900);
            },
            onError: (err) => setSubmitError(err.message),
          },
        );
      } else {
        createMesin.mutate(payload, {
          onSuccess: () => {
            setSuccess(true);
            setTimeout(() => navigate({ to: "/mesin" }), 900);
          },
          onError: (err) => setSubmitError(err.message),
        });
      }
    },
    [
      machineCode,
      machineName,
      machineDesc,
      machineFactory,
      machineSc,
      machineStatus,
      isEdit,
      editId,
      createMesin,
      updateMesin,
      navigate,
    ],
  );

  const isPending = createMesin.isPending || updateMesin.isPending;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl animate-in fade-in duration-300">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {isEdit ? "Edit Mesin" : "Tambah Mesin"}
            </span>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {isEdit ? "Edit Data Mesin" : "Add New Machine"}
            </h1>
          </div>
          <Link
            to="/mesin"
            className="text-sm font-semibold text-[#c05c30] transition-smooth hover:opacity-80"
          >
            Back to List
          </Link>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border bg-card p-6 sm:p-8"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Machine Code" required>
              <input
                id="input-machine-code"
                type="text"
                value={machineCode}
                onChange={(e) => setMachineCode(e.target.value)}
                placeholder="e.g. MC#6"
                required
                className={INPUT}
              />
            </Field>

            <Field label="Machine Name" required>
              <input
                id="input-machine-name"
                type="text"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                placeholder="e.g. Quarter Trim Machine #6"
                required
                className={INPUT}
              />
            </Field>
          </div>

          <div className="mt-5">
            <Field label="Description">
              <input
                id="input-description"
                type="text"
                value={machineDesc}
                onChange={(e) => setMachineDesc(e.target.value)}
                placeholder="Optional"
                className={INPUT}
              />
            </Field>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-5 sm:grid-cols-3">
            <Field label="Factory" required>
              <div className="relative">
                <select
                  id="input-factory"
                  value={machineFactory}
                  onChange={(e) => setMachineFactory(e.target.value)}
                  required
                  className={SELECT}
                >
                  <option value="">Pilih factory...</option>
                  {factories.map((f) => (
                    <option key={f.uuid} value={f.uuid}>
                      {f.factory_name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ▾
                </div>
              </div>
            </Field>

            <Field label="SC (Supply Chain)" required>
              <div className="relative">
                <select
                  id="input-sc"
                  value={machineSc}
                  onChange={(e) => setMachineSc(e.target.value)}
                  className={SELECT}
                >
                  <option value="SC1">SC1</option>
                  {scList.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.sc_id}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  ▾
                </div>
              </div>
            </Field>

            <Field label="Status" required>
              <div className="relative">
                <select
                  id="input-status"
                  value={machineStatus}
                  onChange={(e) =>
                    setMachineStatus(e.target.value as "active" | "inactive")
                  }
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

          {machineFactory && (
            <div className="mt-8 rounded-2xl border border-border bg-card-elevated/30 p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
                Minimum Stock / Machine
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Mesin untuk factory - status berdasarkan Stok Jam.
              </p>
              <MinimumStockGrid machines={stockPreview?.machines ?? []} compact />
            </div>
          )}

          {submitError && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-destructive/30 bg-destructive/10 p-3.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {submitError}
            </div>
          )}

          {success && (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              Mesin berhasil {isEdit ? "diperbarui" : "disimpan"}! Mengalihkan...
            </div>
          )}

          <div className="mt-8 flex justify-end gap-3">
            <Link
              to="/mesin"
              className="inline-flex items-center rounded-xl border border-border bg-card-elevated px-5 py-2.5 text-sm font-semibold text-foreground transition-smooth hover:bg-accent"
            >
              Cancel
            </Link>
            <button
              id="btn-save-mesin"
              type="submit"
              disabled={isPending || success}
              className="inline-flex items-center gap-2 rounded-xl bg-[#c05c30] px-6 py-2.5 text-sm font-bold text-white transition-smooth hover:brightness-110 disabled:opacity-50"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Update Machine" : "Save Machine"}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
