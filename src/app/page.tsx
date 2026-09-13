export default function HomePage() {
  return (
    <main>
      <p>Watch together. Stay in sync.</p>
      <h1>Watch Party</h1>
      <p>
        Friends watch a movie or video at the same time and see and hear each other over
        camera and microphone. There are no accounts, no recordings, and the server never
        fetches or stores media bytes.
      </p>
      <section className="panel">
        <p>
          Join with a 6-character room code. Rooms hold at most 8 people and expire 24 hours
          after the last presence heartbeat.
        </p>
        <p>
          Hosts share a YouTube watch / youtu.be / embed URL or a direct HTTPS{" "}
          <code>.mp4</code>, <code>.webm</code>, or <code>.m3u8</code>. Clients load the
          media themselves. Playback sync uses Ably; live A/V uses LiveKit Cloud tokens
          minted by this API.
        </p>
        <p>Backend contract: <code>API.md</code> in the repository root.</p>
      </section>
    </main>
  );
}
