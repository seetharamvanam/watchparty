"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { getApi } from "@/lib/client";
import { ApiError, isApiError } from "@/lib/client/errors";
import { isMockApi, PRESENCE_INTERVAL_MS } from "@/lib/client/config";
import type { ReactionPublic } from "@/lib/client/api-types";
import {
  isStalePlaybackEvent,
  playbackFromEvent,
  type RealtimeConnection,
  type RoomEvent,
} from "@/lib/client/room-events";
import { loadChatAfterReady, loadRoomReady } from "@/lib/client/room-ready";
import { clearSession, readSession, writeSession } from "@/lib/client/session";
import type {
  ChatMessagePublic,
  ParticipantPublic,
  PlaybackState,
  RoomPublic,
} from "@/lib/types";
import type { PlaybackRequest, ReactionEmoji } from "@/lib/client/api-types";

/** Visible room load machine: skeleton (`boot`) → `syncing` → `ready`. */
export type RoomPhase = "boot" | "needs-join" | "syncing" | "ready" | "error";
export type ConnectionState = "connecting" | "connected" | "lost";

const idlePlayback: PlaybackState = {
  status: "paused",
  positionMs: 0,
  playbackRate: 1,
  mediaUrl: null,
  mediaType: null,
  updatedAt: new Date(0).toISOString(),
};

interface RoomContextValue {
  code: string;
  phase: RoomPhase;
  error: ApiError | null;
  mock: boolean;
  room: RoomPublic | null;
  playback: PlaybackState;
  participants: ParticipantPublic[];
  me: ParticipantPublic | null;
  isHost: boolean;
  sessionToken: string | null;
  chat: ChatMessagePublic[];
  reactions: ReactionPublic[];
  connection: ConnectionState;
  join: (displayName: string) => Promise<void>;
  leave: () => Promise<void>;
  sendChat: (body: string) => Promise<void>;
  sendReaction: (emoji: ReactionEmoji) => Promise<void>;
  controlPlayback: (body: PlaybackRequest) => Promise<void>;
  setMedia: (mediaUrl: string) => Promise<void>;
  clearError: () => void;
}

const RoomContext = createContext<RoomContextValue | null>(null);

export function RoomProvider({ code, children }: { code: string; children: ReactNode }) {
  const api = useMemo(() => getApi(), []);
  const [phase, setPhase] = useState<RoomPhase>(() =>
    typeof window !== "undefined" && !readSession(code) ? "needs-join" : "boot",
  );
  const [error, setError] = useState<ApiError | null>(null);
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [playback, setPlayback] = useState<PlaybackState>(idlePlayback);
  const [participants, setParticipants] = useState<ParticipantPublic[]>([]);
  const [me, setMe] = useState<ParticipantPublic | null>(null);
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [chat, setChat] = useState<ChatMessagePublic[]>([]);
  const [reactions, setReactions] = useState<ReactionPublic[]>([]);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const realtimeRef = useRef<RealtimeConnection | null>(null);
  const enterGenRef = useRef(0);
  const playbackRef = useRef(playback);
  playbackRef.current = playback;

  const handleEvent = useCallback((event: RoomEvent) => {
    switch (event.type) {
      case "state_snapshot":
        if (event.room) setRoom(event.room);
        if (event.participants) setParticipants(event.participants);
        if (event.playback) {
          setPlayback((current) => {
            if (isStalePlaybackEvent(event, current)) return current;
            return event.playback!;
          });
        }
        break;
      case "play":
      case "pause":
      case "seek":
      case "rate":
      case "change_media":
        setPlayback((current) => {
          if (isStalePlaybackEvent(event, current)) return current;
          return playbackFromEvent(event, current);
        });
        break;
      case "participant_joined":
        if (event.participant) {
          const joined = event.participant;
          setParticipants((current) =>
            current.some((p) => p.id === joined.id) ? current : [...current, joined],
          );
        }
        if (typeof event.participantCount === "number") {
          setRoom((current) =>
            current ? { ...current, participantCount: event.participantCount! } : current,
          );
        }
        break;
      case "participant_left":
        if (event.participantId) {
          setParticipants((current) => current.filter((p) => p.id !== event.participantId));
        }
        break;
      case "host_changed":
        if (event.host) {
          const hostId = event.host.id;
          setParticipants((current) => current.map((p) => ({ ...p, isHost: p.id === hostId })));
          setMe((current) => (current ? { ...current, isHost: current.id === hostId } : current));
        }
        break;
      case "chat_message":
        if (event.message) {
          const message = event.message;
          setChat((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
        }
        break;
      case "reaction":
        if (event.emoji) {
          setReactions((current) => [
            ...current.slice(-24),
            {
              emoji: event.emoji!,
              participantId: event.participantId ?? "",
              displayName: event.displayName ?? "",
              createdAt: event.createdAt ?? new Date().toISOString(),
            },
          ]);
        }
        break;
      case "room_expired":
        setError(new ApiError("ROOM_EXPIRED", "This room has expired.", 410));
        setPhase("error");
        break;
      default:
        break;
    }
  }, []);

  const failEnter = useCallback(
    (err: unknown) => {
      if (isApiError(err) && err.code === "UNAUTHORIZED") {
        clearSession(code);
        setPhase("needs-join");
        setError(null);
        return;
      }
      if (isApiError(err) && err.code === "ROOM_NOT_FOUND") {
        clearSession(code);
        setError(err);
        setPhase("error");
        return;
      }
      setError(isApiError(err) ? err : new ApiError("UNKNOWN", "Could not open this room."));
      setPhase("error");
    },
    [code],
  );

  const enter = useCallback(
    async (token: string, participant: ParticipantPublic) => {
      const gen = ++enterGenRef.current;
      setPhase("syncing");
      setSessionToken(token);
      setMe(participant);
      setConnection("connecting");
      setError(null);

      const buffered: RoomEvent[] = [];
      let releaseBuffer: (() => void) | undefined;

      const { snapshot, realtime, realtimeFailed } = await loadRoomReady({
        getSnapshot: () => api.getRoom(code, token),
        connectRealtime: async () => {
          const { connectRealtime } = await import("@/lib/client/realtime");
          const connection = await connectRealtime(api, code, token);
          releaseBuffer = connection.subscribe((event) => {
            buffered.push(event);
          });
          return connection;
        },
      });

      if (gen !== enterGenRef.current) {
        realtime?.close();
        return;
      }

      setRoom(snapshot.room);
      setPlayback(snapshot.playback);
      setParticipants(snapshot.participants);
      if (snapshot.participant) setMe(snapshot.participant);

      realtimeRef.current?.close();
      if (realtime) {
        releaseBuffer?.();
        realtimeRef.current = realtime;
        realtime.subscribe(handleEvent);
        for (const event of buffered) handleEvent(event);
        setConnection("connected");
      } else {
        realtimeRef.current = null;
        setConnection(realtimeFailed ? "lost" : "connecting");
      }

      setPhase("ready");

      void loadChatAfterReady(() => api.listChat(code, token)).then((messages) => {
        if (gen !== enterGenRef.current || !messages.length) return;
        setChat(messages);
      });
    },
    [api, code, handleEvent],
  );

  useEffect(() => {
    const session = readSession(code);
    if (!session) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      enter(session.sessionToken, session.participant).catch((err) => {
        if (cancelled) return;
        failEnter(err);
      });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [code, enter, failEnter]);

  useEffect(() => {
    if (phase !== "ready" || !sessionToken) return;
    const tick = () => {
      api.heartbeat(code, sessionToken).catch(() => setConnection("lost"));
    };
    tick();
    const id = window.setInterval(tick, PRESENCE_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [api, code, phase, sessionToken]);

  useEffect(() => () => realtimeRef.current?.close(), []);

  const join = useCallback(
    async (displayName: string) => {
      const session = await api.joinRoom({ code, displayName });
      writeSession(code, {
        sessionToken: session.sessionToken,
        participant: session.participant,
        displayName: session.participant.displayName,
      });
      // Apply the join snapshot immediately so mid-playback late joiners do not
      // sit on idle position 0 while GET room + Ably subscribe race in enter().
      setRoom(session.room);
      setPlayback(session.playback);
      setParticipants(session.participants);
      setMe(session.participant);
      try {
        await enter(session.sessionToken, session.participant);
      } catch (err) {
        failEnter(err);
        throw err;
      }
    },
    [api, code, enter, failEnter],
  );

  const leave = useCallback(async () => {
    enterGenRef.current += 1;
    if (sessionToken) {
      try {
        await api.leave(code, sessionToken);
      } catch {
        // best-effort
      }
    }
    clearSession(code);
    realtimeRef.current?.close();
    realtimeRef.current = null;
  }, [api, code, sessionToken]);

  const sendChat = useCallback(
    async (body: string) => {
      if (!sessionToken) return;
      const { message } = await api.sendChat(code, body, sessionToken);
      setChat((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));
    },
    [api, code, sessionToken],
  );

  const sendReaction = useCallback(
    async (emoji: ReactionEmoji) => {
      if (!sessionToken) return;
      const { reaction } = await api.sendReaction(code, emoji, sessionToken);
      setReactions((current) => [...current.slice(-24), reaction]);
    },
    [api, code, sessionToken],
  );

  const controlPlayback = useCallback(
    async (body: PlaybackRequest) => {
      if (!sessionToken) return;
      const { playback: next } = await api.controlPlayback(code, body, sessionToken);
      setPlayback(next);
    },
    [api, code, sessionToken],
  );

  const setMedia = useCallback(
    async (mediaUrl: string) => {
      if (!sessionToken) return;
      const { room: nextRoom, playback: next } = await api.setMedia(code, mediaUrl, sessionToken);
      setPlayback(next);
      setRoom(nextRoom);
    },
    [api, code, sessionToken],
  );

  const value = useMemo<RoomContextValue>(
    () => ({
      code,
      phase,
      error,
      mock: isMockApi(),
      room,
      playback,
      participants,
      me,
      isHost: Boolean(me?.isHost),
      sessionToken,
      chat,
      reactions,
      connection,
      join,
      leave,
      sendChat,
      sendReaction,
      controlPlayback,
      setMedia,
      clearError: () => setError(null),
    }),
    [
      chat,
      code,
      connection,
      controlPlayback,
      error,
      join,
      leave,
      me,
      participants,
      phase,
      playback,
      reactions,
      room,
      sendChat,
      sendReaction,
      sessionToken,
      setMedia,
    ],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoom(): RoomContextValue {
  const value = useContext(RoomContext);
  if (!value) throw new Error("useRoom must be used within RoomProvider");
  return value;
}
