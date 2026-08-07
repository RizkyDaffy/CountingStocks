import { useState } from "react";
import { Boxes, LayoutGrid } from "lucide-react";

export type WorkspaceMode = "inventaris" | "material";

export interface WorkspaceSwitcherProps {
  value?: WorkspaceMode;
  onChange?: (mode: WorkspaceMode) => void;
  collapsed?: boolean;
}

const WORKSPACES: {
  id: WorkspaceMode;
  label: string;
  icon: React.ElementType;
}[] = [
  { id: "inventaris", label: "Inventaris", icon: LayoutGrid },
  { id: "material", label: "Material", icon: Boxes },
];

export function WorkspaceSwitcher({ value, onChange, collapsed = false }: WorkspaceSwitcherProps) {
  const [internal, setInternal] = useState<WorkspaceMode>("inventaris");
  const active = value ?? internal;

  const handleSelect = (id: WorkspaceMode) => {
    if (id === active) return;
    setInternal(id);
    onChange?.(id);
  };

  if (collapsed) {
    return (
      <div
        role="group"
        aria-label="Workspace switcher"
        className="flex flex-col items-center gap-1.5 pb-3"
      >
        {}
        <div className="h-px w-8 bg-border-surface mb-1" />

        {WORKSPACES.map(({ id, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              id={`workspace-btn-${id}`}
              aria-pressed={isActive}
              onClick={() => handleSelect(id)}
              title={id.charAt(0).toUpperCase() + id.slice(1)}
              className={[
                "flex h-9 w-9 items-center justify-center rounded-full",
                "transition-all duration-200 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C05C30]/60",
                isActive
                  ? "bg-[#C05C30] text-white shadow-sm"
                  : "text-muted-foreground hover:bg-sidebar-hover hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-4 w-4" strokeWidth={isActive ? 2 : 1.75} />
            </button>
          );
        })}

        {/* Thin divider below */}
        <div className="h-px w-8 bg-border-surface mt-1" />
      </div>
    );
  }

  const activeIndex = WORKSPACES.findIndex((w) => w.id === active);

  return (
    <div role="group" aria-label="Workspace switcher" className="pb-3">
      {/*
        Outer track: the rounded-full border box that holds the two options.
        The sliding "pill" is absolutely positioned inside.
      */}
      <div
        className={[
          "relative flex items-center",
          "rounded-[14px] border border-border-surface",
          "bg-card-elevated p-[3px]",
          /* subtle inner glow on the track */
          "shadow-[inset_0_1px_2px_rgba(0,0,0,0.18)]",
        ].join(" ")}
      >
        {/* ── Sliding background pill ───────────────────────────────────── */}
        <span
          aria-hidden="true"
          className={[
            "pointer-events-none absolute inset-y-[3px]",
            "rounded-[10px]",
            "bg-[#C05C30]",
            /* subtle highlight on top edge */
            "shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_2px_8px_rgba(192,92,48,0.35)]",
            /* GPU-composited slide - uses transform for 60 fps */
            "transition-transform duration-[280ms] cubic-bezier(0.4,0,0.2,1)",
            /* width is exactly half the track */
            "w-[calc(50%-3px)]",
          ].join(" ")}
          style={{
            transform: `translateX(${activeIndex === 0 ? "0px" : "100%"})`,
            willChange: "transform",
          }}
        />

        {/* ── Tab buttons ───────────────────────────────────────────────── */}
        {WORKSPACES.map(({ id, label, icon: Icon }, idx) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              id={`workspace-tab-${id}`}
              role="tab"
              aria-selected={isActive}
              onClick={() => handleSelect(id)}
              className={[
                "relative z-10 flex flex-1 items-center justify-center gap-2",
                "py-[7px] px-3",
                "rounded-[10px]",
                "text-[12.5px] font-semibold tracking-[0.02em]",
                "select-none transition-colors duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C05C30]/60",
                isActive ? "text-white" : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
              style={{ letterSpacing: "0.025em" }}
            >
              <Icon
                className={[
                  "h-3.5 w-3.5 shrink-0 transition-colors duration-200",
                  isActive ? "text-white/90" : "text-muted-foreground",
                ].join(" ")}
                strokeWidth={isActive ? 2.2 : 1.75}
              />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
