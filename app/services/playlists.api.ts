// CheriFi/services/playlists.service.ts
import { api } from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export type PlaylistTrack = {
  playlistId: string;
  trackId: string;
  position: number;
  addedAt: string;
  track: {
    id: string;
    title: string;
    duration: number;
    audioUrl: string;
    coverUrl: string | null;
    artist: { id: string; name: string };
    album: { id: string; title: string } | null;
    genre?: string | null;
    playCount?: number;
    isLiked?: boolean;
    inLibrary?: boolean;
  };
};

export type Playlist = {
  id: string;
  title: string;
  description?: string | null;
  coverUrl: string | null;
  userId?: string;
  isPublic?: boolean;
  createdAt?: string;
  updatedAt?: string;
  tracks?: PlaylistTrack[];
  owner?: { id: string; username: string };
  trackCount?: number;
};

export type UpdatePlaylistPayload = {
  title?: string;
  description?: string | null;
  coverUrl?: string | null;
};

// ─── Service ──────────────────────────────────────────────────────────────────

export const PlaylistsService = {
  async getAll(): Promise<Playlist[]> {
    const res = await api.get<{ success: boolean; data: Playlist[] }>("/playlists");
    return res.data ?? [];
  },

  async getQuickAccess(limit = 4): Promise<Playlist[]> {
    const res = await api.get<{ success: boolean; data: Playlist[] }>(
      `/playlists/quick-access?limit=${limit}`
    );
    return res.data ?? [];
  },

  async getById(id: string): Promise<Playlist> {
    const res = await api.get<{ success: boolean; data: Playlist }>(`/playlists/${id}`);
    return res.data!;
  },

  async create(
    title: string,
    description?: string,
    coverUrl?: string | null,
  ): Promise<Playlist> {
    const res = await api.post<{ success: boolean; data: Playlist }>("/playlists", {
      title,
      description,
      coverUrl,
    });
    return res.data!;
  },

  async update(
    playlistId: string,
    payload: UpdatePlaylistPayload,
  ): Promise<Playlist> {
    const res = await api.patch<{ success: boolean; data: Playlist }>(
      `/playlists/${playlistId}`,
      payload,
    );
    return res.data!;
  },

  async addTrack(playlistId: string, trackId: string): Promise<void> {
    await api.post(`/playlists/${playlistId}/tracks`, { trackId });
  },

  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}/tracks/${trackId}`);
  },

  async delete(playlistId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}`);
  },
};