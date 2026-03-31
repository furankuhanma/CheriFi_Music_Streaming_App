// CheriFi/app/(tabs)/search.tsx

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import { TracksService, Track } from "../services/tracks.service";
import {
  SearchService,
  YouTubeSearchResult,
  ArtistResult,
} from "@/app/services/search.service";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import TrackActionsSheet from "../components/TrackActionsSheet";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 500;
const HISTORY_KEY = "@cherifi:search_history";
const MAX_HISTORY = 20;
const ARTIST_CARD_SIZE = 80;

// ─── Search history helpers ───────────────────────────────────────────────────

async function loadHistory(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function saveHistory(history: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch {}
}

async function pushToHistory(query: string): Promise<string[]> {
  const trimmed = query.trim();
  if (!trimmed) return loadHistory();
  const prev = await loadHistory();
  const deduped = [
    trimmed,
    ...prev.filter((h) => h.toLowerCase() !== trimmed.toLowerCase()),
  ];
  const next = deduped.slice(0, MAX_HISTORY);
  await saveHistory(next);
  return next;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (!seconds) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

// ─── Artist Card (circular, like home page) ───────────────────────────────────

function ArtistCard({
  artist,
  onPress,
}: {
  artist: ArtistResult;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ alignItems: "center", marginRight: 16, width: ARTIST_CARD_SIZE }}
    >
      {artist.imageUrl ? (
        <Image
          source={{ uri: artist.imageUrl }}
          style={{
            width: ARTIST_CARD_SIZE,
            height: ARTIST_CARD_SIZE,
            borderRadius: ARTIST_CARD_SIZE / 2,
            backgroundColor: "#282828",
            marginBottom: 8,
          }}
        />
      ) : (
        <View
          style={{
            width: ARTIST_CARD_SIZE,
            height: ARTIST_CARD_SIZE,
            borderRadius: ARTIST_CARD_SIZE / 2,
            backgroundColor: "#282828",
            marginBottom: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="person" size={32} color="#555" />
        </View>
      )}
      <Text
        numberOfLines={1}
        style={{
          color: "white",
          fontSize: 12,
          fontWeight: "600",
          textAlign: "center",
        }}
      >
        {artist.name}
      </Text>
      <Text
        numberOfLines={1}
        style={{
          color: "#555",
          fontSize: 10,
          marginTop: 2,
          textAlign: "center",
        }}
      >
        {artist.trackCount} {artist.trackCount === 1 ? "song" : "songs"}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Artist Results Section ───────────────────────────────────────────────────

function ArtistSection({
  artists,
  onPress,
}: {
  artists: ArtistResult[];
  onPress: (artist: ArtistResult) => void;
}) {
  if (artists.length === 0) return null;

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: "white",
          fontSize: 16,
          fontWeight: "700",
          paddingHorizontal: 16,
          marginBottom: 12,
        }}
      >
        Artists
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {artists.map((artist) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            onPress={() => onPress(artist)}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Request Button ───────────────────────────────────────────────────────────

function RequestButton({
  videoId,
  onRequested,
}: {
  videoId: string;
  onRequested: (track: Track) => void;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done">("idle");

  const handleRequest = async () => {
    if (state !== "idle") return;
    setState("loading");
    try {
      const track = await SearchService.requestTrack(videoId);
      setState("done");
      onRequested(track);
    } catch (err: any) {
      setState("idle");
      Alert.alert(
        "Request failed",
        err?.message ?? "Could not import this track. Please try again.",
      );
    }
  };

  if (state === "done") {
    return (
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#1DB954",
          borderRadius: 20,
          paddingHorizontal: 12,
          paddingVertical: 6,
          gap: 4,
        }}
      >
        <Ionicons name="checkmark" size={14} color="white" />
        <Text style={{ color: "white", fontSize: 12, fontWeight: "700" }}>
          Added
        </Text>
      </View>
    );
  }

  if (state === "loading") {
    return (
      <View
        style={{
          width: 80,
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: 6,
        }}
      >
        <ActivityIndicator size="small" color="#1DB954" />
      </View>
    );
  }

  return (
    <TouchableOpacity
      onPress={handleRequest}
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#1DB954",
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 4,
      }}
    >
      <Ionicons name="cloud-download-outline" size={14} color="#1DB954" />
      <Text style={{ color: "#1DB954", fontSize: 12, fontWeight: "700" }}>
        Request
      </Text>
    </TouchableOpacity>
  );
}

// ─── Search Result Row ────────────────────────────────────────────────────────

function SearchResultRow({
  result,
  isActive,
  onPress,
  onLongPress,
  onTrackRequested,
}: {
  result: YouTubeSearchResult;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onTrackRequested: (videoId: string, track: Track) => void;
}) {
  const isInDb = result.inDatabase;
  const artistName = isInDb ? result.track?.artist.name : result.channelTitle;

  return (
    <TouchableOpacity
      onPress={isInDb ? onPress : undefined}
      onLongPress={isInDb ? onLongPress : undefined}
      delayLongPress={350}
      activeOpacity={isInDb ? 0.7 : 1}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 4,
        opacity: isInDb ? 1 : 0.85,
      }}
    >
      {result.thumbnailUrl ? (
        <Image
          source={{ uri: result.thumbnailUrl }}
          style={{
            width: 52,
            height: 52,
            borderRadius: 6,
            marginRight: 12,
            backgroundColor: "#282828",
          }}
        />
      ) : (
        <View
          style={{
            width: 52,
            height: 52,
            borderRadius: 6,
            backgroundColor: "#282828",
            marginRight: 12,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="musical-note" size={22} color="#555" />
        </View>
      )}

      <View style={{ flex: 1, marginRight: 8 }}>
        <Text
          style={{
            color: isActive ? "#1DB954" : "white",
            fontSize: 14,
            fontWeight: "600",
            marginBottom: 3,
          }}
          numberOfLines={1}
        >
          {result.title}
        </Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {!isInDb && (
            <View
              style={{
                backgroundColor: "#2A2A2A",
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: "#888", fontSize: 10, fontWeight: "600" }}>
                YouTube
              </Text>
            </View>
          )}
          <Text style={{ color: "#B3B3B3", fontSize: 12 }} numberOfLines={1}>
            {artistName}
          </Text>
        </View>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        {isInDb ? (
          <View style={{ alignItems: "center" }}>
            {isActive && (
              <Ionicons
                name="musical-notes"
                size={13}
                color="#1DB954"
                style={{ marginBottom: 4 }}
              />
            )}
            <Text style={{ color: "#B3B3B3", fontSize: 12 }}>
              {formatDuration(result.duration)}
            </Text>
          </View>
        ) : (
          <RequestButton
            videoId={result.videoId}
            onRequested={(track) => onTrackRequested(result.videoId, track)}
          />
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── History List ─────────────────────────────────────────────────────────────

function SearchHistory({
  history,
  onSelect,
  onRemove,
  onClearAll,
}: {
  history: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
}) {
  if (history.length === 0) return null;

  return (
    <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "700" }}>
          Recent searches
        </Text>
        <TouchableOpacity onPress={onClearAll}>
          <Text style={{ color: "#1DB954", fontSize: 13, fontWeight: "600" }}>
            Clear all
          </Text>
        </TouchableOpacity>
      </View>
      {history.map((item) => (
        <View
          key={item}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
          }}
        >
          <TouchableOpacity
            onPress={() => onSelect(item)}
            style={{
              flex: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
            }}
          >
            <Ionicons name="time-outline" size={18} color="#555" />
            <Text
              style={{ color: "#E5E5E5", fontSize: 14, flex: 1 }}
              numberOfLines={1}
            >
              {item}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onRemove(item)} hitSlop={8}>
            <Ionicons name="close" size={18} color="#555" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

// ─── Empty / Idle States ──────────────────────────────────────────────────────

function IdleState() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 80,
      }}
    >
      <Ionicons name="search" size={48} color="#333" />
      <Text
        style={{
          color: "#555",
          fontSize: 16,
          fontWeight: "600",
          marginTop: 16,
        }}
      >
        Search for music
      </Text>
      <Text
        style={{
          color: "#444",
          fontSize: 13,
          marginTop: 6,
          textAlign: "center",
          paddingHorizontal: 40,
        }}
      >
        Search by song title, artist, or anything else
      </Text>
    </View>
  );
}

function EmptyState({ query }: { query: string }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: 80,
      }}
    >
      <Ionicons name="musical-notes-outline" size={48} color="#333" />
      <Text
        style={{
          color: "#888",
          fontSize: 16,
          fontWeight: "600",
          marginTop: 16,
        }}
      >
        No results for "{query}"
      </Text>
      <Text style={{ color: "#555", fontSize: 13, marginTop: 6 }}>
        Try a different search term
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const router = useRouter();
  const { loadAndPlay, currentTrack, addToQueue, addToQueueNext } = usePlayer();

  const [query, setQuery] = useState("");
  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const [history, setHistory] = useState<string[]>([]);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const [playlistTrackId, setPlaylistTrackId] = useState<string | null>(null);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadHistory().then(setHistory);
  }, []);

  // ── Search ──────────────────────────────────────────────────────────────────

  const performSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setArtists([]);
      setHasSearched(false);
      setError(null);
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await SearchService.searchYouTube(trimmed);
      setArtists(data.artists);
      setResults(data.results);
      setLikedIds((prev) => {
        const next = new Set(prev);
        data.results.forEach((r: YouTubeSearchResult) => {
          if (r.track?.isLiked) next.add(r.track.id);
        });
        return next;
      });
      const updated = await pushToHistory(trimmed);
      setHistory(updated);
    } catch (err: any) {
      setError(err?.message ?? "Search failed. Please try again.");
      setResults([]);
      setArtists([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleQueryChange = useCallback(
    (text: string) => {
      setQuery(text);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        performSearch(text);
      }, DEBOUNCE_MS);
    },
    [performSearch],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    setResults([]);
    setArtists([]);
    setHasSearched(false);
    setError(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  // ── History actions ─────────────────────────────────────────────────────────

  const handleHistorySelect = useCallback(
    (q: string) => {
      setQuery(q);
      performSearch(q);
    },
    [performSearch],
  );

  const handleHistoryRemove = useCallback(async (q: string) => {
    const prev = await loadHistory();
    const next = prev.filter((h) => h.toLowerCase() !== q.toLowerCase());
    await saveHistory(next);
    setHistory(next);
  }, []);

  const handleClearAll = useCallback(async () => {
    await saveHistory([]);
    setHistory([]);
  }, []);

  // ── Artist press → collection screen ───────────────────────────────────────

  const handleArtistPress = useCallback(
    (artist: ArtistResult) => {
      router.push({
        pathname: "/collection",
        params: {
          type: "artist",
          id: artist.id,
          title: artist.name,
          coverUrl: artist.imageUrl ?? "",
        },
      });
    },
    [router],
  );

  // ── Track requested (YouTube → DB) ─────────────────────────────────────────

  const handleTrackRequested = useCallback((videoId: string, track: Track) => {
    setResults((prev) =>
      prev.map((r) =>
        r.videoId === videoId
          ? {
              ...r,
              inDatabase: true,
              track,
              title: track.title,
              channelTitle: track.artist.name,
              thumbnailUrl: track.coverUrl ?? r.thumbnailUrl,
              duration: track.duration,
            }
          : r,
      ),
    );
  }, []);

  // ── Like toggle ─────────────────────────────────────────────────────────────

  const handleLikeToggle = useCallback(
    async (track: Track) => {
      const wasLiked = likedIds.has(track.id);
      setLikedIds((prev) => {
        const next = new Set(prev);
        wasLiked ? next.delete(track.id) : next.add(track.id);
        return next;
      });
      try {
        wasLiked
          ? await TracksService.unlike(track.id)
          : await TracksService.like(track.id);
      } catch {
        setLikedIds((prev) => {
          const next = new Set(prev);
          wasLiked ? next.add(track.id) : next.delete(track.id);
          return next;
        });
      }
    },
    [likedIds],
  );

  // ── Long press ──────────────────────────────────────────────────────────────

  const handleLongPress = useCallback((track: Track) => {
    setSelectedTrack(track);
    setSheetVisible(true);
  }, []);

  // ── Track press ─────────────────────────────────────────────────────────────

  const handleTrackPress = useCallback(
    async (tappedTrack: Track) => {
      try {
        const res = await TracksService.getAll(1, 30);
        const dbTracks = res.tracks;
        const tappedIdx = dbTracks.findIndex((t) => t.id === tappedTrack.id);

        let orderedTracks: Track[];
        let startIndex: number;

        if (tappedIdx !== -1) {
          orderedTracks = [
            ...dbTracks.slice(tappedIdx),
            ...dbTracks.slice(0, tappedIdx),
          ];
          startIndex = 0;
        } else {
          orderedTracks = [tappedTrack, ...dbTracks];
          startIndex = 0;
        }

        await loadAndPlay(orderedTracks, startIndex);
      } catch {
        await loadAndPlay([tappedTrack], 0);
      }
    },
    [loadAndPlay],
  );

  // ── Render item ─────────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item }: { item: YouTubeSearchResult }) => {
      const isActive = item.inDatabase && currentTrack?.id === item.track?.id;
      return (
        <SearchResultRow
          result={item}
          isActive={isActive}
          onPress={() => item.track && handleTrackPress(item.track)}
          onLongPress={() => item.track && handleLongPress(item.track)}
          onTrackRequested={handleTrackRequested}
        />
      );
    },
    [currentTrack, handleTrackPress, handleLongPress, handleTrackRequested],
  );

  const keyExtractor = useCallback(
    (item: YouTubeSearchResult) => item.videoId,
    [],
  );

  // ── Render ──────────────────────────────────────────────────────────────────

  const showIdle = !hasSearched && !isSearching;
  const showEmpty =
    hasSearched &&
    !isSearching &&
    results.length === 0 &&
    artists.length === 0 &&
    !error;
  const showHistory = showIdle && history.length > 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#121212" }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 }}>
        <Text
          style={{
            color: "white",
            fontSize: 24,
            fontWeight: "700",
            marginBottom: 16,
          }}
        >
          Search
        </Text>

        {/* Search bar */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: "white",
            borderRadius: 10,
            paddingHorizontal: 12,
            height: 44,
          }}
        >
          <Ionicons name="search" size={18} color="#666" />
          <TextInput
            ref={inputRef}
            style={{
              flex: 1,
              marginLeft: 8,
              fontSize: 15,
              color: "#121212",
              paddingVertical: 0,
            }}
            placeholder="Artists, songs, podcasts"
            placeholderTextColor="#999"
            value={query}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            onSubmitEditing={() => {
              if (debounceRef.current) clearTimeout(debounceRef.current);
              performSearch(query);
            }}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="never"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Results count + legend */}
      {hasSearched && !isSearching && results.length > 0 && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingBottom: 8,
          }}
        >
          <Text style={{ color: "#888", fontSize: 12 }}>
            {results.length} results
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#1DB954",
                }}
              />
              <Text style={{ color: "#888", fontSize: 11 }}>In library</Text>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
            >
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: "#444",
                }}
              />
              <Text style={{ color: "#888", fontSize: 11 }}>
                Request to add
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Loading */}
      {isSearching && (
        <View
          style={{
            flex: 1,
            alignItems: "center",
            justifyContent: "center",
            paddingBottom: 80,
          }}
        >
          <ActivityIndicator size="large" color="#1DB954" />
          <Text style={{ color: "#888", fontSize: 14, marginTop: 12 }}>
            Searching...
          </Text>
        </View>
      )}

      {/* Error */}
      {error && !isSearching && (
        <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1E1E1E",
              borderRadius: 10,
              padding: 12,
            }}
          >
            <Ionicons name="warning-outline" size={16} color="#FF4444" />
            <Text
              style={{ color: "#FF4444", fontSize: 13, flex: 1, marginLeft: 8 }}
            >
              {error}
            </Text>
            <TouchableOpacity onPress={() => performSearch(query)}>
              <Text
                style={{ color: "#1DB954", fontSize: 13, fontWeight: "600" }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Search history */}
      {!isSearching && showHistory && (
        <SearchHistory
          history={history}
          onSelect={handleHistorySelect}
          onRemove={handleHistoryRemove}
          onClearAll={handleClearAll}
        />
      )}

      {/* Idle state */}
      {showIdle && !isSearching && !showHistory && <IdleState />}

      {/* Empty state */}
      {showEmpty && <EmptyState query={query} />}

      {/* Results: artists + tracks */}
      {!isSearching && (artists.length > 0 || results.length > 0) && (
        <FlatList
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={
            <ArtistSection artists={artists} onPress={handleArtistPress} />
          }
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={() => (
            <View
              style={{
                height: 1,
                backgroundColor: "#1E1E1E",
                marginLeft: 64,
              }}
            />
          )}
        />
      )}

      {/* Track action sheet */}
      <TrackActionsSheet
        track={selectedTrack}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        isLiked={selectedTrack ? likedIds.has(selectedTrack.id) : false}
        onToggleLike={handleLikeToggle}
        onPlayNext={addToQueueNext}
        onAddToQueue={addToQueue}
        onAddToPlaylist={(track) => {
          setPlaylistTrackId(track.id);
          setPlaylistModalVisible(true);
        }}
      />

      {/* Add-to-playlist modal */}
      <AddToPlaylistModal
        trackId={playlistTrackId}
        visible={playlistModalVisible}
        onClose={() => setPlaylistModalVisible(false)}
      />
    </SafeAreaView>
  );
}
