// backend/src/modules/playlist/playlists.service.ts
import { prisma } from "../../config/db";

export const PlaylistsService = {
  async getUserPlaylists(userId: string) {
    return prisma.playlist.findMany({
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
  },

  async getById(playlistId: string, userId: string) {
    return prisma.playlist.findFirst({
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
  },

  async create(userId: string, title: string, description?: string) {
    return prisma.playlist.create({
      data: { userId, title, description, isPublic: false },
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
};