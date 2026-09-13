import { estimatedPosition } from "@/lib/client/parse-media";
import type { YTPlayer } from "@/lib/client/youtube";
import type { PlaybackState } from "@/lib/types";
import type { MutableRefObject } from "react";

export function playbackSignature(playback: PlaybackState): string {
  return `${playback.mediaUrl}|${playback.status}|${Math.round(playback.positionMs / 250)}|${playback.playbackRate}|${playback.updatedAt}`;
}

export function applyYoutube(
  player: YTPlayer | null,
  playback: PlaybackState,
  applyingRef: MutableRefObject<boolean>,
  lastAppliedRef: MutableRefObject<string>,
) {
  if (!player) return;
  const key = playbackSignature(playback);
  if (lastAppliedRef.current === key) return;
  lastAppliedRef.current = key;
  applyingRef.current = true;
  player.setPlaybackRate(playback.playbackRate);
  player.seekTo(estimatedPosition(playback) / 1000, true);
  if (playback.status === "playing") player.playVideo();
  else player.pauseVideo();
  window.setTimeout(() => {
    applyingRef.current = false;
  }, 280);
}

export function applyHtml5(
  video: HTMLVideoElement,
  playback: PlaybackState,
  applyingRef: MutableRefObject<boolean>,
  lastAppliedRef: MutableRefObject<string>,
) {
  const key = playbackSignature(playback);
  if (lastAppliedRef.current === key) return;
  lastAppliedRef.current = key;
  applyingRef.current = true;
  video.playbackRate = playback.playbackRate;
  video.currentTime = estimatedPosition(playback) / 1000;
  const play = playback.status === "playing" ? video.play() : Promise.resolve(video.pause());
  void Promise.resolve(play).finally(() => {
    window.setTimeout(() => {
      applyingRef.current = false;
    }, 280);
  });
}
