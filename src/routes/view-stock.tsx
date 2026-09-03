import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Boxes,
  Search,
  Filter,
  TrendingUp,
  TrendingDown,
  Package,
  Minus,
  RefreshCw,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useStock, useStockStats, useStockFactories, type StockRow } from "@/hooks/use-stock";

export const Route = createFileRoute("/view-stock")({
  head: () => ({
    meta: [
      { title: "Lihat Stock  - Sugity Creatives" },
      { name: "description", content: "Realtime stock data view with IN/OUT tracking." },
    ],
  }),
  component: ViewStockPage,
});

function ViewStockPage() {
  const [query, setQuery] = useState("");
  const [factory, setFactory] = useState("All");

  const { data: factories = [], isLoading: loadingFactories } = useStockFactories();
  const allFactories = ["All", ...factories];

  const { data: stockData = [], isLoading, refetch } = useStock(query, factory);
  const { data: statsData, isLoading: loadingStats } = useStockStats();

  const totalUnits = statsData?.totalUnits ?? 0;
  const skuCount = statsData?.skuCount ?? 0;
  const emptyStock = statsData?.emptyStock ?? 0;

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        {}
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Inventory
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Lihat Stock</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Tingkat stok live yang disinkronkan dengan setiap pemindaian QR. Diperbarui setiap 21,4
            Milidetik.
          </p>
        </div>

        {}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="Total Units di Stock"
            value={loadingStats ? null : Number(totalUnits).toLocaleString()}
            icon={Package}
          />
          <StatCard
            label="Jumlah Parts yang Dipantau"
            value={loadingStats ? null : skuCount.toString()}
            icon={Boxes}
          />
          <StatCard
            label="Stock Habis (0 unit)"
            value={loadingStats ? null : emptyStock.toString()}
            icon={TrendingDown}
            accent
          />
        </div>

        {}
        <section className="mt-6 rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-semibold text-foreground">Stock Levels</h2>
            <div className="flex flex-wrap items-center gap-2">
              {}
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="search-stock"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Cari part atau QR ID…"
                  className="h-10 w-full rounded-full border border-border-surface bg-card-elevated pl-9 pr-4 text-sm outline-none transition-smooth focus:border-[#C05C30] sm:w-52"
                />
              </div>
              {}
              <div className="relative">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <select
                  id="filter-factory"
                  value={factory}
                  onChange={(e) => setFactory(e.target.value)}
                  disabled={loadingFactories}
                  className="h-10 appearance-none rounded-full border border-border-surface bg-card-elevated pl-9 pr-8 text-sm text-foreground outline-none transition-smooth focus:border-[#C05C30]"
                >
                  {allFactories.map((f) => (
                    <option key={f} value={f} className="bg-card">
                      {f}
                    </option>
                  ))}
                </select>
              </div>
              {}
              <button
                id="btn-refresh-stock"
                onClick={() => refetch()}
                className="inline-flex h-10 w-10 items-center justify-center border border-border-surface rounded-full bg-card-elevated text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground"
                title="Refresh now"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border-surface bg-surface-elevated p-4 animate-pulse"
                >
                  {}
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="h-3.5 w-36 rounded-full bg-card-elevated" />
                        <div className="h-3 w-16 rounded-full bg-card-elevated/70" />
                      </div>
                      <div className="h-2.5 w-20 rounded-full bg-card-elevated/60" />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="h-8 w-8 rounded-full bg-card-elevated" />
                      <div className="h-6 w-16 rounded-full bg-card-elevated" />
                    </div>
                  </div>
                  {}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="h-2.5 w-20 rounded-full bg-card-elevated/70" />
                      <div className="h-2.5 w-10 rounded-full bg-card-elevated/70" />
                    </div>
                    <div className="h-2 w-full rounded-full bg-card" />
                  </div>
                  {}
                  <div className="mt-2 flex items-center justify-between">
                    <div className="h-2 w-28 rounded-full bg-card-elevated/50" />
                    <div className="h-2 w-24 rounded-full bg-card-elevated/50" />
                  </div>
                </div>
              ))
            ) : stockData.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                Yah ga ada stock items yang terlihat nih.{" "}
                {query === "" && factory === "All" && (
                  <span className="block mt-1 text-xs">
                    Buat sebuah QR code dulu - setaip QR baru auto membuat sebuah stock entry.
                  </span>
                )}
              </div>
            ) : (
              stockData.map((row) => <StockCard key={row.id} row={row} />)
            )}
          </div>
        </section>

        {}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-[11.5px] text-muted-foreground px-1">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Stocked (has units)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-500" />
            Empty (0 units - cannot scan OUT)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            Untouched (awaiting first scan)
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StockCard({ row }: { row: StockRow }) {
  const unitValue = Number(row.unit_value);
  const currentStock = Number(row.current_stock);
  const percentage = Number(row.percentage);

  const isUntouched = row.trend === "none";
  const isEmpty = currentStock === 0 && !isUntouched;
  const isStocked = currentStock > 0;

  const statusColor = isUntouched
    ? "bg-muted-foreground/15 text-muted-foreground"
    : isEmpty
      ? "bg-red-500/10 text-red-400"
      : "bg-emerald-500/10 text-emerald-400";

  const barColor = isUntouched
    ? "bg-muted-foreground/30"
    : isEmpty
      ? "bg-red-500"
      : "bg-emerald-500";

  const TrendIcon = row.trend === "up" ? TrendingUp : row.trend === "down" ? TrendingDown : Minus;

  const updatedAt = new Date(row.updated_at).toLocaleString("en-CA", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="group rounded-2xl border border-border-surface bg-surface-elevated p-4 transition-smooth hover:bg-surface-hover">
      <div className="flex flex-wrap items-start justify-between gap-2">
        {}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{row.part_name}</span>
            <span className="rounded-full bg-card px-2 py-0.5 text-[10px] font-mono text-muted-foreground">
              {row.qr_id}
            </span>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {row.factory}
            {row.machine ? ` - ${row.machine}` : ""}
          </div>
        </div>

        {}
        <div className="flex items-center gap-2 shrink-0">
          {}
          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${statusColor}`}>
            <TrendIcon className="h-4 w-4" />
          </div>
          {/* Status badge */}
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusColor}`}
          >
            {isUntouched ? "Not scanned" : isEmpty ? "Empty" : "Stocked"}
          </span>
        </div>
      </div>

      {/* Progress bar, feat: {unitValue} units*/}
      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11.5px] text-muted-foreground">
            <span
              className={`font-semibold ${isStocked ? "text-foreground" : "text-muted-foreground"}`}
            >
              {currentStock}
            </span>{" "}
            Total PCs
          </span>
          <span className="text-[11.5px] font-medium text-foreground">
            {isUntouched ? "-" : `${percentage.toFixed(1)}%`}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-card">
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${isUntouched ? 0 : Math.min(100, percentage)}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-2 flex items-center justify-between text-[10.5px] text-muted-foreground/60">
        <span>Unit value: {unitValue} per scan</span>
        <span>Updated {updatedAt}</span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | null; // null triggers shimmer skeleton
  icon: typeof Package;
  accent?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-border-surface bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </span>
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-full ${
            accent ? "bg-destructive/15 text-destructive" : "bg-card-elevated text-foreground/80"
          }`}
        >
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <div className="mt-4 text-2xl font-semibold tracking-tight">
        {value === null ? (
          <div className="h-8 w-24 animate-pulse rounded-lg bg-card-elevated" />
        ) : (
          value
        )}
      </div>
    </div>
  );
}
