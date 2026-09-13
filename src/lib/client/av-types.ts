/** Minimal attach surface so UI never type-imports livekit-client. */
export type AttachableTrack = {
  attach(element: HTMLMediaElement): unknown;
  detach(element?: HTMLMediaElement): unknown;
};

export type RemoteFace = {
  identity: string;
  videoTrack: AttachableTrack | null;
  audioTrack: AttachableTrack | null;
  camEnabled: boolean;
  micEnabled: boolean;
  speaking: boolean;
};

export interface AvSession {
  connect(): Promise<void>;
  setCamera(enabled: boolean, deviceId?: string): Promise<MediaStream | null>;
  setMicrophone(enabled: boolean, deviceId?: string): Promise<void>;
  switchDevice(kind: "videoinput" | "audioinput", deviceId: string): Promise<void>;
  onRemote(handler: (faces: RemoteFace[]) => void): () => void;
  disconnect(): Promise<void>;
}
