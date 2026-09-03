import { useState } from "react";
import { ArrowUpCircle, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { isUpdateAvailable, useUpdateCheck } from "@/hooks/use-update-check";
import { selfUpdatePhaseLabel, useSelfUpdate } from "@/hooks/use-self-update";

const DISMISSED_KEY = "update-dismissed-version";

function readDismissed(): string {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) ?? "";
  } catch {
    return "";
  }
}

export function UpdateBanner() {
  const { data: info } = useUpdateCheck();
  const { phase, message, trigger } = useSelfUpdate();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [changelogOpen, setChangelogOpen] = useState(false);

  const updateAvailable = isUpdateAvailable(info);
  const visible = updateAvailable && info?.latest !== dismissed;
  const busy =
    phase === "starting" || phase === "updating" || phase === "restarting" || phase === "done";

  if (!visible || !info) return null;

  const dismiss = () => {
    setDismissed(info.latest);
    try {
      window.localStorage.setItem(DISMISSED_KEY, info.latest);
    } catch {
      /* storage unavailable - dismissal lasts for this session only */
    }
  };

  const latestRelease = info.releases[0];

  return (
    <>
      <div
        role="status"
        className="flex flex-col items-start justify-between gap-3 border-b border-border-surface bg-surface-sidebar px-4 py-3 sm:flex-row sm:items-center sm:px-6 lg:px-10"
      >
        <div className="flex items-center gap-2 text-sm">
          <ArrowUpCircle className="h-4.5 w-4.5 shrink-0 text-primary" />
          <span>
            Pembaruan tersedia: <strong>v{info.latest}</strong> (saat ini v{info.current})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setChangelogOpen(true)}>
            Lihat Changelog
          </Button>
          <Button variant="ghost" size="sm" onClick={dismiss} disabled={busy}>
            Nanti
          </Button>
          <Button
            size="sm"
            onClick={trigger}
            disabled={busy}
            title={phase === "error" && message ? message : "Perbarui aplikasi ke versi terbaru"}
          >
            {busy ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1 h-4 w-4" />
            )}
            {selfUpdatePhaseLabel(phase)}
          </Button>
          {phase === "error" && message ? (
            <span className="text-xs text-destructive">{message}</span>
          ) : null}
        </div>
      </div>

      <Dialog open={changelogOpen} onOpenChange={setChangelogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Changelog - v{info.latest}</DialogTitle>
            <DialogDescription>
              {latestRelease?.published_at
                ? new Date(latestRelease.published_at).toLocaleString()
                : ""}
            </DialogDescription>
          </DialogHeader>
          <pre className="whitespace-pre-wrap break-words text-sm text-muted-foreground">
            {latestRelease?.body || "Tidak ada catatan perubahan untuk versi ini."}
          </pre>
          {latestRelease?.url ? (
            <a
              href={latestRelease.url}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-primary underline-offset-4 hover:underline"
            >
              Lihat rilisan lengkap di GitHub
            </a>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
