"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type MutableRefObject } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { ApiError, errorMessage, isApiError } from "@/lib/client/errors";
import { estimatedPosition, formatClock, isHlsUrl, youtubeIdFromUrl } from "@/lib/client/parse-media";
import { DRIFT_CORRECTION_MS } from "@/lib/constants";
import { useRoom } from "@/lib/client/room-context";
import { loadYouTubeApi, type YTPlayer } from "@/lib/client/youtube";
import type { PlaybackState } from "@/lib/types";

export function SyncedPlayer() {
  const { playback, isHost, controlPlayback, setMedia } = useRoom();
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const [localMs, setLocalMs] = useState(0);
  const [showLockTip, setShowLockTip] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const applyingRef = useRef(false);
  const lastAppliedRef = useRef("");
  const ytRef = useRef<YTPlayer | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const punchLocal = useCallback(
    (action: "play" | "pause" | "seek" | "rate", positionMs: number, playbackRate?: number) => {
      applyingRef.current = true;
      const yt = ytRef.current;
      const video = videoRef.current;
      if (yt) {
        if (action === "play") yt.playVideo();
        if (action === "pause") yt.pauseVideo();
        if (action === "seek") yt.seekTo(positionMs / 1000, true);
        if (action === "rate" && playbackRate) yt.setPlaybackRate(playbackRate);
      }
      if (video) {
        if (action === "play") void video.play();
        if (action === "pause") video.pause();
        if (action === "seek") video.currentTime = positionMs / 1000;
        if (action === "rate" && playbackRate) video.playbackRate = playbackRate;
      }
      window.setTimeout(() => {
        applyingRef.current = false;
      }, 280);
    },
    [],
  );

  const onHostAction = useCallback(
    async (action: "play" | "pause" | "seek" | "rate", positionMs: number, playbackRate?: number) => {
      if (!isHost) return;
      punchLocal(action, positionMs, playbackRate);
      try {
        await controlPlayback({ action, positionMs, playbackRate });
      } catch (err) {
        setMediaError(isApiError(err) ? err.message : errorMessage(err));
      }
    },
    [controlPlayback, isHost, punchLocal],
  );

  async function onQueue(event: FormEvent) {
    event.preventDefault();
    setMediaError(null);
    try {
      await setMedia(urlDraft);
      setUrlDraft("");
    } catch (err) {
      setMediaError(isApiError(err) ? err.message : errorMessage(err));
    }
  }

  if (!playback.mediaUrl || !playback.mediaType) {
    return (
      <div className="relative flex h-full min-h-[240px] flex-col items-center justify-center bg-[radial-gradient(ellipse_at_center,rgba(232,168,124,0.08),transparent_55%)] px-6">
        <p className="text-xs uppercase tracking-[0.2em] text-warm">Waiting room</p>
        <h2 className="mt-2 max-w-md text-center text-2xl tracking-tight text-primary">
          Lights are low. Nothing’s queued yet.
        </h2>
        <p className="mt-2 max-w-sm text-center text-sm text-muted">
          {isHost
            ? "Paste an HTTPS YouTube watch / youtu.be / embed link, or a direct .mp4 / .webm / .m3u8."
            : "Hang tight — the host is picking something to watch."}
        </p>
        {isHost ? (
          <form onSubmit={onQueue} className="mt-6 w-full max-w-md">
            <Field label="Media URL" htmlFor="queue-url">
              <TextInput
                id="queue-url"
                type="url"
                required
                placeholder="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
              />
            </Field>
            {mediaError ? (
              <p role="alert" className="mt-2 text-sm text-danger">
                {mediaError}
              </p>
            ) : null}
            <Button type="submit" className="mt-3 w-full">
              Queue it
            </Button>
          </form>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-[240px] flex-col bg-void">
      <div className="relative aspect-video w-full overflow-hidden bg-black md:aspect-auto md:flex-1">
        {playback.mediaType === "youtube" ? (
          <YouTubeStage
            playback={playback}
            isHost={isHost}
            applyingRef={applyingRef}
            lastAppliedRef={lastAppliedRef}
            playerRef={ytRef}
            onHostAction={onHostAction}
            onDuration={setDurationMs}
            onPosition={setLocalMs}
            onError={setMediaError}
          />
        ) : (
          <Html5Stage
            playback={playback}
            isHost={isHost}
            applyingRef={applyingRef}
            lastAppliedRef={lastAppliedRef}
            videoRef={videoRef}
            onHostAction={onHostAction}
            onDuration={setDurationMs}
            onPosition={setLocalMs}
            onError={setMediaError}
          />
        )}
        {!isHost ? (
          <button
            type="button"
            className="absolute inset-0 z-10 cursor-not-allowed"
            aria-label="Only the host can control playback"
            onClick={() => {
              setShowLockTip(true);
              window.setTimeout(() => setShowLockTip(false), 1800);
            }}
          />
        ) : null}
        {showLockTip ? (
          <div
            role="tooltip"
            className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-xl border border-subtle bg-elevated px-3 py-2 text-sm text-primary shadow-lg"
          >
            Only the host can control playback
          </div>
        ) : null}
        {mediaError ? (
          <div className="absolute inset-x-4 bottom-16 z-20 rounded-xl border border-danger/40 bg-surface/95 px-4 py-3 text-sm text-danger">
            {mediaError}
          </div>
        ) : null}
      </div>
      {isHost ? (
        <HostControls
          playback={playback}
          localMs={localMs}
          durationMs={durationMs}
          onHostAction={onHostAction}
          onChangeMedia={setMedia}
        />
      ) : (
        <div className="flex h-12 items-center justify-between border-t border-subtle bg-surface px-4 text-xs text-muted">
          <span>Synced to host · {formatClock(estimatedPosition(playback))}</span>
          <span>{playback.playbackRate}×</span>
        </div>
      )}
    </div>
  );
}

function HostControls({
  playback,
  localMs,
  durationMs,
  onHostAction,
  onChangeMedia,
}: {
  playback: PlaybackState;
  localMs: number;
  durationMs: number;
  onHostAction: (action: "play" | "pause" | "seek" | "rate", positionMs: number, rate?: number) => void;
  onChangeMedia: (url: string) => Promise<void>;
}) {
  const [openSwap, setOpenSwap] = useState(false);
  const [nextUrl, setNextUrl] = useState("");
  const playing = playback.status === "playing";
  const max = Math.max(durationMs, localMs, 1);

  return (
    <div className="border-t border-subtle bg-surface px-3 py-2">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="secondary" onClick={() => onHostAction(playing ? "pause" : "play", localMs)}>
          {playing ? "Pause" : "Play"}
        </Button>
        <label className="sr-only" htmlFor="seek">
          Timeline
        </label>
        <input
          id="seek"
          type="range"
          min={0}
          max={max}
          value={Math.min(localMs, max)}
          onChange={(e) => onHostAction("seek", Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-elevated accent-[#E8A87C]"
        />
        <span className="min-w-[4.5rem] text-right font-mono text-xs text-muted">{formatClock(localMs)}</span>
        <label className="sr-only" htmlFor="rate">
          Playback speed
        </label>
        <select
          id="rate"
          value={playback.playbackRate}
          onChange={(e) => onHostAction("rate", localMs, Number(e.target.value))}
          className="h-9 rounded-lg border border-subtle bg-elevated px-2 text-xs text-primary"
        >
          {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
            <option key={rate} value={rate}>
              {rate}×
            </option>
          ))}
        </select>
        <Button size="sm" variant="ghost" onClick={() => setOpenSwap((v) => !v)}>
          Change
        </Button>
      </div>
      {openSwap ? (
        <form
          className="mt-2 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            await onChangeMedia(nextUrl);
            setNextUrl("");
            setOpenSwap(false);
          }}
        >
          <TextInput required type="url" placeholder="New allowed media URL" value={nextUrl} onChange={(e) => setNextUrl(e.target.value)} />
          <Button type="submit" size="sm">
            Swap
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function signature(playback: PlaybackState): string {
  return `${playback.mediaUrl}|${playback.status}|${Math.round(playback.positionMs / 250)}|${playback.playbackRate}|${playback.updatedAt}`;
}

function YouTubeStage({
  playback,
  isHost,
  applyingRef,
  lastAppliedRef,
  playerRef,
  onHostAction,
  onDuration,
  onPosition,
  onError,
}: {
  playback: PlaybackState;
  isHost: boolean;
  applyingRef: MutableRefObject<boolean>;
  lastAppliedRef: MutableRefObject<string>;
  playerRef: MutableRefObject<YTPlayer | null>;
  onHostAction: (action: "play" | "pause" | "seek" | "rate", positionMs: number, rate?: number) => void;
  onDuration: (ms: number) => void;
  onPosition: (ms: number) => void;
  onError: (message: string | null) => void;
}) {
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
      if (Math.abs(local - expected) > DRIFT_CORRECTION_MS) {
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

function Html5Stage({
  playback,
  isHost,
  applyingRef,
  lastAppliedRef,
  videoRef,
  onHostAction,
  onDuration,
  onPosition,
  onError,
}: {
  playback: PlaybackState;
  isHost: boolean;
  applyingRef: MutableRefObject<boolean>;
  lastAppliedRef: MutableRefObject<string>;
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  onHostAction: (action: "play" | "pause" | "seek" | "rate", positionMs: number, rate?: number) => void;
  onDuration: (ms: number) => void;
  onPosition: (ms: number) => void;
  onError: (message: string | null) => void;
}) {
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

function applyYoutube(
  player: YTPlayer | null,
  playback: PlaybackState,
  applyingRef: MutableRefObject<boolean>,
  lastAppliedRef: MutableRefObject<string>,
) {
  if (!player) return;
  const key = signature(playback);
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

function applyHtml5(
  video: HTMLVideoElement,
  playback: PlaybackState,
  applyingRef: MutableRefObject<boolean>,
  lastAppliedRef: MutableRefObject<string>,
) {
  const key = signature(playback);
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
