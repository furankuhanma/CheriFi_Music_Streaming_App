import { useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useOffline } from "../context/OfflineContext";
import { useDownload } from "../context/DownloadContext";

/**
 * Hook to integrate OfflineContext downloads with DownloadContext UI state
 * Listens for download state changes and updates the UI accordingly
 *
 * Usage: Just call useDownloadIntegration() at the top level (e.g., in RootLayout)
 */
export function useDownloadIntegration() {
  const { isLoggedIn } = useAuth();
  const { downloadsMap } = useOffline();
  const {
    addNotification,
    setDownloadProgress,
    getDownloadProgress,
    getActiveDownloadsCount,
  } = useDownload();

  const previousDownloadsRef = useRef<Record<string, string>>({});

  useEffect(() => {
    // Only integrate when user is logged in
    if (!isLoggedIn) return;

    Object.entries(downloadsMap).forEach(([trackId, item]) => {
      const previousStatus = previousDownloadsRef.current[trackId];

      // Show notification when download starts
      if (previousStatus !== "downloading" && item.status === "downloading") {
        // Create unique ID for notification
        const notifId = `${trackId}-${Date.now()}`;

        addNotification({
          id: notifId,
          trackId,
          title: item.track.title,
          artist: item.track.artist.name,
          coverUrl: item.track.coverUrl,
          message: "Download started",
          dismissAfter: 3000,
        });
      }

      // Update download progress in DownloadContext
      const currentProgress = getDownloadProgress(trackId);
      if (!currentProgress || currentProgress.progress !== item.progress) {
        setDownloadProgress(trackId, {
          trackId,
          state: item.status as any,
          progress: item.progress,
          error: item.error,
        });
      }

      // Update previous status tracking
      previousDownloadsRef.current[trackId] = item.status;
    });

    // Clean up references for deleted items
    Object.keys(previousDownloadsRef.current).forEach((trackId) => {
      if (!downloadsMap[trackId]) {
        delete previousDownloadsRef.current[trackId];
      }
    });
  }, [isLoggedIn, downloadsMap, addNotification, setDownloadProgress, getDownloadProgress]);
}
