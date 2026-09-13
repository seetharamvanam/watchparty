"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getAppUrl } from "@/lib/client/config";
import { useRoom } from "@/lib/client/room-context";

export function RoomHeader() {
  const { code, room, participants, leave, mock, connection } = useRoom();
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const seats = room?.participantCount ?? participants.length;
  const max = room?.maxParticipants ?? 8;
  const invite = `${getAppUrl()}/r/${code}`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(invite);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Copy this invite", invite);
    }
  }

  async function onLeave() {
    await leave();
    router.push("/");
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-subtle bg-surface/80 px-3 backdrop-blur-md sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="hidden text-sm font-medium tracking-tight text-primary sm:inline">
          Watch Party
        </span>
        <span className="hidden h-4 w-px bg-subtle sm:block" aria-hidden />
        <div className="flex items-center gap-2">
          <p className="font-mono text-sm tracking-[0.28em] text-primary">{code}</p>
          <Button size="sm" variant="ghost" onClick={copyLink} aria-label="Copy invite link">
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        {room?.title ? (
          <p className="hidden truncate text-sm text-muted lg:block">{room.title}</p>
        ) : null}
        {mock ? (
          <span className="rounded-full border border-warm/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-warm">
            Mock
          </span>
        ) : null}
        {connection === "connected" ? (
          <span
            className="hidden items-center gap-1.5 rounded-full border border-success/30 px-2 py-0.5 text-[10px] uppercase tracking-wider text-success sm:inline-flex"
            aria-label="Room is ready"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden />
            Ready
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        <p className="text-sm tabular-nums text-muted" aria-label={`${seats} of ${max} seats`}>
          <span className="text-primary">{seats}</span>/{max}
        </p>
        <Button size="sm" variant="ghost" onClick={onLeave}>
          Leave
        </Button>
      </div>
    </header>
  );
}
