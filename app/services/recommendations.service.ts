import { api } from "./api";
import { Track } from "./tracks.service";

type RecommendationsResponse = {
  success: boolean;
  data: Track[];
};

// ─── Home feed section types ──────────────────────────────────────────────────

export type HomeFeedTrackSection = {
  type: "tracks";
  variant: "large" | "small";
  title: string;
  tracks: Track[];
};

export type HomeFeedAlbumSection = {
  type: "albums";
  title: string;
  albums: {
    id: string;
    title: string;
    coverUrl: string | null;
    artist: { id: string; name: string };
    trackCount: number;
  }[];
};

export type HomeFeedArtistSection = {
  type: "artists";
  title: string;
  artists: {
    id: string;
    name: string;
    imageUrl: string | null;
    fallbackCoverUrl: string | null;
    trackCount: number;
  }[];
};

export type HomeFeedPlaylistSection = {
  type: "playlists";
  title: string;
  playlists: {
    id: string;
    title: string;
    coverUrl: string | null;
    owner: { id: string; username: string };
    trackCount: number;
    tracks?: any[];
  }[];
};

export type HomeFeedSection =
  | HomeFeedTrackSection
  | HomeFeedAlbumSection
  | HomeFeedArtistSection
  | HomeFeedPlaylistSection;

type HomeFeedResponse = {
  success: boolean;
  data: HomeFeedSection[];
};

// ─── In-memory TTL cache ──────────────────────────────────────────────────────
//
// Keeps the last fetched feed in memory for CACHE_TTL_MS milliseconds.
// Navigating away and back within the TTL window returns the cached result
// instantly with no network request.
//
// The cache is intentionally module-level (not React state) so it survives
// component unmounts. Call RecommendationsService.bustFeedCache() from the
// pull-to-refresh handler to force a fresh fetch.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

type FeedCache = {
  sections: HomeFeedSection[];
  fetchedAt: number; // Date.now() timestamp
};

let feedCache: FeedCache | null = null;

function isCacheValid(): boolean {
  if (!feedCache) return false;
  return Date.now() - feedCache.fetchedAt < CACHE_TTL_MS;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const RecommendationsService = {
  // Personalised — requires user to be logged in
  async forYou(limit = 20): Promise<Track[]> {
    const res = await api.get<RecommendationsResponse>(
      `/recommendations/for-you?limit=${limit}`,
    );
    return res.data;
  },

  // Popular tracks — works without auth
  async popular(limit = 20): Promise<Track[]> {
    const res = await api.get<RecommendationsResponse>(
      `/recommendations/popular?limit=${limit}`,
    );
    return res.data;
  },

  // Related to a specific track — optional auth
  async relatedTo(trackId: string, limit = 10): Promise<Track[]> {
    const res = await api.get<RecommendationsResponse>(
      `/recommendations/related/${trackId}?limit=${limit}`,
    );
    return res.data;
  },

  // Smart fetch — returns personalised if logged in, popular otherwise
  async smart(limit = 20): Promise<Track[]> {
    try {
      return await RecommendationsService.forYou(limit);
    } catch {
      return RecommendationsService.popular(limit);
    }
  },

  // ── Home feed with TTL cache ────────────────────────────────────────────────
  //
  // forceRefresh = true  →  always hits the network and updates the cache.
  //                          Pass this from pull-to-refresh handlers.
  // forceRefresh = false →  returns cached data if still within TTL,
  //                          otherwise fetches fresh data.

  async homeFeed(forceRefresh = false): Promise<HomeFeedSection[]> {
    if (!forceRefresh && isCacheValid()) {
      return feedCache!.sections;
    }

    const res = await api.get<HomeFeedResponse>("/recommendations/home-feed");

    feedCache = {
      sections: res.data,
      fetchedAt: Date.now(),
    };

    return feedCache.sections;
  },

  // Call this to immediately invalidate the cache without fetching.
  // Useful if the user logs out, switches accounts, or likes/unlikes tracks
  // and you want the next mount to always get fresh data.
  bustFeedCache(): void {
    feedCache = null;
  },
};