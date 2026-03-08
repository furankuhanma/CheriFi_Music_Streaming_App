import { Router, Request, Response, NextFunction } from "express";
import { TracksController } from "./tracks.controller";
import { requireAuth, optionalAuth } from "../../middleware/auth";
import { AuthenticatedRequest } from "../../types";

const router = Router();

// ─── Helpers to eliminate repetitive casts ────────────────────────────────────

type Handler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => Promise<void>;

function auth(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) =>
    handler(req as AuthenticatedRequest, res, next);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// List all tracks — optional auth to include isLiked/inLibrary
router.get("/", optionalAuth as any, auth(TracksController.getAll));

// Get single track metadata
router.get("/:id", optionalAuth as any, auth(TracksController.getById));

// Stream audio — public so expo-av can fetch without auth header issues
router.get("/:id/stream", auth(TracksController.stream));

// Record a play — requires auth
router.post("/:id/play", requireAuth as any, auth(TracksController.recordPlay));

// Like a track — requires auth
router.post("/:id/like", requireAuth as any, auth(TracksController.like));

// Unlike a track — requires auth
router.delete("/:id/like", requireAuth as any, auth(TracksController.unlike));

export default router;