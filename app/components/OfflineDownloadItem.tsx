import React, { useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CircularDownloadProgress } from "./CircularDownloadProgress";
import { Track } from "../services/tracks.service";
import { OfflineDownloadItem } from "../services/offline.service";
import { useOffline } from "../context/OfflineContext";
import { useDownload } from "../context/DownloadContext";

interface OfflineDownloadItemComponentProps {
  item: OfflineDownloadItem;
  onPlay: (track: Track) => void;
}

/**
 * Displays a single download item in the Offline Downloads section
 * - Shows track cover, title, artist
 * - Displays circular progress indicator with pause/resume control
 * - Offers cancel and menu options
 */
export function OfflineDownloadItemComponent({
  item,
  onPlay,
}: OfflineDownloadItemComponentProps) {
  const { removeTrackDownload } = useOffline();
  const { getDownloadProgress, pauseDownload, resumeDownload, cancelDownload } =
    useDownload();
  const [showMenu, setShowMenu] = useState(false);

  const downloadProgress = getDownloadProgress(item.trackId);
  const isDownloading = item.status === "downloading";
  const isPaused = item.status === "paused";
  const isCompleted = item.status === "downloaded";

  const handleTogglePause = () => {
    if (isPaused) {
      resumeDownload(item.trackId);
    } else if (isDownloading) {
      pauseDownload(item.trackId);
    }
  };

  const handleCancel = () => {
    Alert.alert("Cancel Download", `Stop downloading "${item.track.title}"?`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel Download",
        style: "destructive",
        onPress: async () => {
          cancelDownload(item.trackId);
          await removeTrackDownload(item.trackId);
        },
      },
    ]);
  };

  const progressValue = downloadProgress?.progress ?? item.progress;

  return (
    <View className="flex-row items-center py-3 px-4 border-b border-[#282828]">
      {/* Cover art */}
      <View className="relative mr-3">
        {item.track.coverUrl ? (
          <Image
            source={{ uri: item.track.coverUrl }}
            style={{
              width: 56,
              height: 56,
              borderRadius: 8,
              backgroundColor: "#282828",
            }}
          />
        ) : (
          <View className="w-14 h-14 bg-[#282828] rounded-lg items-center justify-center">
            <Ionicons name="musical-notes" size={24} color="#888" />
          </View>
        )}

        {/* Download progress overlay */}
        {(isDownloading || isPaused) && (
          <Pressable
            className="absolute inset-0 items-center justify-center"
            onPress={handleTogglePause}
          >
            <CircularDownloadProgress
              progress={progressValue}
              state={
                downloadProgress?.state === "idle"
                  ? "downloading"
                  : downloadProgress?.state === "queued"
                    ? "downloading"
                    : (downloadProgress?.state ?? "downloading")
              }
              onPress={handleTogglePause}
            />
          </Pressable>
        )}

        {/* Completion indicator */}
        {isCompleted && (
          <View className="absolute -bottom-1 -right-1 bg-[#1DB954] rounded-full p-1">
            <Ionicons name="checkmark" size={12} color="white" />
          </View>
        )}
      </View>

      {/* Track info */}
      <View className="flex-1">
        <Text className="text-white font-semibold text-sm" numberOfLines={1}>
          {item.track.title}
        </Text>
        <Text className="text-[#888] text-xs mt-1" numberOfLines={1}>
          {item.track.artist.name}
        </Text>

        {/* Status message */}
        <View className="mt-1.5">
          {isDownloading && (
            <Text className="text-[#1DB954] text-xs">
              Downloading... {Math.round(progressValue * 100)}%
            </Text>
          )}
          {isPaused && (
            <Text className="text-[#FFA500] text-xs">
              Paused at {Math.round(progressValue * 100)}%
            </Text>
          )}
          {isCompleted && (
            <Text className="text-[#1DB954] text-xs">Downloaded</Text>
          )}
        </View>
      </View>

      {/* Action buttons */}
      <View className="flex-row items-center gap-2 ml-2">
        {/* Play button - always available */}
        <Pressable
          onPress={() => onPlay(item.track)}
          hitSlop={8}
          className="p-2"
        >
          <Ionicons
            name="play-circle"
            size={24}
            color={isCompleted ? "#1DB954" : "#888"}
          />
        </Pressable>

        {/* Menu button */}
        <Pressable
          onPress={() => setShowMenu(!showMenu)}
          hitSlop={8}
          className="p-2"
        >
          <Ionicons name="ellipsis-vertical" size={20} color="#888" />
        </Pressable>
      </View>

      {/* Context menu */}
      {showMenu && (
        <View className="absolute right-0 top-12 bg-[#282828] rounded-lg shadow-lg z-10 min-w-[160px]">
          {isDownloading || isPaused ? (
            <Pressable
              onPress={() => {
                handleTogglePause();
                setShowMenu(false);
              }}
              className="px-4 py-3 border-b border-[#1E1E1E]"
            >
              <Text className="text-white text-sm">
                {isPaused ? "Resume" : "Pause"}
              </Text>
            </Pressable>
          ) : null}

          {isDownloading || isPaused ? (
            <Pressable
              onPress={() => {
                handleCancel();
                setShowMenu(false);
              }}
              className="px-4 py-3 border-b border-[#1E1E1E]"
            >
              <Text className="text-[#FF4D4D] text-sm">Cancel</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => {
              removeTrackDownload(item.trackId);
              setShowMenu(false);
            }}
            className="px-4 py-3"
          >
            <Text className="text-[#FF4D4D] text-sm">Remove</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
