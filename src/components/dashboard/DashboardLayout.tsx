import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { SidebarContent } from "./Sidebar";
import { UpdateBanner } from "@/components/update-banner";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

function readSidebarCollapsed(): boolean {
  try {
    return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(readSidebarCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage unavailable - keep state in memory only */
    }
  }, [collapsed]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <div className="min-h-screen w-full bg-surface-page">
      {}
      <div className="fixed inset-y-0 left-0 z-30 hidden md:block">
        <SidebarContent collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      </div>

      {}
      <div
        className={`fixed inset-0 z-40 md:hidden transition-smooth ${
          mobileOpen ? "pointer-events-auto" : "pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div
          onClick={() => setMobileOpen(false)}
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-smooth ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-y-0 left-0 transition-smooth ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="relative h-full">
            <SidebarContent
              collapsed={false}
              onToggle={() => setMobileOpen(false)}
              onNavigate={() => setMobileOpen(false)}
            />
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full bg-card-elevated text-muted-foreground transition-smooth hover:bg-accent hover:text-foreground md:hidden"
              aria-label="Close menu"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-smooth ${collapsed ? "md:pl-[84px]" : "md:pl-[280px]"}`}>
        <UpdateBanner />
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-border-surface bg-surface-sidebar px-4 py-3 backdrop-blur md:hidden">
          <div className="text-sm font-semibold tracking-wide">SUGITY CREATIVES</div>
          <button
            onClick={() => setMobileOpen(true)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-card text-foreground transition-smooth hover:bg-accent"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
