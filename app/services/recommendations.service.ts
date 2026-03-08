import { api } from "./api";
import { Track } from "./tracks.service";

type RecommendationsResponse = {
  success: boolean;
  data: Track[];
};

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
};