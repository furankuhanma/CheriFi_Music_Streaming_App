import { api } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Track = {
  id: string;
  title: string;
  duration: number; // seconds
  audioUrl: string; // relative path — use api.streamUrl(id) for playback
  coverUrl: string | null;
  artist: {
    id: string;
    name: string;
  };
  album: {
    id: string;
    title: string;
  } | null;
  genre: string | null;
  playCount: number;
  isLiked?: boolean;
  inLibrary?: boolean;
};

type TracksResponse = {
  success: boolean;
  tracks: Track[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type TrackResponse = {
  success: boolean;
  data: Track;
};

// ─── Tracks service ───────────────────────────────────────────────────────────

export const TracksService = {
  async getAll(page = 1, limit = 20): Promise<TracksResponse> {
    return api.get<TracksResponse>(`/tracks?page=${page}&limit=${limit}`);
  },

  async getById(trackId: string): Promise<Track> {
    const res = await api.get<TrackResponse>(`/tracks/${trackId}`);
    return res.data;
  },

  // Returns the full streaming URL for expo-av
  streamUrl(trackId: string): string {
    return api.streamUrl(trackId);
  },

  async recordPlay(trackId: string): Promise<void> {
    await api.post(`/tracks/${trackId}/play`).catch(() => null);
    // Fire-and-forget — don't block playback if this fails
  },

  async like(trackId: string): Promise<void> {
    await api.post(`/tracks/${trackId}/like`);
  },

  async unlike(trackId: string): Promise<void> {
    await api.delete(`/tracks/${trackId}/like`);
  },
};