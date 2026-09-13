"use client";

import { useEffect, useRef } from "react";
import { ApiError } from "@/lib/client/errors";
import { estimatedPosition, youtubeIdFromUrl } from "@/lib/client/parse-media";
import { loadYouTubeApi } from "@/lib/client/youtube";
import { SYNC_DRIFT_MS } from "@/lib/constants";
import { shouldCorrectDrift } from "@/lib/sync-rules";
import { applyYoutube } from "@/components/room/player-sync";
import type { YouTubeStageProps } from "@/components/room/player-types";

export function YouTubeStage({
  playback,
  isHost,
  applyingRef,
  lastAppliedRef,
  playerRef,
  onHostAction,
  onDuration,
  onPosition,
  onError,
}: YouTubeStageProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const videoId = playback.mediaUrl ? youtubeIdFromUrl(playback.mediaUrl) : null;
    if (!videoId || !mountRef.current) return;
    let cancelled = false;
    loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !mountRef.current) return;
        playerRef.current?.destroy();
        playerRef.current = new YT.Player(mountRef.current, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: { controls: 0, rel: 0, modestbranding: 1, playsinline: 1, origin: window.location.origin },
          events: {
            onReady: () => {
              lastAppliedRef.current = "";
              applyYoutube(playerRef.current, playback, applyingRef, lastAppliedRef);
              onDuration((playerRef.current?.getDuration() ?? 0) * 1000);
            },
            onStateChange: (event) => {
              onDuration((event.target.getDuration() ?? 0) * 1000);
              if (!isHost || applyingRef.current) return;
              const positionMs = event.target.getCurrentTime() * 1000;
              if (event.data === YT.PlayerState.PLAYING) onHostAction("play", positionMs);
              if (event.data === YT.PlayerState.PAUSED) onHostAction("pause", positionMs);
            },
            onError: (event) => {
              if (event.data === 101 || event.data === 150) {
                onError(new ApiError("YOUTUBE_NOT_EMBEDDABLE", "YouTube won’t embed this video.").message);
              } else {
                onError("This YouTube video couldn’t be played.");
              }
            },
          },
        });
      })
      .catch(() => onError("Could not load the YouTube player."));
    return () => {
      cancelled = true;
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // Player is rebuilt only when the queued URL changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playback.mediaUrl]);

  useEffect(() => {
    applyYoutube(playerRef.current, playback, applyingRef, lastAppliedRef);
  }, [applyingRef, lastAppliedRef, playback, playerRef]);

  useEffect(() => {
    const id = window.setInterval(() => {
      const player = playerRef.current;
      if (!player) return;
      const local = player.getCurrentTime() * 1000;
      onPosition(local);
      onDuration((player.getDuration() ?? 0) * 1000);
      if (isHost) return;
      const expected = estimatedPosition(playback);
      if (shouldCorrectDrift(local, expected, SYNC_DRIFT_MS)) {
        applyingRef.current = true;
        player.seekTo(expected / 1000, true);
        window.setTimeout(() => {
          applyingRef.current = false;
        }, 250);
      }
    }, 700);
    return () => window.clearInterval(id);
  }, [applyingRef, isHost, onDuration, onPosition, playback, playerRef]);

  return <div ref={mountRef} className="absolute inset-0 h-full w-full" />;
}

export default YouTubeStage;
