import { prisma } from "../../config/db";
import { createError } from "../../middleware/errorHandler";
import { SongRequestStatus } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SongRequestInput {
  rawInput: string;
  userId: string;
}

export interface NormalizedSongData {
  normalizedTitle: string;
  normalizedArtist: string;  // primary artist (canonical)
  allArtists: string[];       // all split artists
  albumHint: string | null;
}

export interface SongRequestAnalysis {
  normalizedTitle: string;
  normalizedArtist: string;
  allArtists: string[];
  albumHint: string | null;
  confidence: number;
  matchedTrackId: string | null;
  matchedArtistIds: string[];
  newArtistsToCreate: string[];
  shouldCreateTrack: boolean;
  shouldCreateAlbum: boolean;
  fulfilledByExisting: boolean;
  notes: string;
  payload: CleanInsertPayload | null;
}

export interface CleanInsertPayload {
  title: string;
  primaryArtistId: string;
  albumId: string | null;
  genre: string | null;
  collaboratorNames: string[];
}

export interface SongRequestResult {
  requestId: string;
  status: SongRequestStatus;
  analysis: SongRequestAnalysis;
  message: string;
}

// ─── Normalization helpers ────────────────────────────────────────────────────

/**
 * Normalize a string for comparison:
 * lowercase, trim, collapse spaces, remove trailing punctuation.
 */
function normalize(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/\s{2,}/g, " ")
    .replace(/[.,!?;:'"`]+$/, "")
    .trim();
}

/**
 * Clean a song title:
 * Remove feat/ft notations, official/lyric video noise, extra punctuation.
 */
function normalizeTitle(raw: string): string {
  return normalize(
    raw
      .replace(/\s*[\(\[]\s*feat\.?.*?[\)\]]/gi, "")   // (feat. X) / [feat. X]
      .replace(/\s*[\(\[]\s*ft\.?.*?[\)\]]/gi, "")      // (ft. X)
      .replace(/\s*[\(\[]\s*featuring.*?[\)\]]/gi, "")  // (featuring X)
      .replace(/\(official\s*(music\s*)?video\)/gi, "")
      .replace(/\(official\s*(lyric\s*)?video\)/gi, "")
      .replace(/\(official\s*audio\)/gi, "")
      .replace(/\(lyrics?\)/gi, "")
      .replace(/\(audio\)/gi, "")
      .replace(/\s*-\s*Topic$/i, "")
      .replace(/\s{2,}/g, " ")
      .trim()
      .replace(/[-–—\s]+$/, "")
      .trim()
  );
}

/**
 * Split a raw artist string into individual canonical artist names.
 * Handles: feat./ft./featuring/&/and/x/with/vs/,
 */
function splitArtists(raw: string): string[] {
  const parts = raw
    .replace(/\s*[\(\[]\s*(feat\.?|ft\.?|featuring)\s*/gi, ",")
    .replace(/[\)\]]/g, "")
    .split(/,|\s+&\s+|\s+and\s+|\s+x\s+|\s+with\s+|\s+vs\.?\s+/gi)
    .map((s) =>
      normalize(
        s
          .replace(/\s*-\s*Topic$/i, "")
          .replace(/\(Original\)/gi, "")
          .replace(/\(Official\)/gi, "")
          .replace(/\s*\(.*?\)\s*$/, "")
          .trim()
      )
    )
    .filter((s) => s.length > 1);

  return [...new Set(parts)];
}

/**
 * Parse raw user input into normalized song data.
 * Supports formats:
 *   "Artist - Title"
 *   "Title by Artist"
 *   "Title (feat. Artist2)"
 *   plain "Title"
 */
function parseRawInput(rawInput: string): NormalizedSongData {
  let titleRaw = rawInput.trim();
  let artistRaw = "";
  let albumHint: string | null = null;

  // Extract album hint: "Title - Artist [Album Name]"
  const albumMatch = titleRaw.match(/\[([^\]]+)\]/);
  if (albumMatch) {
    albumHint = normalize(albumMatch[1]);
    titleRaw = titleRaw.replace(albumMatch[0], "").trim();
  }

  // Format: "Artist - Title"
  const dashIdx = titleRaw.indexOf(" - ");
  if (dashIdx !== -1) {
    artistRaw = titleRaw.slice(0, dashIdx).trim();
    titleRaw = titleRaw.slice(dashIdx + 3).trim();
  }
  // Format: "Title by Artist"
  else {
    const byMatch = titleRaw.match(/^(.+?)\s+by\s+(.+)$/i);
    if (byMatch) {
      titleRaw = byMatch[1].trim();
      artistRaw = byMatch[2].trim();
    }
  }

  // Extract inline feat. from title into artist string
  const featMatch = titleRaw.match(/[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+([^\)\]]+)[\)\]]/i);
  if (featMatch && !artistRaw) {
    artistRaw = featMatch[1].trim();
  }

  const normalizedTitle = normalizeTitle(titleRaw);
  const allArtists = artistRaw ? splitArtists(artistRaw) : [];
  const normalizedArtist = allArtists[0] ?? "";

  return { normalizedTitle, normalizedArtist, allArtists, albumHint };
}

// ─── Confidence scoring ───────────────────────────────────────────────────────

/**
 * Score confidence 0.0–1.0:
 * - title present and long enough: +0.4
 * - primary artist identified: +0.4
 * - album hint: +0.1
 * - title > 2 words: +0.1
 */
function scoreConfidence(data: NormalizedSongData): number {
  let score = 0;
  if (data.normalizedTitle.length >= 2) score += 0.4;
  if (data.normalizedArtist.length >= 2) score += 0.4;
  if (data.albumHint) score += 0.1;
  if (data.normalizedTitle.split(" ").length > 2) score += 0.1;
  return Math.min(score, 1.0);
}

// ─── DB matching ──────────────────────────────────────────────────────────────

/**
 * Try to find an existing track by normalized title + artist.
 * Uses case-insensitive LIKE for flexibility.
 */
async function findExistingTrack(
  normalizedTitle: string,
  normalizedArtist: string
): Promise<{ id: string; artistId: string } | null> {
  const tracks = await prisma.track.findMany({
    where: {
      title: { equals: normalizedTitle, mode: "insensitive" },
    },
    include: {
      artist: { select: { id: true, name: true } },
    },
  });

  if (tracks.length === 0) return null;

  // Try to match artist too
  const matched = tracks.find(
    (t) => normalize(t.artist.name) === normalizedArtist
  );

  return matched
    ? { id: matched.id, artistId: matched.artistId }
    : tracks.length === 1
    ? { id: tracks[0].id, artistId: tracks[0].artistId }
    : null;
}

/**
 * Find existing artists by normalized name.
 * Returns { found: Artist[], notFound: string[] }
 */
async function matchArtists(artistNames: string[]): Promise<{
  found: { id: string; name: string; normalized: string }[];
  notFound: string[];
}> {
  if (artistNames.length === 0) return { found: [], notFound: [] };

  const allArtists = await prisma.artist.findMany({
    select: { id: true, name: true },
  });

  const found: { id: string; name: string; normalized: string }[] = [];
  const notFound: string[] = [];

  for (const name of artistNames) {
    const match = allArtists.find((a) => normalize(a.name) === name);
    if (match) {
      found.push({ id: match.id, name: match.name, normalized: name });
    } else {
      notFound.push(name);
    }
  }

  return { found, notFound };
}

/**
 * Find existing album by normalized title + artistId.
 */
async function findExistingAlbum(
  albumHint: string,
  artistId: string
): Promise<string | null> {
  const album = await prisma.album.findFirst({
    where: {
      title: { equals: albumHint, mode: "insensitive" },
      artistId,
    },
    select: { id: true },
  });
  return album?.id ?? null;
}

// ─── Core analysis ────────────────────────────────────────────────────────────

async function analyzeSongRequest(
  rawInput: string
): Promise<SongRequestAnalysis> {
  const parsed = parseRawInput(rawInput);
  const confidence = scoreConfidence(parsed);
  const notes: string[] = [];

  // Low confidence — reject immediately
  if (confidence < 0.4) {
    return {
      ...parsed,
      confidence,
      matchedTrackId: null,
      matchedArtistIds: [],
      newArtistsToCreate: [],
      shouldCreateTrack: false,
      shouldCreateAlbum: false,
      fulfilledByExisting: false,
      notes: "Confidence too low — insufficient title or artist data.",
      payload: null,
    };
  }

  // Check for existing track
  const existingTrack = await findExistingTrack(
    parsed.normalizedTitle,
    parsed.normalizedArtist
  );

  if (existingTrack) {
    return {
      ...parsed,
      confidence: 1.0,
      matchedTrackId: existingTrack.id,
      matchedArtistIds: [existingTrack.artistId],
      newArtistsToCreate: [],
      shouldCreateTrack: false,
      shouldCreateAlbum: false,
      fulfilledByExisting: true,
      notes: "Fulfilled by existing track.",
      payload: null,
    };
  }

  // Match artists
  const { found: foundArtists, notFound: newArtistNames } = await matchArtists(
    parsed.allArtists
  );

  if (newArtistNames.length > 0) {
    notes.push(`New artists to create: ${newArtistNames.join(", ")}`);
  }

  const primaryArtist =
    foundArtists[0] ?? null;

  // If no primary artist found and confidence is medium — queue for review
  if (!primaryArtist && confidence < 0.8) {
    return {
      ...parsed,
      confidence,
      matchedTrackId: null,
      matchedArtistIds: foundArtists.map((a) => a.id),
      newArtistsToCreate: newArtistNames,
      shouldCreateTrack: false,
      shouldCreateAlbum: false,
      fulfilledByExisting: false,
      notes: `Queued for manual review — primary artist not found. ${notes.join(" ")}`.trim(),
      payload: null,
    };
  }

  // Try to match album
  let albumId: string | null = null;
  let shouldCreateAlbum = false;

  if (parsed.albumHint && primaryArtist) {
    albumId = await findExistingAlbum(parsed.albumHint, primaryArtist.id);
    if (!albumId && confidence >= 0.8) {
      shouldCreateAlbum = true;
      notes.push(`New album to create: "${parsed.albumHint}"`);
    }
  }

  // High confidence — ready to create
  const collaborators = parsed.allArtists.slice(1);

  return {
    ...parsed,
    confidence,
    matchedTrackId: null,
    matchedArtistIds: foundArtists.map((a) => a.id),
    newArtistsToCreate: newArtistNames,
    shouldCreateTrack: confidence >= 0.8,
    shouldCreateAlbum,
    fulfilledByExisting: false,
    notes: notes.join(" ") || "Ready to insert.",
    payload:
      confidence >= 0.8 && primaryArtist
        ? {
            title: parsed.normalizedTitle,
            primaryArtistId: primaryArtist.id,
            albumId,
            genre: null,
            collaboratorNames: collaborators,
          }
        : null,
  };
}

// ─── Song Request Service ─────────────────────────────────────────────────────

export const SongRequestService = {

  async requestSongAndPopulateDatabase(
    input: SongRequestInput
  ): Promise<SongRequestResult> {
    const { rawInput, userId } = input;

    if (!rawInput || rawInput.trim().length < 2) {
      throw createError("Song request input is too short.", 400);
    }

    const analysis = await analyzeSongRequest(rawInput);

    // ── Case 1: Fulfilled by existing track ───────────────────────────────────
    if (analysis.fulfilledByExisting && analysis.matchedTrackId) {
      const request = await prisma.songRequest.create({
        data: {
          userId,
          rawInput,
          normalizedTitle: analysis.normalizedTitle,
          normalizedArtist: analysis.normalizedArtist,
          albumHint: analysis.albumHint,
          confidence: analysis.confidence,
          status: SongRequestStatus.FULFILLED,
          notes: analysis.notes,
          fulfilledTrackId: analysis.matchedTrackId,
        },
      });

      return {
        requestId: request.id,
        status: SongRequestStatus.FULFILLED,
        analysis,
        message: "Song already exists in the database. Request fulfilled.",
      };
    }

    // ── Case 2: Low confidence or no payload — queue for manual review ────────
    if (!analysis.shouldCreateTrack || !analysis.payload) {
      const request = await prisma.songRequest.create({
        data: {
          userId,
          rawInput,
          normalizedTitle: analysis.normalizedTitle,
          normalizedArtist: analysis.normalizedArtist,
          albumHint: analysis.albumHint,
          confidence: analysis.confidence,
          status: SongRequestStatus.PENDING,
          notes: analysis.notes,
        },
      });

      return {
        requestId: request.id,
        status: SongRequestStatus.PENDING,
        analysis,
        message:
          analysis.confidence < 0.4
            ? "Request rejected — not enough information to identify the song."
            : "Request queued for manual review.",
      };
    }

    // ── Case 3: High confidence — create missing artists, album, track ────────
    const { payload } = analysis;

    const trackId = await prisma.$transaction(async (tx) => {
      // 3a. Create any new artists that didn't exist
      const createdArtistMap: Record<string, string> = {};
      for (const artistName of analysis.newArtistsToCreate) {
        const created = await tx.artist.create({
          data: {
            id: crypto.randomUUID(),
            name:
              artistName.charAt(0).toUpperCase() + artistName.slice(1), // re-capitalize
          },
        });
        createdArtistMap[artistName] = created.id;
      }

      // 3b. Resolve primary artist ID (may have just been created)
      let primaryArtistId = payload.primaryArtistId;
      if (!primaryArtistId && analysis.newArtistsToCreate[0]) {
        primaryArtistId = createdArtistMap[analysis.newArtistsToCreate[0]];
      }

      if (!primaryArtistId) {
        throw createError("Could not resolve primary artist.", 500);
      }

      // 3c. Create album if needed
      let albumId = payload.albumId;
      if (analysis.shouldCreateAlbum && analysis.albumHint) {
        const newAlbum = await tx.album.create({
          data: {
            id: crypto.randomUUID(),
            title:
              analysis.albumHint.charAt(0).toUpperCase() +
              analysis.albumHint.slice(1),
            artistId: primaryArtistId,
          },
        });
        albumId = newAlbum.id;
      }

      // 3d. Create the track
      // audioUrl is left as a placeholder — admin will fill it in later
      const track = await tx.track.create({
        data: {
          id: crypto.randomUUID(),
          title: payload.title,
          duration: 0,          // unknown until file is added
          audioUrl: `pending:${crypto.randomUUID()}`, // unique placeholder
          artistId: primaryArtistId,
          albumId: albumId ?? null,
          genre: payload.genre,
        },
      });

      return track.id;
    });

    // 3e. Save the fulfilled request
    const request = await prisma.songRequest.create({
      data: {
        userId,
        rawInput,
        normalizedTitle: analysis.normalizedTitle,
        normalizedArtist: analysis.normalizedArtist,
        albumHint: analysis.albumHint,
        confidence: analysis.confidence,
        status: SongRequestStatus.FULFILLED,
        notes:
          analysis.notes +
          (payload.collaboratorNames.length > 0
            ? ` Collaborators: ${payload.collaboratorNames.join(", ")}.`
            : ""),
        fulfilledTrackId: trackId,
      },
    });

    return {
      requestId: request.id,
      status: SongRequestStatus.FULFILLED,
      analysis,
      message: "Song record created successfully and request fulfilled.",
    };
  },

  // ── Get all pending requests (admin use) ────────────────────────────────────
  async getPendingRequests(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      prisma.songRequest.findMany({
        where: { status: SongRequestStatus.PENDING },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
      }),
      prisma.songRequest.count({
        where: { status: SongRequestStatus.PENDING },
      }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  // ── Get requests by user ────────────────────────────────────────────────────
  async getMyRequests(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      prisma.songRequest.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        include: {
          fulfilledTrack: {
            select: {
              id: true,
              title: true,
              artist: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.songRequest.count({ where: { userId } }),
    ]);

    return {
      requests,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};