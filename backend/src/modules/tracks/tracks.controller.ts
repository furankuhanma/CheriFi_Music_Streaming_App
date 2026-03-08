import { Response, NextFunction } from "express";
import { TracksService } from "./tracks.service";
import { AuthenticatedRequest } from "../../types";

export const TracksController = {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const userId = req.user?.userId;

      const result = await TracksService.getAll(userId, page, limit);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const track = await TracksService.getById(
        req.params.id,
        req.user?.userId,
      );
      res.json({ success: true, data: track });
    } catch (err) {
      next(err);
    }
  },

  async stream(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await TracksService.stream(req.params.id, req, res);
    } catch (err) {
      next(err);
    }
  },

  async recordPlay(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    try {
      await TracksService.recordPlay(req.params.id, req.user.userId);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async like(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await TracksService.like(req.params.id, req.user.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async unlike(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      await TracksService.unlike(req.params.id, req.user.userId);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};