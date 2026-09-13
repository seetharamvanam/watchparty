"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChatRail } from "@/components/room/chat-rail";
import { ReactionsOverlay } from "@/components/room/reactions-overlay";
import { RoomHeader } from "@/components/room/room-header";
import { ConnectionBanner } from "@/components/room/status-screen";
import { SyncedPlayer } from "@/components/room/synced-player";
import { Button } from "@/components/ui/button";
import { ROOM_PHASE_COPY } from "@/lib/client/room-phase-copy";
import { useRoom } from "@/lib/client/room-context";

const FaceStrip = dynamic(() => import("@/components/room/face-strip").then((mod) => mod.FaceStrip), {
  ssr: false,
  loading: () => (
    <div
      className="h-[132px] shrink-0 border-t border-subtle bg-surface"
      role="status"
      aria-label="Loading faces. The room is already ready."
    >
      <div className="flex gap-3 px-3 py-3">
        {[0, 1, 2].map((slot) => (
          <div key={slot} className="h-[88px] w-[88px] animate-pulse rounded-2xl bg-elevated" />
        ))}
      </div>
    </div>
  ),
});

export function RoomStage() {
  const { connection } = useRoom();
  const [chatOpen, setChatOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-void" data-room-phase="ready">
      <p className="sr-only" role="status" aria-live="polite">
        {ROOM_PHASE_COPY.ready.announce}
      </p>
      <RoomHeader />
      <ConnectionBanner state={connection} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1">
            <SyncedPlayer />
            <ReactionsOverlay />
          </div>
          <FaceStrip />
          <div className="border-t border-subtle p-2 md:hidden">
            <Button className="w-full" variant="secondary" onClick={() => setChatOpen(true)}>
              Open chat
            </Button>
          </div>
        </div>
        <ChatRail mobileOpen={chatOpen} onClose={() => setChatOpen(false)} />
      </div>
    </div>
  );
}

export default RoomStage;
