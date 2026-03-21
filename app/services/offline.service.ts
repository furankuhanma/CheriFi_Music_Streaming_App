import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import { Track } from "./tracks.service";

export type DownloadStatus = "downloading" | "downloaded" | "failed" | "paused";

export type OfflineDownloadItem = {
  trackId: string;
  track: Track;
  localUri: string;
  status: DownloadStatus;
  progress: number;
  error?: string;
  updatedAt: string;
};

/**
 * Store resumable download references to support pause/resume
 * This is an in-memory map since downloads are process-specific
 */
export type DownloadResumableRef = {
  resumable: FileSystem.DownloadResumable;
  isPaused: boolean;
};

export type OfflinePlaylistItem = {
  playlistId: string;
  trackIds: string[];
  updatedAt: string;
};

export type OfflineDownloadsMap = Record<string, OfflineDownloadItem>;
export type OfflinePlaylistsMap = Record<string, OfflinePlaylistItem>;

const STORAGE_KEY_DOWNLOADS = "@cherifi:offline:downloads";
const STORAGE_KEY_PLAYLISTS = "@cherifi:offline:playlists";

const OFFLINE_AUDIO_DIR = `${FileSystem.documentDirectory}offline-audio`;

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export const OfflineService = {
  async ensureOfflineDirectory(): Promise<void> {
    const info = await FileSystem.getInfoAsync(OFFLINE_AUDIO_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(OFFLINE_AUDIO_DIR, {
        intermediates: true,
      });
    }
  },

  trackFileUri(trackId: string): string {
    return `${OFFLINE_AUDIO_DIR}/${trackId}.mp3`;
  },

  async readDownloads(): Promise<OfflineDownloadsMap> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_DOWNLOADS);
    return safeParse<OfflineDownloadsMap>(raw, {});
  },

  async writeDownloads(map: OfflineDownloadsMap): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_DOWNLOADS, JSON.stringify(map));
  },

  async readOfflinePlaylists(): Promise<OfflinePlaylistsMap> {
    const raw = await AsyncStorage.getItem(STORAGE_KEY_PLAYLISTS);
    return safeParse<OfflinePlaylistsMap>(raw, {});
  },

  async writeOfflinePlaylists(map: OfflinePlaylistsMap): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEY_PLAYLISTS, JSON.stringify(map));
  },

  async clearMissingDownloadedFiles(
    map: OfflineDownloadsMap,
  ): Promise<OfflineDownloadsMap> {
    const next: OfflineDownloadsMap = { ...map };
    const ids = Object.keys(next);

    await Promise.all(
      ids.map(async (trackId) => {
        const item = next[trackId];
        if (item.status !== "downloaded") return;

        const info = await FileSystem.getInfoAsync(item.localUri);
        const hasSize =
          "size" in info && typeof info.size === "number" && info.size > 0;

        if (!info.exists || !hasSize) {
          delete next[trackId];
        }
      }),
    );

    return next;
  },

  async resolvePlayableUri(trackId: string): Promise<string | null> {
    const map = await OfflineService.readDownloads();
    const item = map[trackId];
    if (!item || item.status !== "downloaded") return null;

    const info = await FileSystem.getInfoAsync(item.localUri);
    const hasSize =
      "size" in info && typeof info.size === "number" && info.size > 0;
    if (!info.exists || !hasSize) {
      const next = { ...map };
      delete next[trackId];
      await OfflineService.writeDownloads(next);
      return null;
    }

    return item.localUri;
  },

  createDownloadResumable(
    trackId: string,
    remoteUrl: string,
    onProgress?: (progress01: number) => void,
  ): FileSystem.DownloadResumable {
    const targetUri = OfflineService.trackFileUri(trackId);

    return FileSystem.createDownloadResumable(
      remoteUrl,
      targetUri,
      {},
      (evt) => {
        if (!onProgress) return;
        const total = evt.totalBytesExpectedToWrite || 0;
        const written = evt.totalBytesWritten || 0;
        const p = total <= 0 ? 0 : written / total;
        onProgress(Math.max(0, Math.min(1, p)));
      },
    );
  },

  async removeLocalFile(localUri: string): Promise<void> {
    const info = await FileSystem.getInfoAsync(localUri);
    if (info.exists) {
      await FileSystem.deleteAsync(localUri, { idempotent: true });
    }
  },

  /**
   * Pause an ongoing download resumable
   * The partial file is preserved for resumption
   */
  pauseDownloadResumable(resumable: FileSystem.DownloadResumable): void {
    try {
      resumable.pauseAsync?.();
    } catch {
      // Silently fail if pause is not supported
    }
  },

  /**
   * Resume a paused download resumable
   */
  async resumeDownloadResumable(
    resumable: FileSystem.DownloadResumable,
  ): Promise<FileSystem.FileSystemDownloadResult | undefined> {
    try {
      return await resumable.resumeAsync?.();
    } catch {
      return undefined;
    }
  },

  /**
   * Cancel a download and clean up partial file
   */
  async cancelDownload(trackId: string): Promise<void> {
    const targetUri = OfflineService.trackFileUri(trackId);
    try {
      // First try to pause the resumable
      // This doesn't fully cancel but stops progress
      const info = await FileSystem.getInfoAsync(targetUri);
      if (info.exists) {
        await FileSystem.deleteAsync(targetUri, { idempotent: true });
      }
    } catch {
      // Silently fail
    }
  },
};
