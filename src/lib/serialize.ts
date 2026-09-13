import type { ChatMessageRow, ParticipantRow, RoomRow } from "@/db/schema";
import { MAX_PARTICIPANTS } from "./constants";
import type { ChatMessagePublic, ParticipantPublic, RoomPublic } from "./types";

export function serializeRoom(room: RoomRow, participantCount: number): RoomPublic {
  return {
    id: room.id,
    code: room.code,
    title: room.title ?? null,
    expiresAt: room.expiresAt.toISOString(),
    participantCount,
    maxParticipants: MAX_PARTICIPANTS,
  };
}

export function serializeParticipant(participant: ParticipantRow): ParticipantPublic {
  return {
    id: participant.id,
    displayName: participant.displayName,
    isHost: participant.isHost,
  };
}

export function serializeChatMessage(
  message: ChatMessageRow,
  displayName: string,
): ChatMessagePublic {
  return {
    id: message.id,
    participantId: message.participantId,
    displayName,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
  };
}
