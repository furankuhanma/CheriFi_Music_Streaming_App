import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import { Playlist } from "../services/playlists.api";
import { Track, TracksService } from "../services/tracks.service";
import {
  OfflineDownloadItem,
  OfflineDownloadsMap,
  OfflinePlaylistsMap,
  OfflineService,
} from "../services/offline.service";

type PlaylistOfflineStatus = {
  isMarkedOffline: boolean;
  downloadedCount: number;
  totalCount: number;
  isComplete: boolean;
};

type OfflineContextType = {
  downloadsMap: OfflineDownloadsMap;
  downloadedTracks: Track[];
  offlinePlaylists: OfflinePlaylistsMap;
  isHydrated: boolean;
  isOnline: boolean;
  getDownloadItem: (trackId: string) => OfflineDownloadItem | undefined;
  isTrackDownloaded: (trackId: string) => boolean;
  downloadTrack: (track: Track) => Promise<void>;
  removeTrackDownload: (trackId: string) => Promise<void>;
  toggleTrackDownload: (track: Track) => Promise<void>;
  markPlaylistOffline: (playlist: Playlist) => Promise<void>;
  unmarkPlaylistOffline: (playlistId: string) => Promise<void>;
  getPlaylistOfflineStatus: (playlist: Playlist) => PlaylistOfflineStatus;
};

const OfflineContext = createContext<OfflineContextType | null>(null);

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOnline, setIsOnline] = useState(true);
  const [downloadsMap, setDownloadsMap] = useState<OfflineDownloadsMap>({});
  const [offlinePlaylists, setOfflinePlaylists] = useState<OfflinePlaylistsMap>(
    {},
  );
  const [isHydrated, setIsHydrated] = useState(false);

  const tasksRef = useRef<Record<string, boolean>>({});

  const persistDownloads = useCallback(async (next: OfflineDownloadsMap) => {
    setDownloadsMap(next);
    await OfflineService.writeDownloads(next);
  }, []);

  const persistPlaylists = useCallback(async (next: OfflinePlaylistsMap) => {
    setOfflinePlaylists(next);
    await OfflineService.writeOfflinePlaylists(next);
  }, []);

  useEffect(() => {
    (async () => {
      await OfflineService.ensureOfflineDirectory();
      const [storedDownloads, storedPlaylists] = await Promise.all([
        OfflineService.readDownloads(),
        OfflineService.readOfflinePlaylists(),
      ]);
      const cleaned =
        await OfflineService.clearMissingDownloadedFiles(storedDownloads);
      setDownloadsMap(cleaned);
      setOfflinePlaylists(storedPlaylists);
      if (Object.keys(cleaned).length !== Object.keys(storedDownloads).length) {
        await OfflineService.writeDownloads(cleaned);
      }
      setIsHydrated(true);
    })();
  }, []);

  const downloadedTracks = useMemo(() => {
    return Object.values(downloadsMap)
      .filter((d) => d.status === "downloaded")
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
      .map((d) => d.track);
  }, [downloadsMap]);

  const getDownloadItem = useCallback(
    (trackId: string) => downloadsMap[trackId],
    [downloadsMap],
  );

  const isTrackDownloaded = useCallback(
    (trackId: string) => downloadsMap[trackId]?.status === "downloaded",
    [downloadsMap],
  );

  const downloadTrack = useCallback(
    async (track: Track) => {
      if (tasksRef.current[track.id]) return;
      tasksRef.current[track.id] = true;

      try {
        const fileUri = OfflineService.trackFileUri(track.id);
        const queued: OfflineDownloadItem = {
          trackId: track.id,
          track,
          localUri: fileUri,
          status: "downloading",
          progress: 0,
          updatedAt: new Date().toISOString(),
        };

        const latestBeforeQueue = await OfflineService.readDownloads();
        await persistDownloads({
          ...latestBeforeQueue,
          [track.id]: queued,
        });

        const task = OfflineService.createDownloadResumable(
          track.id,
          TracksService.streamUrl(track.id),
          (progress01) => {
            setDownloadsMap((prev) => {
              const current = prev[track.id];
              if (!current) return prev;
              return {
                ...prev,
                [track.id]: {
                  ...current,
                  progress: progress01,
                  status: "downloading",
                  updatedAt: new Date().toISOString(),
                },
              };
            });
          },
        );

        const result = await task.downloadAsync();

        if (!result?.uri) {
          throw new Error("No local file was saved");
        }

        const complete: OfflineDownloadItem = {
          trackId: track.id,
          track,
          localUri: result.uri,
          status: "downloaded",
          progress: 1,
          updatedAt: new Date().toISOString(),
        };

        const latest = await OfflineService.readDownloads();
        await persistDownloads({
          ...latest,
          [track.id]: complete,
        });
      } catch (error) {
        const latest = await OfflineService.readDownloads();
        await persistDownloads({
          ...latest,
          [track.id]: {
            trackId: track.id,
            track,
            localUri: OfflineService.trackFileUri(track.id),
            status: "failed",
            progress: 0,
            error: error instanceof Error ? error.message : "Download failed",
            updatedAt: new Date().toISOString(),
          },
        });

        Alert.alert("Download failed", "Could not download this track.");
      } finally {
        tasksRef.current[track.id] = false;
      }
    },
    [persistDownloads],
  );

  const removeTrackDownload = useCallback(
    async (trackId: string) => {
      const item = downloadsMap[trackId];
      if (!item) return;

      try {
        await OfflineService.removeLocalFile(item.localUri);
      } catch {
        // ignore file cleanup errors
      }

      const next = { ...downloadsMap };
      delete next[trackId];
      await persistDownloads(next);
    },
    [downloadsMap, persistDownloads],
  );

  const toggleTrackDownload = useCallback(
    async (track: Track) => {
      if (isTrackDownloaded(track.id)) {
        await removeTrackDownload(track.id);
        return;
      }
      await downloadTrack(track);
    },
    [downloadTrack, isTrackDownloaded, removeTrackDownload],
  );

  const markPlaylistOffline = useCallback(
    async (playlist: Playlist) => {
      const trackIds = playlist.tracks.map((t) => t.trackId);
      const nextPlaylists = {
        ...offlinePlaylists,
        [playlist.id]: {
          playlistId: playlist.id,
          trackIds,
          updatedAt: new Date().toISOString(),
        },
      };
      await persistPlaylists(nextPlaylists);

      for (const item of playlist.tracks) {
        const t = item.track;
        const track: Track = {
          id: t.id,
          title: t.title,
          duration: t.duration,
          audioUrl: t.audioUrl,
          coverUrl: t.coverUrl,
          artist: t.artist,
          album: t.album,
          genre: t.genre ?? null,
          playCount: t.playCount ?? 0,
          isLiked: t.isLiked,
          inLibrary: t.inLibrary,
        };

        if (!isTrackDownloaded(track.id)) {
          await downloadTrack(track);
        }
      }
    },
    [downloadTrack, isTrackDownloaded, offlinePlaylists, persistPlaylists],
  );

  const unmarkPlaylistOffline = useCallback(
    async (playlistId: string) => {
      const next = { ...offlinePlaylists };
      delete next[playlistId];
      await persistPlaylists(next);
    },
    [offlinePlaylists, persistPlaylists],
  );

  const getPlaylistOfflineStatus = useCallback(
    (playlist: Playlist): PlaylistOfflineStatus => {
      const totalCount = playlist.tracks.length;
      const downloadedCount = playlist.tracks.filter((item) =>
        isTrackDownloaded(item.trackId),
      ).length;

      return {
        isMarkedOffline: Boolean(offlinePlaylists[playlist.id]),
        downloadedCount,
        totalCount,
        isComplete: totalCount > 0 && downloadedCount === totalCount,
      };
    },
    [isTrackDownloaded, offlinePlaylists],
  );

  useEffect(() => {
    const performCheck = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);

      try {
        const res = await fetch("http://192.168.114.7:3000/health", {
          method: "GET",
          signal: controller.signal,
        });
        setIsOnline(res.ok);
      } catch {
        setIsOnline(false);
      } finally {
        clearTimeout(timeout);
        controller.abort();
      }
    };

    void performCheck();
    const id = setInterval(() => {
      void performCheck();
    }, 30000);

    return () => {
      clearInterval(id);
    };
  }, []);

  return (
    <OfflineContext.Provider
      value={{
        downloadsMap,
        downloadedTracks,
        offlinePlaylists,
        isHydrated,
        isOnline,
        getDownloadItem,
        isTrackDownloaded,
        downloadTrack,
        removeTrackDownload,
        toggleTrackDownload,
        markPlaylistOffline,
        unmarkPlaylistOffline,
        getPlaylistOfflineStatus,
      }}
    >
      {children}
    </OfflineContext.Provider>
  );
}

export function useOffline() {
  const ctx = useContext(OfflineContext);
  if (!ctx) {
    throw new Error("useOffline must be used within OfflineProvider");
  }
  return ctx;
}
