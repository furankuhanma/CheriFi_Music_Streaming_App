// CheriFi/app/(tabs)/library.tsx

import { ReactNode, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import { useOffline } from "../context/OfflineContext";
import { useDownload } from "../context/DownloadContext";
import { PlaylistsService, Playlist } from "../services/playlists.api";
import { Track, TracksService } from "../services/tracks.service";
import PlaylistCover from "../components/PlaylistCover";
import TrackActionsSheet from "../components/TrackActionsSheet";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import { CircularDownloadProgress } from "../components/CircularDownloadProgress";
import { OfflineDownloadItem } from "../services/offline.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPlayableTrack(track: any): Track {
  return {
    id: track.id,
    title: track.title,
    duration: track.duration,
    audioUrl: track.audioUrl,
    coverUrl: track.coverUrl,
    artist: track.artist,
    album: track.album,
    genre: track.genre ?? null,
    playCount: track.playCount ?? 0,
    isLiked: track.isLiked,
    inLibrary: track.inLibrary,
  };
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  icon,
  right,
  accent = false,
}: {
  title: string;
  icon?: string;
  right?: ReactNode;
  accent?: boolean;
}) {
  return (
    <View className="flex-row items-center justify-between mb-4">
      <View className="flex-row items-center gap-2">
        {accent && (
          <View
            style={{
              width: 3,
              height: 20,
              borderRadius: 2,
              backgroundColor: "#1DB954",
              marginRight: 6,
            }}
          />
        )}
        {icon && (
          <Ionicons
            name={icon as any}
            size={16}
            color="#1DB954"
            style={{ marginRight: 4 }}
          />
        )}
        <Text className="text-white text-lg font-bold">{title}</Text>
      </View>
      {right}
    </View>
  );
}

// ─── Error state ──────────────────────────────────────────────────────────────

function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="flex-row items-center bg-[#1E1E1E] rounded-xl px-4 py-3">
      <Ionicons name="warning-outline" size={16} color="#FF4D4D" />
      <Text className="text-[#FF4D4D] text-sm flex-1 ml-2">{message}</Text>
      <TouchableOpacity onPress={onRetry}>
        <Text className="text-[#1DB954] text-sm font-semibold">Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Skeleton rows ────────────────────────────────────────────────────────────

function LoadingRows() {
  return (
    <>
      {[1, 2, 3].map((v) => (
        <View key={v} className="flex-row items-center py-3">
          <View className="w-14 h-14 rounded-xl bg-[#1E1E1E] mr-4" />
          <View className="flex-1">
            <View className="h-3 rounded-full bg-[#1E1E1E] w-2/3 mb-2.5" />
            <View className="h-2.5 rounded-full bg-[#181818] w-1/3" />
          </View>
        </View>
      ))}
    </>
  );
}

// ─── Track row (library style) ────────────────────────────────────────────────

function TrackRow({
  track,
  isActive,
  subtitle,
  onPress,
  onLongPress,
  disabled,
  disabledLabel,
  right,
}: {
  track: Track;
  isActive: boolean;
  subtitle: string;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  disabledLabel?: string;
  right?: ReactNode;
}) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      delayLongPress={350}
      disabled={disabled}
      className="flex-row items-center py-2.5"
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <View className="mr-3">
        {track.coverUrl ? (
          <Image
            source={{ uri: track.coverUrl }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              backgroundColor: "#1E1E1E",
            }}
          />
        ) : (
          <View
            style={{ width: 52, height: 52, borderRadius: 8 }}
            className="bg-[#1E1E1E] items-center justify-center"
          >
            <Ionicons name="musical-note" size={20} color="#444" />
          </View>
        )}
      </View>

      <View className="flex-1">
        <Text
          className="text-sm font-semibold"
          style={{ color: isActive ? "#1DB954" : "white" }}
          numberOfLines={1}
        >
          {track.title}
        </Text>
        <Text className="text-[#666] text-xs mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
        {disabledLabel && (
          <Text className="text-[#FF9E9E] text-[11px] mt-0.5">
            {disabledLabel}
          </Text>
        )}
      </View>

      {isActive && (
        <Ionicons
          name="musical-notes"
          size={14}
          color="#1DB954"
          style={{ marginRight: 8 }}
        />
      )}
      {right}
    </TouchableOpacity>
  );
}

// ─── Offline download row (click to play, minimal chrome) ─────────────────────

function DownloadRow({
  item,
  isActive,
  onPlay,
}: {
  item: OfflineDownloadItem;
  isActive: boolean;
  onPlay: (track: Track) => void;
}) {
  const { removeTrackDownload } = useOffline();
  const { getDownloadProgress, pauseDownload, resumeDownload, cancelDownload } =
    useDownload();
  const [menuOpen, setMenuOpen] = useState(false);

  const progress = getDownloadProgress(item.trackId);
  const isDownloading = item.status === "downloading";
  const isPaused = item.status === "paused";
  const isCompleted = item.status === "downloaded";
  const progressValue = progress?.progress ?? item.progress;

  const handleTogglePause = () => {
    isPaused ? resumeDownload(item.trackId) : pauseDownload(item.trackId);
  };

  const handleCancel = () => {
    Alert.alert("Cancel Download", `Stop downloading "${item.track.title}"?`, [
      { text: "Keep", style: "cancel" },
      {
        text: "Cancel",
        style: "destructive",
        onPress: async () => {
          cancelDownload(item.trackId);
          await removeTrackDownload(item.trackId);
        },
      },
    ]);
  };

  return (
    <TouchableOpacity
      onPress={() => isCompleted && onPlay(item.track)}
      activeOpacity={isCompleted ? 0.7 : 1}
      className="flex-row items-center py-2.5"
    >
      {/* Cover + progress overlay */}
      <View style={{ position: "relative", marginRight: 12 }}>
        {item.track.coverUrl ? (
          <Image
            source={{ uri: item.track.coverUrl }}
            style={{
              width: 52,
              height: 52,
              borderRadius: 8,
              backgroundColor: "#1E1E1E",
            }}
          />
        ) : (
          <View
            style={{ width: 52, height: 52, borderRadius: 8 }}
            className="bg-[#1E1E1E] items-center justify-center"
          >
            <Ionicons name="musical-notes" size={20} color="#444" />
          </View>
        )}

        {(isDownloading || isPaused) && (
          <Pressable
            style={{
              position: "absolute",
              inset: 0,
              alignItems: "center",
              justifyContent: "center",
            }}
            onPress={handleTogglePause}
          >
            <CircularDownloadProgress
              progress={progressValue}
              state={
                progress?.state === "idle" || progress?.state === "queued"
                  ? "downloading"
                  : (progress?.state ?? "downloading")
              }
              onPress={handleTogglePause}
            />
          </Pressable>
        )}

        {/* Subtle green dot for completed */}
        {isCompleted && (
          <View
            style={{
              position: "absolute",
              bottom: 3,
              right: 3,
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "#1DB954",
              borderWidth: 1.5,
              borderColor: "#121212",
            }}
          />
        )}

        {isActive && isCompleted && (
          <View
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: 8,
              backgroundColor: "rgba(0,0,0,0.45)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons name="musical-notes" size={18} color="#1DB954" />
          </View>
        )}
      </View>

      {/* Info */}
      <View className="flex-1">
        <Text
          className="text-sm font-semibold"
          style={{ color: isActive ? "#1DB954" : "white" }}
          numberOfLines={1}
        >
          {item.track.title}
        </Text>
        <Text className="text-[#666] text-xs mt-0.5" numberOfLines={1}>
          {item.track.artist.name}
        </Text>
        {isDownloading && (
          <Text className="text-[#1DB954] text-[11px] mt-1">
            {Math.round(progressValue * 100)}%
          </Text>
        )}
        {isPaused && (
          <Text className="text-[#F4C95D] text-[11px] mt-1">
            Paused · {Math.round(progressValue * 100)}%
          </Text>
        )}
      </View>

      {/* Three-dot menu */}
      <View style={{ position: "relative" }}>
        <TouchableOpacity
          onPress={() => setMenuOpen((p) => !p)}
          hitSlop={8}
          className="p-2"
        >
          <Ionicons name="ellipsis-vertical" size={18} color="#555" />
        </TouchableOpacity>

        {menuOpen && (
          <View
            style={{
              position: "absolute",
              right: 0,
              top: 32,
              backgroundColor: "#252525",
              borderRadius: 10,
              minWidth: 160,
              zIndex: 20,
              shadowColor: "#000",
              shadowOpacity: 0.4,
              shadowRadius: 8,
              elevation: 8,
            }}
          >
            {(isDownloading || isPaused) && (
              <TouchableOpacity
                onPress={() => {
                  handleTogglePause();
                  setMenuOpen(false);
                }}
                className="px-4 py-3 border-b border-[#2A2A2A]"
              >
                <Text className="text-white text-sm">
                  {isPaused ? "Resume" : "Pause"}
                </Text>
              </TouchableOpacity>
            )}
            {(isDownloading || isPaused) && (
              <TouchableOpacity
                onPress={() => {
                  handleCancel();
                  setMenuOpen(false);
                }}
                className="px-4 py-3 border-b border-[#2A2A2A]"
              >
                <Text className="text-[#FF4D4D] text-sm">Cancel download</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => {
                removeTrackDownload(item.trackId);
                setMenuOpen(false);
              }}
              className="px-4 py-3"
            >
              <Text className="text-[#FF4D4D] text-sm">Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Playlist row ─────────────────────────────────────────────────────────────

function PlaylistRow({
  playlist,
  onPress,
  offlineStatus,
  onToggleOffline,
  isOnline,
}: {
  playlist: Playlist;
  onPress: () => void;
  offlineStatus: {
    isMarkedOffline: boolean;
    isComplete: boolean;
    downloadedCount: number;
    totalCount: number;
  };
  onToggleOffline: () => void;
  isOnline: boolean;
}) {
  const count = playlist.tracks?.length ?? 0;

  return (
    <TouchableOpacity onPress={onPress} className="flex-row items-center py-3">
      <View className="mr-4">
        <PlaylistCover playlist={playlist} size={64} rounded={10} />
      </View>

      <View className="flex-1">
        <Text className="text-white text-sm font-semibold" numberOfLines={1}>
          {playlist.title}
        </Text>
        <View className="flex-row items-center mt-1 gap-2">
          <View className="bg-[#1E1E1E] rounded-full px-2 py-0.5">
            <Text className="text-[#666] text-[11px]">
              {count} {count === 1 ? "song" : "songs"}
            </Text>
          </View>
          {offlineStatus.isMarkedOffline && (
            <View
              className="rounded-full px-2 py-0.5"
              style={{
                backgroundColor: offlineStatus.isComplete
                  ? "#1DB95420"
                  : "#F4C95D20",
              }}
            >
              <Text
                className="text-[11px] font-semibold"
                style={{
                  color: offlineStatus.isComplete ? "#1DB954" : "#F4C95D",
                }}
              >
                {offlineStatus.isComplete
                  ? "Offline"
                  : `${offlineStatus.downloadedCount}/${offlineStatus.totalCount}`}
              </Text>
            </View>
          )}
        </View>
      </View>

      {isOnline && (
        <TouchableOpacity
          onPress={onToggleOffline}
          hitSlop={8}
          className="p-2 ml-1"
        >
          <Ionicons
            name={
              offlineStatus.isMarkedOffline
                ? "checkmark-circle"
                : "download-outline"
            }
            size={20}
            color={offlineStatus.isComplete ? "#1DB954" : "#444"}
          />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

// ─── Edit modal ───────────────────────────────────────────────────────────────

type PlaylistEditState = {
  title: string;
  description: string;
  coverUrl: string;
};

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function LibraryScreen() {
  const { playTrack, currentTrack, addToQueue, addToQueueNext } = usePlayer();
  const {
    downloadedTracks,
    downloadsMap,
    isTrackDownloaded,
    isOnline,
    toggleTrackDownload,
    markPlaylistOffline,
    unmarkPlaylistOffline,
    getPlaylistOfflineStatus,
  } = useOffline();
  const { getActiveDownloadsCount } = useDownload();

  const [liked, setLiked] = useState<Track[]>([]);
  const [recent, setRecent] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [showAllLiked, setShowAllLiked] = useState(false);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [playlistTrackId, setPlaylistTrackId] = useState<string | null>(null);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(
    null,
  );
  const [editVisible, setEditVisible] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editState, setEditState] = useState<PlaylistEditState>({
    title: "",
    description: "",
    coverUrl: "",
  });

  const [searchQuery, setSearchQuery] = useState("");
  const trimmedQuery = searchQuery.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;

  const searchedTracks = useMemo(() => {
    if (!isSearching) return [];
    const all = [...downloadedTracks, ...liked, ...recent];
    const seen = new Set<string>();
    return all.filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return (
        t.title.toLowerCase().includes(trimmedQuery) ||
        t.artist.name.toLowerCase().includes(trimmedQuery) ||
        (t.album?.title ?? "").toLowerCase().includes(trimmedQuery)
      );
    });
  }, [isSearching, trimmedQuery, downloadedTracks, liked, recent]);

  const searchedPlaylists = useMemo(() => {
    if (!isSearching) return [];
    return playlists.filter((p) =>
      p.title.toLowerCase().includes(trimmedQuery),
    );
  }, [isSearching, trimmedQuery, playlists]);

  const loadLibrary = useCallback(async () => {
    setError(null);
    if (!isOnline) {
      setLoading(false);
      return;
    }
    try {
      const [playlistsData, likedData, recentData] = await Promise.all([
        PlaylistsService.getAll(),
        TracksService.getLiked(100),
        TracksService.getRecentlyPlayed(100),
      ]);
      setPlaylists(playlistsData);
      setLiked(likedData);
      setRecent(recentData);
    } catch {
      setError("Could not load your library.");
    }
  }, [isOnline]);

  const loadInitial = useCallback(async () => {
    setLoading(true);
    await loadLibrary();
    setLoading(false);
  }, [loadLibrary]);

  useFocusEffect(
    useCallback(() => {
      loadInitial();
    }, [loadInitial]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLibrary();
    setRefreshing(false);
  }, [loadLibrary]);

  const selectedPlaylistFresh = useMemo(() => {
    if (!selectedPlaylist) return null;
    return (
      playlists.find((p) => p.id === selectedPlaylist.id) ?? selectedPlaylist
    );
  }, [playlists, selectedPlaylist]);

  const openEdit = useCallback((playlist: Playlist) => {
    setEditState({
      title: playlist.title,
      description: playlist.description ?? "",
      coverUrl: playlist.coverUrl ?? "",
    });
    setEditVisible(true);
  }, []);

  const submitEdit = useCallback(async () => {
    if (!selectedPlaylistFresh) return;
    if (!editState.title.trim()) {
      Alert.alert("Invalid title", "Playlist title is required.");
      return;
    }
    setSavingEdit(true);
    try {
      const updated = await PlaylistsService.update(selectedPlaylistFresh.id, {
        title: editState.title.trim(),
        description: editState.description.trim() || null,
        coverUrl: editState.coverUrl.trim() || null,
      });
      setPlaylists((prev) =>
        prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)),
      );
      setSelectedPlaylist((prev) =>
        prev && prev.id === updated.id ? { ...prev, ...updated } : prev,
      );
      setEditVisible(false);
    } catch {
      Alert.alert("Update failed", "Could not save playlist changes.");
    } finally {
      setSavingEdit(false);
    }
  }, [selectedPlaylistFresh, editState]);

  const handleDeletePlaylist = useCallback((playlist: Playlist) => {
    Alert.alert(
      "Delete playlist",
      `Delete "${playlist.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await PlaylistsService.delete(playlist.id);
              setPlaylists((prev) => prev.filter((p) => p.id !== playlist.id));
              setSelectedPlaylist((prev) =>
                prev?.id === playlist.id ? null : prev,
              );
            } catch {
              Alert.alert("Delete failed", "Could not delete playlist.");
            }
          },
        },
      ],
    );
  }, []);

  const handleLikeToggle = useCallback(async (track: Track) => {
    try {
      if (track.isLiked) {
        await TracksService.unlike(track.id);
      } else {
        await TracksService.like(track.id);
      }
      setLiked((prev) => {
        if (track.isLiked) return prev.filter((t) => t.id !== track.id);
        const exists = prev.some((t) => t.id === track.id);
        return exists ? prev : [{ ...track, isLiked: true }, ...prev];
      });
      setRecent((prev) =>
        prev.map((t) =>
          t.id === track.id ? { ...t, isLiked: !track.isLiked } : t,
        ),
      );
    } catch {
      Alert.alert("Action failed", "Could not update liked status.");
    }
  }, []);

  const handleTrackPress = useCallback(
    (track: Track) => {
      if (!isOnline && !isTrackDownloaded(track.id)) {
        Alert.alert("Unavailable offline", "This track is not downloaded.");
        return;
      }
      playTrack(track);
    },
    [isOnline, isTrackDownloaded, playTrack],
  );

  const activeDownloads = getActiveDownloadsCount();
  const downloadItems = Object.values(downloadsMap).sort((a, b) => {
    if (a.status === "downloading" || a.status === "paused") return -1;
    if (b.status === "downloading" || b.status === "paused") return 1;
    return +new Date(b.updatedAt) - +new Date(a.updatedAt);
  });

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <ScrollView
        className="px-4 pt-6"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1DB954"
          />
        }
      >
        {/* ── Header ── */}
        <View className="flex-row items-center justify-between mb-5">
          <Text className="text-white text-2xl font-bold">Your Library</Text>
          {!isOnline && (
            <View className="flex-row items-center bg-[#F4C95D18] border border-[#F4C95D30] rounded-full px-3 py-1">
              <View className="w-1.5 h-1.5 rounded-full bg-[#F4C95D] mr-1.5" />
              <Text className="text-[#F4C95D] text-xs font-semibold">
                Offline
              </Text>
            </View>
          )}
        </View>

        {/* ── Search ── */}
        <View className="flex-row items-center bg-[#1A1A1A] border border-[#252525] rounded-2xl px-4 py-3 mb-6">
          <Ionicons name="search" size={16} color="#444" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search your library..."
            placeholderTextColor="#444"
            className="flex-1 text-white text-sm ml-3"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#444" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Loading state ── */}
        {loading && <LoadingRows />}

        {/* ── Error state ── */}
        {error && !loading && (
          <View className="mb-6">
            <SectionError message={error} onRetry={loadInitial} />
          </View>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            SEARCH RESULTS
        ══════════════════════════════════════════════════════════════════ */}
        {!loading && !error && isSearching && (
          <>
            {searchedTracks.length === 0 && searchedPlaylists.length === 0 ? (
              <View className="items-center py-16">
                <View className="w-16 h-16 rounded-full bg-[#1A1A1A] items-center justify-center mb-4">
                  <Ionicons name="search-outline" size={28} color="#333" />
                </View>
                <Text className="text-[#444] text-sm">
                  No results for "{searchQuery.trim()}"
                </Text>
              </View>
            ) : (
              <>
                {searchedTracks.length > 0 && (
                  <View className="mb-8">
                    <SectionHeader
                      title="Tracks"
                      right={
                        <View className="bg-[#1E1E1E] rounded-full px-2.5 py-0.5">
                          <Text className="text-[#666] text-xs">
                            {searchedTracks.length}
                          </Text>
                        </View>
                      }
                    />
                    {searchedTracks.map((track) => {
                      const downloaded = isTrackDownloaded(track.id);
                      const disabledOffline = !isOnline && !downloaded;
                      return (
                        <TrackRow
                          key={track.id}
                          track={track}
                          isActive={currentTrack?.id === track.id}
                          subtitle={track.artist.name}
                          onPress={() => handleTrackPress(track)}
                          onLongPress={() => {
                            setSelectedTrack(track);
                            setSheetVisible(true);
                          }}
                          disabled={disabledOffline}
                          disabledLabel={
                            disabledOffline ? "Unavailable offline" : undefined
                          }
                          right={
                            isOnline ? (
                              <TouchableOpacity
                                onPress={() => toggleTrackDownload(track)}
                                hitSlop={8}
                                className="p-2 ml-1"
                              >
                                <Ionicons
                                  name={
                                    downloaded
                                      ? "checkmark-circle"
                                      : "download-outline"
                                  }
                                  size={19}
                                  color={downloaded ? "#1DB954" : "#444"}
                                />
                              </TouchableOpacity>
                            ) : undefined
                          }
                        />
                      );
                    })}
                  </View>
                )}

                {searchedPlaylists.length > 0 && (
                  <View className="mb-8">
                    <SectionHeader
                      title="Playlists"
                      right={
                        <View className="bg-[#1E1E1E] rounded-full px-2.5 py-0.5">
                          <Text className="text-[#666] text-xs">
                            {searchedPlaylists.length}
                          </Text>
                        </View>
                      }
                    />
                    {searchedPlaylists.map((playlist) => (
                      <PlaylistRow
                        key={playlist.id}
                        playlist={playlist}
                        onPress={() => setSelectedPlaylist(playlist)}
                        offlineStatus={getPlaylistOfflineStatus(playlist)}
                        onToggleOffline={async () => {
                          const s = getPlaylistOfflineStatus(playlist);
                          s.isMarkedOffline
                            ? await unmarkPlaylistOffline(playlist.id)
                            : await markPlaylistOffline(playlist);
                        }}
                        isOnline={isOnline}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            MAIN LIBRARY VIEW
        ══════════════════════════════════════════════════════════════════ */}
        {!loading && !error && !isSearching && (
          <>
            {/* ── Offline Downloads ── */}
            {downloadItems.length > 0 && (
              <View className="mb-8">
                <SectionHeader
                  title="Downloaded"
                  icon="arrow-down-circle"
                  accent
                  right={
                    <View className="flex-row items-center gap-2">
                      {activeDownloads > 0 && (
                        <View className="flex-row items-center bg-[#1DB95420] rounded-full px-2.5 py-1 gap-1.5">
                          <View className="w-1.5 h-1.5 rounded-full bg-[#1DB954]" />
                          <Text className="text-[#1DB954] text-xs font-semibold">
                            {activeDownloads} active
                          </Text>
                        </View>
                      )}
                      <View className="bg-[#1E1E1E] rounded-full px-2.5 py-0.5">
                        <Text className="text-[#666] text-xs">
                          {downloadItems.length}
                        </Text>
                      </View>
                    </View>
                  }
                />
                <View className="bg-[#161616] rounded-2xl px-4 py-1">
                  {downloadItems.map((item, idx) => (
                    <View key={item.trackId}>
                      <DownloadRow
                        item={item}
                        isActive={currentTrack?.id === item.trackId}
                        onPlay={handleTrackPress}
                      />
                      {idx < downloadItems.length - 1 && (
                        <View className="h-px bg-[#1E1E1E] ml-16" />
                      )}
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* ── Playlists ── */}
            <View className="mb-8">
              <SectionHeader
                title="Playlists"
                icon="musical-notes"
                accent
                right={
                  <View className="bg-[#1E1E1E] rounded-full px-2.5 py-0.5">
                    <Text className="text-[#666] text-xs">
                      {playlists.length}
                    </Text>
                  </View>
                }
              />

              {playlists.length === 0 ? (
                <View className="bg-[#161616] rounded-2xl px-5 py-8 items-center">
                  <Ionicons
                    name="musical-notes-outline"
                    size={32}
                    color="#2A2A2A"
                  />
                  <Text className="text-[#444] text-sm mt-3">
                    No playlists yet
                  </Text>
                </View>
              ) : (
                <View className="bg-[#161616] rounded-2xl px-4 py-1">
                  {playlists.map((playlist, idx) => (
                    <View key={playlist.id}>
                      <PlaylistRow
                        playlist={playlist}
                        onPress={() => setSelectedPlaylist(playlist)}
                        offlineStatus={getPlaylistOfflineStatus(playlist)}
                        onToggleOffline={async () => {
                          const s = getPlaylistOfflineStatus(playlist);
                          s.isMarkedOffline
                            ? await unmarkPlaylistOffline(playlist.id)
                            : await markPlaylistOffline(playlist);
                        }}
                        isOnline={isOnline}
                      />
                      {idx < playlists.length - 1 && (
                        <View className="h-px bg-[#1E1E1E] ml-20" />
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* ── Liked Songs ── */}
            {liked.length > 0 && (
              <View className="mb-8">
                <SectionHeader
                  title="Liked Songs"
                  icon="heart"
                  accent
                  right={
                    <View className="bg-[#1E1E1E] rounded-full px-2.5 py-0.5">
                      <Text className="text-[#666] text-xs">
                        {liked.length}
                      </Text>
                    </View>
                  }
                />
                <View className="bg-[#161616] rounded-2xl px-4 py-1">
                  {(showAllLiked ? liked : liked.slice(0, 8)).map(
                    (track, idx) => {
                      const sl = showAllLiked ? liked : liked.slice(0, 8);
                      const disabledOffline =
                        !isOnline && !isTrackDownloaded(track.id);
                      return (
                        <View key={track.id}>
                          <TrackRow
                            track={track}
                            isActive={currentTrack?.id === track.id}
                            subtitle={track.artist.name}
                            onPress={() => handleTrackPress(track)}
                            onLongPress={() => {
                              setSelectedTrack(track);
                              setSheetVisible(true);
                            }}
                            disabled={disabledOffline}
                            disabledLabel={
                              disabledOffline
                                ? "Unavailable offline"
                                : undefined
                            }
                          />
                          {idx < sl.length - 1 && (
                            <View className="h-px bg-[#1E1E1E] ml-16" />
                          )}
                        </View>
                      );
                    },
                  )}
                </View>
                {liked.length > 8 && (
                  <TouchableOpacity
                    onPress={() => setShowAllLiked((p) => !p)}
                    className="mt-3 self-start"
                  >
                    <Text className="text-[#1DB954] text-sm font-semibold">
                      {showAllLiked ? "Show less" : `Show all ${liked.length}`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {/* ── Recently Played ── */}
            {recent.length > 0 && (
              <View className="mb-8">
                <SectionHeader
                  title="Recently Played"
                  icon="time"
                  accent
                  right={
                    <View className="bg-[#1E1E1E] rounded-full px-2.5 py-0.5">
                      <Text className="text-[#666] text-xs">
                        {recent.length}
                      </Text>
                    </View>
                  }
                />
                <View className="bg-[#161616] rounded-2xl px-4 py-1">
                  {(showAllRecent ? recent : recent.slice(0, 20)).map(
                    (track, idx) => {
                      const sl = showAllRecent ? recent : recent.slice(0, 20);
                      const disabledOffline =
                        !isOnline && !isTrackDownloaded(track.id);
                      return (
                        <View key={track.id}>
                          <TrackRow
                            track={track}
                            isActive={currentTrack?.id === track.id}
                            subtitle={track.artist.name}
                            onPress={() => handleTrackPress(track)}
                            onLongPress={() => {
                              setSelectedTrack(track);
                              setSheetVisible(true);
                            }}
                            disabled={disabledOffline}
                            disabledLabel={
                              disabledOffline
                                ? "Unavailable offline"
                                : undefined
                            }
                          />
                          {idx < sl.length - 1 && (
                            <View className="h-px bg-[#1E1E1E] ml-16" />
                          )}
                        </View>
                      );
                    },
                  )}
                </View>
                {recent.length > 20 && (
                  <TouchableOpacity
                    onPress={() => setShowAllRecent((p) => !p)}
                    className="mt-3 self-start"
                  >
                    <Text className="text-[#1DB954] text-sm font-semibold">
                      {showAllRecent
                        ? "Show less"
                        : `View ${recent.length - 20} more`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ══════════════════════════════════════════════════════════════════
          PLAYLIST DETAIL MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={Boolean(selectedPlaylistFresh)}
        animationType="slide"
        onRequestClose={() => setSelectedPlaylist(null)}
      >
        <SafeAreaView className="flex-1 bg-[#121212]">
          {selectedPlaylistFresh && (
            <>
              {/* Header */}
              <View className="px-4 pt-3 pb-3 flex-row items-center">
                <TouchableOpacity
                  onPress={() => setSelectedPlaylist(null)}
                  className="mr-3 p-1"
                >
                  <Ionicons name="chevron-back" size={24} color="white" />
                </TouchableOpacity>
                <Text
                  className="text-white text-lg font-bold flex-1"
                  numberOfLines={1}
                >
                  {selectedPlaylistFresh.title}
                </Text>
                <TouchableOpacity
                  className="mr-3 p-1"
                  onPress={() => openEdit(selectedPlaylistFresh)}
                >
                  <Ionicons name="create-outline" size={20} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity
                  className="p-1"
                  onPress={() => handleDeletePlaylist(selectedPlaylistFresh)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF4D4D" />
                </TouchableOpacity>
              </View>

              <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
                {/* Cover + meta */}
                <View className="items-center py-6 mb-2">
                  <PlaylistCover
                    playlist={selectedPlaylistFresh}
                    size={180}
                    rounded={16}
                  />
                  <Text className="text-white text-xl font-bold mt-4">
                    {selectedPlaylistFresh.title}
                  </Text>
                  <Text className="text-[#666] text-sm mt-1">
                    {selectedPlaylistFresh.tracks.length}{" "}
                    {selectedPlaylistFresh.tracks.length === 1
                      ? "song"
                      : "songs"}
                  </Text>

                  {/* Offline toggle pill */}
                  {(() => {
                    const s = getPlaylistOfflineStatus(selectedPlaylistFresh);
                    return (
                      <TouchableOpacity
                        onPress={async () => {
                          s.isMarkedOffline
                            ? await unmarkPlaylistOffline(
                                selectedPlaylistFresh.id,
                              )
                            : await markPlaylistOffline(selectedPlaylistFresh);
                        }}
                        className="flex-row items-center mt-4 rounded-full px-4 py-2"
                        style={{
                          backgroundColor: s.isMarkedOffline
                            ? "#1DB95420"
                            : "#1E1E1E",
                        }}
                      >
                        <Ionicons
                          name={
                            s.isMarkedOffline
                              ? "checkmark-circle"
                              : "download-outline"
                          }
                          size={15}
                          color={
                            s.isComplete
                              ? "#1DB954"
                              : s.isMarkedOffline
                                ? "#1DB954"
                                : "#666"
                          }
                        />
                        <Text
                          className="text-xs font-semibold ml-2"
                          style={{
                            color: s.isMarkedOffline ? "#1DB954" : "#666",
                          }}
                        >
                          {s.isMarkedOffline
                            ? `Offline · ${s.downloadedCount}/${s.totalCount}`
                            : "Save offline"}
                        </Text>
                      </TouchableOpacity>
                    );
                  })()}
                </View>

                {/* Track list */}
                {selectedPlaylistFresh.tracks.length === 0 ? (
                  <View className="items-center py-12">
                    <Ionicons
                      name="musical-notes-outline"
                      size={40}
                      color="#2A2A2A"
                    />
                    <Text className="text-[#444] text-sm mt-3">
                      This playlist is empty
                    </Text>
                  </View>
                ) : (
                  <View className="bg-[#161616] rounded-2xl px-4 py-1 mb-8">
                    {selectedPlaylistFresh.tracks.map((item, idx) => {
                      const track = toPlayableTrack(item.track);
                      const disabledOffline =
                        !isOnline && !isTrackDownloaded(track.id);
                      return (
                        <View
                          key={`${selectedPlaylistFresh.id}-${item.trackId}`}
                        >
                          <TrackRow
                            track={track}
                            isActive={currentTrack?.id === track.id}
                            subtitle={track.artist.name}
                            onPress={() => handleTrackPress(track)}
                            onLongPress={() => {
                              setSelectedTrack(track);
                              setSheetVisible(true);
                            }}
                            disabled={disabledOffline}
                            disabledLabel={
                              disabledOffline
                                ? "Unavailable offline"
                                : undefined
                            }
                          />
                          {idx < selectedPlaylistFresh.tracks.length - 1 && (
                            <View className="h-px bg-[#1E1E1E] ml-16" />
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>

      {/* ══════════════════════════════════════════════════════════════════
          EDIT PLAYLIST MODAL
      ══════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <View className="flex-1 bg-black/70 items-center justify-center px-5">
          <View
            className="w-full rounded-2xl p-5"
            style={{
              backgroundColor: "#181818",
              borderWidth: 1,
              borderColor: "#252525",
            }}
          >
            <Text className="text-white text-base font-bold mb-5">
              Edit Playlist
            </Text>

            <Text className="text-[#555] text-xs mb-1.5 uppercase tracking-wider">
              Title
            </Text>
            <TextInput
              value={editState.title}
              onChangeText={(v) => setEditState((p) => ({ ...p, title: v }))}
              className="text-white rounded-xl px-4 py-3 mb-4"
              style={{ backgroundColor: "#222" }}
              placeholder="Playlist title"
              placeholderTextColor="#444"
            />

            <Text className="text-[#555] text-xs mb-1.5 uppercase tracking-wider">
              Description
            </Text>
            <TextInput
              value={editState.description}
              onChangeText={(v) =>
                setEditState((p) => ({ ...p, description: v }))
              }
              className="text-white rounded-xl px-4 py-3 mb-4"
              style={{ backgroundColor: "#222" }}
              placeholder="Optional description"
              placeholderTextColor="#444"
            />

            <Text className="text-[#555] text-xs mb-1.5 uppercase tracking-wider">
              Cover URL
            </Text>
            <TextInput
              value={editState.coverUrl}
              onChangeText={(v) => setEditState((p) => ({ ...p, coverUrl: v }))}
              className="text-white rounded-xl px-4 py-3 mb-5"
              style={{ backgroundColor: "#222" }}
              placeholder="https://..."
              placeholderTextColor="#444"
              autoCapitalize="none"
            />

            <View className="flex-row justify-end items-center gap-3">
              <TouchableOpacity
                onPress={() => setEditVisible(false)}
                className="px-4 py-2"
              >
                <Text className="text-[#555] text-sm font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitEdit}
                disabled={savingEdit}
                className="rounded-full px-5 py-2.5"
                style={{ backgroundColor: "#1DB954" }}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text className="text-white text-sm font-bold">Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Sheets ── */}
      <TrackActionsSheet
        track={selectedTrack}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        isLiked={Boolean(selectedTrack?.isLiked)}
        onToggleLike={handleLikeToggle}
        onPlayNext={addToQueueNext}
        onAddToQueue={addToQueue}
        onAddToPlaylist={(track) => {
          setPlaylistTrackId(track.id);
          setPlaylistModalVisible(true);
        }}
      />

      <AddToPlaylistModal
        trackId={playlistTrackId}
        visible={playlistModalVisible}
        onClose={() => setPlaylistModalVisible(false)}
      />
    </SafeAreaView>
  );
}
