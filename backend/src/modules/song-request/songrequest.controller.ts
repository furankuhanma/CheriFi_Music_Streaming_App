import { Response, NextFunction } from "express";
import { SongRequestService } from "./songrequest.service";
import { AuthenticatedRequest } from "../../types";

export const SongRequestController = {

  // POST /api/song-requests
  async requestSong(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const { rawInput } = req.body;

      if (!rawInput || typeof rawInput !== "string") {
        res.status(400).json({
          success: false,
          error: "rawInput is required and must be a string.",
        });
        return;
      }

      const result = await SongRequestService.requestSongAndPopulateDatabase({
        rawInput: rawInput.trim(),
        userId: req.user.userId,
      });

      const statusCode =
        result.status === "FULFILLED"
          ? 200
          : result.status === "PENDING"
          ? 202
          : 422;

      res.status(statusCode).json({
        success: true,
        data: {
          requestId: result.requestId,
          status: result.status,
          message: result.message,
          analysis: {
            normalizedTitle: result.analysis.normalizedTitle,
            normalizedArtist: result.analysis.normalizedArtist,
            allArtists: result.analysis.allArtists,
            albumHint: result.analysis.albumHint,
            confidence: result.analysis.confidence,
            fulfilledByExisting: result.analysis.fulfilledByExisting,
            shouldCreateTrack: result.analysis.shouldCreateTrack,
            matchedArtistIds: result.analysis.matchedArtistIds,
            newArtistsToCreate: result.analysis.newArtistsToCreate,
            payload: result.analysis.payload,
          },
        },
      });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/song-requests/my
  async getMyRequests(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const result = await SongRequestService.getMyRequests(
        req.user.userId,
        page,
        limit
      );

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  // GET /api/song-requests/pending  (admin)
  async getPendingRequests(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);

      const result = await SongRequestService.getPendingRequests(page, limit);

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },
};