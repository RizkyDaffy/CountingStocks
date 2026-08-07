import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Download, Printer, ScanLine } from "lucide-react";
import { useCallback } from "react";

export const Route = createFileRoute("/qr-viewer")({
  validateSearch: (search: Record<string, unknown>) => ({
    img: (search.img as string) || "",
    label: (search.label as string) || "QR Code",
    partname: (search.partname as string) || (search.label as string) || "",
    partnum: (search.partnum as string) || "",
    partmodel: (search.partmodel as string) || "",
    machineOrigin: (search.machineOrigin as string) || "",
    factoryOrigin: (search.factoryOrigin as string) || "",
    updatedAt: (search.updatedAt as string) || "",
  }),
  head: () => ({
    meta: [
      { title: "QR Viewer - Scan Dashboard" },
      { name: "description", content: "Full-size QR code viewer for printing." },
    ],
  }),
  component: QrViewerPage,
});

function QrViewerPage() {
  const { img, label, partname, partnum, partmodel, machineOrigin, factoryOrigin, updatedAt } =
    Route.useSearch();

  const handleDownload = useCallback(() => {
    if (!img) return;
    const link = document.createElement("a");
    link.href = img;
    link.download = `${(partname || label).replace(/\s+/g, "-")}-QR.png`;
    link.click();
  }, [img, label, partname]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  if (!img) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">No QR image provided.</p>
          <Link
            to="/"
            className="mt-4 inline-flex items-center gap-2 text-sm text-[#c05c30] hover:underline"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-12">
      {/* Print-friendly card */}
      <div
        id="qr-print-card"
        className="rounded-3xl border border-border-surface bg-surface-section p-8 flex flex-col items-center gap-6 max-w-[360px] w-full shadow-2xl print:border-none print:shadow-none print:bg-white print:p-0"
      >
        <div className="w-full text-center">
          <span className="inline-block rounded-full bg-[#c05c30]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[#c05c30] print:hidden">
            Sugity Creatives
          </span>
          <span className="hidden text-[10px] uppercase tracking-[0.2em] text-black print:block">
            Sugity Creatives
          </span>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground print:text-black">
            {partname || label}
          </h1>
          {partnum && (
            <p className="mt-1 text-sm font-medium text-muted-foreground print:text-gray-600 font-mono">
              {partnum}
            </p>
          )}
        </div>

        {/* QR Image */}
        <div className="relative rounded-2xl bg-white p-5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.05)] ring-1 ring-border-surface print:ring-0 print:shadow-none">
          <img src={img} alt={`QR code for ${label}`} className="h-56 w-56 object-contain" />
          {/* subtle corner brackets for a technical feel */}
          <div className="absolute top-0 left-0 h-4 w-4 border-t-2 border-l-2 border-[#c05c30]/40 rounded-tl-xl m-2 print:hidden" />
          <div className="absolute top-0 right-0 h-4 w-4 border-t-2 border-r-2 border-[#c05c30]/40 rounded-tr-xl m-2 print:hidden" />
          <div className="absolute bottom-0 left-0 h-4 w-4 border-b-2 border-l-2 border-[#c05c30]/40 rounded-bl-xl m-2 print:hidden" />
          <div className="absolute bottom-0 right-0 h-4 w-4 border-b-2 border-r-2 border-[#c05c30]/40 rounded-br-xl m-2 print:hidden" />
        </div>

        {/* Details Grid */}
        <div className="w-full grid grid-cols-2 gap-y-4 gap-x-2 rounded-2xl bg-card-elevated p-4 text-left ring-1 ring-border-surface print:bg-transparent print:ring-gray-300 print:px-2">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Part Model
            </div>
            <div className="mt-0.5 text-xs font-medium text-foreground print:text-black truncate">
              {partmodel || "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Homelane Factory
            </div>
            <div className="mt-0.5 text-xs font-medium text-foreground print:text-black truncate">
              {factoryOrigin || "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Homelane Machine
            </div>
            <div className="mt-0.5 text-xs font-medium text-foreground print:text-black truncate">
              {machineOrigin || "-"}
            </div>
          </div>
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Terakhir Di Update
            </div>
            <div className="mt-0.5 text-xs font-medium text-foreground print:text-black truncate">
              {updatedAt
                ? new Intl.DateTimeFormat("id-ID", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(new Date(updatedAt))
                : "-"}
            </div>
          </div>
        </div>

        <p className="w-full text-center text-[10px] uppercase tracking-wider text-muted-foreground/80 print:text-gray-500">
          <span className="flex items-center justify-center gap-1.5">
            <ScanLine className="h-3.5 w-3.5 print:hidden" />
            Scan to view live IN/OUT status
          </span>
        </p>
      </div>

      {/* Controls - hidden when printing */}
      <div className="mt-8 flex gap-3 print:hidden">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-border-surface bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-smooth hover:bg-sidebar-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-2 rounded-full border border-border-surface bg-card px-4 py-2.5 text-sm font-medium text-foreground transition-smooth hover:bg-sidebar-hover"
        >
          <Download className="h-4 w-4" />
          Download
        </button>
        <button
          onClick={handlePrint}
          className="inline-flex items-center gap-2 rounded-full bg-[#c05c30] px-4 py-2.5 text-sm font-medium text-white transition-smooth hover:bg-[#a84d24] shadow-[0_4px_14px_rgba(192,92,48,0.25)]"
        >
          <Printer className="h-4 w-4" />
          Print QR
        </button>
      </div>
    </div>
  );
}
