import { Router, Response, NextFunction } from "express";
import { RecommendationsService } from "./recommendations.service";
import { requireAuth, optionalAuth } from "../../middleware/auth";
import { AuthenticatedRequest } from "../../types";

// ─── Controller ───────────────────────────────────────────────────────────────

const RecommendationsController = {
  async forUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const tracks = await RecommendationsService.forUser(
        req.user.userId,
        limit,
      );
      res.json({ success: true, data: tracks });
    } catch (err) {
      next(err);
    }
  },

  async popular(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
      const tracks = await RecommendationsService.popular(limit);
      res.json({ success: true, data: tracks });
    } catch (err) {
      next(err);
    }
  },

  async relatedTo(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 30);
      const tracks = await RecommendationsService.relatedTo(
        req.params.trackId,
        req.user?.userId,
        limit,
      );
      res.json({ success: true, data: tracks });
    } catch (err) {
      next(err);
    }
  },
};

// ─── Routes ───────────────────────────────────────────────────────────────────

const router = Router();

// Personalised — requires auth
router.get(
  "/for-you",
  requireAuth as any,
  (req, res, next) =>
    RecommendationsController.forUser(req as AuthenticatedRequest, res, next),
);

// Popular — public
router.get(
  "/popular",
  optionalAuth as any,
  (req, res, next) =>
    RecommendationsController.popular(req as AuthenticatedRequest, res, next),
);

// Related to a specific track — optional auth
router.get(
  "/related/:trackId",
  optionalAuth as any,
  (req, res, next) =>
    RecommendationsController.relatedTo(
      req as AuthenticatedRequest,
      res,
      next,
    ),
);

export default router;
