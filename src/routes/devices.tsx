import { useState, useMemo, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Smartphone,
  Tablet,
  Wifi,
  WifiOff,
  Battery,
  MoreHorizontal,
  Search,
  Plus,
  LayoutGrid,
  List,
  X,
  Loader2,
  AlertCircle,
  Trash2,
  Pencil,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import {
  useDevices,
  useCreateDevice,
  useDeleteDevice,
  useUpdateDevice,
  type DeviceRow,
  type CreateDevicePayload,
} from "@/hooks/use-devices";
import { FactoryApi } from "@/hooks/use-master-data";

export const Route = createFileRoute("/devices")({
  head: () => ({
    meta: [
      { title: "Device Management - Sugity Creatives" },
      { name: "description", content: "Management perangkat scanner." },
    ],
  }),
  component: DevicesPage,
});

function getLastSyncLabel(lastSync: string): string {
  const syncDate = new Date(lastSync);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - syncDate.getTime()) / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min lalu`;
  if (diffMin < 1440) return `${Math.floor(diffMin / 60)} J lalu`;
  return "Kemarin";
}

function AddDeviceModal({ onClose }: { onClose: () => void }) {
  const createDevice = useCreateDevice();
  const { data: factories = [], isLoading: isLoadingFactories } = FactoryApi.useGetAll();
  const [form, setForm] = useState<CreateDevicePayload>({
    device_code: "",
    name: "",
    location: "",
    device_role: "IN",
    pin: "",
    model: "Scanner",
    type: "phone",
    active_status: "active",
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleChange = useCallback(
    <K extends keyof CreateDevicePayload>(key: K, value: CreateDevicePayload[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      createDevice.mutate(form, {
        onSuccess: () => onClose(),
        onError: (err) => setFormError(err.message),
      });
    },
    [form, createDevice, onClose],
  );

  const inputCls =
    "w-full rounded-xl border border-border bg-card-elevated px-4 py-2.5 text-sm outline-none transition-smooth focus:border-primary/60 focus:ring-1 focus:ring-primary/30";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Tambah Devices</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Daftarkan perangkat baru ke sistem
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-smooth"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Device Code */}
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="dc-device-code" className={labelCls}>
                Device Code <span className="text-destructive">*</span>
              </label>
              <input
                id="dc-device-code"
                value={form.device_code}
                onChange={(e) => handleChange("device_code", e.target.value)}
                placeholder="cth: scanner-a01"
                required
                className={inputCls}
              />
            </div>

            {/* Device Name */}
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="dc-name" className={labelCls}>
                Device Name <span className="text-destructive">*</span>
              </label>
              <input
                id="dc-name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="cth: Scanner A-01"
                required
                className={inputCls}
              />
            </div>

            {/* Location */}
            <div className="col-span-2">
              <label htmlFor="dc-location" className={labelCls}>
                Location <span className="text-muted-foreground/50">(Opsional)</span>
              </label>
              <select
                id="dc-location"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                disabled={isLoadingFactories}
                className={inputCls}
              >
                <option value="">-- Pilih Factory --</option>
                {factories.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Device Role */}
            <div>
              <label htmlFor="dc-role" className={labelCls}>
                Device Role <span className="text-destructive">*</span>
              </label>
              <select
                id="dc-role"
                value={form.device_role}
                onChange={(e) => handleChange("device_role", e.target.value as "IN" | "OUT")}
                required
                className={inputCls}
              >
                <option value="IN">IN - Scan Masuk</option>
                <option value="OUT">OUT - Scan Keluar</option>
              </select>
            </div>

            {/* PIN */}
            <div>
              <label htmlFor="dc-pin" className={labelCls}>
                PIN <span className="text-destructive">*</span>
              </label>
              <input
                id="dc-pin"
                type="password"
                value={form.pin}
                onChange={(e) => handleChange("pin", e.target.value)}
                placeholder="Min. 4 karakter"
                required
                minLength={4}
                className={inputCls}
              />
            </div>

            {/* Device Type */}
            <div>
              <label htmlFor="dc-type" className={labelCls}>
                Model Perangkat
              </label>
              <select
                id="dc-type"
                value={form.type}
                onChange={(e) => handleChange("type", e.target.value as "phone" | "tablet")}
                className={inputCls}
              >
                <option value="phone">Phone / Scanner</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="dc-status" className={labelCls}>
                Status
              </label>
              <select
                id="dc-status"
                value={form.active_status}
                onChange={(e) =>
                  handleChange("active_status", e.target.value as "active" | "inactive")
                }
                className={inputCls}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
            >
              Batal
            </button>
            <button
              id="dc-submit"
              type="submit"
              disabled={createDevice.isPending}
              className="flex-1 rounded-xl bg-[#c05c30] py-2.5 text-sm font-semibold text-white transition-smooth hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {createDevice.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Device"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditDeviceModal({ device, onClose }: { device: DeviceRow; onClose: () => void }) {
  const updateDevice = useUpdateDevice();
  const { data: factories = [], isLoading: isLoadingFactories } = FactoryApi.useGetAll();
  const [form, setForm] = useState<Partial<CreateDevicePayload>>({
    device_code: device.device_code || "",
    name: device.name,
    location: device.location || "",
    device_role: device.device_role,
    pin: "", // Optional during edit
    model: device.model,
    type: device.type,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const handleChange = useCallback(
    <K extends keyof CreateDevicePayload>(key: K, value: CreateDevicePayload[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      setFormError(null);
      updateDevice.mutate(
        { id: device.id, payload: form },
        {
          onSuccess: () => onClose(),
          onError: (err) => setFormError(err.message),
        },
      );
    },
    [device.id, form, updateDevice, onClose],
  );

  const inputCls =
    "w-full rounded-xl border border-border bg-card-elevated px-4 py-2.5 text-sm outline-none transition-smooth focus:border-primary/60 focus:ring-1 focus:ring-primary/30";
  const labelCls = "block text-xs font-medium text-muted-foreground mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-border bg-card shadow-xl p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-foreground">Edit Devices</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Ubah informasi perangkat</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 inline-flex items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground transition-smooth"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {formError && (
          <div className="mb-4 flex items-start gap-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Device Code */}
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="edit-device-code" className={labelCls}>
                Device Code <span className="text-destructive">*</span>
              </label>
              <input
                id="edit-device-code"
                value={form.device_code}
                onChange={(e) => handleChange("device_code", e.target.value)}
                placeholder="cth: scanner-a01"
                required
                className={inputCls}
              />
            </div>

            {/* Device Name */}
            <div className="col-span-2 sm:col-span-1">
              <label htmlFor="edit-name" className={labelCls}>
                Device Name <span className="text-destructive">*</span>
              </label>
              <input
                id="edit-name"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="cth: Scanner A-01"
                required
                className={inputCls}
              />
            </div>

            {/* Location */}
            <div className="col-span-2">
              <label htmlFor="edit-location" className={labelCls}>
                Location <span className="text-muted-foreground/50">(Opsional)</span>
              </label>
              <select
                id="edit-location"
                value={form.location}
                onChange={(e) => handleChange("location", e.target.value)}
                disabled={isLoadingFactories}
                className={inputCls}
              >
                <option value="">-- Pilih Factory --</option>
                {factories.map((f) => (
                  <option key={f.id} value={f.name}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Device Role */}
            <div>
              <label htmlFor="edit-role" className={labelCls}>
                Device Role <span className="text-destructive">*</span>
              </label>
              <select
                id="edit-role"
                value={form.device_role}
                onChange={(e) => handleChange("device_role", e.target.value as "IN" | "OUT")}
                required
                className={inputCls}
              >
                <option value="IN">IN - Scan Masuk</option>
                <option value="OUT">OUT - Scan Keluar</option>
              </select>
            </div>

            {/* PIN */}
            <div>
              <label htmlFor="edit-pin" className={labelCls}>
                PIN <span className="text-muted-foreground/50">(Opsional)</span>
              </label>
              <input
                id="edit-pin"
                type="password"
                value={form.pin}
                onChange={(e) => handleChange("pin", e.target.value)}
                placeholder="Abaikan jika tdk diubah"
                minLength={4}
                className={inputCls}
              />
            </div>

            {/* Device Type */}
            <div className="col-span-2">
              <label htmlFor="edit-type" className={labelCls}>
                Model Perangkat
              </label>
              <select
                id="edit-type"
                value={form.type}
                onChange={(e) => handleChange("type", e.target.value as "phone" | "tablet")}
                className={inputCls}
              >
                <option value="phone">Phone / Scanner</option>
                <option value="tablet">Tablet</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-border py-2.5 text-sm font-medium text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
            >
              Batal
            </button>
            <button
              id="edit-submit"
              type="submit"
              disabled={updateDevice.isPending}
              className="flex-1 rounded-xl bg-[#c05c30] py-2.5 text-sm font-semibold text-white transition-smooth hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {updateDevice.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                "Simpan Perubahan"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeviceCard({
  d,
  onDelete,
  onEdit,
}: {
  d: DeviceRow;
  onDelete: (id: number) => void;
  onEdit: (d: DeviceRow) => void;
}) {
  const TypeIcon = d.type === "phone" ? Smartphone : Tablet;
  const isOnline = d.status === "online";
  const lastSyncLabel = getLastSyncLabel(d.last_sync);

  return (
    <div className="rounded-3xl border border-border-surface bg-card p-5 transition-smooth hover:bg-card-elevated/40">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-card-elevated text-foreground/90">
            <TypeIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">{d.name}</div>
            <div className="text-xs text-muted-foreground">{d.model}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {d.device_code && (
            <span className="rounded-full bg-card-elevated px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              {d.device_role}
            </span>
          )}
          {/* Triple-dot menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
                aria-label="More options"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(d)}>
                <Pencil className="h-3.5 w-3.5" />
                Edit item ini
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onClick={() => onDelete(d.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus item ini
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
            isOnline ? "bg-[#00bc7d] text-white" : "bg-card-elevated text-muted-foreground"
          }`}
        >
          {isOnline ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {isOnline ? "Online" : "Offline"}
        </span>
        <span
          className={`inline-flex items-center gap-1 text-xs ${
            d.battery < 20 ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          <Battery className="h-3.5 w-3.5" />
          {d.battery}%
        </span>
      </div>

      <div className="mt-4 space-y-1 border-t border-border pt-4 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Lokasi</span>
          <span className="text-foreground">{d.location || "-"}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Terakhir Terhubung</span>
          <span className="text-foreground">{lastSyncLabel}</span>
        </div>
      </div>
    </div>
  );
}

function DeviceListView({
  devices,
  onDelete,
  onEdit,
}: {
  devices: DeviceRow[];
  onDelete: (id: number) => void;
  onEdit: (d: DeviceRow) => void;
}) {
  return (
    <div className="rounded-3xl border border-border-surface bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            <th className="px-5 py-3.5 text-left text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Perangkat
            </th>
            <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hidden sm:table-cell">
              Code
            </th>
            <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hidden md:table-cell">
              Lokasi
            </th>
            <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Role
            </th>
            <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hidden lg:table-cell">
              Baterai
            </th>
            <th className="px-4 py-3.5 text-left text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground hidden xl:table-cell">
              Terakhir Terhubung
            </th>
            <th className="px-4 py-3.5 text-right text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Aksi
            </th>
          </tr>
        </thead>
        <tbody>
          {devices.map((d, i) => {
            const TypeIcon = d.type === "phone" ? Smartphone : Tablet;
            const isOnline = d.status === "online";
            return (
              <tr
                key={d.id}
                className={`transition-smooth hover:bg-card-elevated/50 ${
                  i !== devices.length - 1 ? "border-b border-border/60" : ""
                }`}
              >
                {/* Perangkat */}
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-xl bg-card-elevated flex items-center justify-center text-foreground/70 shrink-0">
                      <TypeIcon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground text-sm">{d.name}</div>
                      <div className="text-xs text-muted-foreground">{d.model}</div>
                    </div>
                  </div>
                </td>

                {/* Code */}
                <td className="px-4 py-3.5 hidden sm:table-cell">
                  <span className="font-mono text-xs bg-card-elevated px-2 py-1 rounded-lg text-muted-foreground">
                    {d.device_code || "-"}
                  </span>
                </td>

                {/* Location */}
                <td className="px-4 py-3.5 hidden md:table-cell">
                  <span className="text-sm text-foreground">{d.location || "-"}</span>
                </td>

                {/* Role */}
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      d.device_role === "IN"
                        ? "bg-green-500/10 text-green-600 dark:text-green-400"
                        : "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                    }`}
                  >
                    {d.device_role || "-"}
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isOnline
                        ? "bg-pixel-blue-soft/20 text-[oklch(0.82_0.06_245)]"
                        : "bg-card-elevated text-muted-foreground"
                    }`}
                  >
                    {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                    {isOnline ? "Online" : "Offline"}
                  </span>
                </td>

                {/* Battery */}
                <td className="px-4 py-3.5 hidden lg:table-cell">
                  <span
                    className={`inline-flex items-center gap-1 text-xs ${
                      d.battery < 20 ? "text-destructive" : "text-muted-foreground"
                    }`}
                  >
                    <Battery className="h-3.5 w-3.5" />
                    {d.battery}%
                  </span>
                </td>

                {/* Last Sync */}
                <td className="px-4 py-3.5 hidden xl:table-cell text-xs text-muted-foreground">
                  {getLastSyncLabel(d.last_sync)}
                </td>

                {/* Actions */}
                <td className="px-4 py-3.5 text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
                        aria-label="More options"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => onEdit(d)}>
                        <Pencil className="h-3.5 w-3.5" />
                        Edit item ini
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                        onClick={() => onDelete(d.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Hapus item ini
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DevicesPage() {
  const { data: devices = [], isLoading } = useDevices();
  const deleteDevice = useDeleteDevice();

  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingDevice, setEditingDevice] = useState<DeviceRow | null>(null);

  const online = devices.filter((d) => d.status === "online").length;

  const filtered = useMemo(() => {
    if (!search.trim()) return devices;
    const q = search.toLowerCase();
    return devices.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        (d.device_code ?? "").toLowerCase().includes(q) ||
        (d.location ?? "").toLowerCase().includes(q),
    );
  }, [devices, search]);

  const handleDelete = useCallback(
    (id: number) => {
      if (!confirm("Hapus perangkat ini? Tindakan ini tidak bisa dibatalkan.")) return;
      deleteDevice.mutate(id);
    },
    [deleteDevice],
  );

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        {/* Page header */}
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Device
          </span>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Perangkat Terhubung
            </h1>
            {/* Online status pill */}
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#C05C30] opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#C05C30]" />
              </span>
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium">{online}</span> dari {devices.length}{" "}
                perangkat aktif
              </span>
            </div>
          </div>
        </div>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="search-devices"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari Kode Mesin atau Namanya..."
              className="h-10 w-full rounded-full border border-transparent bg-card pl-10 pr-4 text-sm outline-none transition-smooth focus:border-primary/60"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Add button */}
            <button
              id="btn-tambah-devices"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 rounded-full bg-[#c05c30] px-4 py-2 text-sm font-semibold text-white transition-smooth hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Tambah Devices
            </button>

            {/* Grid / List switcher */}
            <div className="inline-flex rounded-full border border-border bg-card p-1 text-xs">
              <button
                id="view-grid"
                onClick={() => setView("grid")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-smooth ${
                  view === "grid"
                    ? "bg-[#c05c30] text-white shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Grid
              </button>
              <button
                id="view-list"
                onClick={() => setView("list")}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-smooth ${
                  view === "list"
                    ? "bg-[#00bc7d] text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-3.5 w-3.5" />
                List
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-3 text-primary" />
            Memuat perangkat...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center text-sm text-muted-foreground">
            {search
              ? `Tidak ada perangkat yang cocok dengan "${search}".`
              : "Belum ada perangkat terdaftar."}
          </div>
        ) : view === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((d) => (
              <DeviceCard key={d.id} d={d} onDelete={handleDelete} onEdit={setEditingDevice} />
            ))}
          </div>
        ) : (
          <DeviceListView devices={filtered} onDelete={handleDelete} onEdit={setEditingDevice} />
        )}
      </div>

      {/* Add Device Modal */}
      {showAddModal && <AddDeviceModal onClose={() => setShowAddModal(false)} />}

      {/* Edit Device Modal */}
      {editingDevice && (
        <EditDeviceModal device={editingDevice} onClose={() => setEditingDevice(null)} />
      )}
    </DashboardLayout>
  );
}
