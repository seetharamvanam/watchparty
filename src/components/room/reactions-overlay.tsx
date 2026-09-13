"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/lib/client/room-context";

function driftX(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash + id.charCodeAt(i) * 7) % 64;
  return 18 + hash;
}

export function ReactionsOverlay() {
  const { reactions } = useRoom();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const visible = reactions.filter((reaction) => now - new Date(reaction.createdAt).getTime() < 1800);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-16 top-8 overflow-hidden" aria-hidden>
      {visible.map((floater) => {
        const key = `${floater.createdAt}-${floater.participantId}-${floater.emoji}`;
        return (
          <span
            key={key}
            className="absolute bottom-0 animate-[floatUp_1.7s_ease-out_forwards] text-3xl"
            style={{ left: `${driftX(key)}%` }}
          >
            {floater.emoji}
          </span>
        );
      })}
    </div>
  );
}
