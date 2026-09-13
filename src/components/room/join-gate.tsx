"use client";

import { useState, type FormEvent } from "react";
import { CinemaBackdrop } from "@/components/home/cinema-backdrop";
import { StatusScreen } from "@/components/room/status-screen";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { errorMessage, isApiError, type ClientErrorCode } from "@/lib/client/errors";
import { useRoom } from "@/lib/client/room-context";

export function JoinGate() {
  const { code, join } = useRoom();
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fatal, setFatal] = useState<ClientErrorCode | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await join(displayName);
    } catch (err) {
      if (
        isApiError(err) &&
        (err.code === "ROOM_FULL" || err.code === "ROOM_EXPIRED" || err.code === "ROOM_NOT_FOUND")
      ) {
        setFatal(err.code);
        return;
      }
      setError(isApiError(err) ? err.message : errorMessage(err));
      setBusy(false);
    }
  }

  if (fatal) return <StatusScreen code={fatal} tone="danger" />;

  return (
    <div className="relative flex min-h-dvh items-center justify-center px-6">
      <CinemaBackdrop />
      <form
        onSubmit={onSubmit}
        className="relative z-10 w-full max-w-md rounded-3xl border border-subtle bg-surface/90 p-6"
      >
        <p className="font-mono text-sm tracking-[0.28em] text-warm">{code}</p>
        <h1 className="mt-2 text-2xl tracking-tight text-primary">What’s your name?</h1>
        <p className="mt-2 text-sm text-muted">
          Cam and mic stay off until you turn them on. The host has the remote.
        </p>
        <div className="mt-5">
          <Field label="Display name" htmlFor="gate-name">
            <TextInput
              id="gate-name"
              required
              maxLength={32}
              autoFocus
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
        </div>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        ) : null}
        <Button type="submit" className="mt-5 w-full" disabled={busy}>
          {busy ? "Joining…" : "Enter the room"}
        </Button>
      </form>
    </div>
  );
}
