import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as createRoomHandler } from "@/app/api/rooms/route";
import { POST as setMedia } from "@/app/api/rooms/[code]/media/route";
import { validateMediaUrl } from "@/lib/media";
import { createHost, jsonRequest, params, resetTestState } from "./helpers";

describe("media URL validation", () => {
  beforeEach(async () => {
    await resetTestState();
  });

  it("accepts YouTube watch, youtu.be, and embed URLs without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(validateMediaUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ").mediaType).toBe("youtube");
    expect(validateMediaUrl("https://youtu.be/dQw4w9WgXcQ").mediaType).toBe("youtube");
    expect(validateMediaUrl("https://www.youtube.com/embed/dQw4w9WgXcQ").mediaType).toBe("youtube");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("accepts HTTPS direct mp4/webm/m3u8 URLs without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    expect(validateMediaUrl("https://cdn.example.com/film.mp4").mediaType).toBe("direct");
    expect(validateMediaUrl("https://cdn.example.com/film.webm").mediaType).toBe("direct");
    expect(validateMediaUrl("https://cdn.example.com/film.m3u8").mediaType).toBe("direct");
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("rejects YouTube Shorts and live URLs as not embeddable", () => {
    expect(() => validateMediaUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toThrowError(
      /not embeddable|cannot be embedded/i,
    );
    expect(() => validateMediaUrl("https://www.youtube.com/live/dQw4w9WgXcQ")).toThrowError(
      /not embeddable/i,
    );
  });

  it("rejects http and non-media URLs", () => {
    expect(() => validateMediaUrl("http://cdn.example.com/film.mp4")).toThrowError(/HTTPS/i);
    expect(() => validateMediaUrl("https://cdn.example.com/film.avi")).toThrowError(/mp4/i);
    expect(() => validateMediaUrl("https://example.com/not-a-video")).toThrowError();
  });

  it("returns INVALID_MEDIA_URL from the create and media APIs", async () => {
    const created = await createRoomHandler(
      jsonRequest("http://localhost/api/rooms", "POST", {
        displayName: "Host",
        mediaUrl: "http://example.com/movie.mp4",
      }),
    );
    expect(created.status).toBe(400);
    expect((await created.json()).error.code).toBe("INVALID_MEDIA_URL");

    const host = await createHost();
    const media = await setMedia(
      jsonRequest(
        `http://localhost/api/rooms/${host.body.room.code}/media`,
        "POST",
        { mediaUrl: "https://example.com/notes.txt" },
        host.body.sessionToken,
      ),
      params(host.body.room.code),
    );
    expect(media.status).toBe(400);
    expect((await media.json()).error.code).toBe("INVALID_MEDIA_URL");
  });

  it("returns YOUTUBE_NOT_EMBEDDABLE for Shorts", async () => {
    const host = await createHost();
    const media = await setMedia(
      jsonRequest(
        `http://localhost/api/rooms/${host.body.room.code}/media`,
        "POST",
        { mediaUrl: "https://youtube.com/shorts/dQw4w9WgXcQ" },
        host.body.sessionToken,
      ),
      params(host.body.room.code),
    );
    expect(media.status).toBe(400);
    expect((await media.json()).error.code).toBe("YOUTUBE_NOT_EMBEDDABLE");
  });
});
