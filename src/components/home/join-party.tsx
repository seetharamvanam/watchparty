"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { getApi } from "@/lib/client";
import { errorMessage, isApiError } from "@/lib/client/errors";
import { ROOM_CODE_LENGTH } from "@/lib/constants";
import { isRoomCodeFormat, normalizeRoomCode } from "@/lib/client/room-code";
import { writeSession } from "@/lib/client/session";

export function JoinParty({ initialCode = "" }: { initialCode?: string }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [code, setCode] = useState(normalizeRoomCode(initialCode).slice(0, ROOM_CODE_LENGTH));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const normalized = normalizeRoomCode(code);
    if (!isRoomCodeFormat(normalized)) {
      setError("Enter the 6-character code. It never uses 0, O, 1, or I.");
      return;
    }
    setBusy(true);
    try {
      const session = await getApi().joinRoom({ code: normalized, displayName });
      writeSession(session.room.code, {
        sessionToken: session.sessionToken,
        participant: session.participant,
        displayName: session.participant.displayName,
      });
      router.push(`/r/${session.room.code}`);
    } catch (err) {
      if (isApiError(err) && (err.code === "ROOM_FULL" || err.code === "ROOM_EXPIRED" || err.code === "ROOM_NOT_FOUND")) {
        router.push(`/r/${normalized}?e=${err.code}`);
        return;
      }
      setError(isApiError(err) ? err.message : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5 rounded-3xl border border-subtle bg-surface/80 p-6 backdrop-blur-md"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">Guest</p>
        <h2 className="mt-1 font-sans text-2xl tracking-tight text-primary">Join a room</h2>
        <p className="mt-2 text-sm text-muted">
          Bring your face. The host has the remote — you just settle in.
        </p>
      </div>

      <Field label="Your name" htmlFor="join-name">
        <TextInput
          id="join-name"
          name="displayName"
          autoComplete="nickname"
          required
          maxLength={32}
          placeholder="Sam"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </Field>

      <Field label="Room code" htmlFor="join-code" hint="Six characters. No 0, O, 1, or I.">
        <TextInput
          id="join-code"
          name="code"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          required
          maxLength={ROOM_CODE_LENGTH}
          placeholder="K7M2QX"
          value={code}
          onChange={(e) => setCode(normalizeRoomCode(e.target.value).slice(0, ROOM_CODE_LENGTH))}
          className="font-mono text-lg tracking-[0.35em] uppercase"
        />
      </Field>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" variant="secondary" disabled={busy}>
        {busy ? "Finding the couch…" : "Join party"}
      </Button>
    </form>
  );
}
