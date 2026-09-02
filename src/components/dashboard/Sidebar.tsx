import { Link, useRouterState } from "@tanstack/react-router";
import {
  ScanLine,
  Boxes,
  History,
  Smartphone,
  Menu,
  QrCode,
  Users,
  Database,
  Sparkles,
  BadgeCheck,
  CreditCard,
  Bell,
  LogOut,
  ChevronsUpDown,
  Sun,
  Moon,
  MonitorCog,
  ShieldCheck,
  Monitor,
  Cpu,
  ShieldAlert,
  Link2,
  Activity,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/hooks/use-theme";
import { getAuthUser, clearAuth } from "@/lib/auth";

export type NavItem = {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
};

export const NAV_ITEMS: NavItem[] = [
  {
    label: "Buat QR",
    description: "Buat QR Code baru",
    to: "/",
    icon: ScanLine,
  },
  {
    label: "Stock Activity",
    description: "Aktifitas Realtime stock",
    to: "/view-stock",
    icon: Boxes,
  },
  {
    label: "Histori Tugas",
    description: "Histori Tugas QR Scanner",
    to: "/task-history",
    icon: History,
  },
  {
    label: "Pindai QR",
    description: "Pindai QR Code: IN/OUT",
    to: "/scan",
    icon: QrCode,
  },
  {
    label: "IoT Monitor",
    description: "Monitor status scan IoT",
    to: "/monitor",
    icon: Activity,
  },
];

export const MANAGEMENT_ITEMS: NavItem[] = [
  {
    label: "Device Management",
    description: "Management Perangkat Scanner",
    to: "/devices",
    icon: Smartphone,
  },
  {
    label: "Mesin Management",
    description: "Management Mesin",
    to: "/mesin",
    icon: MonitorCog,
  },
  {
    label: "Users Management",
    description: "Management Pengguna",
    to: "/users",
    icon: Users,
  },
  {
    label: "Privilege QR",
    description: "Kelola Akses QR per Station",
    to: "/qr-privileges",
    icon: ShieldCheck,
  },
  {
    label: "Stock Display",
    description: "Tampilan Monitor Stock",
    to: "/tvsection",
    icon: Monitor,
  },
  {
    label: "Provisioning",
    description: "Provisioning Mesin dengan IoT - ESP32",
    to: "/admin/provisioning",
    icon: Cpu,
  },
  {
    label: "Business Continuity Plan",
    description: "Koneksi Google Sheet untuk Backup Stock",
    to: "/backup",
    icon: ShieldAlert,
  },
];

export const MASTER_DATA_ITEMS: NavItem[] = [
  {
    label: "Plant & SC",
    description: "Kelola Supply Chain (SC) data",
    to: "/plant",
    icon: Link2,
  },
  {
    label: "Master Data",
    description: "Management Master Data",
    to: "/master-data",
    icon: Database,
  },
  {
    label: "Teitei Management",
    description: "Kelola nilai teitei per part",
    to: "/teitei",
    icon: Database,
  },
  {
    label: "Category Management",
    description: "Kelola Kategori Part",
    to: "/category",
    icon: Database,
  },
  {
    label: "Factory Management",
    description: "Kelola Data Factory/Pabrik",
    to: "/factory",
    icon: Database,
  },
  {
    label: "Model Management",
    description: "Kelola Model Kendaraan/Mesin",
    to: "/model",
    icon: Database,
  },
  {
    label: "Customer Management",
    description: "Kelola Data Customer",
    to: "/customer",
    icon: Database,
  },
];

type Props = {
  collapsed: boolean;
  onToggle: () => void;
  onNavigate?: () => void;
};

export function SidebarContent({ collapsed, onToggle, onNavigate }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { theme, toggleTheme } = useTheme();

  const authUser = getAuthUser();
  const displayName = authUser?.username ?? "";
  const displayRole = authUser?.role ?? "";
  const initials = authUser ? authUser.username.substring(0, 2).toUpperCase() : "";

  const handleLogout = () => {
    clearAuth();
    window.location.replace("/login");
  };

  return (
    <aside
      className={`flex h-full flex-col bg-surface-sidebar border-r border-border-surface text-sidebar-foreground transition-smooth ${
        collapsed ? "w-[84px]" : "w-[280px]"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-3 py-5 ${
          collapsed ? "justify-center px-0" : "justify-between px-5"
        }`}
      >
        <div
          className={`min-w-0 leading-tight overflow-hidden transition-smooth ${
            collapsed ? "hidden w-0 opacity-0" : "w-auto opacity-100"
          }`}
        >
          <div className="truncate text-[13px] font-semibold tracking-wide text-foreground">
            SUGITY CREATIVES
          </div>
          <div className="truncate text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Sugity Integrated Online
          </div>
        </div>
        <button
          onClick={onToggle}
          className="hidden md:inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-smooth hover:bg-sidebar-hover hover:text-foreground"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className={`flex-1 overflow-y-auto py-2 scrollbar-thin ${collapsed ? "px-0" : "px-3"}`}>
        <ul className={`space-y-1.5 ${collapsed ? "flex flex-col items-center" : ""}`}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;

            if (collapsed) {
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    title={item.label}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-smooth ${
                      active
                        ? "bg-[#c05c30] text-white"
                        : "text-foreground/80 hover:bg-sidebar-hover hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={`group flex items-center gap-4 rounded-full px-4 py-3 transition-smooth ${
                    active ? "bg-[#c05c30] text-white" : "text-foreground/90 hover:bg-sidebar-hover"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 transition-smooth ${
                      active ? "text-white" : "text-foreground/80"
                    }`}
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-[14px] font-semibold">{item.label}</span>
                    <span
                      className={`block truncate text-[11.5px] ${
                        active ? "text-[#f1e7db]" : "text-muted-foreground"
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Management Group */}
        <div className={`mt-6 mb-2 ${collapsed ? "px-0 text-center" : "px-4"}`}>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ${collapsed ? "hidden" : "block"}`}
          >
            Management
          </span>
          {collapsed && <div className="mx-auto h-px w-8 bg-border-surface my-2" />}
        </div>
        <ul className={`space-y-1.5 pb-4 ${collapsed ? "flex flex-col items-center" : ""}`}>
          {MANAGEMENT_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;

            if (collapsed) {
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    title={item.label}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-smooth ${
                      active
                        ? "bg-[#c05c30] text-white"
                        : "text-foreground/80 hover:bg-sidebar-hover hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={`group flex items-center gap-4 rounded-full px-4 py-3 transition-smooth ${
                    active ? "bg-[#c05c30] text-white" : "text-foreground/90 hover:bg-sidebar-hover"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 transition-smooth ${
                      active ? "text-white" : "text-foreground/80"
                    }`}
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-[14px] font-semibold">{item.label}</span>
                    <span
                      className={`block truncate text-[11.5px] ${
                        active ? "text-[#f1e7db]" : "text-muted-foreground"
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Master Data Group */}
        <div className={`mt-6 mb-2 ${collapsed ? "px-0 text-center" : "px-4"}`}>
          <span
            className={`text-[10px] font-bold uppercase tracking-wider text-muted-foreground/70 ${collapsed ? "hidden" : "block"}`}
          >
            MASTER DATA
          </span>
          {collapsed && <div className="mx-auto h-px w-8 bg-border-surface my-2" />}
        </div>
        <ul className={`space-y-1.5 pb-4 ${collapsed ? "flex flex-col items-center" : ""}`}>
          {MASTER_DATA_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.to;

            if (collapsed) {
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    onClick={onNavigate}
                    title={item.label}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition-smooth ${
                      active
                        ? "bg-[#c05c30] text-white"
                        : "text-foreground/80 hover:bg-sidebar-hover hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </Link>
                </li>
              );
            }

            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  className={`group flex items-center gap-4 rounded-full px-4 py-3 transition-smooth ${
                    active ? "bg-[#c05c30] text-white" : "text-foreground/90 hover:bg-sidebar-hover"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 transition-smooth ${
                      active ? "text-white" : "text-foreground/80"
                    }`}
                    strokeWidth={1.75}
                  />
                  <span className="min-w-0 flex-1 overflow-hidden">
                    <span className="block truncate text-[14px] font-semibold">{item.label}</span>
                    <span
                      className={`block truncate text-[11.5px] ${
                        active ? "text-[#f1e7db]" : "text-muted-foreground"
                      }`}
                    >
                      {item.description}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Profile */}
      <div className="px-3 py-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-smooth hover:bg-sidebar-hover focus-visible:outline-none ${
                collapsed ? "justify-center px-0" : ""
              }`}
            >
              <Avatar className="h-9 w-9 shrink-0 rounded-lg">
                <AvatarImage src="" alt="User avatar" />
                <AvatarFallback className="rounded-lg bg-[#c05c30] text-white text-sm font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div
                className={`min-w-0 flex-1 overflow-hidden transition-smooth ${
                  collapsed ? "w-0 opacity-0 hidden" : "opacity-100"
                }`}
              >
                <p className="truncate text-[13px] font-semibold text-foreground leading-tight">
                  {displayName}
                </p>
                <p className="truncate text-[11px] uppercase tracking-tighter text-muted-foreground leading-tight">
                  {displayRole}
                </p>
              </div>
              {!collapsed && (
                <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-64 rounded-xl bg-surface-sidebar border border-border-surface shadow-2xl text-foreground"
            side="top"
            align="end"
            sideOffset={8}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-3 px-3 py-3">
                <Avatar className="h-10 w-10 rounded-lg shrink-0">
                  <AvatarImage src="" alt="User avatar" />
                  <AvatarFallback className="rounded-lg bg-[#c05c30] text-white text-sm font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold leading-tight text-foreground">
                    {displayName}
                  </p>
                  <p className="truncate text-[12px] uppercase tracking-tighter text-muted-foreground leading-tight">
                    {displayRole}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-border-surface" />
            {/* <DropdownMenuGroup>
              <DropdownMenuItem className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg focus:bg-sidebar-hover focus:text-foreground">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px]">Upgrade to Pro</span>
              </DropdownMenuItem>
            </DropdownMenuGroup> */}
            <DropdownMenuSeparator className="bg-border-surface" />
            <DropdownMenuGroup>
              <DropdownMenuItem className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg focus:bg-sidebar-hover focus:text-foreground">
                <BadgeCheck className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px]">Akun</span>
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg focus:bg-sidebar-hover focus:text-foreground">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <span className="text-[13px]">Notifikasi</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator className="bg-border-surface" />
            <DropdownMenuItem
              className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg focus:bg-sidebar-hover focus:text-foreground text-red-400 focus:text-red-400"
              onClick={(e) => {
                e.preventDefault();
                handleLogout();
              }}
            >
              <LogOut className="h-4 w-4" />
              <span className="text-[13px]">Keluar Akun</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border-surface" />
            <DropdownMenuItem
              className="gap-3 px-3 py-2.5 cursor-pointer rounded-lg focus:bg-sidebar-hover focus:text-foreground"
              onClick={(e) => {
                e.preventDefault();
                toggleTheme();
              }}
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <Moon className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-[13px]">{theme === "dark" ? "Mode Terang" : "Mode Gelap"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
