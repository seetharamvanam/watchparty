"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/client/cn";
import { REACTION_EMOJIS } from "@/lib/client/config";
import { useRoom } from "@/lib/client/room-context";

export function ChatRail({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { chat, me, sendChat, sendReaction } = useRoom();
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.length]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!draft.trim()) return;
    setBusy(true);
    try {
      await sendChat(draft);
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside
      className={cn(
        "flex w-full flex-col border-subtle bg-surface md:w-80 md:border-l",
        "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-30 max-md:h-[70vh] max-md:rounded-t-3xl max-md:border-t max-md:shadow-[0_-20px_60px_rgba(0,0,0,0.45)]",
        "max-md:transition-transform max-md:duration-200",
        mobileOpen ? "max-md:translate-y-0" : "max-md:pointer-events-none max-md:translate-y-full",
      )}
      aria-label="Room chat"
    >
      <div className="flex items-center justify-between border-b border-subtle px-4 py-3">
        <h2 className="text-sm font-medium text-primary">Chat</h2>
        <Button size="sm" variant="ghost" className="md:hidden" onClick={onClose}>
          Close
        </Button>
      </div>
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-live="polite">
        {chat.length === 0 ? (
          <p className="text-sm text-muted">Keep it light. The movie is the main event.</p>
        ) : (
          chat.map((message) => (
            <article key={message.id} className="text-sm">
              <p className="text-xs text-muted">
                {message.participantId === me?.id ? "You" : message.displayName}
              </p>
              <p className="text-primary">{message.body}</p>
            </article>
          ))
        )}
      </div>
      <div className="border-t border-subtle px-3 py-2">
        <div className="mb-2 flex flex-wrap gap-1" aria-label="Reactions">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="grid h-9 w-9 place-items-center rounded-lg text-lg transition-transform duration-150 hover:scale-110 hover:bg-elevated"
              onClick={() => void sendReaction(emoji)}
              aria-label={`React ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit} className="flex gap-2">
          <label className="sr-only" htmlFor="chat-draft">
            Message
          </label>
          <input
            id="chat-draft"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={2000}
            placeholder="Say something short"
            className="h-10 flex-1 rounded-xl border border-subtle bg-void px-3 text-sm text-primary placeholder:text-muted/70 focus:border-warm/60 focus:outline-none focus:ring-2 focus:ring-warm/30"
          />
          <Button type="submit" size="sm" disabled={busy || !draft.trim()}>
            Send
          </Button>
        </form>
      </div>
    </aside>
  );
}
