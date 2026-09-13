import { describe, expect, it } from "vitest";
import { validateMediaUrl } from "@/lib/media";
import { isHlsUrl, youtubeIdFromUrl } from "@/lib/client/parse-media";

describe("frontend media allowlist matches Backend", () => {
  it("accepts YouTube watch, youtu.be, and embed", () => {
    expect(validateMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").mediaType).toBe("youtube");
    expect(validateMediaUrl("https://youtu.be/dQw4w9WgXcQ").mediaType).toBe("youtube");
    expect(validateMediaUrl("https://www.youtube.com/embed/dQw4w9WgXcQ").mediaType).toBe("youtube");
    expect(youtubeIdFromUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("accepts HTTPS direct mp4/webm/m3u8", () => {
    expect(validateMediaUrl("https://cdn.example.com/film.mp4").mediaType).toBe("direct");
    expect(validateMediaUrl("https://cdn.example.com/film.webm").mediaType).toBe("direct");
    expect(validateMediaUrl("https://cdn.example.com/film.m3u8").mediaType).toBe("direct");
    expect(isHlsUrl("https://cdn.example.com/film.m3u8")).toBe(true);
  });

  it("rejects Shorts/Live/Clips/Music as not embeddable and http/other as invalid", () => {
    expect(() => validateMediaUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toThrow(/embed/i);
    expect(() => validateMediaUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toThrow(/embed/i);
    expect(() => validateMediaUrl("https://www.youtube.com/clip/Ugkx")).toThrow();
    expect(() => validateMediaUrl("https://music.youtube.com/watch?v=dQw4w9WgXcQ")).toThrow(/embed/i);
    expect(() => validateMediaUrl("http://cdn.example.com/film.mp4")).toThrow(/HTTPS/i);
    expect(() => validateMediaUrl("https://example.com/notes.txt")).toThrow();
  });
});
