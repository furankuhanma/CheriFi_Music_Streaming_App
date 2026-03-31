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

// ─── Home feed types ──────────────────────────────────────────────────────────

export type HomeFeedTrackSection = {
  type: "tracks";
  variant: "large" | "small";
  title: string;
  tracks: TrackDto[];
};

export type HomeFeedAlbumSection = {
  type: "albums";
  title: string;
  albums: {
    id: string;
    title: string;
    coverUrl: string | null;
    artist: { id: string; name: string };
    trackCount: number;
  }[];
};

export type HomeFeedArtistSection = {
  type: "artists";
  title: string;
  artists: {
    id: string;
    name: string;
    imageUrl: string | null;
    fallbackCoverUrl: string | null;
    trackCount: number;
  }[];
};

export type HomeFeedPlaylistSection = {
  type: "playlists";
  title: string;
  playlists: {
    id: string;
    title: string;
    coverUrl: string | null;
    owner: { id: string; username: string };
    trackCount: number;
  }[];
};

export type HomeFeedSection =
  | HomeFeedTrackSection
  | HomeFeedAlbumSection
  | HomeFeedArtistSection
  | HomeFeedPlaylistSection;

// ─── Shuffle helper ───────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ─── Recommendations service ──────────────────────────────────────────────────

export const RecommendationsService = {
  async forUser(userId: string, limit = 20): Promise<TrackDto[]> {
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

    const recentlyPlayed = await prisma.playHistory.findMany({
      where: { userId },
      select: { trackId: true },
      orderBy: { playedAt: "desc" },
      take: 20,
    });
    const recentlyPlayedIds = recentlyPlayed.map((p) => p.trackId);

    const excludeIds = [...new Set([...likedTrackIds, ...recentlyPlayedIds])];

    const results: any[] = [];

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

  async popular(limit = 20): Promise<TrackDto[]> {
    const tracks = await prisma.track.findMany({
      include: trackInclude,
      orderBy: { playCount: "desc" },
      take: limit,
    });

    return tracks.map((t) => formatTrack(t));
  },

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

  // ─── Home feed ─────────────────────────────────────────────────────────────
  // Returns 4–6 randomly selected and shuffled sections per call.
  // Each refresh produces a different layout and different tracks.

  async homeFeed(userId: string): Promise<HomeFeedSection[]> {
    const sectionCount = 4 + Math.floor(Math.random() * 3);

    const allBuilders: Array<() => Promise<HomeFeedSection | null>> = [

      // ── For You (large horizontal cards) ──
      async () => {
        const tracks = await RecommendationsService.forUser(userId, 60);
        if (tracks.length === 0) return null;
        return {
          type: "tracks",
          variant: "large",
          title: "For You",
          tracks: shuffle(tracks).slice(0, 20),
        } satisfies HomeFeedTrackSection;
      },

      // ── Popular Right Now (small vertical rows) ──
      async () => {
        const tracks = await prisma.track.findMany({
          include: trackInclude,
          orderBy: { playCount: "desc" },
          take: 60,
        });
        if (tracks.length === 0) return null;
        const picked = shuffle(tracks).slice(0, 15);
        return {
          type: "tracks",
          variant: "small",
          title: "Popular Right Now",
          tracks: picked.map((t) => formatTrack(t, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // ── Liked Songs snapshot (large horizontal cards) ──
      async () => {
        const likes = await prisma.like.findMany({
          where: { userId },
          include: { track: { include: trackInclude } },
          orderBy: { createdAt: "desc" },
          take: 100,
        });
        if (likes.length < 3) return null;
        const picked = shuffle(likes).slice(0, 20);
        return {
          type: "tracks",
          variant: "large",
          title: "From Your Liked Songs",
          tracks: picked.map((l) => formatTrack(l.track, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // ── Recently Played (small vertical rows) ──
      async () => {
        const history = await prisma.playHistory.findMany({
          where: { userId },
          include: { track: { include: trackInclude } },
          orderBy: { playedAt: "desc" },
          take: 60,
          distinct: ["trackId"],
        });
        if (history.length < 3) return null;
        const picked = shuffle(history).slice(0, 15);
        return {
          type: "tracks",
          variant: "small",
          title: "Jump Back In",
          tracks: picked.map((h) => formatTrack(h.track, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // ── Albums ──
      async () => {
        const albums = await prisma.album.findMany({
          include: {
            artist: { select: { id: true, name: true } },
            _count: { select: { tracks: true } },
          },
        });
        if (albums.length === 0) return null;
        const picked = shuffle(albums).slice(0, 12);
        return {
          type: "albums",
          title: "Albums You Might Like",
          albums: picked.map((a) => ({
            id: a.id,
            title: a.title,
            coverUrl: a.coverUrl ?? null,
            artist: { id: a.artist.id, name: a.artist.name },
            trackCount: a._count.tracks,
          })),
        } satisfies HomeFeedAlbumSection;
      },

      // ── Artists ──
      // Fetches the most-played track per artist as a fallback cover
      // when the artist has no imageUrl set.
      async () => {
        const artists = await prisma.artist.findMany({
          include: {
            _count: { select: { tracks: true } },
            tracks: {
              select: {
                coverUrl: true,
                album: { select: { coverUrl: true } },
              },
              take: 1,
              orderBy: { playCount: "desc" },
            },
          },
        });
        if (artists.length === 0) return null;
        const picked = shuffle(artists).slice(0, 12);
        return {
          type: "artists",
          title: "Artists to Discover",
          artists: picked.map((a) => ({
            id: a.id,
            name: a.name,
            imageUrl: a.imageUrl ?? null,
            fallbackCoverUrl:
              a.tracks[0]?.coverUrl ??
              a.tracks[0]?.album?.coverUrl ??
              null,
            trackCount: a._count.tracks,
          })),
        } satisfies HomeFeedArtistSection;
      },

      // ── Public Playlists ──
      async () => {
        const playlists = await prisma.playlist.findMany({
          where: {
            isPublic: true,
            userId: { not: userId },
          },
          include: {
            user: { select: { id: true, username: true } },
            tracks: {
              take: 4,
              select: {
                track: { select: { coverUrl: true } },
              },
            },
            _count: { select: { tracks: true } },
          },
        });
        if (playlists.length === 0) return null;
        const picked = shuffle(playlists).slice(0, 12);
        return {
          type: "playlists",
          title: "Featured Playlists",
          playlists: picked.map((p) => ({
            id: p.id,
            title: p.title,
            coverUrl: p.coverUrl ?? null,
            owner: { id: p.user.id, username: p.user.username },
            trackCount: p._count.tracks,
            tracks: p.tracks.map((pt) => ({
              playlistId: p.id,
              trackId: "",
              position: 0,
              addedAt: new Date().toISOString(),
              track: {
                id: "",
                title: "",
                duration: 0,
                audioUrl: "",
                coverUrl: pt.track.coverUrl,
                artist: { id: "", name: "" },
                album: null,
              },
            })),
          })),
        } satisfies HomeFeedPlaylistSection;
      },
    ];

    const shuffledBuilders = shuffle(allBuilders);
    const sections: HomeFeedSection[] = [];
    const usedTrackIds = new Set<string>();

    for (const builder of shuffledBuilders) {
      if (sections.length >= sectionCount) break;

      const section = await builder();
      if (!section) continue;

      if (section.type === "tracks") {
        const unique = section.tracks.filter((t) => !usedTrackIds.has(t.id));
        unique.forEach((t) => usedTrackIds.add(t.id));
        if (unique.length < 2) continue;
        sections.push({ ...section, tracks: unique });
      } else {
        sections.push(section);
      }
    }

    return sections;
  },
};