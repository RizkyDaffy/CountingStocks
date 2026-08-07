import { Suspense } from "react";
import {
  Outlet,
  Link,
  createRootRoute,
  HeadContent,
  Scripts,
  redirect,
} from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/hooks/use-theme.tsx";
import { isTokenValid, isAuthorizedUser, getAuthUser } from "@/lib/auth";
import { PageSkeleton } from "@/components/dashboard/PageSkeleton";

import appCss from "../styles.css?url";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

const AUTH_GATE_SCRIPT = `(function(){
  var p=location.pathname;
  // Public login paths — no gate
  if(p==='/login'||p.indexOf('/login/')===0||p==='/station/login'){
    document.documentElement.classList.remove('auth-pending');
    return;
  }
  // Station dashboard — check station token before revealing
  if(p.indexOf('/station/dashboard')===0){
    if(!localStorage.getItem('sugity-station-token')){
      location.replace('/station/login');return;
    }
    document.documentElement.classList.remove('auth-pending');
    return;
  }
  // Root path '/' — allowed for guests (Resin/Workstation portal) & admin/op (StockScan)
  if(p==='/'){
    try{
      var tk0=localStorage.getItem('sugity-auth-token');
      var u0=JSON.parse(localStorage.getItem('sugity-auth-user')||'{}');
      if(tk0&&u0.role==='usertv'){
        var f0=encodeURIComponent(u0.tvFactory||'');
        var s0=encodeURIComponent(u0.tvShift||'A');
        var t0=encodeURIComponent(u0.tvTheme||'default');
        location.replace('/tv?fac='+f0+'&shift='+s0+'&theme='+t0);return;
      }
    }catch(e){}
    document.documentElement.classList.remove('auth-pending');
    return;
  }
  var tk=localStorage.getItem('sugity-auth-token');
  if(!tk){location.replace('/login');return;}
  // Decode JWT, check expiry
  try{
    var payload=JSON.parse(atob(tk.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
    if(payload.exp&&Date.now()>=payload.exp*1000){
      localStorage.removeItem('sugity-auth-token');
      localStorage.removeItem('sugity-auth-user');
      location.replace('/login');return;
    }
  }catch(e){
    localStorage.removeItem('sugity-auth-token');
    localStorage.removeItem('sugity-auth-user');
    location.replace('/login');return;
  }
  // Role gate — usertv can only see /tv
  var isTv=p==='/tv'||p.indexOf('/tv')===0;
  if(!isTv){
    try{
      var u=JSON.parse(localStorage.getItem('sugity-auth-user')||'{}');
      if(u.role&&u.role!=='admin'&&u.role!=='operator'){
        var fac=encodeURIComponent(u.tvFactory||'');
        var sh=encodeURIComponent(u.tvShift||'A');
        var th=encodeURIComponent(u.tvTheme||'default');
        location.replace('/tv?fac='+fac+'&shift='+sh+'&theme='+th);return;
      }
    }catch(e){}
  }
  // Auth passed — reveal body
  document.documentElement.classList.remove('auth-pending');
})();`;

function isTvPath(pathname: string): boolean {
  return pathname === "/tv" || pathname.startsWith("/tv");
}

function authBeforeLoad({ location }: { location: { pathname: string } }) {
  if (typeof window === "undefined") return;

  const { pathname } = location;

  if (pathname.startsWith("/station/dashboard")) {
    if (!localStorage.getItem("sugity-station-token")) {
      throw redirect({ to: "/station/login" });
    }
    return;
  }

  if (
    pathname === "/" ||
    pathname === "/login" ||
    pathname.startsWith("/login/") ||
    pathname === "/station/login"
  ) {
    if (pathname === "/" && isTokenValid() && !isAuthorizedUser()) {
      const user = getAuthUser();
      throw redirect({
        to: "/tv",
        search: {
          fac: user?.tvFactory || "",
          shift: user?.tvShift || "A",
          theme: user?.tvTheme || "default",
        },
      });
    }
    return;
  }

  if (!isTokenValid()) {
    throw redirect({ to: "/login" });
  }

  if (!isTvPath(pathname) && !isAuthorizedUser()) {
    const user = getAuthUser();
    throw redirect({
      to: "/tv",
      search: {
        fac: user?.tvFactory || "",
        shift: user?.tvShift || "A",
        theme: user?.tvTheme || "default",
      },
    });
  }
}

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground transition-smooth hover:opacity-90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  beforeLoad: authBeforeLoad,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sugity Creatives - Stock Scan Dashboard" },
      {
        name: "description",
        content: "Manage dan Buat QR stock codes dengan dashboard",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark auth-pending">
      <head>
        <HeadContent />
        {}
        <style
          dangerouslySetInnerHTML={{ __html: `.auth-pending body{visibility:hidden!important}` }}
        />
        {}
        <script dangerouslySetInnerHTML={{ __html: AUTH_GATE_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
