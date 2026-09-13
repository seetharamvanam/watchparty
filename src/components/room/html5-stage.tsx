"use client";

import { useEffect } from "react";
import { estimatedPosition, isHlsUrl } from "@/lib/client/parse-media";
import { DRIFT_CORRECTION_MS } from "@/lib/constants";
import { applyHtml5 } from "@/components/room/player-sync";
import type { Html5StageProps } from "@/components/room/player-types";

export function Html5Stage({
  playback,
  isHost,
  applyingRef,
  lastAppliedRef,
  videoRef,
  onHostAction,
  onDuration,
  onPosition,
  onError,
}: Html5StageProps) {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playback.mediaUrl) return;
    const el = video;
    const src = playback.mediaUrl;
    let hls: { destroy(): void } | null = null;
    let cancelled = false;
    async function attach() {
      onError(null);
      if (isHlsUrl(src) && !el.canPlayType("application/vnd.apple.mpegurl")) {
        const Hls = (await import("hls.js")).default;
        if (cancelled) return;
        if (Hls.isSupported()) {
          const instance = new Hls();
          instance.loadSource(src);
          instance.attachMedia(el);
          hls = instance;
          return;
        }
      }
      el.src = src;
    }
    void attach();
    lastAppliedRef.current = "";
    return () => {
      cancelled = true;
      hls?.destroy();
    };
  }, [lastAppliedRef, onError, playback.mediaUrl, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    applyHtml5(video, playback, applyingRef, lastAppliedRef);
  }, [applyingRef, lastAppliedRef, playback, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const id = window.setInterval(() => {
      const local = video.currentTime * 1000;
      onPosition(local);
      if (video.duration && Number.isFinite(video.duration)) onDuration(video.duration * 1000);
      if (isHost) return;
      const expected = estimatedPosition(playback);
      if (Math.abs(local - expected) > DRIFT_CORRECTION_MS) {
        applyingRef.current = true;
        video.currentTime = expected / 1000;
        window.setTimeout(() => {
          applyingRef.current = false;
        }, 250);
      }
    }, 700);
    return () => window.clearInterval(id);
  }, [applyingRef, isHost, onDuration, onPosition, playback, videoRef]);

  return (
    <video
      ref={videoRef}
      className="absolute inset-0 h-full w-full bg-black object-contain"
      playsInline
      controls={false}
      onPlay={() => {
        if (!isHost || applyingRef.current || !videoRef.current) return;
        onHostAction("play", videoRef.current.currentTime * 1000);
      }}
      onPause={() => {
        if (!isHost || applyingRef.current || !videoRef.current) return;
        onHostAction("pause", videoRef.current.currentTime * 1000);
      }}
      onLoadedMetadata={() => {
        if (videoRef.current?.duration) onDuration(videoRef.current.duration * 1000);
      }}
      onError={() => onError("This video couldn’t be loaded. Check the URL or try another allowed link.")}
    />
  );
}

export default Html5Stage;
