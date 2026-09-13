import { CinemaBackdrop } from "@/components/home/cinema-backdrop";
import { CreateParty } from "@/components/home/create-party";
import { JoinParty } from "@/components/home/join-party";
import { isMockApi } from "@/lib/client/config";

export default function HomePage() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <CinemaBackdrop />
      <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-5xl flex-col justify-center px-5 py-16">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-warm">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-live" />
          </span>
          Live together
        </p>
        <h1 className="mt-3 max-w-xl text-4xl leading-tight tracking-tight text-primary sm:text-5xl">
          Watch the movie.
          <span className="block text-warm">Keep the faces.</span>
        </h1>
        <p className="mt-4 max-w-lg text-base leading-7 text-muted">
          A living-room night in the browser. Playback stays in sync. Cameras stay on the couch —
          not buried behind a chat thread.
        </p>
        {isMockApi() ? (
          <p className="mt-3 text-xs text-muted">
            Mock API is on — local/dev only. Open a second tab to join your own room.
          </p>
        ) : null}
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          <CreateParty />
          <JoinParty />
        </div>
      </main>
    </div>
  );
}
