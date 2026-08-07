import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  XCircle,
  History,
  ArrowDownLeft,
  ArrowUpRight,
  QrCode,
} from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useTasks } from "@/hooks/use-tasks";
import { useQrHistory } from "@/hooks/use-qr-process";

export const Route = createFileRoute("/task-history")({
  head: () => ({
    meta: [
      { title: "History Tugas - Sugity Creatives" },
      { name: "description", content: "View your task and scan history." },
    ],
  }),
  component: TaskHistoryPage,
});

const STATUS_META = {
  completed: { icon: CheckCircle2, cls: "bg-emerald-500/10 text-emerald-400", label: "Completed" },
  pending: { icon: Clock, cls: "bg-card-elevated text-muted-foreground", label: "Pending" },
  failed: { icon: XCircle, cls: "bg-destructive/15 text-destructive", label: "Failed" },
} as const;

function TaskHistoryPage() {
  const [tab, setTab] = useState<"tasks" | "scans">("scans");
  const { data: tasks = [], isLoading: loadingTasks } = useTasks();
  const { data: scanHistory = [], isLoading: loadingScans } = useQrHistory();

  return (
    <DashboardLayout>
      <div className="animate-in fade-in duration-300">
        <div className="mb-6 flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Activity
          </span>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">History Tugas</h1>
        </div>

        {}
        <div className="mb-4 flex gap-2">
          <button
            id="tab-scans"
            onClick={() => setTab("scans")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-smooth ${
              tab === "scans"
                ? "bg-[#c05c30] text-white"
                : "border border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            <QrCode className="h-4 w-4" />
            QR Scan Log
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
              {scanHistory.length}
            </span>
          </button>
          <button
            id="tab-tasks"
            onClick={() => setTab("tasks")}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-smooth ${
              tab === "tasks"
                ? "bg-[#008349] text-white"
                : "border border-border bg-card text-muted-foreground hover:bg-accent"
            }`}
          >
            <History className="h-4 w-4" />
            Semua Tugas
            <span className="rounded-full bg-white/20 px-1.5 py-0.5 text-[10px]">
              {tasks.length}
            </span>
          </button>
        </div>

        {/* QR Scan Log */}
        {tab === "scans" && (
          <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">QR Scan Events</h2>
              <span className="text-xs text-muted-foreground">
                {scanHistory.length} entries · Memuat setiap 5dtk
              </span>
            </div>

            <ul className="mt-5 space-y-3">
              {loadingScans ? (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  Loading scan history...
                </li>
              ) : scanHistory.length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  Yahh masih belum ada nih scan events nya. coba buat QR code lalu scan!
                </li>
              ) : (
                scanHistory.map((s) => {
                  const isIn = s.action === "SCAN_IN";
                  const dateObj = new Date(s.created_at);
                  const formattedTime = dateObj
                    .toLocaleString("en-CA", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    .replace(",", "");

                  return (
                    <li
                      key={s.id}
                      className="group flex items-start gap-4 rounded-2xl border border-border bg-card-elevated/30 p-4 transition-smooth hover:bg-card-elevated/60"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                          isIn ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {isIn ? (
                          <ArrowDownLeft className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            {s.qr_id}
                          </span>
                          {s.batch_id && (
                            <span className="rounded-full bg-card px-2 py-0.5 text-[10px] text-muted-foreground font-mono">
                              {s.batch_id.slice(0, 16)}...
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-sm font-medium text-foreground">{s.label}</div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {s.factory} · {formattedTime}
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                          isIn ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {isIn ? "IN" : "OUT"}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        )}

        {/* All Tasks */}
        {tab === "tasks" && (
          <section className="rounded-3xl border border-border-surface bg-surface-section p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-foreground">Tasks Terbaru</h2>
              <span className="text-xs text-muted-foreground">{tasks.length} entries</span>
            </div>

            <ul className="mt-5 space-y-3">
              {loadingTasks ? (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  Loading task history tunggu yah hehe...
                </li>
              ) : tasks.length === 0 ? (
                <li className="py-8 text-center text-sm text-muted-foreground">
                  Yah belum Belum ada task nih...
                </li>
              ) : (
                tasks.map((t) => {
                  const meta = STATUS_META[t.status];
                  const Icon = meta.icon;

                  const dateObj = new Date(t.created_at);
                  const formattedTime = dateObj
                    .toLocaleString("en-CA", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                    .replace(",", "");

                  return (
                    <li
                      key={t.id}
                      className="group flex items-start gap-4 rounded-2xl border border-border bg-card-elevated/30 p-4 transition-smooth hover:bg-card-elevated/60"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-card text-foreground/80">
                        <History className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                            {t.task_id}
                          </span>
                          <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted-foreground">
                            {t.type}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm font-medium text-foreground">
                          {t.title}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          by {t.user} · {formattedTime}
                        </div>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${meta.cls}`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </li>
                  );
                })
              )}
            </ul>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
