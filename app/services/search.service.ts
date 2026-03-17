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

type SearchResponse = {
  success: boolean;
  data: YouTubeSearchResult[];
  query: string;
};

type RequestResponse = {
  success: boolean;
  data: Track;
};

export const SearchService = {
  async searchYouTube(query: string): Promise<YouTubeSearchResult[]> {
    const res = await api.get<SearchResponse>(
      `/search/youtube?q=${encodeURIComponent(query)}`,
    );
    return res.data;
  },

  async requestTrack(videoId: string): Promise<Track> {
    const res = await api.post<RequestResponse>("/search/request", { videoId });
    return res.data;
  },
};