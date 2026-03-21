import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
  useMemo,
} from "react";

/**
 * Download notification shown in a queue at the bottom of the screen
 */
export type DownloadNotification = {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  message: string; // "Download started", "3 songs downloading…", etc.
  dismissAfter?: number; // milliseconds (default 3000)
};

/**
 * Download state machine states
 */
export type DownloadState =
  | "idle"
  | "queued"
  | "downloading"
  | "paused"
  | "completed"
  | "cancelled"
  | "failed";

/**
 * Represents the state of a single download
 */
export type DownloadProgress = {
  trackId: string;
  state: DownloadState;
  progress: number; // 0-1
  error?: string;
};

type DownloadContextType = {
  // Notifications queue
  notifications: DownloadNotification[];
  addNotification: (notification: DownloadNotification) => void;
  removeNotification: (id: string) => void;

  // Download control
  downloadProgress: Record<string, DownloadProgress>;
  getDownloadProgress: (trackId: string) => DownloadProgress | undefined;
  setDownloadProgress: (trackId: string, progress: DownloadProgress) => void;
  pauseDownload: (trackId: string) => void;
  resumeDownload: (trackId: string) => void;
  cancelDownload: (trackId: string) => void;

  // Batch operations
  getActiveDownloadsCount: () => number;
  getQueuedDownloadsCount: () => number;
};

const DownloadContext = createContext<DownloadContextType | null>(null);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<DownloadNotification[]>(
    [],
  );
  const [downloadProgress, setDownloadProgressState] = useState<
    Record<string, DownloadProgress>
  >({});

  const addNotification = useCallback((notification: DownloadNotification) => {
    setNotifications((prev) => [...prev, notification]);

    // Auto-dismiss after specified time
    const dismissAfter = notification.dismissAfter ?? 3000;
    const timeout = setTimeout(() => {
      removeNotification(notification.id);
    }, dismissAfter);

    // Store timeout ID for cleanup if needed
    return timeout;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const setDownloadProgress = useCallback(
    (trackId: string, progress: DownloadProgress) => {
      setDownloadProgressState((prev) => ({
        ...prev,
        [trackId]: progress,
      }));
    },
    [],
  );

  const getDownloadProgress = useCallback(
    (trackId: string) => downloadProgress[trackId],
    [downloadProgress],
  );

  const pauseDownload = useCallback((trackId: string) => {
    setDownloadProgressState((prev) => {
      const current = prev[trackId];
      if (!current) return prev;
      return {
        ...prev,
        [trackId]: {
          ...current,
          state: "paused",
        },
      };
    });
  }, []);

  const resumeDownload = useCallback((trackId: string) => {
    setDownloadProgressState((prev) => {
      const current = prev[trackId];
      if (!current) return prev;
      return {
        ...prev,
        [trackId]: {
          ...current,
          state: "downloading",
        },
      };
    });
  }, []);

  const cancelDownload = useCallback((trackId: string) => {
    setDownloadProgressState((prev) => {
      const current = prev[trackId];
      if (!current) return prev;

      const next = { ...prev };
      delete next[trackId];
      return next;
    });
  }, []);

  const getActiveDownloadsCount = useCallback(() => {
    return Object.values(downloadProgress).filter(
      (d) => d.state === "downloading",
    ).length;
  }, [downloadProgress]);

  const getQueuedDownloadsCount = useCallback(() => {
    return Object.values(downloadProgress).filter((d) => d.state === "queued")
      .length;
  }, [downloadProgress]);

  const value: DownloadContextType = useMemo(
    () => ({
      notifications,
      addNotification,
      removeNotification,
      downloadProgress,
      getDownloadProgress,
      setDownloadProgress,
      pauseDownload,
      resumeDownload,
      cancelDownload,
      getActiveDownloadsCount,
      getQueuedDownloadsCount,
    }),
    [
      notifications,
      addNotification,
      removeNotification,
      downloadProgress,
      getDownloadProgress,
      setDownloadProgress,
      pauseDownload,
      resumeDownload,
      cancelDownload,
      getActiveDownloadsCount,
      getQueuedDownloadsCount,
    ],
  );

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const ctx = useContext(DownloadContext);
  if (!ctx) {
    throw new Error("useDownload must be used within DownloadProvider");
  }
  return ctx;
}
