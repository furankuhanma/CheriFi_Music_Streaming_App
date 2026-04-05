import { api } from "./api";
import { Track } from "./tracks.service";

export type YouTubeSearchResult = {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string | null;
  duration: number;
  inDatabase: boolean;
  track: Track | null;
};

export type ArtistResult = {
  id: string;
  name: string;
  imageUrl: string | null;
  trackCount: number;
};

export type SearchResponse = {
  artists: ArtistResult[];
  results: YouTubeSearchResult[];
  youtubeAvailable: boolean;
};

type ApiSearchResponse = {
  success: boolean;
  data: SearchResponse;
  query: string;
};

type RequestResponse = {
  success: boolean;
  data: Track;
};

type CacheEntry<T> = {
  value: T;
  at: number;
};

const SEARCH_CACHE_TTL_MS = 20 * 1000;
const searchCache = new Map<string, CacheEntry<SearchResponse>>();
const searchInFlight = new Map<string, Promise<SearchResponse>>();

function getCachedSearch(key: string): SearchResponse | null {
  const hit = searchCache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > SEARCH_CACHE_TTL_MS) {
    searchCache.delete(key);
    return null;
  }
  return hit.value;
}

export const SearchService = {
  async searchYouTube(query: string): Promise<SearchResponse> {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return { artists: [], results: [], youtubeAvailable: true };

    const cached = getCachedSearch(normalized);
    if (cached) return cached;

    const pending = searchInFlight.get(normalized);
    if (pending) return pending;

    const task = api
      .get<ApiSearchResponse>(`/search/youtube?q=${encodeURIComponent(query)}`)
      .then((res) => {
        searchCache.set(normalized, { value: res.data, at: Date.now() });
        return res.data;
      })
      .finally(() => {
        searchInFlight.delete(normalized);
      });

    searchInFlight.set(normalized, task);
    return task;
  },

  async requestTrack(videoId: string): Promise<Track> {
    const res = await api.post<RequestResponse>("/search/request", { videoId });
    return res.data;
  },
};