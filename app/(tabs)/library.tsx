import { ReactNode, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
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
import { OfflineDownloadItemComponent } from "../components/OfflineDownloadItem";

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

function SectionHeader({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text className="text-white text-xl font-bold">{title}</Text>
      {right}
    </View>
  );
}

function SectionError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <View className="flex-row items-center bg-[#1E1E1E] rounded-lg px-3 py-3">
      <Ionicons name="warning-outline" size={16} color="#FF4D4D" />
      <Text className="text-[#FF4D4D] text-sm flex-1 ml-2">{message}</Text>
      <TouchableOpacity onPress={onRetry}>
        <Text className="text-[#1DB954] text-sm font-semibold">Retry</Text>
      </TouchableOpacity>
    </View>
  );
}

function LoadingRows() {
  return (
    <>
      {[1, 2, 3].map((v) => (
        <View key={v} className="flex-row items-center py-2.5">
          <View className="w-12 h-12 rounded-md bg-[#282828] mr-3" />
          <View className="flex-1">
            <View className="h-3 rounded bg-[#2A2A2A] w-2/3 mb-2" />
            <View className="h-3 rounded bg-[#1E1E1E] w-1/3" />
          </View>
        </View>
      ))}
    </>
  );
}

function TrackRow({
  track,
  isActive,
  subtitle,
  onPress,
  onLongPress,
  disabled,
  disabledLabel,
}: {
  track: Track;
  isActive: boolean;
  subtitle: string;
  onPress: () => void;
  onLongPress?: () => void;
  disabled?: boolean;
  disabledLabel?: string;
}) {
  return (
    <TouchableOpacity
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      delayLongPress={350}
      disabled={disabled}
      className="flex-row items-center py-2.5"
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <View className="mr-3">
        {track.coverUrl ? (
          <Image
            source={{ uri: track.coverUrl }}
            style={{
              width: 48,
              height: 48,
              borderRadius: 6,
              backgroundColor: "#282828",
            }}
          />
        ) : (
          <View className="w-12 h-12 rounded-md bg-[#282828] items-center justify-center">
            <Ionicons name="musical-note" size={18} color="#888" />
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
        <Text className="text-[#B3B3B3] text-xs mt-0.5" numberOfLines={1}>
          {subtitle}
        </Text>
        {disabledLabel ? (
          <Text className="text-[#FF9E9E] text-[11px] mt-0.5">
            {disabledLabel}
          </Text>
        ) : null}
      </View>

      {isActive && <Ionicons name="musical-notes" size={14} color="#1DB954" />}
    </TouchableOpacity>
  );
}

type PlaylistEditState = {
  title: string;
  description: string;
  coverUrl: string;
};

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
    // deduplicate by id
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

    // When offline, skip all API calls entirely — the user's downloaded
    // tracks are already available from OfflineContext. No error shown.
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
      `Delete "${playlist.title}"? This action cannot be undone.`,
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
        const exists = prev.some((t) => t.id === track.id);
        if (track.isLiked) {
          return prev.filter((t) => t.id !== track.id);
        }
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
        Alert.alert(
          "Unavailable offline",
          "This track is not downloaded for offline playback.",
        );
        return;
      }
      playTrack(track);
    },
    [isOnline, isTrackDownloaded, playTrack],
  );

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
        <Text className="text-white text-2xl font-bold mb-3">Your Library</Text>

        {!isOnline && (
          <View className="flex-row items-center bg-[#1A1A1A] border border-[#2A2A2A] rounded-lg px-3 py-2.5 mb-5">
            <Ionicons name="cloud-offline-outline" size={16} color="#F4C95D" />
            <Text className="text-[#F4C95D] text-xs ml-2 flex-1">
              You're offline. Showing downloaded songs only.
            </Text>
          </View>
        )}

        {/* ── Search Bar ── */}
        <View className="flex-row items-center bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl px-3 py-2.5 mb-6">
          <Ionicons name="search" size={16} color="#888" />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search your library..."
            placeholderTextColor="#555"
            className="flex-1 text-white text-sm ml-2"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#555" />
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View className="mb-8">
            <LoadingRows />
          </View>
        ) : null}

        {error && !loading ? (
          <View className="mb-8">
            <SectionError message={error} onRetry={loadInitial} />
          </View>
        ) : null}

        {!loading && !error && isSearching && (
          <>
            {/* ── Track Results ── */}
            {searchedTracks.length === 0 && searchedPlaylists.length === 0 ? (
              <View className="items-center py-12">
                <Ionicons name="search-outline" size={40} color="#333" />
                <Text className="text-[#555] text-sm mt-3">
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
                        <Text className="text-[#B3B3B3] text-xs">
                          {searchedTracks.length}
                        </Text>
                      }
                    />
                    {searchedTracks.map((track) => {
                      const downloaded = isTrackDownloaded(track.id);
                      const disabledOffline = !isOnline && !downloaded;
                      return (
                        <View
                          key={track.id}
                          className="flex-row items-center py-2.5"
                        >
                          <View className="flex-1">
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
                          </View>
                          {isOnline && (
                            <TouchableOpacity
                              onPress={() => toggleTrackDownload(track)}
                              hitSlop={8}
                              className="ml-2 p-2"
                            >
                              <Ionicons
                                name={
                                  downloaded
                                    ? "checkmark-circle"
                                    : "download-outline"
                                }
                                size={20}
                                color={downloaded ? "#1DB954" : "#B3B3B3"}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      );
                    })}
                  </View>
                )}

                {searchedPlaylists.length > 0 && (
                  <View className="mb-8">
                    <SectionHeader
                      title="Playlists"
                      right={
                        <Text className="text-[#B3B3B3] text-xs">
                          {searchedPlaylists.length}
                        </Text>
                      }
                    />
                    {searchedPlaylists.map((playlist) => {
                      const count = playlist.tracks?.length ?? 0;
                      const offlineState = getPlaylistOfflineStatus(playlist);
                      return (
                        <TouchableOpacity
                          key={playlist.id}
                          onPress={() => setSelectedPlaylist(playlist)}
                          className="flex-row items-center py-2.5"
                        >
                          <View className="mr-3">
                            <PlaylistCover
                              playlist={playlist}
                              size={56}
                              rounded={8}
                            />
                          </View>
                          <View className="flex-1">
                            <Text
                              className="text-white text-sm font-semibold"
                              numberOfLines={1}
                            >
                              {playlist.title}
                            </Text>
                            <Text className="text-[#B3B3B3] text-xs mt-0.5">
                              {count} song{count !== 1 ? "s" : ""}
                            </Text>
                            {offlineState.isMarkedOffline && (
                              <Text
                                className="text-xs mt-0.5"
                                style={{
                                  color: offlineState.isComplete
                                    ? "#1DB954"
                                    : "#F4C95D",
                                }}
                              >
                                Offline {offlineState.downloadedCount}/
                                {offlineState.totalCount}
                              </Text>
                            )}
                          </View>
                          {isOnline && (
                            <TouchableOpacity
                              onPress={async () => {
                                if (offlineState.isMarkedOffline) {
                                  await unmarkPlaylistOffline(playlist.id);
                                } else {
                                  await markPlaylistOffline(playlist);
                                }
                              }}
                              hitSlop={8}
                              className="ml-2 p-2"
                            >
                              <Ionicons
                                name={
                                  offlineState.isMarkedOffline
                                    ? "checkmark-circle"
                                    : "download-outline"
                                }
                                size={20}
                                color={
                                  offlineState.isComplete
                                    ? "#1DB954"
                                    : "#B3B3B3"
                                }
                              />
                            </TouchableOpacity>
                          )}
                          <Ionicons
                            name="chevron-forward"
                            size={18}
                            color="#B3B3B3"
                            style={{ marginLeft: 4 }}
                          />
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </>
        )}

        {!loading && !error && !isSearching && (
          <>
            <View className="mb-8">
              <SectionHeader
                title="Offline Downloads"
                right={
                  <View className="flex-row items-center gap-2">
                    {getActiveDownloadsCount() > 0 && (
                      <View className="flex-row items-center gap-1 bg-[#1DB954]/20 px-2 py-1 rounded-full">
                        <View className="w-2 h-2 bg-[#1DB954] rounded-full animate-pulse" />
                        <Text className="text-[#1DB954] text-xs font-semibold">
                          {getActiveDownloadsCount()} downloading
                        </Text>
                      </View>
                    )}
                    <Text className="text-[#B3B3B3] text-xs">
                      {Object.values(downloadsMap).length} songs
                    </Text>
                  </View>
                }
              />
              {Object.keys(downloadsMap).length === 0 ? (
                <Text className="text-[#B3B3B3] text-sm">
                  No offline songs yet. Download tracks to listen without
                  internet.
                </Text>
              ) : (
                <View className="border border-[#282828] rounded-lg overflow-hidden">
                  {Object.values(downloadsMap)
                    .sort((a, b) => {
                      // Show downloading/paused first, then downloaded
                      if (a.status === "downloading" || a.status === "paused")
                        return -1;
                      if (b.status === "downloading" || b.status === "paused")
                        return 1;
                      return +new Date(b.updatedAt) - +new Date(a.updatedAt);
                    })
                    .map((item) => (
                      <OfflineDownloadItemComponent
                        key={item.trackId}
                        item={item}
                        onPlay={handleTrackPress}
                      />
                    ))}
                </View>
              )}
            </View>

            <View className="mb-8">
              <SectionHeader
                title="Playlists"
                right={
                  <Text className="text-[#B3B3B3] text-xs">
                    {playlists.length}
                  </Text>
                }
              />

              {playlists.length === 0 ? (
                <Text className="text-[#B3B3B3] text-sm">
                  No playlists yet.
                </Text>
              ) : (
                playlists.map((playlist) => {
                  const count = playlist.tracks?.length ?? 0;
                  const offlineState = getPlaylistOfflineStatus(playlist);
                  return (
                    <TouchableOpacity
                      key={playlist.id}
                      onPress={() => setSelectedPlaylist(playlist)}
                      className="flex-row items-center py-2.5"
                    >
                      <View className="mr-3">
                        <PlaylistCover
                          playlist={playlist}
                          size={56}
                          rounded={8}
                        />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-white text-sm font-semibold"
                          numberOfLines={1}
                        >
                          {playlist.title}
                        </Text>
                        <Text className="text-[#B3B3B3] text-xs mt-0.5">
                          {count} song{count !== 1 ? "s" : ""}
                        </Text>
                        {offlineState.isMarkedOffline && (
                          <Text
                            className="text-xs mt-0.5"
                            style={{
                              color: offlineState.isComplete
                                ? "#1DB954"
                                : "#F4C95D",
                            }}
                          >
                            Offline {offlineState.downloadedCount}/
                            {offlineState.totalCount}
                          </Text>
                        )}
                      </View>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#B3B3B3"
                      />
                    </TouchableOpacity>
                  );
                })
              )}
            </View>

            {liked.length > 0 && (
              <View className="mb-8">
                <SectionHeader title="Liked Songs" />
                {liked.slice(0, 8).map((track) => {
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
                    />
                  );
                })}
              </View>
            )}

            {recent.length > 0 && (
              <View className="mb-8">
                <SectionHeader title="Recently Played" />
                {(showAllRecent ? recent : recent.slice(0, 20)).map((track) => {
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
                    />
                  );
                })}
                {recent.length > 20 && (
                  <TouchableOpacity
                    onPress={() => setShowAllRecent((prev) => !prev)}
                    className="mt-3 self-start"
                  >
                    <Text className="text-[#1DB954] text-sm font-semibold">
                      {showAllRecent
                        ? "Show Less"
                        : `View More (${recent.length - 20})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <Modal
        visible={Boolean(selectedPlaylistFresh)}
        animationType="slide"
        onRequestClose={() => setSelectedPlaylist(null)}
      >
        <SafeAreaView className="flex-1 bg-[#121212]">
          {selectedPlaylistFresh && (
            <>
              <View className="px-4 pt-4 pb-3 flex-row items-center">
                <TouchableOpacity onPress={() => setSelectedPlaylist(null)}>
                  <Ionicons name="chevron-back" size={26} color="white" />
                </TouchableOpacity>
                <Text
                  className="text-white text-lg font-bold ml-2 flex-1"
                  numberOfLines={1}
                >
                  {selectedPlaylistFresh.title}
                </Text>
                <TouchableOpacity
                  className="mr-3"
                  onPress={() => openEdit(selectedPlaylistFresh)}
                >
                  <Ionicons name="create-outline" size={20} color="#B3B3B3" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDeletePlaylist(selectedPlaylistFresh)}
                >
                  <Ionicons name="trash-outline" size={20} color="#FF4D4D" />
                </TouchableOpacity>
              </View>

              <View className="px-4 pb-3">
                {(() => {
                  const offlineState = getPlaylistOfflineStatus(
                    selectedPlaylistFresh,
                  );
                  return (
                    <TouchableOpacity
                      onPress={async () => {
                        if (offlineState.isMarkedOffline) {
                          await unmarkPlaylistOffline(selectedPlaylistFresh.id);
                        } else {
                          await markPlaylistOffline(selectedPlaylistFresh);
                        }
                      }}
                      className="flex-row items-center self-start bg-[#202020] px-3 py-2 rounded-full"
                    >
                      <Ionicons
                        name={
                          offlineState.isMarkedOffline
                            ? "checkmark-circle"
                            : "download-outline"
                        }
                        size={15}
                        color={offlineState.isComplete ? "#1DB954" : "#B3B3B3"}
                      />
                      <Text className="text-[#E5E5E5] text-xs font-semibold ml-2">
                        {offlineState.isMarkedOffline
                          ? `Offline ${offlineState.downloadedCount}/${offlineState.totalCount}`
                          : "Save playlist offline"}
                      </Text>
                    </TouchableOpacity>
                  );
                })()}
              </View>

              <ScrollView className="px-4" showsVerticalScrollIndicator={false}>
                <View className="items-center py-3 mb-4">
                  <PlaylistCover
                    playlist={selectedPlaylistFresh}
                    size={160}
                    rounded={12}
                  />
                  <Text className="text-[#B3B3B3] text-sm mt-3">
                    {selectedPlaylistFresh.tracks.length} song
                    {selectedPlaylistFresh.tracks.length !== 1 ? "s" : ""}
                  </Text>
                </View>

                {selectedPlaylistFresh.tracks.length === 0 ? (
                  <Text className="text-[#B3B3B3] text-sm text-center">
                    This playlist is empty.
                  </Text>
                ) : (
                  selectedPlaylistFresh.tracks.map((item) => {
                    const track = toPlayableTrack(item.track);
                    const downloaded = isTrackDownloaded(track.id);
                    const disabledOffline = !isOnline && !downloaded;
                    return (
                      <TrackRow
                        key={`${selectedPlaylistFresh.id}-${item.trackId}`}
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
                      />
                    );
                  })
                )}

                <View style={{ height: 36 }} />
              </ScrollView>
            </>
          )}
        </SafeAreaView>
      </Modal>

      <Modal
        visible={editVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setEditVisible(false)}
      >
        <View className="flex-1 bg-black/60 items-center justify-center px-4">
          <View className="w-full bg-[#1A1A1A] rounded-xl p-4 border border-[#2A2A2A]">
            <Text className="text-white text-base font-bold mb-4">
              Edit Playlist
            </Text>

            <Text className="text-[#B3B3B3] text-xs mb-1">Title</Text>
            <TextInput
              value={editState.title}
              onChangeText={(value) =>
                setEditState((prev) => ({ ...prev, title: value }))
              }
              className="bg-[#2A2A2A] text-white rounded-md px-3 py-2.5 mb-3"
              placeholder="Playlist title"
              placeholderTextColor="#777"
            />

            <Text className="text-[#B3B3B3] text-xs mb-1">Description</Text>
            <TextInput
              value={editState.description}
              onChangeText={(value) =>
                setEditState((prev) => ({ ...prev, description: value }))
              }
              className="bg-[#2A2A2A] text-white rounded-md px-3 py-2.5 mb-3"
              placeholder="Optional description"
              placeholderTextColor="#777"
            />

            <Text className="text-[#B3B3B3] text-xs mb-1">
              Custom cover URL
            </Text>
            <TextInput
              value={editState.coverUrl}
              onChangeText={(value) =>
                setEditState((prev) => ({ ...prev, coverUrl: value }))
              }
              className="bg-[#2A2A2A] text-white rounded-md px-3 py-2.5 mb-4"
              placeholder="https://example.com/cover.jpg"
              placeholderTextColor="#777"
              autoCapitalize="none"
            />

            <View className="flex-row justify-end items-center">
              <TouchableOpacity
                onPress={() => setEditVisible(false)}
                className="px-4 py-2 mr-2"
              >
                <Text className="text-[#B3B3B3] text-sm font-semibold">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={submitEdit}
                disabled={savingEdit}
                className="bg-[#1DB954] rounded-full px-4 py-2"
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
