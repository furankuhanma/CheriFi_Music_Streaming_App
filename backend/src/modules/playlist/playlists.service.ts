// backend/src/modules/playlist/playlists.service.ts
import { prisma } from "../../config/db";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Format a track's audioUrl to a full streaming URL in playlist responses
 */
function formatPlaylistTracks(playlist: any) {
  return {
    ...playlist,
    tracks: playlist.tracks?.map((pt: any) => ({
      ...pt,
      track: {
        ...pt.track,
        audioUrl: `${process.env.API_BASE_URL}/api/tracks/${pt.track.id}/stream`,
      },
    })) || [],
  };
}

export const PlaylistsService = {
  async getUserPlaylists(userId: string) {
    const playlists = await prisma.playlist.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        tracks: {
          orderBy: { position: "asc" },
          include: {
            track: {
              include: {
                artist: { select: { id: true, name: true } },
                album: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });

    return playlists.map(formatPlaylistTracks);
  },

  async getById(playlistId: string, userId: string) {
    const playlist = await prisma.playlist.findFirst({
      where: {
        id: playlistId,
        OR: [{ userId }, { isPublic: true }],
      },
      include: {
        tracks: {
          orderBy: { position: "asc" },
          include: {
            track: {
              include: {
                artist: { select: { id: true, name: true } },
                album: { select: { id: true, title: true } },
              },
            },
          },
        },
      },
    });

    return playlist ? formatPlaylistTracks(playlist) : null;
  },

  async create(
    userId: string,
    title: string,
    description?: string,
    coverUrl?: string | null,
  ) {
    return prisma.playlist.create({
      data: { userId, title, description, coverUrl, isPublic: false },
    });
  },

  async update(
    playlistId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      coverUrl?: string | null;
    },
  ) {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
    });
    if (!playlist) return null;

    return prisma.playlist.update({
      where: { id: playlistId },
      data,
    });
  },

  async addTrack(playlistId: string, trackId: string, userId: string) {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
    });
    if (!playlist) return null;

    // Already in playlist — silently succeed
    const exists = await prisma.playlistTrack.findUnique({
      where: { playlistId_trackId: { playlistId, trackId } },
    });
    if (exists) return exists;

    const last = await prisma.playlistTrack.findFirst({
      where: { playlistId },
      orderBy: { position: "desc" },
    });
    const position = (last?.position ?? -1) + 1;

    return prisma.playlistTrack.create({
      data: { playlistId, trackId, position },
    });
  },

  async removeTrack(playlistId: string, trackId: string, userId: string) {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
    });
    if (!playlist) return null;

    await prisma.playlistTrack.delete({
      where: { playlistId_trackId: { playlistId, trackId } },
    });
    return true;
  },

  async delete(playlistId: string, userId: string) {
    const playlist = await prisma.playlist.findFirst({
      where: { id: playlistId, userId },
    });
    if (!playlist) return null;

    await prisma.playlist.delete({ where: { id: playlistId } });
    return true;
  },

  async getQuickAccessPlaylists(userId: string, limit = 4) {
    const userPlaylists = await prisma.playlist.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        coverUrl: true,
        isPublic: true,
        userId: true,
        tracks: {
          take: 4,
          select: {
            track: { select: { coverUrl: true } },
          },
        },
        _count: { select: { tracks: true } },
      },
    });

    // If user has enough playlists, just return those
    if (userPlaylists.length >= limit) {
      return userPlaylists.slice(0, limit).map((p) => ({
        id: p.id,
        title: p.title,
        coverUrl: p.coverUrl,
        isPublic: p.isPublic,
        owner: { id: userId, username: "You" },
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
      }));
    }

    // Otherwise, mix in random public playlists from other users
    const neededCount = limit - userPlaylists.length;
    const publicPlaylists = await prisma.playlist.findMany({
      where: {
        isPublic: true,
        userId: { not: userId },
      },
      take: neededCount,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        coverUrl: true,
        isPublic: true,
        userId: true,
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

    const combined = [
      ...userPlaylists.map((p) => ({
        id: p.id,
        title: p.title,
        coverUrl: p.coverUrl,
        isPublic: p.isPublic,
        owner: { id: userId, username: "You" },
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
      ...publicPlaylists.map((p) => ({
        id: p.id,
        title: p.title,
        coverUrl: p.coverUrl,
        isPublic: p.isPublic,
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
    ];

    return combined;
  },
};