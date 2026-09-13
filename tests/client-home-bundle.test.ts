import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, ".next/app-build-manifest.json");
const BUILD_ID = path.join(ROOT, ".next/BUILD_ID");
const NEXT_CONFIG = path.join(ROOT, "next.config.ts");

const SDK_CHUNK_NAME = /sdk-(ably|livekit-client|hlsjs)/;
const SDK_IMPLEMENTATION = [
  /new Ably\.Realtime/,
  /createLocalVideoTrack/,
  /createLocalAudioTrack/,
  /RoomEvent\.ActiveSpeakersChanged/,
  /new Hls\(/,
];

const HOME_SOURCE_FILES = [
  "src/app/page.tsx",
  "src/app/layout.tsx",
  "src/components/home/create-party.tsx",
  "src/components/home/join-party.tsx",
  "src/components/home/cinema-backdrop.tsx",
];

function assertOmitsSdkSource(source: string, label: string) {
  for (const pattern of SDK_IMPLEMENTATION) {
    expect(source, `${label} must not include ${pattern}`).not.toMatch(pattern);
  }
}

function isWebpackRuntimeChunk(file: string): boolean {
  return /(?:^|\/)webpack-[^/]+\.js$/.test(file);
}

function homeFirstLoadFiles(manifest: { pages: Record<string, string[]> }): string[] {
  const files = new Set<string>([
    ...(manifest.pages["/page"] ?? []),
    ...(manifest.pages["/"] ?? []),
    ...(manifest.pages["/layout"] ?? []),
  ]);
  return [...files];
}

describe("production home bundle stays off realtime SDKs", () => {
  it("keeps webpack SDK cache groups async-only so home cannot pull them", () => {
    const config = readFileSync(NEXT_CONFIG, "utf8");
    expect(config).toMatch(/ably\|livekit-client\|hls\\\.js/);
    expect(config).toMatch(/chunks:\s*["']async["']/);
    expect(config).toMatch(/enforce:\s*true/);
    expect(config).toMatch(/name\(module[\s\S]*sdk-/);
  });

  it("home first-load source never mentions Ably, LiveKit, or hls.js", () => {
    for (const file of HOME_SOURCE_FILES) {
      const source = readFileSync(path.join(ROOT, file), "utf8");
      expect(source, file).not.toMatch(/from\s+["'](ably|livekit-client|hls\.js)["']/);
      expect(source, file).not.toMatch(/from\s+["']@\/lib\/client\/(realtime|livekit)["']/);
      expect(source, file).not.toMatch(/import\(["']@\/lib\/client\/(realtime|livekit)["']\)/);
    }
  });

  it("does not put ably/livekit/hls.js on the home first-load graph", () => {
    // next dev writes an empty app-build-manifest; only a production build has BUILD_ID.
    if (!existsSync(BUILD_ID) || !existsSync(MANIFEST)) return;
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { pages: Record<string, string[]> };
    const home = homeFirstLoadFiles(manifest);
    expect(home.length).toBeGreaterThan(0);
    expect(home.some((file) => SDK_CHUNK_NAME.test(file))).toBe(false);

    const chunksDir = path.join(ROOT, ".next");
    for (const file of home) {
      if (isWebpackRuntimeChunk(file)) continue;
      const abs = path.join(chunksDir, file);
      if (!existsSync(abs)) continue;
      const source = readFileSync(abs, "utf8");
      assertOmitsSdkSource(source, file);
    }
  });
});
