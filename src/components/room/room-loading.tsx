"use client";

export type RoomLoadPhase = "boot" | "syncing";

export function RoomLoading({ phase }: { phase: RoomLoadPhase }) {
  const syncing = phase === "syncing";
  return (
    <div
      className="flex min-h-dvh flex-col bg-void"
      data-room-phase={phase}
      aria-busy="true"
    >
      <div className="h-14 shrink-0 border-b border-subtle bg-surface/80">
        <div className="flex h-full items-center gap-3 px-5">
          <div className="h-3 w-24 animate-pulse rounded bg-elevated" />
          <div className="h-3 w-16 animate-pulse rounded bg-elevated" />
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-[240px] flex-1 overflow-hidden bg-elevated/50">
            <div className="absolute inset-0 animate-pulse bg-[radial-gradient(ellipse_at_center,rgba(232,168,124,0.08),transparent_55%)]" />
            <div className="absolute inset-0 grid place-items-center px-6">
              <div className="text-center" role="status">
                <p className="text-xs font-medium uppercase tracking-[0.22em] text-warm">
                  {syncing ? "Syncing" : "Skeleton"}
                </p>
                <p className="mt-2 text-sm text-muted">
                  {syncing ? "Fetching room snapshot and live playback…" : "Dimming the lights…"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 overflow-hidden border-t border-subtle bg-surface px-3 py-3">
            {[0, 1, 2].map((slot) => (
              <div key={slot} className="h-[88px] w-[88px] shrink-0 animate-pulse rounded-2xl bg-elevated sm:h-[104px] sm:w-[104px]" />
            ))}
          </div>
        </div>
        <div className="hidden w-80 shrink-0 border-l border-subtle bg-surface md:block">
          <div className="h-12 border-b border-subtle" />
          <div className="space-y-3 p-4">
            <div className="h-3 w-3/4 animate-pulse rounded bg-elevated" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-elevated" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-elevated" />
          </div>
        </div>
      </div>
    </div>
  );
}
