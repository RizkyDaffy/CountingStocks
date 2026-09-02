import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  LabelList,
} from "recharts";
import { motion } from "framer-motion";
import { useTvDashboard } from "@/hooks/use-tv-dashboard";
import type { TvMachine } from "@/hooks/use-tv-dashboard";
import { MinimumStockGrid } from "@/components/mesin/MinimumStockGrid";
import "./tv.css";

function getStatus(jam: number): "critical" | "warning" | "safe" {
  if (jam < 3.0) return "critical";
  if (jam < 4.0) return "warning";
  return "safe";
}

function computeMinJam(partRows: TvMachine["partRows"]): number {
  const active = partRows.filter((r) => r.jam !== 0);
  if (active.length === 0) return 0;
  return Math.min(...active.map((r) => r.jam));
}

function fixMachineStatuses(machines: TvMachine[]): TvMachine[] {
  return machines.map((m) => {
    if (!m.isActive) return m;
    const minJam = computeMinJam(m.partRows ?? []);
    const cardStatus = getStatus(minJam);
    return { ...m, stokJam: minJam, stockJam: minJam, cardStatus };
  });
}

const searchSchema = z.object({
  fac: z.string().optional().catch(""),
  shift: z.enum(["A", "B"]).optional().catch("A"),
  theme: z.enum(["default", "dark", "white"]).optional().catch("default"),
});

export const Route = createFileRoute("/tv")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "REALTIME STOCK MONITORING - TV" },
      { name: "description", content: "REALTIME Factory stock monitoring display" },
    ],
  }),
  component: TvPage,
});

function resolveTheme(themeParam: string): "dark" | "light" {
  if (themeParam === "white") return "light";
  if (themeParam === "dark") return "dark";
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

const STATUS_COLORS = {
  safe: "#16A34A",
  critical: "#F13333",
  warning: "#F1CB33",
  none: "#F1CB33",
};

const STATUS_SORT_ORDER: Record<string, number> = {
  critical: 0,
  warning: 1,
  safe: 2,
};

type ChartPoint = {
  label: string;
  value: number;
  displayValue: number;
  jam: number;
  status: string;
  models: string[];
  machines: string[];
};

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: ChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      style={{
        background: "var(--color-bg-surface)",
        border: "1px solid var(--color-bg-border)",
        borderRadius: 8,
        fontSize: 12,
        padding: "10px 12px",
        maxWidth: 280,
      }}
    >
      <div
        style={{
          fontWeight: 700,
          color: "var(--color-text-primary)",
          marginBottom: 6,
        }}
      >
        {point.label}
      </div>
      <div style={{ color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        value: {point.value} PCs · {Number(point.jam).toFixed(1)} HR
      </div>
      <div style={{ color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        Models: {point.models.length > 0 ? point.models.join(", ") : "-"}
      </div>
      <div style={{ color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
        Machines: {point.machines.length > 0 ? point.machines.join(", ") : "-"}
      </div>
    </div>
  );
}

interface CustomBarProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { status: string; value: number; jam: number };
}

const CustomBar = (props: CustomBarProps) => {
  const { x = 0, y = 0, width = 0, height = 0, payload } = props;
  const { status = "warning", value = 0, jam = 0 } = payload ?? {};
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.warning;
  const rx = 6;

  if (height <= 0) return null;

  const safeRx = Math.min(rx, width / 2, height / 2);

  const getPath = (currentY: number, currentHeight: number) => {
    return `M${x},${currentY + currentHeight} L${x},${currentY + safeRx} Q${x},${currentY} ${x + safeRx},${currentY} L${x + width - safeRx},${currentY} Q${x + width},${currentY} ${x + width},${currentY + safeRx} L${x + width},${currentY + currentHeight} Z`;
  };

  const startPath = getPath(y + height, 0);
  const endPath = getPath(y, height);

  const formattedJam = `${Number(jam).toFixed(1).replace(".", ",")} HR`;
  // Hasil: "1,2 HR"
  const badgeY = Math.max(y, 22);

  return (
    <g>
      <g style={{ filter: `drop-shadow(0px 0px 15px ${color}30)` }}>
        <motion.path
          initial={{ d: startPath }}
          animate={{ d: endPath }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          fill={color}
          fillOpacity={0.9}
          stroke="none"
        />
      </g>

      {/* Stock text at the bottom */}
      <motion.text
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        x={x + width / 2}
        y={y + height - 20}
        fill="#ffffff"
        textAnchor="middle"
      >
        <tspan fontSize={18} fontWeight={800}>
          {value}
        </tspan>
        <tspan fontSize={13} fontWeight={600} dx="4">
          PCs
        </tspan>
      </motion.text>

      {/* Hour Pill */}
      {jam > 0 && (
        <motion.g
          initial={{ opacity: 0, y: y + 20 }}
          animate={{ opacity: 1, y: badgeY }}
          transition={{ delay: 0.4, duration: 0.4 }}
        >
          {/* Hour Pill */}
          <rect
            x={x + width / 2 - 28}
            y={-28}
            width={56}
            height={22}
            rx={2}
            fill="var(--color-bg-surface)"
            stroke={color}
            strokeWidth={1}
            style={{ filter: `drop-shadow(0px 0px 8px ${color}40)` }}
          />
          <text
            x={x + width / 2}
            y={-17}
            dy="0.35em"
            fill="var(--color-text-primary)"
            fontSize={10}
            fontWeight={700}
            fontFamily="JetBrains Mono, monospace"
            textAnchor="middle"
            letterSpacing="0.05em"
          >
            {formattedJam}
          </text>
        </motion.g>
      )}
    </g>
  );
};

const PAGE_SIZE = 15;
const CYCLE_INTERVAL = 12000; // 12 s between page flips
const TRANSITION_DURATION = 500; // ms - must match CSS transition duration

function TvPage() {
  const { fac = "", shift = "A", theme = "default" } = Route.useSearch();
  const [clock, setClock] = useState("");
  // Change #3: expand/collapse state for safe rows in PRIORITY PRODUCTION
  const [isExpanded, setIsExpanded] = useState(false);
  const visualTheme = resolveTheme(theme);

  const [currentPage, setCurrentPage] = useState(0);
  const [activeSlot, setActiveSlot] = useState<"A" | "B">("A");
  const [isTransitioning, setIsTransitioning] = useState(false);

  const { data, isLoading } = useTvDashboard(fac, shift, !!fac);

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setClock(
        now.toLocaleString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        }) + " WIB",
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const gaugeArc = useMemo(() => {
    // Determine the percentage based on the number of non-critical machines over total active machines
    const machines = data?.machines ?? [];
    const activeMachines = machines.filter((m) => m.isActive);
    let pct = 0;

    if (activeMachines.length > 0) {
      // Fix #1 guarantees that cardStatus reflects the real minimum JAM for each machine
      // and getStatus() has set it properly. So we just count safe/warning vs critical.
      // Availability = percentage of active machines that are NOT critical.
      // (Using the newly fixed fixMachineStatuses function logic)
      const fixedMachines = fixMachineStatuses(machines);
      const nonCriticalCount = fixedMachines.filter(
        (m) => m.isActive && m.cardStatus !== "critical",
      ).length;

      pct = Math.round((nonCriticalCount / activeMachines.length) * 100);
    }

    // Normalize percentage (clamp 0-100)
    pct = Math.min(100, Math.max(0, pct));

    const circumference = 339.3;
    const offset = circumference - (pct / 100) * circumference;
    return { offset, pct };
  }, [data?.machines]);

  const chartPoints = useMemo(() => {
    if (!data) return [];
    const points = data.chartLabels.map((label, i) => {
      const val = data.chartData[i] ?? 0;
      const jam = data.chartStokJam?.[i] ?? 0;
      const status = data.chartStatus?.[i] ?? "warning";
      const models = data.chartModels?.[i] ?? [];
      const machines = data.chartMachines?.[i] ?? [];
      return {
        label,
        value: val,
        displayValue: val,
        jam,
        status,
        models,
        machines,
      };
    });
    return points.sort(
      (a, b) =>
        (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99) ||
        a.label.localeCompare(b.label),
    );
  }, [data]);

  const yAxisConfig = useMemo(() => {
    if (!chartPoints || chartPoints.length === 0) {
      return { domain: [0, 5], ticks: [0, 5] };
    }
    const maxValue = Math.max(...chartPoints.map((d) => d.displayValue));
    const yMax = Math.max(5, Math.ceil(maxValue / 5) * 5);
    const ticks = Array.from({ length: Math.floor(yMax / 5) + 1 }, (_, i) => i * 5);
    return { domain: [0, yMax] as [number, number], ticks };
  }, [chartPoints]);

  // KPI counts: derived from every individual PRIORITY PRODUCTION row.
  // Each row's ST is computed via getStatus(row.stokJam) - never from the
  // raw status string. Safe rows and JAM=0 rows are all included.
  const counts = useMemo(() => {
    const priorities = data?.priorities ?? [];
    if (priorities.length === 0) return { critical: 0, warning: 0, safe: 0 };

    let critical = 0,
      warning = 0,
      safe = 0;
    for (const p of priorities) {
      const st = getStatus(p.stokJam);
      if (st === "critical") critical++;
      else if (st === "warning") warning++;
      else safe++;
    }

    return { critical, warning, safe };
  }, [data?.priorities]);

  const priorityData = data?.priorities ?? [];

  // When Show All is active, sort the full list by status priority
  // (critical → warning → safe). Uses a spread copy - never mutates the
  // original reactive array. When collapsed, no sort is applied.
  const sortedPriorityData = isExpanded
    ? [...priorityData].sort(
        (a, b) =>
          (STATUS_SORT_ORDER[getStatus(a.stokJam)] ?? 99) -
          (STATUS_SORT_ORDER[getStatus(b.stokJam)] ?? 99),
      )
    : priorityData;

  const totalPages = Math.max(1, Math.ceil(sortedPriorityData.length / PAGE_SIZE));

  const getPageData = (pageIndex: number) =>
    sortedPriorityData.slice(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE);

  const nextPage = (currentPage + 1) % totalPages;
  const slotAData = activeSlot === "A" ? getPageData(currentPage) : getPageData(nextPage);
  const slotBData = activeSlot === "B" ? getPageData(currentPage) : getPageData(nextPage);

   
  useEffect(() => {
    if (totalPages <= 1) return;
    const timer = setInterval(() => {
      setIsTransitioning(true);
      setTimeout(() => {
        setCurrentPage((prev) => (prev + 1) % totalPages);
        setActiveSlot((prev) => (prev === "A" ? "B" : "A"));
        setIsTransitioning(false);
      }, TRANSITION_DURATION);
    }, CYCLE_INTERVAL);
    return () => clearInterval(timer);
  }, [totalPages]);

  return (
    <div className="tv-page" data-theme={visualTheme === "dark" ? "dark" : "light"}>
      <div className="tv-shell">
        <header className="tv-header">
          <div className="tv-header-title">
            <div>
              REALTIME STOCK MONITORING
              <div className="tv-header-subtitle">REAL-TIME PRODUCTION INTELLIGENCE</div>
            </div>
          </div>
          <div className="tv-header-time">{clock}</div>
          <div className="tv-header-right">
            {fac && (
              <span
                className="text-xs font-semibold"
                style={{ color: "var(--color-text-secondary)" }}
              >
                {fac} · Shift {shift}
              </span>
            )}
            <div className="tv-live-badge">
              <div className="tv-live-dot" />
              LIVE
            </div>
            <button
              type="button"
              className="tv-btn"
              onClick={() => document.documentElement.requestFullscreen()}
            >
              TV MODE
            </button>
          </div>
        </header>

        <main className="tv-main">
          <div className="tv-left">
            <section className="tv-top-row">
              <div className="tv-gauge-wrap">
                <svg viewBox="0 0 140 140" width="140" height="140">
                  <circle
                    cx="70"
                    cy="70"
                    r="54"
                    stroke="var(--color-bg-border)"
                    strokeWidth="10"
                    fill="none"
                  />
                  <circle
                    cx="70"
                    cy="70"
                    r="54"
                    stroke="var(--color-safe)"
                    strokeWidth="10"
                    fill="none"
                    strokeDasharray="339.3"
                    strokeDashoffset={gaugeArc.offset}
                    strokeLinecap="round"
                    transform="rotate(-90 70 70)"
                    style={{ transition: "stroke-dashoffset 800ms ease" }}
                  />
                </svg>
                <div className="tv-gauge-text">
                  <div className="tv-gauge-val">{isLoading ? "-" : `${gaugeArc.pct}%`}</div>
                  <div className="tv-gauge-label">AVAILABILITY</div>
                </div>
              </div>

              <div className="tv-kpi-row">
                <div className="tv-kpi-card critical">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-critical)",
                      textTransform: "uppercase",
                    }}
                  >
                    Critical <span style={{ color: "var(--color-critical-text)" }}>&lt; 3JAM</span>
                  </div>
                  <div className="tv-kpi-number">{counts.critical}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    PARTS
                  </div>
                </div>
                <div className="tv-kpi-card warning">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-warning)",
                      textTransform: "uppercase",
                    }}
                  >
                    Warning <span style={{ color: "var(--color-warning-text)" }}>3–4JAM</span>
                  </div>
                  <div className="tv-kpi-number">{counts.warning}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    PARTS
                  </div>
                </div>
                <div className="tv-kpi-card safe">
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--color-safe)",
                      textTransform: "uppercase",
                    }}
                  >
                    Safe <span style={{ color: "var(--color-safe-text)" }}>&gt; 4JAM</span>
                  </div>
                  <div className="tv-kpi-number">{counts.safe}</div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--color-text-muted)",
                    }}
                  >
                    PARTS
                  </div>
                </div>
              </div>
            </section>

            <div className="tv-section-label">Minimum Stock / Machine</div>
            {isLoading && !data ? (
              <p style={{ color: "var(--color-text-muted)", fontSize: 13 }}>Loading…</p>
            ) : (
              <MinimumStockGrid
                // Bug #1 fix: pass machines with corrected stokJam + cardStatus
                machines={fixMachineStatuses(data?.machines ?? [])}
                showPartTable
              />
            )}

            <div className="tv-section-label" style={{ marginTop: 4 }}>
              Ratio Stock Part by Part
            </div>
            <section className="tv-chart-wrap">
              {chartPoints.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%" style={{ overflow: "visible" }}>
                  <BarChart
                    data={chartPoints}
                    margin={{ top: 60, right: 10, left: 10, bottom: 5 }}
                    style={{ overflow: "visible" }}
                  >
                    <CartesianGrid
                      strokeDasharray="4 4"
                      stroke={
                        visualTheme === "dark" ? "rgba(255, 255, 255, 0.25)" : "rgba(0, 0, 0, 0.1)"
                      }
                      strokeWidth={visualTheme === "dark" ? 1 : undefined}
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={yAxisConfig.domain}
                      ticks={yAxisConfig.ticks}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "var(--color-text-muted)", fontSize: 10 }}
                    />
                    <Tooltip
                      content={<ChartTooltip />}
                      cursor={{ fill: "rgba(59, 107, 255, 0.08)" }}
                    />
                    <Bar dataKey="displayValue" shape={<CustomBar />} isAnimationActive={false} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p
                  style={{
                    color: "var(--color-text-muted)",
                    fontSize: 13,
                    padding: 16,
                  }}
                >
                  Yah belum ada stock data untuk factory ini.
                </p>
              )}
            </section>
          </div>

          <aside className="tv-right">
            <div className="tv-panel-header">
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                  letterSpacing: "0.1em",
                }}
              >
                PRIORITY PRODUCTION
              </span>
              <span
                style={{
                  background: "var(--color-warning-bg)",
                  border: "1px solid var(--color-warning-dim)",
                  borderRadius: 4,
                  padding: "3px 8px",
                  fontSize: 10,
                  fontWeight: 700,
                  color: "var(--color-warning)",
                }}
              >
                &lt; 4H
              </span>
            </div>

            {priorityData.length > 0 ? (
              <>
                {totalPages > 1 && (
                  <div className="tv-priority-progress">
                    <div
                      key={`${currentPage}-${activeSlot}`}
                      className="tv-priority-progress-fill"
                      style={{ animationDuration: `${CYCLE_INTERVAL}ms` }}
                    />
                  </div>
                )}

                <div style={{ position: "relative" }}>
                  {/* SLOT A */}
                  <div
                    className={`priority-slot ${
                      activeSlot === "A" ? "slot-active" : "slot-inactive"
                    }${isTransitioning ? " slot-transitioning" : ""}`}
                    style={{
                      position: activeSlot === "A" ? "relative" : "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                    }}
                  >
                    <table className="tv-priority-table">
                      <thead>
                        <tr>
                          <th>Machine</th>
                          <th>Part</th>
                          <th style={{ display: "none" }}>PN</th>
                          <th>Rasio</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slotAData.map((p, i) => {
                          const rowStatus = getStatus(p.stokJam);
                          const stColor =
                            rowStatus === "critical"
                              ? "var(--color-critical)"
                              : rowStatus === "warning"
                                ? "var(--color-warning)"
                                : "var(--color-safe)";
                          const isSafeRow = rowStatus === "safe";
                          return (
                            <tr
                              key={`a-${p.machine}-${i}`}
                              className={`priority-row${isSafeRow ? " tv-row-safe" : ""}`}
                              style={isSafeRow && !isExpanded ? { display: "none" } : undefined}
                            >
                              <td>{p.machine}</td>
                              <td>{p.partName}</td>
                              <td style={{ display: "none" }}>{p.partNumber}</td>
                              <td>{p.stokJam.toFixed(1)}</td>
                              <td>
                                <div className={`tv-priority-status-badge badge-${rowStatus}`}>
                                  <span className={`tv-priority-status-dot dot-${rowStatus}`} />
                                  {rowStatus}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* SLOT B - identical structure */}
                  <div
                    className={`priority-slot ${
                      activeSlot === "B" ? "slot-active" : "slot-inactive"
                    }${isTransitioning ? " slot-transitioning" : ""}`}
                    style={{
                      position: activeSlot === "B" ? "relative" : "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                    }}
                  >
                    <table className="tv-priority-table">
                      <thead>
                        <tr>
                          <th>Machine</th>
                          <th>Part</th>
                          <th style={{ display: "none" }}>PN</th>
                          <th>Rasio</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {slotBData.map((p, i) => {
                          const rowStatus = getStatus(p.stokJam);
                          const stColor =
                            rowStatus === "critical"
                              ? "var(--color-critical)"
                              : rowStatus === "warning"
                                ? "var(--color-warning)"
                                : "var(--color-safe)";
                          const isSafeRow = rowStatus === "safe";
                          return (
                            <tr
                              key={`b-${p.machine}-${i}`}
                              className={`priority-row${isSafeRow ? " tv-row-safe" : ""}`}
                              style={isSafeRow && !isExpanded ? { display: "none" } : undefined}
                            >
                              <td>{p.machine}</td>
                              <td>{p.partName}</td>
                              <td style={{ display: "none" }}>{p.partNumber}</td>
                              <td>{p.stokJam.toFixed(1)}</td>
                              <td>
                                <div className={`tv-priority-status-badge badge-${rowStatus}`}>
                                  <span className={`tv-priority-status-dot dot-${rowStatus}`} />
                                  {rowStatus}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* end A/B wrapper */}

                {totalPages > 1 && (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 0 4px",
                    }}
                  >
                    {Array.from({ length: totalPages }).map((_, idx) => (
                      <div
                        key={idx}
                        style={{
                          width: idx === currentPage ? "16px" : "6px",
                          height: "6px",
                          borderRadius: "3px",
                          backgroundColor:
                            idx === currentPage ? "#ffffff" : "rgba(255,255,255,0.25)",
                          transition: "all 400ms ease",
                        }}
                      />
                    ))}
                    <span
                      style={{
                        marginLeft: 4,
                        fontSize: 9,
                        color: "rgba(255,255,255,0.3)",
                        letterSpacing: "0.06em",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {currentPage + 1}/{totalPages}
                    </span>
                  </div>
                )}
              </>
            ) : (
              <div className="tv-empty">
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-bg-border)"
                  strokeWidth="1.5"
                >
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
                <div>No active priorities</div>
              </div>
            )}

            {/* Change #3: Show All / Show Less toggle - only toggles safe row visibility */}
            {priorityData.length > 0 && (
              <button
                type="button"
                onClick={() => setIsExpanded((prev) => !prev)}
                style={{
                  marginTop: 10,
                  width: "100%",
                  padding: "5px 0",
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--color-text-muted)",
                  background: "transparent",
                  border: "1px solid var(--color-bg-border)",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                {isExpanded ? "Show Less" : "Show All"}
              </button>
            )}
          </aside>
        </main>
      </div>
    </div>
  );
}
