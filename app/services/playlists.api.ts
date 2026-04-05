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

type CacheEntry<T> = {
  value: T;
  at: number;
};

const CACHE_TTL_MS = 30 * 1000;
const playlistsCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function getCached<T>(key: string): T | null {
  const hit = playlistsCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    playlistsCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T) {
  playlistsCache.set(key, { value, at: Date.now() });
}

async function runCached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const cached = getCached<T>(key);
  if (cached) return cached;

  const pending = inFlight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const task = fetcher()
    .then((value) => {
      setCached(key, value);
      return value;
    })
    .finally(() => {
      inFlight.delete(key);
    });

  inFlight.set(key, task);
  return task;
}

function bustPlaylistCaches() {
  playlistsCache.clear();
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const PlaylistsService = {
  async getAll(forceRefresh = false): Promise<Playlist[]> {
    const key = "playlists:all";
    if (forceRefresh) playlistsCache.delete(key);
    const res = await runCached(key, () =>
      api.get<{ success: boolean; data: Playlist[] }>("/playlists"),
    );
    return res.data ?? [];
  },

  async getQuickAccess(limit = 4, forceRefresh = false): Promise<Playlist[]> {
    const key = `playlists:quick:${limit}`;
    if (forceRefresh) playlistsCache.delete(key);
    const res = await runCached(key, () =>
      api.get<{ success: boolean; data: Playlist[] }>(
        `/playlists/quick-access?limit=${limit}`,
      ),
    );
    return res.data ?? [];
  },

  async getById(id: string, forceRefresh = false): Promise<Playlist> {
    const key = `playlists:byId:${id}`;
    if (forceRefresh) playlistsCache.delete(key);
    const res = await runCached(key, () =>
      api.get<{ success: boolean; data: Playlist }>(`/playlists/${id}`),
    );
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
    bustPlaylistCaches();
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
    bustPlaylistCaches();
    return res.data!;
  },

  async addTrack(playlistId: string, trackId: string): Promise<void> {
    await api.post(`/playlists/${playlistId}/tracks`, { trackId });
    bustPlaylistCaches();
  },

  async removeTrack(playlistId: string, trackId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}/tracks/${trackId}`);
    bustPlaylistCaches();
  },

  async delete(playlistId: string): Promise<void> {
    await api.delete(`/playlists/${playlistId}`);
    bustPlaylistCaches();
  },
};