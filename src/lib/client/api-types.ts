import type {
  AvTokenPayload,
  ChatMessagePublic,
  JoinPayload,
  ParticipantPublic,
  PlaybackAction,
  PlaybackState,
  RoomPublic,
  RoomView,
  SessionPayload,
} from "@/lib/types";
import type { REACTION_EMOJIS } from "@/lib/client/config";

export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export type ReactionPublic = {
  emoji: string;
  participantId: string;
  displayName: string;
  createdAt: string;
};

export type PlaybackRequest = {
  action: PlaybackAction;
  positionMs?: number;
  playbackRate?: number;
  mediaUrl?: string;
};

export type RealtimeTokenResponse = {
  tokenRequest: unknown;
  channel: string;
  token?: string;
  clientId?: string;
};

export interface WatchPartyApi {
  createRoom(input: { displayName: string; mediaUrl?: string; title?: string }): Promise<SessionPayload>;
  joinRoom(input: { code: string; displayName: string }): Promise<JoinPayload>;
  getRoom(code: string, token?: string): Promise<RoomView>;
  setMedia(code: string, mediaUrl: string, token: string): Promise<{ room: RoomPublic; playback: PlaybackState }>;
  controlPlayback(code: string, body: PlaybackRequest, token: string): Promise<{ playback: PlaybackState }>;
  getPlayback(code: string, token: string): Promise<{ playback: PlaybackState }>;
  getRealtimeToken(code: string, token: string): Promise<RealtimeTokenResponse>;
  getAvToken(code: string, token: string): Promise<AvTokenPayload>;
  listChat(code: string, token: string): Promise<{ messages: ChatMessagePublic[] }>;
  sendChat(code: string, body: string, token: string): Promise<{ message: ChatMessagePublic }>;
  sendReaction(code: string, emoji: ReactionEmoji, token: string): Promise<{ ok: true; reaction: ReactionPublic }>;
  heartbeat(code: string, token: string): Promise<{ room: RoomPublic; participant: ParticipantPublic; expiresAt: string }>;
  leave(code: string, token: string): Promise<{
    ok: true;
    hostTransferred: boolean;
    newHost: ParticipantPublic | null;
  }>;
}
