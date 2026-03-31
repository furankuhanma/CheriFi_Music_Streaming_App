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
  genre?: string | null;
  description?: string;
  publishedAt?: string;
  viewCount?: number;
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

// ─── NEW: Artist result type ──────────────────────────────────────────────────

export type ArtistResult = {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
};

export type SearchResult = {
  artists: ArtistResult[];
  results: YouTubeResult[];
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
        description?: string;
        tags?: string[];
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
      const description = item.snippet?.description ?? "";
      const tags = item.snippet?.tags ?? [];
      const genre = extractGenre(tags, description);

      return {
        videoId,
        title: item.snippet?.title ?? "Unknown title",
        channelTitle: item.snippet?.channelTitle ?? "Unknown artist",
        thumbnailUrl:
          thumbs?.high?.url ?? thumbs?.medium?.url ?? thumbs?.default?.url ?? null,
        genre,
        description,
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
  })) as YouTubeSearchItem[];
}

async function fetchSingleVideo(videoId: string): Promise<YouTubeSearchItem | null> {
  const apiKey = getYouTubeApiKey();

  const params = new URLSearchParams({
    key: apiKey,
    id: videoId,
    part: "snippet,contentDetails,statistics,topicDetails",
  });

  const res = await fetch(`${YT_VIDEOS_URL}?${params}`);
  if (!res.ok) throw createError("YouTube details lookup failed", 502);

  const json = (await res.json()) as {
    items?: Array<{
      id?: string;
      snippet?: {
        title?: string;
        channelTitle?: string;
        description?: string;
        publishedAt?: string;
        tags?: string[];
        thumbnails?: {
          default?: { url?: string };
          medium?: { url?: string };
          high?: { url?: string };
          maxres?: { url?: string };
        };
      };
      contentDetails?: { duration?: string };
      statistics?: { viewCount?: string };
      topicDetails?: { topicCategories?: string[] };
    }>;
  };

  const item = json.items?.[0];
  if (!item?.id) return null;

  const thumbs = item.snippet?.thumbnails;
  const description = item.snippet?.description ?? "";
  const tags = item.snippet?.tags ?? [];

  const genre = extractGenre(tags, description);
  const viewCount = item.statistics?.viewCount
    ? parseInt(item.statistics.viewCount, 10)
    : undefined;

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
    genre,
    description,
    publishedAt: item.snippet?.publishedAt,
    viewCount,
  };
}

function extractGenre(tags: string[], description: string): string | null {
  const genreKeywords = [
    "pop", "rock", "hiphop", "hip-hop", "rap", "jazz", "blues", "classical",
    "electronic", "edm", "dance", "indie", "folk", "country", "reggae",
    "latin", "metal", "rnb", "r&b", "soul", "funk", "punk", "alternative",
    "ambient", "techno", "house", "dubstep", "trap", "gsap", "afrobeat",
    "k-pop", "anime", "soundtrack", "gaming",
  ];

  const text = `${tags.join(" ")} ${description}`.toLowerCase();
  const found = genreKeywords.find((genre) => text.includes(genre));

  return found ? found.charAt(0).toUpperCase() + found.slice(1) : null;
}

// ─── NEW: Search artists in DB ────────────────────────────────────────────────

async function searchArtists(query: string): Promise<ArtistResult[]> {
  const artists = await prisma.artist.findMany({
    where: {
      name: { contains: query, mode: "insensitive" },
    },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      _count: { select: { tracks: true } },
    },
    orderBy: { tracks: { _count: "desc" } },
    take: 5,
  });

  return artists.map((a) => ({
    id: a.id,
    name: a.name,
    imageUrl: a.imageUrl,
    trackCount: a._count.tracks,
  }));
}

// ─── Search service ───────────────────────────────────────────────────────────

export const SearchService = {
  async search(query: string, userId?: string): Promise<SearchResult> {
    // Run artist DB search and YouTube search in parallel
    const [artists, youtubeItems] = await Promise.all([
      searchArtists(query),
      searchYouTube(query, 10),
    ]);

    if (youtubeItems.length === 0) return { artists, results: [] };

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

    const results: YouTubeResult[] = youtubeItems.map((item) => {
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

    return { artists, results };
  },

  async requestTrack(videoId: string, userId?: string): Promise<TrackDto> {
    const existing = await prisma.track.findFirst({
      where: { audioUrl: { contains: videoId } },
      include: trackInclude,
    });

    if (existing) return formatTrack(existing, userId);

    const youtubeVideo = await fetchSingleVideo(videoId);
    if (!youtubeVideo) throw createError("YouTube video not found", 404);

    const musicDir = path.resolve(
      process.env.MUSIC_DIR ?? "/home/frank-loui-lapore/vibestream/audio",
    );
    await downloadToMusicDir(videoId, musicDir);

    const mp3Path = path.resolve(path.join(musicDir, `${videoId}.mp3`));
    if (!fs.existsSync(mp3Path)) {
      throw createError("Audio conversion failed", 500);
    }

    let artist = await prisma.artist.findFirst({
      where: {
        name: { equals: youtubeVideo.channelTitle, mode: "insensitive" },
      },
    });

    if (!artist) {
      artist = await prisma.artist.create({
        data: { name: youtubeVideo.channelTitle },
      });
    }

    let album = await prisma.album.findFirst({
      where: {
        AND: [
          { title: { equals: youtubeVideo.channelTitle, mode: "insensitive" } },
          { artistId: artist.id },
        ],
      },
    });

    if (!album) {
      album = await prisma.album.create({
        data: {
          title: youtubeVideo.channelTitle,
          coverUrl: youtubeVideo.thumbnailUrl,
          artistId: artist.id,
        },
      });
    }

    const createdTrack = await prisma.track.create({
      data: {
        title: youtubeVideo.title,
        duration: youtubeVideo.duration,
        audioUrl: mp3Path,
        coverUrl: youtubeVideo.thumbnailUrl,
        artistId: artist.id,
        albumId: album.id,
        genre: youtubeVideo.genre,
        playCount: youtubeVideo.viewCount
          ? Math.min(youtubeVideo.viewCount, 2147483647)
          : 0,
      },
      include: trackInclude,
    });

    return formatTrack(createdTrack, userId);
  },
};

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
    quiet: true,
  });
}