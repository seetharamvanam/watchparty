/** Lightweight who’s-here copy from the HTTP/Ably roster — no extra polling. */

export type PresencePerson = {
  id: string;
  displayName: string;
  isHost?: boolean;
};

export function whoIsHere(people: PresencePerson[], meId?: string | null): {
  count: number;
  countLabel: string;
  namesLabel: string;
  announce: string;
} {
  const count = people.length;
  const names = people.map((person) => {
    const you = person.id === meId ? " (you)" : "";
    const host = person.isHost ? " · host" : "";
    return `${person.displayName}${you}${host}`;
  });
  const namesLabel = names.join(", ");
  const countLabel = count === 1 ? "1 here" : `${count} here`;
  return {
    count,
    countLabel,
    namesLabel,
    announce: count === 0 ? "Waiting for people to sit down." : `${countLabel}: ${namesLabel}`,
  };
}

export function tileCamLabel(options: { camOn: boolean; camDenied?: boolean }): string | null {
  if (options.camDenied) return "Cam blocked";
  if (!options.camOn) return "Cam off";
  return null;
}

export function tileMicLabel(micOn: boolean): string {
  return micOn ? "Mic on" : "Mic off";
}

export function applyLeaveToRoster<T extends { id: string }>(
  people: T[],
  participantId: string | undefined,
): T[] {
  if (!participantId) return people;
  return people.filter((person) => person.id !== participantId);
}

/** Prefer the event count when the server sent one; otherwise the live roster. */
export function nextParticipantCount(options: {
  eventCount?: number;
  rosterLength: number;
}): number {
  if (typeof options.eventCount === "number" && Number.isFinite(options.eventCount)) {
    return Math.max(0, options.eventCount);
  }
  return Math.max(0, options.rosterLength);
}
