// backend/src/modules/playlist/playlists.routes.ts
import { Router, Request, Response, NextFunction } from "express";
import { PlaylistsController } from "./playlists.controller";
import { requireAuth } from "../../middleware/auth";
import { AuthenticatedRequest } from "../../types";

const router = Router();

// ─── Helper (same pattern as tracks.routes.ts) ────────────────────────────────

type Handler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => Promise<void>;

function auth(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) =>
    handler(req as AuthenticatedRequest, res, next);
}

// ─── Routes (all require auth) ────────────────────────────────────────────────

router.get("/", requireAuth as any, auth(PlaylistsController.getAll));
router.get("/:id", requireAuth as any, auth(PlaylistsController.getById));
router.post("/", requireAuth as any, auth(PlaylistsController.create));
router.delete("/:id", requireAuth as any, auth(PlaylistsController.delete));

router.post("/:id/tracks", requireAuth as any, auth(PlaylistsController.addTrack));
router.delete("/:id/tracks/:trackId", requireAuth as any, auth(PlaylistsController.removeTrack));

export default router;