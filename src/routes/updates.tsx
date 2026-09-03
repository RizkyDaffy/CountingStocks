import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowUpCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  History,
  Tag,
  ExternalLink,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import {
  compareSemver,
  isUpdateAvailable,
  useUpdateCheck,
  type ReleaseInfo,
} from "@/hooks/use-update-check";
import { selfUpdatePhaseLabel, useSelfUpdate } from "@/hooks/use-self-update";

export const Route = createFileRoute("/updates")({
  head: () => ({
    meta: [
      { title: "Version & Update - Sugity Creatives" },
      { name: "description", content: "Informasi versi aplikasi dan pembaruan yang tersedia." },
    ],
  }),
  component: UpdatesPage,
});

function versionBadgeClass(state: "newer" | "current" | "older"): string {
  switch (state) {
    case "newer":
      return "bg-[#c05c30]/15 text-[#c05c30] border-[#c05c30]/30";
    case "current":
      return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
    case "older":
      return "bg-muted text-muted-foreground border-border-surface";
  }
}

function versionBadgeLabel(state: "newer" | "current" | "older"): string {
  switch (state) {
    case "newer":
      return "Tersedia";
    case "current":
      return "Versi Saat Ini";
    case "older":
      return "Riwayat";
  }
}

function ReleaseCard({
  release,
  state,
}: {
  release: ReleaseInfo;
  state: "newer" | "current" | "older";
}) {
  return (
    <div className="rounded-xl border border-border-surface bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Tag className="h-4.5 w-4.5 text-muted-foreground" />
          <div>
            <div className="text-sm font-semibold text-foreground">
              {release.name || release.tag}
            </div>
            <div className="text-xs text-muted-foreground">
              {release.published_at
                ? format(new Date(release.published_at), "dd MMM yyyy, HH:mm")
                : "Tanggal tidak diketahui"}
            </div>
          </div>
        </div>
        <span
          className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${versionBadgeClass(state)}`}
        >
          {versionBadgeLabel(state)}
        </span>
      </div>
      {release.body ? (
        <pre className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed text-muted-foreground">
          {release.body}
        </pre>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          Tidak ada catatan perubahan untuk versi ini.
        </p>
      )}
      {release.url ? (
        <a
          href={release.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Lihat di GitHub
        </a>
      ) : null}
    </div>
  );
}

function UpdatesPage() {
  const { data: info, isLoading, dataUpdatedAt, refetch, isRefetching } = useUpdateCheck();
  const { phase, message, trigger } = useSelfUpdate();
  const updateBusy =
    phase === "starting" || phase === "updating" || phase === "restarting" || phase === "done";

  const updateAvailable = isUpdateAvailable(info);
  const lastCheck =
    dataUpdatedAt > 0 ? format(new Date(dataUpdatedAt), "dd MMM yyyy, HH:mm:ss") : "-";

  const newer = (info?.releases ?? []).filter(
    (r) => compareSemver(r.tag.replace(/^v/, ""), info?.current ?? "0.0.0") > 0,
  );
  const older = (info?.releases ?? []).filter(
    (r) => compareSemver(r.tag.replace(/^v/, ""), info?.current ?? "0.0.0") < 0,
  );

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Version &amp; Update
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informasi versi aplikasi yang sedang berjalan dan pembaruan yang tersedia.
          </p>
        </div>

        {/* Current version card */}
        <div className="rounded-xl border border-border-surface bg-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#c05c30]/15">
                <Tag className="h-6 w-6 text-[#c05c30]" />
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Versi Terpasang
                </div>
                <div className="text-xl font-bold text-foreground">
                  {isLoading ? "Memuat…" : `v${info?.current ?? "?"}`}
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching || isLoading}
            >
              <RefreshCw className={`mr-1.5 h-4 w-4 ${isRefetching ? "animate-spin" : ""}`} />
              Periksa Update
            </Button>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-border-surface pt-4 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Pemeriksaan terakhir: {lastCheck}
          </div>
        </div>

        {/* Status section */}
        {isLoading ? (
          <div className="rounded-xl border border-border-surface bg-card p-6 text-sm text-muted-foreground">
            Memeriksa pembaruan…
          </div>
        ) : updateAvailable ? (
          <div className="rounded-xl border border-[#c05c30]/30 bg-[#c05c30]/5 p-6">
            <div className="flex items-start gap-4">
              <ArrowUpCircle className="mt-0.5 h-6 w-6 shrink-0 text-[#c05c30]" />
              <div className="min-w-0 flex-1">
                <div className="text-base font-semibold text-foreground">
                  Pembaruan tersedia: v{info?.latest}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Anda sedang menjalankan v{info?.current}. Klik "Update Sekarang" untuk memperbarui
                  aplikasi secara otomatis (admin). Layanan akan dimulai ulang sebentar.
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button size="sm" onClick={trigger} disabled={updateBusy}>
                    {updateBusy ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 h-4 w-4" />
                    )}
                    {selfUpdatePhaseLabel(phase)}
                  </Button>
                  {phase === "error" && message ? (
                    <span className="text-sm text-destructive">{message}</span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
            <div className="flex items-start gap-4">
              <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-500" />
              <div>
                <div className="text-base font-semibold text-foreground">
                  Anda berada di versi terbaru (v{info?.current})
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pemeriksaan terakhir: {lastCheck}. Tidak ada pembaruan yang dibutuhkan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Newer versions */}
        {newer.length > 0 && (
          <section className="space-y-4">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
              <ArrowUpCircle className="h-4 w-4" />
              Versi Baru
            </h2>
            {newer.map((release) => (
              <ReleaseCard key={release.tag} release={release} state="newer" />
            ))}
          </section>
        )}

        {/* Release history */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-muted-foreground">
            <History className="h-4 w-4" />
            Riwayat Versi
          </h2>
          {older.length === 0 ? (
            <p className="rounded-xl border border-border-surface bg-card p-5 text-sm text-muted-foreground">
              Belum ada riwayat versi lain yang tercatat.
            </p>
          ) : (
            older.map((release) => (
              <ReleaseCard key={release.tag} release={release} state="older" />
            ))
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
