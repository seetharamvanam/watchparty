import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const MANIFEST = path.join(ROOT, ".next/app-build-manifest.json");

describe("production home bundle stays off realtime SDKs", () => {
  it("does not put ably/livekit/hls.js on the home first-load graph", () => {
    if (!existsSync(MANIFEST)) return;
    const manifest = JSON.parse(readFileSync(MANIFEST, "utf8")) as { pages: Record<string, string[]> };
    const home = manifest.pages["/page"] ?? [];
    expect(home.length).toBeGreaterThan(0);
    expect(home.some((file) => /sdk-(ably|livekit-client|hlsjs)/.test(file))).toBe(false);

    const chunksDir = path.join(ROOT, ".next");
    for (const file of home) {
      const abs = path.join(chunksDir, file);
      if (!existsSync(abs)) continue;
      const source = readFileSync(abs, "utf8");
      expect(source, file).not.toMatch(/livekit-client/);
      expect(source, file).not.toMatch(/new Ably\.Realtime/);
    }
  });
});
