import { Router, Request, Response, NextFunction } from "express";
import { SearchController } from "./search.controller";
import { optionalAuth, requireAuth } from "../../middleware/auth";
import { AuthenticatedRequest } from "../../types";

const router = Router();

type Handler = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => Promise<void>;

function auth(handler: Handler) {
  return (req: Request, res: Response, next: NextFunction) =>
    handler(req as AuthenticatedRequest, res, next);
}

// Search YouTube — optional auth (to resolve isLiked / inLibrary)
router.get(
  "/youtube",
  optionalAuth as any,
  auth(SearchController.searchYouTube),
);

// Request/import a track — requires auth
router.post(
  "/request",
  requireAuth as any,
  auth(SearchController.requestTrack),
);

export default router;