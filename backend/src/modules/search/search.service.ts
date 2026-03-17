import fs from "fs";
import path from "path";
import { prisma } from "../../config/db";
import { createError } from "../../middleware/errorHandler";
import { TrackDto } from "../../types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTrack(track: any, userId?: string): TrackDto {
  return {
    id: track.id,
    title: track.title,
    duration: track.duration,
    audioUrl: `/api/tracks/${track.id}/stream`,
    coverUrl: track.coverUrl ?? track.album?.coverUrl ?? null,
    artist: { id: track.artist.id, name: track.artist.name },
    album: track.album
      ? { id: track.album.id, title: track.album.title }
      : null,
    genre: track.genre,
    playCount: track.playCount,
    isLiked: userId
      ? track.likes?.some((l: any) => l.userId === userId)
      : undefined,
    inLibrary: userId
      ? track.library?.some((l: any) => l.userId === userId)
      : undefined,
  };
}

const trackInclude = {
  artist: { select: { id: true, name: true } },
  album: { select: { id: true, title: true, coverUrl: true } },
  likes: { select: { userId: true } },
  library: { select: { userId: true } },
};

const YT_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YT_VIDEOS_URL = "https://www.googleapis.com/youtube/v3/videos";

type YouTubeSearchItem = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  duration: number;
};

export type YouTubeResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  duration: number;
  inDatabase: boolean;
  track: TrackDto | null;
};

function parseIsoDuration(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (
    parseInt(match[1] ?? "0") * 3600 +
    parseInt(match[2] ?? "0") * 60 +
    parseInt(match[3] ?? "0")
  );
}

function getYouTubeApiKey(): string {
  const key = process.env.YOUTUBE_API_KEY?.trim();
  if (!key) throw createError("YouTube API key not configured", 500);
  return key;
}

async function searchYouTube(query: string, maxResults = 10): Promise<YouTubeSearchItem[]> {
  const apiKey = getYouTubeApiKey();

  const searchParams = new URLSearchParams({
    key: apiKey,
    q: query,
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    maxResults: String(maxResults),
  });

  const searchRes = await fetch(`${YT_SEARCH_URL}?${searchParams}`);
  if (!searchRes.ok) throw createError("YouTube search failed", 502);

  const searchJson = (await searchRes.json()) as {
    items?: Array<{
      id?: { videoId?: string };
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
        };
      };
    }>;
  };

  const basicItems = (searchJson.items ?? [])
    .map((item) => {
      const videoId = item.id?.videoId;
      if (!videoId) return null;

      const thumbs = item.snippet?.thumbnails;
      return {
        videoId,
        title: item.snippet?.title ?? "Unknown title",
        channelTitle: item.snippet?.channelTitle ?? "Unknown artist",
        thumbnailUrl:
          thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (basicItems.length === 0) return [];

  const ids = basicItems.map((item) => item.videoId).join(",");
  const videosParams = new URLSearchParams({
    key: apiKey,
    id: ids,
    part: "contentDetails",
  });

  const videosRes = await fetch(`${YT_VIDEOS_URL}?${videosParams}`);
  if (!videosRes.ok) throw createError("YouTube details lookup failed", 502);

  const videosJson = (await videosRes.json()) as {
    items?: Array<{ id?: string; contentDetails?: { duration?: string } }>;
  };

  const durationById = new Map<string, number>();
  for (const item of videosJson.items ?? []) {
    if (!item.id) continue;
    durationById.set(item.id, parseIsoDuration(item.contentDetails?.duration ?? ""));
  }

  return basicItems.map((item) => ({
    ...item,
    duration: durationById.get(item.videoId) ?? 0,
  }));
}

async function fetchSingleVideo(videoId: string): Promise<YouTubeSearchItem | null> {
  const apiKey = getYouTubeApiKey();

  const params = new URLSearchParams({
    key: apiKey,
    id: videoId,
    part: "snippet,contentDetails",
  });

  const res = await fetch(`${YT_VIDEOS_URL}?${params}`);
  if (!res.ok) throw createError("YouTube details lookup failed", 502);

  const json = (await res.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        channelTitle?: string;
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
          maxres?: { url?: string };
        };
      };
      contentDetails?: { duration?: string };
    }>;
  };

  const item = json.items?.[0];
  if (!item?.id) return null;

  const thumbs = item.snippet?.thumbnails;
  return {
    videoId: item.id,
    title: item.snippet?.title ?? "Unknown title",
    channelTitle: item.snippet?.channelTitle ?? "Unknown artist",
    thumbnailUrl:
      thumbs?.maxres?.url ??
      thumbs?.high?.url ??
      thumbs?.medium?.url ??
      thumbs?.default?.url ??
      null,
    duration: parseIsoDuration(item.contentDetails?.duration ?? ""),
  };
}

async function downloadToMusicDir(videoId: string, musicDir: string): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const ytdlModule = require("youtube-dl-exec");
  const ytdl = (ytdlModule.default ?? ytdlModule) as (
    url: string,
    options: Record<string, unknown>,
  ) => Promise<unknown>;

  fs.mkdirSync(musicDir, { recursive: true });

  await ytdl(`https://www.youtube.com/watch?v=${videoId}`, {
    extractAudio: true,
    audioFormat: "mp3",
    audioQuality: 0,
    output: path.join(musicDir, `${videoId}.%(ext)s`),
    noPlaylist: true,
    writeInfoJson: true,
    quiet: true,
  });
}

// ─── Search service ───────────────────────────────────────────────────────────

export const SearchService = {
  async search(query: string, userId?: string): Promise<YouTubeResult[]> {
    const youtubeItems = await searchYouTube(query, 10);
    if (youtubeItems.length === 0) return [];

    const videoIds = youtubeItems.map((item) => item.videoId);

    const existingTracks = await prisma.track.findMany({
      where: {
        OR: videoIds.map((videoId) => ({
          audioUrl: { contains: videoId },
        })),
      },
      include: trackInclude,
    });

    const trackByVideoId = new Map<string, TrackDto>();
    for (const track of existingTracks) {
      const fileName = path.basename(track.audioUrl, path.extname(track.audioUrl));
      trackByVideoId.set(fileName, formatTrack(track, userId));
    }

    return youtubeItems.map((item) => {
      const existing = trackByVideoId.get(item.videoId) ?? null;
      return {
        videoId: item.videoId,
        title: existing?.title ?? item.title,
        channelTitle: existing?.artist.name ?? item.channelTitle,
        thumbnailUrl: existing?.coverUrl ?? item.thumbnailUrl,
        duration: existing?.duration ?? item.duration,
        inDatabase: existing !== null,
        track: existing,
      };
    });
  },

  async requestTrack(videoId: string, userId?: string): Promise<TrackDto> {
    const existing = await prisma.track.findFirst({
      where: { audioUrl: { contains: videoId } },
      include: trackInclude,
    });

    if (existing) return formatTrack(existing, userId);

    const youtubeVideo = await fetchSingleVideo(videoId);
    if (!youtubeVideo) throw createError("YouTube video not found", 404);

    const musicDir = path.resolve(process.env.MUSIC_DIR ?? "./music");
    await downloadToMusicDir(videoId, musicDir);

    const mp3Path = path.resolve(path.join(musicDir, `${videoId}.mp3`));
    if (!fs.existsSync(mp3Path)) {
      throw createError("Audio conversion failed", 500);
    }

    const infoJsonPath = path.resolve(path.join(musicDir, `${videoId}.info.json`));
    let infoTitle: string | undefined;
    let infoDuration: number | undefined;

    if (fs.existsSync(infoJsonPath)) {
      try {
        const info = JSON.parse(fs.readFileSync(infoJsonPath, "utf-8")) as {
          title?: string;
          duration?: number;
        };
        infoTitle = info.title;
        infoDuration =
          typeof info.duration === "number" ? Math.round(info.duration) : undefined;
      } catch {
        // best effort
      }
    }

    let artist = await prisma.artist.findFirst({
      where: {
        name: {
          equals: youtubeVideo.channelTitle,
          mode: "insensitive",
        },
      },
    });

    if (!artist) {
      artist = await prisma.artist.create({
        data: { name: youtubeVideo.channelTitle },
      });
    }

    const createdTrack = await prisma.track.create({
      data: {
        title: infoTitle ?? youtubeVideo.title,
        duration: infoDuration ?? youtubeVideo.duration,
        audioUrl: mp3Path,
        coverUrl: youtubeVideo.thumbnailUrl,
        artistId: artist.id,
      },
      include: trackInclude,
    });

    return formatTrack(createdTrack, userId);
  },
};