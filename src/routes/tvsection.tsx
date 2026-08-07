import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Monitor, ChevronRight, Tv2, Sun, Moon, Loader2 } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { FactoryApi } from "@/hooks/use-master-data";
import { useTheme } from "@/hooks/use-theme";

export const Route = createFileRoute("/tvsection")({
  head: () => ({
    meta: [
      { title: "Stock Display - Pilih Section | Sugity Creatives" },
      {
        name: "description",
        content: "Pilih factory dan shift untuk tampilan TV Stock Monitoring.",
      },
    ],
  }),
  component: TvSectionPage,
});

interface ShiftDef {
  id: "A" | "B";
  label: string;
  color: string;
  bg: string;
  border: string;
}

const SHIFTS: ShiftDef[] = [
  {
    id: "A",
    label: "Shift A",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
  },
  {
    id: "B",
    label: "Shift B",
    color: "#818cf8",
    bg: "rgba(129,140,248,0.08)",
    border: "rgba(129,140,248,0.25)",
  },
];

function TvSectionPage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { data: factories = [], isLoading } = FactoryApi.useGetAll();

  const handleSelect = (fac: string, shift: "A" | "B") => {
    navigate({
      to: "/tv",
      search: { fac, shift, theme: theme === "dark" ? "dark" : "white" },
    });
  };

  return (
    <DashboardLayout>
      <div style={{ minHeight: "100%", padding: "32px 28px" }}>
        {}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 6,
            }}
          >
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(192,92,48,0.12)",
                border: "1px solid rgba(192,92,48,0.25)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Tv2 style={{ height: 20, width: 20, color: "#c05c30" }} />
            </div>
            <div>
              <h1
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  letterSpacing: "-0.02em",
                  margin: 0,
                  color: "var(--foreground)",
                  lineHeight: 1.2,
                }}
              >
                Stock Display
              </h1>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--muted-foreground)",
                  margin: 0,
                  marginTop: 3,
                }}
              >
                Pilih factory dan shift untuk membuka tampilan TV monitoring
              </p>
            </div>
          </div>
        </div>

        {}
        {isLoading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "60px 0",
              justifyContent: "center",
              color: "var(--muted-foreground)",
              fontSize: 14,
            }}
          >
            <Loader2 style={{ height: 18, width: 18, animation: "spin 1s linear infinite" }} />
            Memuat data factory…
          </div>
        )}

        {}
        {!isLoading && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 20,
            }}
          >
            {factories.length === 0 ? (
              <div
                style={{
                  gridColumn: "1 / -1",
                  textAlign: "center",
                  padding: "60px 0",
                  color: "var(--muted-foreground)",
                  fontSize: 14,
                }}
              >
                Belum ada data factory. Tambahkan factory di Factory Management.
              </div>
            ) : (
              factories.map((fac) => (
                <FactoryCard key={fac.id} name={fac.name} onSelect={handleSelect} />
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .tv-section-card { transition: box-shadow 200ms ease, transform 200ms ease; }
        .tv-section-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.14); transform: translateY(-2px); }
      `}</style>
    </DashboardLayout>
  );
}

interface FactoryCardProps {
  name: string;
  onSelect: (fac: string, shift: "A" | "B") => void;
}

function FactoryCard({ name, onSelect }: FactoryCardProps) {
  return (
    <div
      className="tv-section-card"
      style={{
        borderRadius: 16,
        border: "1px solid var(--border)",
        background: "var(--card, var(--background))",
        overflow: "hidden",
      }}
    >
      {}
      <div
        style={{
          padding: "18px 20px 14px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: "rgba(192,92,48,0.1)",
            border: "1px solid rgba(192,92,48,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Monitor style={{ height: 16, width: 16, color: "#c05c30" }} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: "var(--foreground)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {name}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--muted-foreground)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              fontWeight: 600,
              marginTop: 2,
            }}
          >
            2 Shift Available
          </div>
        </div>
      </div>

      {}
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        {SHIFTS.map((shift) => (
          <ShiftButton key={shift.id} factoryName={name} shift={shift} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

interface ShiftButtonProps {
  factoryName: string;
  shift: ShiftDef;
  onSelect: (fac: string, shift: "A" | "B") => void;
}

function ShiftButton({ factoryName, shift, onSelect }: ShiftButtonProps) {
  const ShiftIcon = shift.id === "A" ? Sun : Moon;
  return (
    <button
      type="button"
      id={`tv-btn-${factoryName.replace(/\s+/g, "-").toLowerCase()}-shift-${shift.id.toLowerCase()}`}
      onClick={() => onSelect(factoryName, shift.id)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        borderRadius: 10,
        border: `1px solid ${shift.border}`,
        background: shift.bg,
        cursor: "pointer",
        width: "100%",
        textAlign: "left",
        transition: "all 160ms ease",
        color: "var(--foreground)",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = shift.bg.replace("0.08", "0.16");
        el.style.borderColor = shift.color;
        el.style.transform = "translateX(3px)";
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.background = shift.bg;
        el.style.borderColor = shift.border;
        el.style.transform = "translateX(0)";
      }}
    >
      <span style={{ color: shift.color, display: "flex", alignItems: "center", flexShrink: 0 }}>
        <ShiftIcon style={{ height: 15, width: 15 }} />
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{shift.label}</span>
      <ChevronRight
        style={{ height: 15, width: 15, color: shift.color, opacity: 0.7, flexShrink: 0 }}
      />
    </button>
  );
}
