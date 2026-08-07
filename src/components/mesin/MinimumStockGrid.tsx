import type { TvMachine } from "@/hooks/use-tv-dashboard";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

function statusIcon(status: TvMachine["cardStatus"]): ReactNode {
  switch (status) {
    case "critical":
      return <X className="w-7 h-7 text-[#e84545]" style={{ color: "var(--color-critical)" }} />;
    case "warning":
      return "⚠️";
    case "safe":
      return <Check className="w-7 h-7 text-[#22c55e]" style={{ color: "var(--color-safe)" }} />;
    default:
      return "-";
  }
}

type Props = {
  machines: TvMachine[];
  compact?: boolean;
  showPartTable?: boolean;
};

export function MinimumStockGrid({ machines, compact, showPartTable = false }: Props) {
  if (machines.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">Tidak ada mesin untuk factory ini.</p>;
  }

  return (
    <div
      className={
        compact ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" : "tv-machine-grid"
      }
    >
      {machines.map((m) => {
        const inactive = !m.isActive;
        const icon = statusIcon(m.cardStatus);
        const stockJam = m.stockJam ?? m.stokJam ?? 0;
        const val = inactive ? "N/A" : stockJam.toFixed(1);
        const sub = inactive ? "Running / Reset" : undefined;

        return (
          <div key={m.id} className={showPartTable ? "tv-mc-wrap" : undefined}>
            <div className={`tv-mc-card tv-mc-${m.cardStatus}${compact ? " tv-mc-compact" : ""}`}>
              <div className="tv-mc-id">{m.machineCode}</div>
              <div className="tv-mc-icon">{icon}</div>
              <div className="tv-mc-val">
                {val}
                {sub && <span className="tv-mc-sub">{sub}</span>}
              </div>
            </div>

            {showPartTable && m.partRows && m.partRows.length > 0 && (
              <div className="tv-mc-parts-table" style={{ display: "none" }}>
                <table className="tv-priority-table w-full">
                  <thead>
                    <tr>
                      <th>Part</th>
                      <th>PN</th>
                      <th>JAM</th>
                    </tr>
                  </thead>
                  <tbody>
                    {m.partRows.map((row, idx) => (
                      <tr key={`${m.machineCode}-${idx}`}>
                        <td>{row.part}</td>
                        <td
                          style={{
                            fontWeight: 700,
                            color: row.pn === "X" ? "var(--color-critical)" : "var(--color-safe)",
                          }}
                        >
                          {row.pn}
                        </td>
                        <td>{row.jam.toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
