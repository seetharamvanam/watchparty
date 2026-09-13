import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

const HOME_ENTRIES = [
  path.join(SRC, "app/page.tsx"),
  path.join(SRC, "app/layout.tsx"),
  path.join(SRC, "components/home/create-party.tsx"),
  path.join(SRC, "components/home/join-party.tsx"),
  path.join(SRC, "components/home/cinema-backdrop.tsx"),
];

const FORBIDDEN = [
  /from\s+["']ably["']/,
  /from\s+["']livekit-client["']/,
  /from\s+["']livekit-server-sdk["']/,
  /from\s+["']hls\.js["']/,
  /from\s+["']@\/lib\/client\/realtime["']/,
  /from\s+["']@\/lib\/client\/livekit["']/,
  /from\s+["']@\/lib\/client\/room-context["']/,
  /from\s+["']@\/lib\/ably["']/,
  /from\s+["']@\/lib\/livekit["']/,
  /from\s+["']@\/components\/room\/(face-strip|synced-player|youtube-stage|html5-stage|room-stage)["']/,
  /import\(["']ably["']\)/,
  /import\(["']livekit-client["']\)/,
  /import\(["']hls\.js["']\)/,
  /import\(["']@\/lib\/client\/realtime["']\)/,
  /import\(["']@\/lib\/client\/livekit["']\)/,
];

const IMPORT_RE =
  /(?:import\s+(?:type\s+)?[^'";]+from\s+|export\s+[^'";]+from\s+|import\()["']([^"']+)["']/g;

function walkRuntimeImports(entry: string, seen: Set<string>) {
  const abs = path.normalize(entry);
  if (seen.has(abs)) return;
  seen.add(abs);

  let source: string;
  try {
    source = readFileSync(abs, "utf8");
  } catch {
    return;
  }

  // Strip type-only imports so compile-time types do not fail the graph.
  const runtime = source
    .replace(/import\s+type\s+[^;]+;/g, "")
    .replace(/export\s+type\s+[^;]+;/g, "");

  for (const rule of FORBIDDEN) {
    expect(runtime, `${path.relative(ROOT, abs)} must not load realtime/A/V SDKs`).not.toMatch(rule);
  }

  for (const match of runtime.matchAll(IMPORT_RE)) {
    const spec = match[1];
    if (!spec.startsWith("@/") && !spec.startsWith(".")) continue;
    if (spec.startsWith("@/lib/client/realtime") || spec.startsWith("@/lib/client/livekit")) {
      throw new Error(`${path.relative(ROOT, abs)} imports ${spec}`);
    }
    const resolved = spec.startsWith("@/")
      ? path.join(SRC, spec.slice(2))
      : path.resolve(path.dirname(abs), spec);
    const candidates = [
      resolved,
      `${resolved}.ts`,
      `${resolved}.tsx`,
      path.join(resolved, "index.ts"),
      path.join(resolved, "index.tsx"),
    ];
    const next = candidates.find((file) => {
      try {
        return statSync(file).isFile();
      } catch {
        return false;
      }
    });
    if (next) walkRuntimeImports(next, seen);
  }
}

describe("home landing graph stays off Ably/LiveKit", () => {
  it("does not statically import realtime SDKs or room player/A/V from home", () => {
    const seen = new Set<string>();
    for (const entry of HOME_ENTRIES) {
      walkRuntimeImports(entry, seen);
    }
    expect(seen.size).toBeGreaterThan(4);
    const files = [...seen].map((file) => path.relative(SRC, file));
    expect(files.some((file) => file.includes("face-strip"))).toBe(false);
    expect(files.some((file) => file.includes("realtime.ts"))).toBe(false);
    expect(files.some((file) => file.includes("livekit.ts"))).toBe(false);
  });

  it("keeps room player and A/V modules out of src/components/home", () => {
    const homeDir = path.join(SRC, "components/home");
    for (const name of readdirSync(homeDir)) {
      const source = readFileSync(path.join(homeDir, name), "utf8");
      for (const rule of FORBIDDEN) {
        expect(source).not.toMatch(rule);
      }
    }
  });

  it("keeps join-gate off Ably/LiveKit so it cannot pull SDK chunks", () => {
    const source = readFileSync(path.join(SRC, "components/room/join-gate.tsx"), "utf8");
    const sdkRules = [
      /from\s+["']ably["']/,
      /from\s+["']livekit-client["']/,
      /from\s+["']hls\.js["']/,
      /from\s+["']@\/lib\/client\/realtime["']/,
      /from\s+["']@\/lib\/client\/livekit["']/,
      /import\(["']ably["']\)/,
      /import\(["']livekit-client["']\)/,
      /import\(["']hls\.js["']\)/,
      /import\(["']@\/lib\/client\/realtime["']\)/,
      /import\(["']@\/lib\/client\/livekit["']\)/,
    ];
    for (const rule of sdkRules) {
      expect(source).not.toMatch(rule);
    }
  });
});
