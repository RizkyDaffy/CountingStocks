import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/$")({
  head: () => ({
    meta: [
      { title: "404 - Halaman Tidak Ditemukan | Sugity" },
      { name: "description", content: "Halaman yang Anda cari tidak ditemukan." },
    ],
  }),
  component: NotFoundPage,
});

function NotFoundPage() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "var(--station-bg, #F0EFED)" }}
    >
      {}
      <div
        className="w-full max-w-md rounded-3xl shadow-lg p-10 flex flex-col items-center text-center"
        style={{ backgroundColor: "#FFFFFF" }}
      >
        {}
        <div
          className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 text-4xl font-black text-white"
          style={{ backgroundColor: "#C05C30" }}
        >
          404
        </div>

        <h1 className="text-2xl font-extrabold mb-2 tracking-tight" style={{ color: "#2D2D2D" }}>
          Halaman Tidak Ditemukan
        </h1>

        <p className="text-sm mb-8 leading-relaxed" style={{ color: "#57534E" }}>
          Halaman yang Anda akses tidak tersedia atau telah dipindahkan. Periksa kembali URL atau
          kembali ke halaman utama.
        </p>

        {}
        <div className="flex flex-col sm:flex-row gap-3 w-full">
          <button
            id="btn-404-goback"
            onClick={() => window.history.back()}
            className="flex-1 rounded-xl px-5 py-3 text-sm font-semibold border transition-all"
            style={{
              borderColor: "#C05C30",
              color: "#C05C30",
              backgroundColor: "transparent",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#FEF3ED";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            ← Kembali
          </button>

          <Link
            id="btn-404-home"
            to="/"
            className="flex-1 rounded-xl px-5 py-3 text-sm font-semibold text-white text-center transition-all"
            style={{ backgroundColor: "#C05C30" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#A84E26";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.backgroundColor = "#C05C30";
            }}
          >
            Ke Halaman Utama
          </Link>
        </div>
      </div>

      {}
      <p className="text-xs mt-8" style={{ color: "#9CA3AF" }}>
        Copyright @2026 Sugity Integrated Systems
      </p>
    </div>
  );
}
