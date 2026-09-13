"use client";

import dynamic from "next/dynamic";
import { JoinGate } from "@/components/room/join-gate";
import { RoomLoading } from "@/components/room/room-loading";
import { StatusScreen } from "@/components/room/status-screen";
import { isRoomCodeFormat, normalizeRoomCode } from "@/lib/client/room-code";
import { RoomProvider, useRoom } from "@/lib/client/room-context";

const FATAL_CODES = new Set(["ROOM_FULL", "ROOM_EXPIRED", "ROOM_NOT_FOUND"]);

const RoomStage = dynamic(() => import("@/components/room/room-stage"), {
  ssr: false,
  loading: () => <RoomLoading phase="syncing" />,
});

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
  const { phase, error } = useRoom();

  if (phase === "boot") {
    return <RoomLoading phase="boot" />;
  }
  if (phase === "syncing") {
    return <RoomLoading phase="syncing" />;
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

  return <RoomStage />;
}
