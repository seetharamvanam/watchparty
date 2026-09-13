import type { YTPlayer } from "@/lib/client/youtube";
import type { PlaybackState } from "@/lib/types";
import type { MutableRefObject } from "react";

export type PlayerStageProps = {
  playback: PlaybackState;
  isHost: boolean;
  applyingRef: MutableRefObject<boolean>;
  lastAppliedRef: MutableRefObject<string>;
  onHostAction: (action: "play" | "pause" | "seek" | "rate", positionMs: number, rate?: number) => void;
  onDuration: (ms: number) => void;
  onPosition: (ms: number) => void;
  onError: (message: string | null) => void;
};

export type YouTubeStageProps = PlayerStageProps & {
  playerRef: MutableRefObject<YTPlayer | null>;
};

export type Html5StageProps = PlayerStageProps & {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
};
