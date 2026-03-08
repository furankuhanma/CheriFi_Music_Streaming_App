import path from "path";
import fs from "fs";
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

// ─── Tracks service ───────────────────────────────────────────────────────────

export const TracksService = {
  async getAll(userId?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [tracks, total] = await Promise.all([
      prisma.track.findMany({
        skip,
        take: limit,
        include: trackInclude,
        orderBy: { createdAt: "desc" },
      }),
      prisma.track.count(),
    ]);

    return {
      tracks: tracks.map((t : any) => formatTrack(t, userId)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async getById(trackId: string, userId?: string) {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      include: trackInclude,
    });

    if (!track) throw createError("Track not found", 404);

    return formatTrack(track, userId);
  },

  async stream(trackId: string, req: any, res: any) {
    const track = await prisma.track.findUnique({
      where: { id: trackId },
      select: { audioUrl: true },
    });

    if (!track) throw createError("Track not found", 404);

    const filePath = path.resolve(track.audioUrl);

    if (!fs.existsSync(filePath)) {
      throw createError("Audio file not found", 404);
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": "audio/mpeg",
      });

      fs.createReadStream(filePath, { start, end }).pipe(res);
    } else {
      res.writeHead(200, {
        "Content-Length": fileSize,
        "Content-Type": "audio/mpeg",
        "Accept-Ranges": "bytes",
      });

      fs.createReadStream(filePath).pipe(res);
    }

    prisma.track
      .update({ where: { id: trackId }, data: { playCount: { increment: 1 } } })
      .catch(console.error);
  },

  async recordPlay(trackId: string, userId: string) {
    await prisma.playHistory.create({ data: { trackId, userId } });
  },

  async like(trackId: string, userId: string) {
    const track = await prisma.track.findUnique({ where: { id: trackId } });
    if (!track) throw createError("Track not found", 404);

    await prisma.like.upsert({
      where: { userId_trackId: { userId, trackId } },
      create: { userId, trackId },
      update: {},
    });
  },

  async unlike(trackId: string, userId: string) {
    const track = await prisma.track.findUnique({ where: { id: trackId } });
    if (!track) throw createError("Track not found", 404);

    await prisma.like
      .delete({ where: { userId_trackId: { userId, trackId } } })
      .catch(() => {}); // ok if it didn't exist
  },
};