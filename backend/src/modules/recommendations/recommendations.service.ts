import { prisma } from "../../config/db";
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
  };
}

const trackInclude = {
  artist: { select: { id: true, name: true } },
  album: { select: { id: true, title: true, coverUrl: true } },
  likes: { select: { userId: true } },
};

// ─── Recommendations service ──────────────────────────────────────────────────
// Phase 1: simple heuristics — no ML needed yet.
// Priority: liked genre → liked artists → popular → recent

export const RecommendationsService = {
  async forUser(userId: string, limit = 20): Promise<TrackDto[]> {
    // 1. Get user's liked tracks to extract preferred genres + artists
    const likes = await prisma.like.findMany({
      where: { userId },
      include: {
        track: { select: { genre: true, artistId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const likedTrackIds = likes.map((l) => l.trackId);
    const preferredGenres = [
      ...new Set(likes.map((l) => l.track.genre).filter(Boolean)),
    ] as string[];
    const preferredArtistIds = [
      ...new Set(likes.map((l) => l.track.artistId)),
    ];

    // 2. Get recently played track ids (to avoid repeating them)
    const recentlyPlayed = await prisma.playHistory.findMany({
      where: { userId },
      select: { trackId: true },
      orderBy: { playedAt: "desc" },
      take: 20,
    });
    const recentlyPlayedIds = recentlyPlayed.map((p) => p.trackId);

    const excludeIds = [...new Set([...likedTrackIds, ...recentlyPlayedIds])];

    // 3. Fetch candidates in priority layers
    const results: any[] = [];

    // Layer A: same genre, not already liked/played
    if (preferredGenres.length > 0 && results.length < limit) {
      const genreTracks = await prisma.track.findMany({
        where: {
          genre: { in: preferredGenres },
          id: { notIn: excludeIds },
        },
        include: trackInclude,
        orderBy: { playCount: "desc" },
        take: limit,
      });
      results.push(...genreTracks);
    }

    // Layer B: same artists, not already in results
    if (preferredArtistIds.length > 0 && results.length < limit) {
      const existingIds = results.map((t) => t.id);
      const artistTracks = await prisma.track.findMany({
        where: {
          artistId: { in: preferredArtistIds },
          id: { notIn: [...excludeIds, ...existingIds] },
        },
        include: trackInclude,
        orderBy: { playCount: "desc" },
        take: limit - results.length,
      });
      results.push(...artistTracks);
    }

    // Layer C: fill remainder with popular tracks not yet included
    if (results.length < limit) {
      const existingIds = results.map((t) => t.id);
      const popular = await prisma.track.findMany({
        where: { id: { notIn: [...excludeIds, ...existingIds] } },
        include: trackInclude,
        orderBy: { playCount: "desc" },
        take: limit - results.length,
      });
      results.push(...popular);
    }

    return results.slice(0, limit).map((t) => formatTrack(t, userId));
  },

  // For unauthenticated users — just return popular tracks
  async popular(limit = 20): Promise<TrackDto[]> {
    const tracks = await prisma.track.findMany({
      include: trackInclude,
      orderBy: { playCount: "desc" },
      take: limit,
    });

    return tracks.map((t) => formatTrack(t));
  },

  // Tracks similar to a given track — same genre + artist, exclude the track itself
  async relatedTo(trackId: string, userId?: string, limit = 10): Promise<TrackDto[]> {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      select: { genre: true, artistId: true },
    });

    if (!track) return [];

    const related = await prisma.track.findMany({
      where: {
        id: { not: trackId },
        OR: [
          { genre: track.genre ?? undefined },
          { artistId: track.artistId },
        ],
      },
      include: trackInclude,
      orderBy: { playCount: "desc" },
      take: limit,
    });

    return related.map((t) => formatTrack(t, userId));
  },
};
