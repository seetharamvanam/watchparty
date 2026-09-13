"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/field";
import { getApi } from "@/lib/client";
import { errorMessage, isApiError } from "@/lib/client/errors";
import { LEGAL_COPY } from "@/lib/client/config";
import { writeSession } from "@/lib/client/session";

export function CreateParty() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [legal, setLegal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!legal) {
      setError("Confirm you are only pasting links you’re allowed to watch.");
      return;
    }
    setBusy(true);
    try {
      const session = await getApi().createRoom({
        displayName,
        title: title.trim() || undefined,
        mediaUrl: mediaUrl.trim() || undefined,
      });
      writeSession(session.room.code, {
        sessionToken: session.sessionToken,
        participant: session.participant,
        displayName: session.participant.displayName,
      });
      router.push(`/r/${session.room.code}`);
    } catch (err) {
      setError(isApiError(err) ? err.message : errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-5 rounded-3xl border border-subtle bg-surface/90 p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] backdrop-blur-md"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-warm">Host</p>
        <h2 className="mt-1 font-sans text-2xl tracking-tight text-primary">Start a party</h2>
        <p className="mt-2 text-sm text-muted">
          You hold the remote. Friends drop in with the code — faces stay on while the movie plays.
        </p>
      </div>

      <Field label="Your name" htmlFor="create-name">
        <TextInput
          id="create-name"
          name="displayName"
          autoComplete="nickname"
          required
          maxLength={32}
          placeholder="Jordan"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </Field>

      <Field label="Title (optional)" htmlFor="create-title" hint="Shown in the room header.">
        <TextInput
          id="create-title"
          name="title"
          maxLength={120}
          placeholder="Friday night: Heat"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>

      <Field
        label="Media URL (optional)"
        htmlFor="create-media"
        hint="HTTPS YouTube watch / youtu.be / embed, or a direct .mp4 / .webm / .m3u8."
      >
        <TextInput
          id="create-media"
          name="mediaUrl"
          type="url"
          inputMode="url"
          placeholder="https://www.youtube.com/watch?v=…"
          value={mediaUrl}
          onChange={(e) => setMediaUrl(e.target.value)}
        />
      </Field>

      <label className="flex items-start gap-3 rounded-2xl border border-warm/25 bg-warm/5 p-3 text-sm text-primary">
        <input
          type="checkbox"
          className="mt-0.5 h-4 w-4 accent-[#E8A87C]"
          checked={legal}
          onChange={(e) => setLegal(e.target.checked)}
        />
        <span>{LEGAL_COPY}</span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={busy}>
        {busy ? "Dimming the lights…" : "Create room"}
      </Button>
    </form>
  );
}
