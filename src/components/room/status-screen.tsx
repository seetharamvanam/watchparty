import Link from "next/link";
import { CinemaBackdrop } from "@/components/home/cinema-backdrop";
import { ERROR_COPY, type ClientErrorCode } from "@/lib/client/errors";
import { cn } from "@/lib/client/cn";

export function StatusScreen({
  code,
  title,
  body,
  tone = "default",
}: {
  code?: ClientErrorCode;
  title?: string;
  body?: string;
  tone?: "default" | "live" | "danger";
}) {
  const copy = code ? ERROR_COPY[code] : null;
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-6 py-16">
      <CinemaBackdrop />
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-subtle bg-surface/90 p-8 text-center shadow-[0_24px_80px_rgba(0,0,0,0.4)]">
        <div
          className={cn(
            "mx-auto mb-5 h-2 w-16 rounded-full",
            tone === "danger" && "bg-danger",
            tone === "live" && "bg-live",
            tone === "default" && "bg-warm",
          )}
        />
        <h1 className="text-2xl tracking-tight text-primary">{title ?? copy?.title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{body ?? copy?.body}</p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-warm px-4 text-sm font-medium text-void shadow-[0_0_24px_rgba(196,122,90,0.28)] transition-colors duration-200 hover:bg-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm/80"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}

export function ConnectionBanner({ state }: { state: "connecting" | "connected" | "lost" }) {
  if (state === "connected") return null;
  return (
    <div
      role="status"
      className={cn(
        "px-4 py-2 text-center text-sm",
        state === "lost" ? "bg-danger/15 text-danger" : "bg-elevated text-muted",
      )}
    >
      {state === "lost" ? "Connection lost. Trying to reconnect…" : "Connecting to the room…"}
    </div>
  );
}
