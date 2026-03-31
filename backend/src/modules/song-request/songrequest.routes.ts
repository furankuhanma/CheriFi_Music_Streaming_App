import { Router } from "express";
import { SongRequestController } from "./songrequest.controller";
import { requireAuth } from "../../middleware/auth";
import { AuthenticatedRequest } from "../../types";

const router = Router();

// POST /api/song-requests — submit a song request
router.post(
  "/",
  requireAuth as any,
  (req, res, next) =>
    SongRequestController.requestSong(
      req as unknown as AuthenticatedRequest,
      res,
      next
    )
);

// GET /api/song-requests/my — get current user's requests
router.get(
  "/my",
  requireAuth as any,
  (req, res, next) =>
    SongRequestController.getMyRequests(
      req as unknown as AuthenticatedRequest,
      res,
      next
    )
);

// GET /api/song-requests/pending — admin: view manual review queue
router.get(
  "/pending",
  requireAuth as any,
  (req, res, next) =>
    SongRequestController.getPendingRequests(
      req as unknown as AuthenticatedRequest,
      res,
      next
    )
);

export default router;