"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { getApi } from "@/lib/client";
import { avatarColorFor, initialsFor } from "@/lib/client/avatar";
import { cn } from "@/lib/client/cn";
import { isMockApi } from "@/lib/client/config";
import { connectLiveKit, type AvSession, type RemoteFace } from "@/lib/client/livekit";
import { useMediaDevices } from "@/lib/client/use-media-devices";
import { useRoom } from "@/lib/client/room-context";
import type { ParticipantPublic } from "@/lib/types";
import type { RemoteTrack } from "livekit-client";

export function FaceStrip() {
  const { participants, me, sessionToken, code } = useRoom();
  const devices = useMediaDevices();
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [denied, setDenied] = useState<{ cam?: boolean; mic?: boolean }>({});
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteFaces, setRemoteFaces] = useState<RemoteFace[]>([]);
  const [avUnavailable, setAvUnavailable] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [headphonesDismissed, setHeadphonesDismissed] = useState(false);
  const avRef = useRef<AvSession | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    if (!sessionToken || isMockApi()) return;
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const creds = await getApi().getAvToken(code, sessionToken);
        if (!creds.token || !creds.url || creds.url.startsWith("mock:")) {
          if (!cancelled) setAvUnavailable(true);
          return;
        }
        const session = await connectLiveKit(creds);
        await session.connect();
        if (cancelled) {
          await session.disconnect();
          return;
        }
        avRef.current = session;
        unsubscribe = session.onRemote((faces) => setRemoteFaces(faces));
      } catch {
        if (!cancelled) setAvUnavailable(true);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
      void avRef.current?.disconnect();
      avRef.current = null;
    };
  }, [code, sessionToken]);

  useEffect(() => {
    return () => {
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function toggleCam() {
    if (camOn) {
      localStream?.getVideoTracks().forEach((track) => track.stop());
      setLocalStream((current) => {
        current?.getVideoTracks().forEach((track) => current.removeTrack(track));
        return current && current.getTracks().length ? current : null;
      });
      await avRef.current?.setCamera(false);
      setCamOn(false);
      return;
    }
    try {
      await devices.refresh();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: devices.cameraId ? { deviceId: { exact: devices.cameraId } } : true,
        audio: false,
      });
      setDenied((d) => ({ ...d, cam: false }));
      setLocalStream((current) => {
        current?.getVideoTracks().forEach((track) => track.stop());
        const next = current ?? new MediaStream();
        stream.getVideoTracks().forEach((track) => next.addTrack(track));
        return next;
      });
      await avRef.current?.setCamera(true, devices.cameraId || undefined);
      setCamOn(true);
    } catch (err) {
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        setDenied((d) => ({ ...d, cam: true }));
        setCamOn(false);
        return;
      }
      setAvUnavailable(true);
    }
  }

  async function toggleMic() {
    if (micOn) {
      localStream?.getAudioTracks().forEach((track) => track.stop());
      await avRef.current?.setMicrophone(false);
      setMicOn(false);
      return;
    }
    try {
      await devices.refresh();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: devices.micId ? { deviceId: { exact: devices.micId } } : true,
        video: false,
      });
      setDenied((d) => ({ ...d, mic: false }));
      setLocalStream((current) => {
        const next = current ?? new MediaStream();
        stream.getAudioTracks().forEach((track) => next.addTrack(track));
        return next;
      });
      await avRef.current?.setMicrophone(true, devices.micId || undefined);
      setMicOn(true);
    } catch (err) {
      if (err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
        setDenied((d) => ({ ...d, mic: true }));
        setMicOn(false);
        return;
      }
      setAvUnavailable(true);
    }
  }

  const remoteById = new Map(remoteFaces.map((face) => [face.identity, face]));

  return (
    <section aria-label="People in this room" className="shrink-0 border-t border-subtle bg-surface">
      {avUnavailable ? (
        <div role="status" className="bg-elevated px-4 py-2 text-center text-sm text-muted">
          Camera & mic unavailable. You can still watch — faces show as avatars.
        </div>
      ) : null}
      {micOn && !headphonesDismissed ? (
        <div className="flex items-center justify-between gap-3 border-b border-subtle px-4 py-2 text-sm text-muted">
          <p>Headphones recommended so others don’t hear the movie through your mic.</p>
          <Button size="sm" variant="ghost" onClick={() => setHeadphonesDismissed(true)}>
            Got it
          </Button>
        </div>
      ) : null}

      <div className="flex items-stretch gap-3 overflow-x-auto px-3 py-3">
        {participants.map((person) => {
          const remote = remoteById.get(person.id);
          const isSelf = person.id === me?.id;
          return (
            <FaceTile
              key={person.id}
              person={person}
              isSelf={isSelf}
              localStream={isSelf ? localStream : null}
              remote={isSelf ? undefined : remote}
              camForcedOff={isSelf && (!camOn || Boolean(denied.cam))}
              permissionDenied={isSelf && Boolean(denied.cam)}
              localMicOn={isSelf ? micOn : Boolean(remote?.micEnabled)}
              speaking={Boolean(remote?.speaking)}
            />
          );
        })}
        {participants.length === 0 ? (
          <p className="px-2 py-6 text-sm text-muted">Waiting for people to sit down…</p>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2 pl-2">
          <ToggleChip pressed={camOn} onClick={() => void toggleCam()} activeLabel="Camera on" inactiveLabel="Camera off" />
          <ToggleChip pressed={micOn} onClick={() => void toggleMic()} activeLabel="Mic on" inactiveLabel="Mic off" />
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setPickerOpen((v) => !v);
              void devices.refresh();
            }}
            aria-expanded={pickerOpen}
          >
            Devices
          </Button>
        </div>
      </div>

      {denied.cam || denied.mic ? (
        <p className="px-4 pb-3 text-xs text-muted">
          Permission denied — you still appear as an avatar{denied.mic ? ", and your mic stays off" : ""}.
        </p>
      ) : null}

      {pickerOpen ? (
        <div className="grid gap-3 border-t border-subtle px-4 py-3 sm:grid-cols-2">
          <label className="text-sm text-muted">
            Camera
            <select
              className="mt-1 h-10 w-full rounded-lg border border-subtle bg-elevated px-2 text-sm text-primary"
              value={devices.cameraId}
              onChange={(e) => devices.setCameraId(e.target.value)}
            >
              {devices.cameras.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm text-muted">
            Microphone
            <select
              className="mt-1 h-10 w-full rounded-lg border border-subtle bg-elevated px-2 text-sm text-primary"
              value={devices.micId}
              onChange={(e) => devices.setMicId(e.target.value)}
            >
              {devices.mics.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
    </section>
  );
}

function ToggleChip({
  pressed,
  onClick,
  activeLabel,
  inactiveLabel,
}: {
  pressed: boolean;
  onClick: () => void;
  activeLabel: string;
  inactiveLabel: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        "h-10 rounded-full border px-3 text-xs font-medium transition-colors duration-200",
        pressed
          ? "border-success/40 bg-success/15 text-success"
          : "border-subtle bg-elevated text-muted hover:text-primary",
      )}
    >
      {pressed ? activeLabel : inactiveLabel}
    </button>
  );
}

function FaceTile({
  person,
  isSelf,
  localStream,
  remote,
  camForcedOff,
  permissionDenied,
  localMicOn,
  speaking,
}: {
  person: ParticipantPublic;
  isSelf: boolean;
  localStream: MediaStream | null;
  remote?: RemoteFace;
  camForcedOff: boolean;
  permissionDenied: boolean;
  localMicOn: boolean;
  speaking: boolean;
}) {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const showLocal = isSelf && Boolean(localStream?.getVideoTracks().length) && !camForcedOff;
  const showRemote = Boolean(remote?.videoTrack && remote.camEnabled);

  useEffect(() => {
    if (!localVideoRef.current) return;
    localVideoRef.current.srcObject = showLocal ? localStream : null;
  }, [showLocal, localStream]);

  return (
    <figure className="w-[88px] shrink-0 sm:w-[104px]">
      <div
        className={cn(
          "relative aspect-[3/4] overflow-hidden rounded-2xl border border-subtle bg-elevated",
          person.isHost && "ring-1 ring-warm/70",
          speaking && "ring-2 ring-live",
        )}
      >
        {showLocal ? (
          <video ref={localVideoRef} className="h-full w-full object-cover" autoPlay muted playsInline />
        ) : showRemote && remote?.videoTrack ? (
          <RemoteMedia track={remote.videoTrack} kind="video" />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center text-lg font-semibold text-void"
            style={{ background: avatarColorFor(person.id) }}
            aria-hidden
          >
            {initialsFor(person.displayName)}
          </div>
        )}
        {remote?.audioTrack ? <RemoteMedia track={remote.audioTrack} kind="audio" /> : null}
        {localMicOn ? (
          <span className="absolute left-1.5 top-1.5 h-2 w-2 rounded-full bg-live shadow-[0_0_8px_#FF5C5C]" title="Mic on" />
        ) : (
          <span className="absolute left-1.5 top-1.5 text-[10px] text-primary/80" title="Mic off">
            🔇
          </span>
        )}
        {permissionDenied ? (
          <span className="absolute inset-x-1 bottom-1 rounded bg-void/70 px-1 text-[10px] text-muted">
            Cam blocked
          </span>
        ) : null}
      </div>
      <figcaption className="mt-1 truncate text-center text-xs text-muted">
        {person.displayName}
        {isSelf ? " · you" : ""}
        {person.isHost ? " · host" : ""}
      </figcaption>
    </figure>
  );
}

function RemoteMedia({ track, kind }: { track: RemoteTrack; kind: "video" | "audio" }) {
  const ref = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    track.attach(el);
    return () => {
      track.detach(el);
    };
  }, [track]);

  if (kind === "audio") {
    return <audio ref={ref as RefObject<HTMLAudioElement>} autoPlay />;
  }
  return (
    <video
      ref={ref as RefObject<HTMLVideoElement>}
      className="h-full w-full object-cover"
      autoPlay
      playsInline
    />
  );
}
