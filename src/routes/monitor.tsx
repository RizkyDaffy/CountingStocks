import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Activity, RefreshCw, Wifi, WifiOff, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { fetchApi } from "@/lib/api";

export const Route = createFileRoute("/monitor")({
  head: () => ({
    meta: [
      { title: "IoT Monitor - Sugity Creatives" },
      { name: "description", content: "Monitor status IoT scanned" },
    ],
  }),
  component: MonitorPage,
});

type IotEntry = { path: string; scanned: boolean; ts: string | null };
type IotMonitorData = {
  scanned: IotEntry[];
  notScanned: IotEntry[];
  total: number;
};

function parsePath(path: string) {
  const parts = path.split("/").filter(Boolean);
  if (parts.length >= 3) {
    const webhook = parts[0];
    const rest = parts.slice(1);
    return { webhook, segments: rest };
  }
  return { webhook: parts[0] || "", segments: parts.slice(1) };
}

function timeAgo(ts: string | null): string {
  if (!ts) return "-";
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 1000) return "baru saja";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}d lalu`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m lalu`;
  return `${Math.floor(diff / 3_600_000)}j lalu`;
}

function MonitorPage() {
  const [data, setData] = useState<IotMonitorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchData = async () => {
    try {
      const result = await fetchApi<IotMonitorData>("/iot-monitor");
      setData(result);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    if (!autoRefresh) return;
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Monitoring
            </span>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              IoT Scan Monitor
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition-smooth ${
                autoRefresh
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Activity className="h-4 w-4" />
              {autoRefresh ? "Auto ON" : "Auto OFF"}
            </button>
            <button
              onClick={fetchData}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-smooth hover:bg-accent"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        {loading && !data ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center text-destructive">
            {error}
          </div>
        ) : data ? (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatCard
                label="Total Entries"
                value={data.total}
                icon={<Activity className="h-5 w-5" />}
                color="text-blue-500"
              />
              <StatCard
                label="Scanned (ON)"
                value={data.scanned.length}
                icon={<Wifi className="h-5 w-5" />}
                color="text-emerald-500"
              />
              <StatCard
                label="Not Scanned (OFF)"
                value={data.notScanned.length}
                icon={<WifiOff className="h-5 w-5" />}
                color="text-muted-foreground"
              />
            </div>

            <Section
              title="Scanned"
              color="emerald"
              entries={data.scanned}
              emptyMsg="Tidak ada entry yang sedang scanned"
            />
            <Section
              title="Not Scanned"
              color="muted"
              entries={data.notScanned}
              emptyMsg="Semua entry sedang scanned!"
            />
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className={color}>{icon}</span>
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
    </div>
  );
}

function Section({
  title,
  color,
  entries,
  emptyMsg,
}: {
  title: string;
  color: string;
  entries: IotEntry[];
  emptyMsg: string;
}) {
  const borderColor = color === "emerald" ? "border-emerald-500/30" : "border-border";
  const badgeColor =
    color === "emerald"
      ? "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
      : "bg-muted text-muted-foreground";
  const dotColor = color === "emerald" ? "bg-emerald-500" : "bg-muted-foreground/40";

  return (
    <div className={`rounded-2xl border ${borderColor} bg-card overflow-hidden`}>
      <div className="flex items-center gap-3 border-b border-border px-5 py-3.5">
        <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-bold ${badgeColor}`}>
          {entries.length}
        </span>
      </div>
      {entries.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">{emptyMsg}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[500px] border-separate border-spacing-0 text-left text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                <th className="border-b border-border px-5 py-3 font-medium">Machine</th>
                <th className="border-b border-border px-5 py-3 font-medium">QR ID</th>
                <th className="border-b border-border px-5 py-3 font-medium">Path</th>
                <th className="border-b border-border px-5 py-3 font-medium">Terakhir Scan</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => {
                const { segments } = parsePath(e.path);
                const machine = segments[0] || "-";
                const qrId = segments[segments.length - 1] || "-";
                return (
                  <tr key={e.path} className="transition-smooth hover:bg-card-elevated/40">
                    <td className="border-b border-border/60 px-5 py-3.5">
                      <span className="font-mono text-[13px] font-bold text-blue-500 dark:text-blue-400">
                        {machine}
                      </span>
                    </td>
                    <td className="border-b border-border/60 px-5 py-3.5">
                      <span className="font-mono text-[13px] font-semibold text-foreground">
                        {qrId}
                      </span>
                    </td>
                    <td className="border-b border-border/60 px-5 py-3.5">
                      <span className="font-mono text-[12px] text-muted-foreground">{e.path}</span>
                    </td>
                    <td className="border-b border-border/60 px-5 py-3.5 text-muted-foreground">
                      {timeAgo(e.ts)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
