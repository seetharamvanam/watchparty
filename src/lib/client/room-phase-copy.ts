export const ROOM_PHASE_STEPS = ["boot", "syncing", "ready"] as const;
export type VisibleRoomPhase = (typeof ROOM_PHASE_STEPS)[number];

export const ROOM_PHASE_COPY = {
  boot: {
    label: "Opening",
    headline: "Dimming the lights…",
    detail: "The room is opening. You can watch as soon as sync finishes.",
    announce: "Opening the room.",
  },
  syncing: {
    label: "Syncing",
    headline: "Locking everyone together…",
    detail: "Getting the movie and who is here. The room is almost ready.",
    announce: "Syncing the room. Almost ready to watch.",
  },
  ready: {
    label: "Ready",
    headline: "You’re in",
    detail: "The room is ready. Camera stays off until you turn it on.",
    announce: "Room is ready. You can watch now.",
  },
} as const;

const PHASE_ORDER: Record<VisibleRoomPhase, number> = {
  boot: 1,
  syncing: 2,
  ready: 3,
};

export function roomPhaseProgress(phase: VisibleRoomPhase): number {
  return PHASE_ORDER[phase];
}

export function roomPhaseBarPercent(phase: Exclude<VisibleRoomPhase, "ready">): number {
  return phase === "syncing" ? 66 : 33;
}

export function isRoomPhaseCurrent(phase: VisibleRoomPhase, step: VisibleRoomPhase): boolean {
  return phase === step;
}

export function isRoomPhaseReached(phase: VisibleRoomPhase, step: VisibleRoomPhase): boolean {
  return PHASE_ORDER[phase] >= PHASE_ORDER[step];
}

export function connectionBannerCopy(state: "connecting" | "lost"): string {
  if (state === "lost") {
    return "Live updates lost. You can still watch — retrying…";
  }
  return "Room is open. Connecting live updates…";
}
