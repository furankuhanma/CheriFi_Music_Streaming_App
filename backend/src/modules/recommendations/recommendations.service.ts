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

// ─── Pick helper — shuffle then slice ────────────────────────────────────────

function pick<T>(arr: T[], count: number): T[] {
  return shuffle(arr).slice(0, count);
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
        where: { genre: { in: preferredGenres }, id: { notIn: excludeIds } },
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

  async relatedTo(
    trackId: string,
    userId?: string,
    limit = 10,
  ): Promise<TrackDto[]> {
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

  // ─── Home feed ──────────────────────────────────────────────────────────────
  //
  // Targets 8–10 sections per call from a pool of 13 builders.
  // Builders are shuffled before selection so each refresh feels different.
  //
  // New-user safety: personalised builders (liked songs, history) return null
  // when there is not enough data, and generic builders always fill the gap.
  //
  // Deduplication: track IDs are tracked globally across sections so the same
  // song never appears twice. A section is only dropped when fewer than 3
  // unique tracks remain after deduplication (raised from 2, prevents tiny
  // sections while still being lenient enough for small databases).

  async homeFeed(userId: string): Promise<HomeFeedSection[]> {
    // Target 8–10 sections; at least 8 so the feed never feels thin
    const sectionTarget = 8 + Math.floor(Math.random() * 3);

    // ── Fetch all genres present in the DB once ──────────────────────────────
    const genreRows = await prisma.track.findMany({
      where: { genre: { not: null } },
      select: { genre: true },
      distinct: ["genre"],
    });
    const allGenres = genreRows.map((r) => r.genre as string).filter(Boolean);

    // ── Builder pool ─────────────────────────────────────────────────────────

    const allBuilders: Array<() => Promise<HomeFeedSection | null>> = [

      // 1. For You — personalised, falls back to popular for new users
      async () => {
        let tracks = await RecommendationsService.forUser(userId, 80);
        // New-user fallback: if we got fewer than 5 personalised tracks,
        // top up with popular tracks so this section never disappears
        if (tracks.length < 5) {
          const popular = await prisma.track.findMany({
            include: trackInclude,
            orderBy: { playCount: "desc" },
            take: 80,
          });
          tracks = popular.map((t) => formatTrack(t, userId));
        }
        if (tracks.length === 0) return null;
        return {
          type: "tracks",
          variant: "large",
          title: "For You",
          tracks: pick(tracks, 20),
        } satisfies HomeFeedTrackSection;
      },

      // 2. Popular Right Now — small rows
      async () => {
        const tracks = await prisma.track.findMany({
          include: trackInclude,
          orderBy: { playCount: "desc" },
          take: 80,
        });
        if (tracks.length === 0) return null;
        return {
          type: "tracks",
          variant: "small",
          title: "Popular Right Now",
          tracks: pick(tracks, 15).map((t) => formatTrack(t, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // 3. From Your Liked Songs — personalised, skipped for new users
      async () => {
        const likes = await prisma.like.findMany({
          where: { userId },
          include: { track: { include: trackInclude } },
          orderBy: { createdAt: "desc" },
          take: 120,
        });
        if (likes.length < 5) return null;
        return {
          type: "tracks",
          variant: "large",
          title: "From Your Liked Songs",
          tracks: pick(likes, 20).map((l) => formatTrack(l.track, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // 4. Jump Back In — recently played, skipped for new users
      async () => {
        const history = await prisma.playHistory.findMany({
          where: { userId },
          include: { track: { include: trackInclude } },
          orderBy: { playedAt: "desc" },
          take: 120,
          distinct: ["trackId"],
        });
        if (history.length < 5) return null;
        return {
          type: "tracks",
          variant: "small",
          title: "Jump Back In",
          tracks: pick(history, 15).map((h) => formatTrack(h.track, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // 5. Albums You Might Like
      async () => {
        const albums = await prisma.album.findMany({
          include: {
            artist: { select: { id: true, name: true } },
            _count: { select: { tracks: true } },
          },
        });
        if (albums.length === 0) return null;
        return {
          type: "albums",
          title: "Albums You Might Like",
          albums: pick(albums, 12).map((a) => ({
            id: a.id,
            title: a.title,
            coverUrl: a.coverUrl ?? null,
            artist: { id: a.artist.id, name: a.artist.name },
            trackCount: a._count.tracks,
          })),
        } satisfies HomeFeedAlbumSection;
      },

      // 6. Artists to Discover
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
        return {
          type: "artists",
          title: "Artists to Discover",
          artists: pick(artists, 12).map((a) => ({
            id: a.id,
            name: a.name,
            imageUrl: (a as any).imageUrl ?? null,
            fallbackCoverUrl:
              a.tracks[0]?.coverUrl ?? a.tracks[0]?.album?.coverUrl ?? null,
            trackCount: a._count.tracks,
          })),
        } satisfies HomeFeedArtistSection;
      },

      // 7. Featured Playlists — public playlists from other users
      async () => {
        const playlists = await prisma.playlist.findMany({
          where: { isPublic: true, userId: { not: userId } },
          include: {
            user: { select: { id: true, username: true } },
            _count: { select: { tracks: true } },
          },
        });
        if (playlists.length === 0) return null;
        return {
          type: "playlists",
          title: "Featured Playlists",
          playlists: pick(playlists, 12).map((p) => ({
            id: p.id,
            title: p.title,
            coverUrl: p.coverUrl ?? null,
            owner: { id: p.user.id, username: p.user.username },
            trackCount: p._count.tracks,
          })),
        } satisfies HomeFeedPlaylistSection;
      },

      // 8. Newly Added — most recently uploaded tracks (large cards)
      async () => {
        const tracks = await prisma.track.findMany({
          include: trackInclude,
          orderBy: { createdAt: "desc" },
          take: 80,
        });
        if (tracks.length === 0) return null;
        return {
          type: "tracks",
          variant: "large",
          title: "Newly Added",
          tracks: pick(tracks, 20).map((t) => formatTrack(t, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // 9. Genre spotlight — pick one random genre and show its tracks
      async () => {
        if (allGenres.length === 0) return null;
        const genre = pick(allGenres, 1)[0];
        const tracks = await prisma.track.findMany({
          where: { genre },
          include: trackInclude,
          orderBy: { playCount: "desc" },
          take: 80,
        });
        if (tracks.length < 5) return null;
        return {
          type: "tracks",
          variant: "large",
          title: `Best of ${genre}`,
          tracks: pick(tracks, 20).map((t) => formatTrack(t, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // 10. Second genre spotlight — different genre from builder 9
      //     Uses a second random pick; may collide on tiny DBs but that's fine.
      async () => {
        if (allGenres.length < 2) return null;
        const genre = pick(allGenres, 2)[1]; // second element of a new shuffle
        const tracks = await prisma.track.findMany({
          where: { genre },
          include: trackInclude,
          orderBy: { playCount: "desc" },
          take: 80,
        });
        if (tracks.length < 5) return null;
        return {
          type: "tracks",
          variant: "small",
          title: `${genre} Picks`,
          tracks: pick(tracks, 15).map((t) => formatTrack(t, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // 11. Artist deep cuts — pick one random artist and show their tracks
      async () => {
        const artists = await prisma.artist.findMany({
          select: { id: true, name: true },
        });
        if (artists.length === 0) return null;
        const artist = pick(artists, 1)[0];
        const tracks = await prisma.track.findMany({
          where: { artistId: artist.id },
          include: trackInclude,
          orderBy: { playCount: "asc" }, // least played = "deep cuts"
          take: 80,
        });
        if (tracks.length < 3) return null;
        return {
          type: "tracks",
          variant: "large",
          title: `More from ${artist.name}`,
          tracks: pick(tracks, 20).map((t) => formatTrack(t, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // 12. Hidden gems — tracks with low play counts that deserve attention
      async () => {
        const tracks = await prisma.track.findMany({
          include: trackInclude,
          orderBy: { playCount: "asc" },
          take: 120,
        });
        if (tracks.length < 5) return null;
        return {
          type: "tracks",
          variant: "small",
          title: "Hidden Gems",
          tracks: pick(tracks, 15).map((t) => formatTrack(t, userId)),
        } satisfies HomeFeedTrackSection;
      },

      // 13. Most played albums — albums whose tracks have the highest combined plays
      async () => {
        // Aggregate play counts per album via track relation
        const albumAgg = await prisma.album.findMany({
          include: {
            artist: { select: { id: true, name: true } },
            tracks: { select: { playCount: true } },
            _count: { select: { tracks: true } },
          },
        });
        if (albumAgg.length === 0) return null;
        const scored = albumAgg
          .map((a) => ({
            ...a,
            totalPlays: a.tracks.reduce((sum, t) => sum + t.playCount, 0),
          }))
          .sort((a, b) => b.totalPlays - a.totalPlays);

        const top = pick(scored.slice(0, 40), 12);
        if (top.length === 0) return null;
        return {
          type: "albums",
          title: "Most Played Albums",
          albums: top.map((a) => ({
            id: a.id,
            title: a.title,
            coverUrl: a.coverUrl ?? null,
            artist: { id: a.artist.id, name: a.artist.name },
            trackCount: a._count.tracks,
          })),
        } satisfies HomeFeedAlbumSection;
      },
    ];

    // ── Section assembly ─────────────────────────────────────────────────────

    const shuffledBuilders = shuffle(allBuilders);
    const sections: HomeFeedSection[] = [];
    const usedTrackIds = new Set<string>();

    for (const builder of shuffledBuilders) {
      if (sections.length >= sectionTarget) break;

      let section: HomeFeedSection | null = null;
      try {
        section = await builder();
      } catch {
        // A single builder failure must not crash the entire feed
        continue;
      }

      if (!section) continue;

      if (section.type === "tracks") {
        // Filter out tracks already shown in an earlier section
        const unique = section.tracks.filter((t) => !usedTrackIds.has(t.id));
        unique.forEach((t) => usedTrackIds.add(t.id));

        // Raised from 2 → 3: drop only truly empty sections, not just small ones
        if (unique.length < 3) continue;

        sections.push({ ...section, tracks: unique });
      } else {
        sections.push(section);
      }
    }

    return sections;
  },
};