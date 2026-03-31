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

export const SearchService = {
  async searchYouTube(query: string): Promise<SearchResponse> {
    const res = await api.get<ApiSearchResponse>(
      `/search/youtube?q=${encodeURIComponent(query)}`,
    );
    return res.data;
  },

  async requestTrack(videoId: string): Promise<Track> {
    const res = await api.post<RequestResponse>("/search/request", { videoId });
    return res.data;
  },
};