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

  // Dynamic home feed — returns 4–6 randomised sections per call
  async homeFeed(): Promise<HomeFeedSection[]> {
    const res = await api.get<HomeFeedResponse>("/recommendations/home-feed");
    return res.data;
  },
};