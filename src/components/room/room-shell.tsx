"use client";

import { useState } from "react";
import { ChatRail } from "@/components/room/chat-rail";
import { FaceStrip } from "@/components/room/face-strip";
import { JoinGate } from "@/components/room/join-gate";
import { ReactionsOverlay } from "@/components/room/reactions-overlay";
import { RoomHeader } from "@/components/room/room-header";
import { ConnectionBanner, StatusScreen } from "@/components/room/status-screen";
import { SyncedPlayer } from "@/components/room/synced-player";
import { Button } from "@/components/ui/button";
import { isRoomCodeFormat, normalizeRoomCode } from "@/lib/client/room-code";
import { RoomProvider, useRoom } from "@/lib/client/room-context";

const FATAL_CODES = new Set(["ROOM_FULL", "ROOM_EXPIRED", "ROOM_NOT_FOUND"]);

export function RoomShell({ code, initialError }: { code: string; initialError?: string }) {
  const normalized = normalizeRoomCode(code);
  if (initialError && FATAL_CODES.has(initialError)) {
    return (
      <StatusScreen
        code={initialError as "ROOM_FULL" | "ROOM_EXPIRED" | "ROOM_NOT_FOUND"}
        tone="danger"
      />
    );
  }
  if (!isRoomCodeFormat(normalized)) {
    return <StatusScreen code="ROOM_NOT_FOUND" />;
  }
  return (
    <RoomProvider key={normalized} code={normalized}>
      <RoomView />
    </RoomProvider>
  );
}

function RoomView() {
  const { phase, error, connection } = useRoom();
  const [chatOpen, setChatOpen] = useState(false);

  if (phase === "boot") {
    return <div className="grid min-h-dvh place-items-center bg-void text-muted">Dimming the lights…</div>;
  }
  if (phase === "error" && error) {
    return (
      <StatusScreen
        code={error.code}
        tone={error.code === "ROOM_EXPIRED" || error.code === "ROOM_FULL" ? "danger" : "default"}
      />
    );
  }
  if (phase === "needs-join") {
    if (error) return <StatusScreen code={error.code} />;
    return <JoinGate />;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-void">
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
