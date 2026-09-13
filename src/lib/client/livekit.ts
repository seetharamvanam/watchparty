import type { AvSession, AttachableTrack, RemoteFace } from "@/lib/client/av-types";
import type { AvTokenPayload } from "@/lib/types";

export type { AttachableTrack, AvSession, RemoteFace } from "@/lib/client/av-types";

export async function connectLiveKit(creds: AvTokenPayload): Promise<AvSession> {
  const {
    Room,
    RoomEvent,
    Track,
    createLocalVideoTrack,
    createLocalAudioTrack,
  } = await import("livekit-client");

  const room = new Room({ adaptiveStream: true, dynacast: true });
  let videoTrack: Awaited<ReturnType<typeof createLocalVideoTrack>> | null = null;
  let audioTrack: Awaited<ReturnType<typeof createLocalAudioTrack>> | null = null;
  const listeners = new Set<(faces: RemoteFace[]) => void>();
  const speakerListeners = new Set<(identities: string[]) => void>();
  let speaking = new Set<string>();

  const emitRemote = () => {
    const faces: RemoteFace[] = [];
    room.remoteParticipants.forEach((participant) => {
      const cameraPubs = [...participant.videoTrackPublications.values()].filter(
        (publication) => publication.source === Track.Source.Camera || publication.kind === Track.Kind.Video,
      );
      const micPubs = [...participant.audioTrackPublications.values()].filter(
        (publication) => publication.source === Track.Source.Microphone || publication.kind === Track.Kind.Audio,
      );
      const camera = cameraPubs.find((publication) => publication.track) ?? cameraPubs[0];
      const mic = micPubs.find((publication) => publication.track) ?? micPubs[0];
      faces.push({
        identity: participant.identity,
        videoTrack: (camera?.track as AttachableTrack | undefined) ?? null,
        audioTrack: (mic?.track as AttachableTrack | undefined) ?? null,
        camEnabled: Boolean(camera?.track && !camera.isMuted),
        micEnabled: Boolean(mic?.track && !mic.isMuted),
        speaking: speaking.has(participant.identity),
      });
    });
    for (const listener of listeners) listener(faces);
  };

  room.on(RoomEvent.TrackSubscribed, emitRemote);
  room.on(RoomEvent.TrackUnsubscribed, emitRemote);
  room.on(RoomEvent.TrackMuted, emitRemote);
  room.on(RoomEvent.TrackUnmuted, emitRemote);
  room.on(RoomEvent.ParticipantConnected, emitRemote);
  room.on(RoomEvent.ParticipantDisconnected, emitRemote);
  const emitSpeakers = (identities: string[]) => {
    speaking = new Set(identities);
    emitRemote();
    for (const listener of speakerListeners) listener(identities);
  };

  room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
    emitSpeakers(speakers.map((speaker) => speaker.identity));
  });

  return {
    async connect() {
      await room.connect(creds.url, creds.token);
      emitRemote();
    },
    async setCamera(enabled, deviceId) {
      if (!enabled) {
        if (videoTrack) {
          await room.localParticipant.unpublishTrack(videoTrack);
          videoTrack.stop();
          videoTrack = null;
        }
        return null;
      }
      videoTrack = await createLocalVideoTrack({ deviceId, facingMode: "user" });
      await room.localParticipant.publishTrack(videoTrack);
      return new MediaStream([videoTrack.mediaStreamTrack]);
    },
    async setMicrophone(enabled, deviceId) {
      if (!enabled) {
        if (audioTrack) {
          await room.localParticipant.unpublishTrack(audioTrack);
          audioTrack.stop();
          audioTrack = null;
        }
        return;
      }
      audioTrack = await createLocalAudioTrack({ deviceId });
      await room.localParticipant.publishTrack(audioTrack);
    },
    async switchDevice(kind, deviceId) {
      if (kind === "videoinput" && videoTrack) await videoTrack.restartTrack({ deviceId });
      if (kind === "audioinput" && audioTrack) await audioTrack.restartTrack({ deviceId });
    },
    onRemote(handler) {
      listeners.add(handler);
      emitRemote();
      return () => {
        listeners.delete(handler);
      };
    },
    onSpeakers(handler) {
      speakerListeners.add(handler);
      handler([...speaking]);
      return () => {
        speakerListeners.delete(handler);
      };
    },
    async disconnect() {
      videoTrack?.stop();
      audioTrack?.stop();
      await room.disconnect();
    },
  };
}
