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

type TrackListResponse = {
  success: boolean;
  data: Track[];
};

type CacheEntry<T> = {
  value: T;
  at: number;
};

const CACHE_TTL_MS = 30 * 1000;

const tracksCache = new Map<string, CacheEntry<unknown>>();
const inFlight = new Map<string, Promise<unknown>>();

function getCached<T>(key: string): T | null {
  const hit = tracksCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_TTL_MS) {
    tracksCache.delete(key);
    return null;
  }
  return hit.value as T;
}

function setCached<T>(key: string, value: T) {
  tracksCache.set(key, { value, at: Date.now() });
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

// ─── Tracks service ───────────────────────────────────────────────────────────

export const TracksService = {
  async getAll(
    page = 1,
    limit = 20,
    forceRefresh = false,
  ): Promise<TracksResponse> {
    const key = `getAll:${page}:${limit}`;
    if (forceRefresh) tracksCache.delete(key);
    return runCached(key, () =>
      api.get<TracksResponse>(`/tracks?page=${page}&limit=${limit}`),
    );
  },

  async getById(trackId: string): Promise<Track> {
    const res = await api.get<TrackResponse>(`/tracks/${trackId}`);
    return res.data;
  },

  async getDownloads(limit = 100, forceRefresh = false): Promise<Track[]> {
    const key = `downloads:${limit}`;
    if (forceRefresh) tracksCache.delete(key);
    const res = await runCached(key, () =>
      api.get<TrackListResponse>(`/tracks/downloads?limit=${limit}`),
    );
    return res.data;
  },

  async getLiked(limit = 100, forceRefresh = false): Promise<Track[]> {
    const key = `liked:${limit}`;
    if (forceRefresh) tracksCache.delete(key);
    const res = await runCached(key, () =>
      api.get<TrackListResponse>(`/tracks/liked?limit=${limit}`),
    );
    return res.data;
  },

  async getRecentlyPlayed(limit = 100, forceRefresh = false): Promise<Track[]> {
    const key = `recent:${limit}`;
    if (forceRefresh) tracksCache.delete(key);
    const res = await runCached(key, () =>
      api.get<TrackListResponse>(`/tracks/recently-played?limit=${limit}`),
    );
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
    tracksCache.forEach((_, key) => {
      if (key.startsWith("liked:") || key.startsWith("getAll:")) {
        tracksCache.delete(key);
      }
    });
  },

  async unlike(trackId: string): Promise<void> {
    await api.delete(`/tracks/${trackId}/like`);
    tracksCache.forEach((_, key) => {
      if (key.startsWith("liked:") || key.startsWith("getAll:")) {
        tracksCache.delete(key);
      }
    });
  },

  async getByAlbum(albumId: string): Promise<Track[]> {
    const res = await api.get<{ success: boolean; data: Track[] }>(
      `/tracks/album/${albumId}`,
    );
    return res.data ?? [];
  },

  async getByArtist(artistId: string): Promise<Track[]> {
    const res = await api.get<{ success: boolean; data: Track[] }>(
      `/tracks/artist/${artistId}`,
    );
    return res.data ?? [];
  },
};