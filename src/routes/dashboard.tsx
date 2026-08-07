import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { getAuthUser, clearAuth } from "@/lib/auth";

interface User {
  name: string;
  role: string;
}

interface Module {
  title: string;
  description: string;
  icon: string;
  route: string;
}

const DEFAULT_MODULES: Module[] = [
  {
    title: "Stock Overview",
    description:
      "Monitor current resin stock levels and pallet inventory in real-time across all storage locations.",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    route: "stock.index",
  },
  {
    title: "Scan History",
    description:
      "View full audit trail of all Scan IN / Scan OUT transactions with timestamps and operator details.",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
    route: "scan.history",
  },
  {
    title: "Reports",
    description: "Generate and export production reports by date range, material type, or station.",
    icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
    route: "#",
  },
];

import { useTheme } from "@/hooks/use-theme";

function AppLayout({
  isDark,
  user,
  onLogout,
  children,
}: {
  isDark: boolean;
  user?: User | null;
  onLogout?: () => void;
  children: React.ReactNode;
}) {
  const styles = isDark
    ? {
        page: { backgroundColor: "#1C1917" },
        nav: { backgroundColor: "#242120", borderBottom: "1px solid #3A3532" },
        brand: { color: "#E8724A" },
        footer: { backgroundColor: "#242120", borderTop: "1px solid #3A3532" },
        footerText: { color: "#57534E" },
      }
    : {};

  return (
    <div
      className={isDark ? "min-h-screen flex flex-col" : "bg-stone-50 min-h-screen flex flex-col"}
      style={{ fontFamily: "'Inter', sans-serif", ...styles.page }}
    >
      <nav
        className={isDark ? "" : "bg-white border-b border-stone-200"}
        style={isDark ? styles.nav : {}}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span
                className={
                  isDark
                    ? "text-xl font-bold uppercase tracking-wider"
                    : "text-xl font-bold text-orange-700 uppercase tracking-wider"
                }
                style={isDark ? styles.brand : {}}
              >
                Resin Production System
              </span>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <>
                  <div className="flex flex-col items-end">
                    <span
                      className={
                        isDark ? "text-sm font-semibold" : "text-sm font-semibold text-stone-700"
                      }
                      style={isDark ? { color: "#FAFAF9" } : {}}
                    >
                      {user.name}
                    </span>
                    <span
                      className={
                        isDark
                          ? "text-xs uppercase tracking-tighter"
                          : "text-xs text-stone-500 uppercase tracking-tighter"
                      }
                      style={isDark ? { color: "#78716C" } : {}}
                    >
                      {user.role}
                    </span>
                  </div>
                  <button
                    onClick={onLogout}
                    className={
                      isDark
                        ? "px-3 py-1.5 rounded-md text-sm font-medium border transition duration-150"
                        : "bg-red-50 hover:bg-red-100 text-red-600 px-3 py-1.5 rounded-md text-sm font-medium border border-red-200 transition duration-150"
                    }
                    style={
                      isDark
                        ? { backgroundColor: "#2D1A1A", color: "#F87171", borderColor: "#4A2525" }
                        : {}
                    }
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  className={
                    isDark
                      ? "px-4 py-2 rounded-md text-sm font-medium text-white transition duration-150"
                      : "bg-orange-700 hover:bg-orange-800 text-white px-4 py-2 rounded-md text-sm font-medium transition duration-150"
                  }
                  style={isDark ? { backgroundColor: "#C05C30" } : {}}
                >
                  Login
                </Link>
              )}
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">{children}</div>
      </main>

      <footer
        className={isDark ? "py-6" : "bg-white border-t border-stone-200 py-6"}
        style={isDark ? styles.footer : {}}
      >
        <div
          className={
            isDark
              ? "max-w-7xl mx-auto px-4 text-center text-sm"
              : "max-w-7xl mx-auto px-4 text-center text-stone-400 text-sm"
          }
          style={isDark ? styles.footerText : {}}
        >
          &copy; {new Date().getFullYear()} Resin Stock Counting System. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

function ModuleCard({ module, href, isDark }: { module: Module; href: string; isDark: boolean }) {
  const [hovered, setHovered] = useState(false);
  const isDisabled = module.route === "#";

  if (!isDark) {
    return (
      <div className="bg-white overflow-hidden shadow-sm rounded-xl border border-stone-100 hover:shadow-md hover:border-orange-200 transition-all duration-300 group">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-50 text-orange-600 rounded-lg group-hover:bg-orange-700 group-hover:text-white transition-colors duration-300">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d={module.icon}
                />
              </svg>
            </div>
            {isDisabled && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-stone-400 bg-stone-50 px-2 py-1 rounded">
                Soon
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-stone-900 mb-2 group-hover:text-orange-700 transition-colors">
            {module.title}
          </h3>
          <p className="text-sm text-stone-500 mb-6 leading-relaxed">{module.description}</p>
          <a
            href={href}
            className={`inline-flex items-center text-sm font-bold ${isDisabled ? "text-stone-300 cursor-not-allowed" : "text-orange-700 hover:text-orange-900"}`}
            {...(isDisabled ? { onClick: (e) => e.preventDefault() } : {})}
          >
            ACCESS MODULE
            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M14 5l7 7-7 7"
              />
            </svg>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-xl transition-all duration-300"
      style={{
        backgroundColor: "#242120",
        border: `1px solid ${hovered && !isDisabled ? "#6B3D27" : "#3A3532"}`,
        boxShadow:
          hovered && !isDisabled ? "0 4px 20px 0 rgba(0,0,0,0.5)" : "0 1px 3px 0 rgba(0,0,0,0.3)",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div
            className="p-3 rounded-lg transition-colors duration-300"
            style={{
              backgroundColor: hovered && !isDisabled ? "#C05C30" : "#2A1A0E",
              color: hovered && !isDisabled ? "#FFFFFF" : "#FB923C",
            }}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={module.icon} />
            </svg>
          </div>
          {isDisabled && (
            <span
              className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded"
              style={{ color: "#57534E", backgroundColor: "#1E1C1A" }}
            >
              Soon
            </span>
          )}
        </div>
        <h3
          className="text-lg font-bold mb-2 transition-colors"
          style={{ color: hovered && !isDisabled ? "#FB923C" : "#FAFAF9" }}
        >
          {module.title}
        </h3>
        <p className="text-sm mb-6 leading-relaxed" style={{ color: "#78716C" }}>
          {module.description}
        </p>
        <a
          href={href}
          className="inline-flex items-center text-sm font-bold"
          style={{
            color: isDisabled ? "#3D3935" : "#E8724A",
            cursor: isDisabled ? "not-allowed" : "pointer",
          }}
          {...(isDisabled ? { onClick: (e) => e.preventDefault() } : {})}
        >
          ACCESS MODULE
          <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function IndexContent({
  modules,
  isDark,
  onOpenStation,
  resolveRoute,
}: {
  modules: Module[];
  isDark: boolean;
  onOpenStation?: () => void;
  resolveRoute?: (name: string) => string;
}) {
  const href = (route: string) =>
    route === "#" ? "#" : resolveRoute ? resolveRoute(route) : `/${route.replace(/\./g, "/")}`;

  return (
    <>
      {/* Hero card */}
      <div
        className={
          isDark
            ? "rounded-2xl overflow-hidden mb-12"
            : "bg-white rounded-2xl shadow-sm border border-stone-100 overflow-hidden mb-12"
        }
        style={
          isDark
            ? {
                backgroundColor: "#242120",
                border: "1px solid #3A3532",
                boxShadow: "0 1px 3px 0 rgba(0,0,0,0.4)",
              }
            : {}
        }
      >
        <div className="flex flex-col md:flex-row">
          <div className="p-8 md:p-12 md:w-2/3 flex flex-col justify-center">
            <div
              className={
                isDark
                  ? "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-4 w-fit"
                  : "inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-orange-50 text-orange-700 mb-4 w-fit"
              }
              style={isDark ? { backgroundColor: "#2A1A0E", color: "#FB923C" } : {}}
            >
              <span className="relative flex h-2 w-2 mr-2">
                <span
                  className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
                  style={{ backgroundColor: isDark ? "#F97316" : undefined }}
                />
                <span
                  className={
                    isDark ? "" : "relative inline-flex rounded-full h-2 w-2 bg-orange-600"
                  }
                  style={
                    isDark
                      ? {
                          position: "relative",
                          display: "inline-flex",
                          borderRadius: "9999px",
                          height: "8px",
                          width: "8px",
                          backgroundColor: "#EA7744",
                        }
                      : {}
                  }
                />
              </span>
              Operator Area
            </div>
            <h1
              className={
                isDark
                  ? "text-4xl font-extrabold mb-4 tracking-tight"
                  : "text-4xl font-extrabold text-stone-900 mb-4 tracking-tight"
              }
              style={isDark ? { color: "#FAFAF9" } : {}}
            >
              Workstation Terminal
            </h1>
            <p
              className={isDark ? "text-lg mb-8 max-w-lg" : "text-lg text-stone-500 mb-8 max-w-lg"}
              style={isDark ? { color: "#A8A29E" } : {}}
            >
              Gunakan modul ini pada Mini PC Station untuk melakukan proses Scan IN dan Scan OUT
              pallet resin secara real-time.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <a
                href={href("station.login")}
                onClick={onOpenStation}
                className={
                  isDark
                    ? "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-bold rounded-xl text-white transition-all duration-300 transform hover:-translate-y-1"
                    : "inline-flex items-center justify-center px-8 py-4 border border-transparent text-lg font-bold rounded-xl text-white bg-orange-700 hover:bg-orange-800 shadow-lg hover:shadow-orange-600/30 transition-all duration-300 transform hover:-translate-y-1"
                }
                style={
                  isDark
                    ? { backgroundColor: "#C05C30", boxShadow: "0 4px 24px 0 rgba(192,92,48,0.35)" }
                    : {}
                }
              >
                <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
                OPEN STATION LOGIN
              </a>
            </div>
          </div>

          <div
            className={
              isDark
                ? "hidden md:flex md:w-1/3 p-12 items-center justify-center"
                : "hidden md:flex md:w-1/3 bg-stone-50 border-l border-stone-100 p-12 items-center justify-center"
            }
            style={isDark ? { backgroundColor: "#1E1C1A", borderLeft: "1px solid #3A3532" } : {}}
          >
            <div
              style={{ color: isDark ? "#3D3935" : undefined }}
              className={!isDark ? "text-stone-200" : ""}
            >
              <svg className="w-48 h-48" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Section header */}
      <div className="flex items-center space-x-4 mb-8">
        <h2
          className={
            isDark ? "text-2xl font-bold whitespace-nowrap" : "text-2xl font-bold text-stone-800"
          }
          style={isDark ? { color: "#E7E5E4" } : {}}
        >
          Management &amp; Analytics
        </h2>
        <div
          className={isDark ? "flex-grow h-px" : "flex-grow h-px bg-stone-200"}
          style={isDark ? { backgroundColor: "#3A3532" } : {}}
        />
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((module, idx) => (
          <ModuleCard key={idx} module={module} href={href(module.route)} isDark={isDark} />
        ))}
      </div>
    </>
  );
}

export function DashboardLandingPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  // In landing mode (unauthenticated), user is explicitly null
  return (
    <AppLayout isDark={isDark} user={null}>
      <IndexContent
        modules={DEFAULT_MODULES}
        isDark={isDark}
        onOpenStation={() => console.log("Station opened")}
      />
    </AppLayout>
  );
}

export const Route = createFileRoute("/dashboard")({
  component: RouteComponent,
});

function RouteComponent() {
  if (typeof window !== "undefined") {
    window.location.replace("/");
  }
  return null;
}
