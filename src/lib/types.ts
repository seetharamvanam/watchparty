export type PlaybackStatus = "playing" | "paused";
export type MediaType = "youtube" | "direct" | null;
export type PlaybackAction = "play" | "pause" | "seek" | "rate" | "change_media";

export type RoomPublic = {
  id: string;
  code: string;
  title: string | null;
  expiresAt: string;
  participantCount: number;
  maxParticipants: number;
};

export type ParticipantPublic = {
  id: string;
  displayName: string;
  isHost: boolean;
};

export type PlaybackState = {
  status: PlaybackStatus;
  positionMs: number;
  playbackRate: number;
  mediaUrl: string | null;
  mediaType: MediaType;
  updatedAt: string;
  /** Server clock when this payload was produced. */
  serverNow?: string;
  /** Live position as of `serverNow` while playing; equals `positionMs` when paused. */
  estimatedPositionMs?: number;
  /** Monotonic id of the last host mutation (`updatedAt` millis). Used to drop stale events. */
  eventId?: string;
};

export type ChatMessagePublic = {
  id: string;
  participantId: string;
  displayName: string;
  body: string;
  createdAt: string;
};

export type SessionPayload = {
  room: RoomPublic;
  participant: ParticipantPublic;
  sessionToken: string;
  playback: PlaybackState;
};

export type JoinPayload = SessionPayload & {
  participants: ParticipantPublic[];
};

export type RoomView = {
  room: RoomPublic;
  participants: ParticipantPublic[];
  playback: PlaybackState;
  participant: ParticipantPublic | null;
};

export type AvTokenPayload = {
  token: string;
  url: string;
  roomName: string;
  identity: string;
  expiresAt: string;
};

export type AblyEventName =
  | "play"
  | "pause"
  | "seek"
  | "rate"
  | "change_media"
  | "state_snapshot"
  | "participant_joined"
  | "participant_left"
  | "host_changed"
  | "room_expired"
  | "chat_message"
  | "reaction";
