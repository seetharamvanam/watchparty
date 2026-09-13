"use client";

import dynamic from "next/dynamic";
import { useCallback, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { errorMessage, isApiError } from "@/lib/client/errors";
import { estimatedPosition, formatClock } from "@/lib/client/parse-media";
import { useRoom } from "@/lib/client/room-context";
import type { YTPlayer } from "@/lib/client/youtube";
import type { PlaybackState } from "@/lib/types";

const StageFallback = () => <div className="absolute inset-0 animate-pulse bg-black" aria-hidden />;

const YouTubeStage = dynamic(() => import("@/components/room/youtube-stage"), {
  ssr: false,
  loading: StageFallback,
});

const Html5Stage = dynamic(() => import("@/components/room/html5-stage"), {
  ssr: false,
  loading: StageFallback,
});

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

export default SyncedPlayer;
