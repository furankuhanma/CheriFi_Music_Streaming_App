// backend/src/modules/playlist/playlists.controller.ts
import { Response, NextFunction } from "express";
import { PlaylistsService } from "./playlists.service";
import { AuthenticatedRequest } from "../../types";

export const PlaylistsController = {
  async getAll(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const playlists = await PlaylistsService.getUserPlaylists(req.user.userId);
      res.json({ success: true, data: playlists });
    } catch (err) {
      next(err);
    }
  },

  async getById(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const playlist = await PlaylistsService.getById(req.params.id, req.user.userId);
      if (!playlist) {
        res.status(404).json({ success: false, error: "Playlist not found" });
        return;
      }
      res.json({ success: true, data: playlist });
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { title, description } = req.body;
      if (!title?.trim()) {
        res.status(400).json({ success: false, error: "Title is required" });
        return;
      }
      const playlist = await PlaylistsService.create(req.user.userId, title.trim(), description);
      res.status(201).json({ success: true, data: playlist });
    } catch (err) {
      next(err);
    }
  },

  async addTrack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { trackId } = req.body;
      if (!trackId) {
        res.status(400).json({ success: false, error: "trackId is required" });
        return;
      }
      const result = await PlaylistsService.addTrack(req.params.id, trackId, req.user.userId);
      if (!result) {
        res.status(404).json({ success: false, error: "Playlist not found" });
        return;
      }
      res.status(201).json({ success: true });
    } catch (err) {
      next(err);
    }
  },

  async removeTrack(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PlaylistsService.removeTrack(
        req.params.id,
        req.params.trackId,
        req.user.userId,
      );
      if (!result) {
        res.status(404).json({ success: false, error: "Playlist not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const result = await PlaylistsService.delete(req.params.id, req.user.userId);
      if (!result) {
        res.status(404).json({ success: false, error: "Playlist not found" });
        return;
      }
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};