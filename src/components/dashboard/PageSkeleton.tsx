export function PageSkeleton() {
  return (
    <div className="min-h-screen w-full bg-surface-page animate-pulse">
      {}
      <div className="fixed inset-y-0 left-0 z-30 hidden w-[280px] flex-col border-r border-border-surface bg-surface-sidebar md:flex">
        {}
        <div className="px-5 py-5">
          <div className="h-4 w-36 rounded-full bg-card-elevated" />
          <div className="mt-1.5 h-2.5 w-24 rounded-full bg-card-elevated/60" />
        </div>
        {}
        <div className="flex flex-1 flex-col gap-2 px-3 py-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-full px-4 py-3">
              <div className="h-5 w-5 shrink-0 rounded-md bg-card-elevated" />
              <div className="flex flex-col gap-1.5">
                <div className="h-3 w-24 rounded-full bg-card-elevated" />
                <div className="h-2 w-32 rounded-full bg-card-elevated/60" />
              </div>
            </div>
          ))}
        </div>
        {}
        <div className="px-3 py-3">
          <div className="flex items-center gap-3 rounded-xl px-3 py-2.5">
            <div className="h-9 w-9 shrink-0 rounded-lg bg-card-elevated" />
            <div className="flex flex-col gap-1.5">
              <div className="h-3 w-20 rounded-full bg-card-elevated" />
              <div className="h-2 w-14 rounded-full bg-card-elevated/60" />
            </div>
          </div>
        </div>
      </div>

      {}
      <div className="md:pl-[280px]">
        {}
        <div className="flex items-center justify-between border-b border-border-surface bg-surface-sidebar px-4 py-3 md:hidden">
          <div className="h-4 w-32 rounded-full bg-card-elevated" />
          <div className="h-10 w-10 rounded-full bg-card-elevated" />
        </div>

        <main className="px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {}
          <div className="mb-6">
            <div className="h-2.5 w-28 rounded-full bg-card-elevated/60" />
            <div className="mt-2 h-7 w-64 rounded-xl bg-card-elevated" />
          </div>

          {}
          <div className="mb-4 h-14 w-full rounded-2xl bg-card" />
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            {}
            <div className="flex gap-4 border-b border-border px-5 py-3.5 bg-card-elevated/50">
              {[80, 60, 50, 60, 40].map((w, i) => (
                <div
                  key={i}
                  className={`h-2.5 rounded-full bg-card-elevated`}
                  style={{ width: `${w}px` }}
                />
              ))}
            </div>
            {/* Table rows */}
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-4 border-b border-border/60 px-5 py-4">
                {[100, 80, 60, 70, 50].map((w, j) => (
                  <div
                    key={j}
                    className="h-3 rounded-full bg-card-elevated/70"
                    style={{ width: `${w}px` }}
                  />
                ))}
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
