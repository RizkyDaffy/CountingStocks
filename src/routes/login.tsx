import { useState, useCallback } from "react";
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { Loader2, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login - Sugity Creatives" },
      { name: "description", content: "Masuk ke sistem inventory Sugity" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setIsLoading(true);
      try {
        const result = await login(username.trim(), password);
        const u = result.user;
        if (u.role === "usertv") {
          const fac = encodeURIComponent(u.tvFactory || "");
          const shift = encodeURIComponent(u.tvShift || "A");
          const theme = encodeURIComponent(u.tvTheme || "default");
          window.location.replace(`/tv?fac=${fac}&shift=${shift}&theme=${theme}`);
        } else {
          window.location.replace("/");
        }
      } catch (err) {
        setError((err as Error).message || "Login gagal. Coba lagi.");
        setIsLoading(false);
      }
    },
    [username, password, login],
  );

  return (
    /* page wrapper - light gray bg, detects theme via CSS variable */
    <div
      className="min-h-screen flex flex-col items-center justify-between py-10 px-4"
      style={{ backgroundColor: "var(--login-bg, #F1F1F1)" }}
    >
      {/* spacer top */}
      <div />

      {/* ── Card ── */}
      <div
        className="w-full max-w-md rounded-2xl shadow-sm p-8 sm:p-10"
        style={{ backgroundColor: "var(--login-card, #FFFFFF)" }}
      >
        <h1
          className="text-2xl font-semibold text-center mb-7 tracking-tight"
          style={{ color: "var(--login-text, #1F2937)" }}
        >
          Users Login
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Alamat Surel / NIK */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="input-username"
              className="text-sm font-medium"
              style={{ color: "var(--login-label, #374151)" }}
            >
              Alamat Surel / NIK
            </label>
            <input
              id="input-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: scanner1"
              required
              className="h-11 w-full rounded-lg border px-4 text-sm outline-none transition-all"
              style={{
                borderColor: "var(--login-border, #D1D5DB)",
                backgroundColor: "var(--login-input-bg, #FFFFFF)",
                color: "var(--login-text, #1F2937)",
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "#c05c30")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--login-border, #D1D5DB)")}
            />
          </div>

          {/* Kata Sandi */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="input-password"
              className="text-sm font-medium"
              style={{ color: "var(--login-label, #374151)" }}
            >
              Kata Sandi
            </label>
            <div className="relative">
              <input
                id="input-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="h-11 w-full rounded-lg border px-4 pr-11 text-sm outline-none transition-all"
                style={{
                  borderColor: "var(--login-border, #D1D5DB)",
                  backgroundColor: "var(--login-input-bg, #FFFFFF)",
                  color: "var(--login-text, #1F2937)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "#c05c30")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--login-border, #D1D5DB)")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Ayo Masuk */}
          <button
            id="btn-ayo-masuk"
            type="submit"
            disabled={isLoading}
            className="h-11 w-full rounded-lg text-sm font-semibold text-white transition-all disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ backgroundColor: "#C07060" }}
            onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "#a85c4e")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C07060")}
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            Ayo Masuk
          </button>

          {/* Kembali Ke Portal */}
          <Link
            id="btn-kembali-portal"
            to="/"
            className="h-11 w-full rounded-lg text-sm font-semibold text-center flex items-center justify-center transition-all"
            style={{
              backgroundColor: "var(--login-secondary-btn, #E5E7EB)",
              color: "var(--login-secondary-text, #374151)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--login-secondary-hover, #D1D5DB)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--login-secondary-btn, #E5E7EB)")
            }
          >
            Kembali Ke Portal
          </Link>
        </form>
      </div>

      {/* ── Footer ── */}
      <p className="text-xs text-center" style={{ color: "var(--login-footer, #9CA3AF)" }}>
        Copyright @2026 Sugity Integrated Systems
      </p>
    </div>
  );
}
