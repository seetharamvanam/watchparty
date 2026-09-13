/** Lightweight speaking helpers on top of LiveKit ActiveSpeakers identities. */

export function speakerIdSet(identities: Iterable<string>): Set<string> {
  return identities instanceof Set ? identities : new Set(identities);
}

export function tileIsSpeaking(options: {
  participantId: string;
  speakerIds: Iterable<string>;
  remoteSpeaking?: boolean;
}): boolean {
  const speakers = speakerIdSet(options.speakerIds);
  if (speakers.has(options.participantId)) return true;
  return Boolean(options.remoteSpeaking);
}

export function speakingLabel(displayName: string, speaking: boolean): string | undefined {
  if (!speaking) return undefined;
  return `${displayName} is speaking`;
}
