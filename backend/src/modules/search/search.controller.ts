import { Response, NextFunction } from "express";
import { SearchService } from "./search.service";
import { AuthenticatedRequest } from "../../types";

export const SearchController = {
  /**
   * GET /api/search/youtube?q=...
   * Search YouTube for music. Returns mixed list of DB tracks + YouTube results.
   */
  async searchYouTube(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const q = (req.query.q as string)?.trim();
      if (!q || q.length < 1) {
        res.status(400).json({ success: false, error: "Query is required" });
        return;
      }

      const userId = req.user?.userId;
      const results = await SearchService.search(q, userId);

      res.json({ success: true, data: results, query: q });
    } catch (err) {
      next(err);
    }
  },

  /**
   * POST /api/search/request
   * Body: { videoId: string }
   * Download a YouTube track and add it to the database.
   */
  async requestTrack(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const { videoId } = req.body;
      if (!videoId || typeof videoId !== "string") {
        res
          .status(400)
          .json({ success: false, error: "videoId is required" });
        return;
      }

      const userId = req.user?.userId;
      const track = await SearchService.requestTrack(videoId, userId);

      res.status(201).json({ success: true, data: track });
    } catch (err) {
      next(err);
    }
  },
};