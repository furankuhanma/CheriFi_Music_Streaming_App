// CheriFi/app/(tabs)/search.tsx

import { memo, useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { usePlayerControls } from "../context/PlayerContext";
import { TracksService, Track } from "../services/tracks.service";
import {
  SearchService,
  YouTubeSearchResult,
  ArtistResult,
} from "@/app/services/search.service";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import TrackActionsSheet from "../components/TrackActionsSheet";
import { useBottomOverlaySpacing } from "../hooks/useBottomOverlaySpacing";

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

// ─── YouTube Unavailable Banner ───────────────────────────────────────────────

function YouTubeUnavailableBanner() {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#1A1A1A",
        borderRadius: 8,
        marginHorizontal: 16,
        marginBottom: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 8,
        borderLeftWidth: 3,
        borderLeftColor: "#F59E0B",
      }}
    >
      <Ionicons name="cloud-offline-outline" size={15} color="#F59E0B" />
      <Text style={{ color: "#A3A3A3", fontSize: 12, flex: 1 }}>
        YouTube search unavailable — showing your library results only
      </Text>
    </View>
  );
}

// ─── Artist Card (circular, like home page) ───────────────────────────────────

const ArtistCard = memo(function ArtistCard({
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
});

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
      <FlatList
        data={artists}
        horizontal
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        initialNumToRender={5}
        maxToRenderPerBatch={8}
        windowSize={5}
        removeClippedSubviews
        renderItem={({ item: artist }) => (
          <ArtistCard artist={artist} onPress={() => onPress(artist)} />
        )}
      />
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

const SearchResultRow = memo(function SearchResultRow({
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
  // A result is playable if it's in the DB (covers both DB-only results with
  // empty videoId and YouTube results that have already been imported)
  const isPlayable = result.inDatabase;

  // Only show the YouTube badge for non-DB results that actually came from YT
  const isYouTubeOnly = !result.inDatabase && result.videoId !== "";

  return (
    <TouchableOpacity
      onPress={isPlayable ? onPress : undefined}
      onLongPress={isPlayable ? onLongPress : undefined}
      delayLongPress={350}
      activeOpacity={isPlayable ? 0.7 : 1}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 4,
        opacity: isPlayable ? 1 : 0.85,
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
          {isYouTubeOnly && (
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
        </View>
      </View>

      <View style={{ alignItems: "flex-end" }}>
        {isPlayable ? (
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
          // Only show RequestButton for real YouTube results (non-empty videoId)
          result.videoId !== "" && (
            <RequestButton
              videoId={result.videoId}
              onRequested={(track) => onTrackRequested(result.videoId, track)}
            />
          )
        )}
      </View>
    </TouchableOpacity>
  );
});

// ─── History List ─────────────────────────────────────────────────────────────

function SearchHistory({
  history,
  onSelect,
  onRemove,
  onClearAll,
  bottomPadding,
}: {
  history: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
  bottomPadding: number;
}) {
  if (history.length === 0) return null;

  return (
    <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }}>
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
      <FlatList
        data={history}
        keyExtractor={(item) => item}
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        renderItem={({ item }) => (
          <View
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
        )}
      />
    </View>
  );
}

// ─── Empty / Idle States ──────────────────────────────────────────────────────

function IdleState({ bottomPadding }: { bottomPadding: number }) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: bottomPadding,
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

function EmptyState({
  query,
  bottomPadding,
}: {
  query: string;
  bottomPadding: number;
}) {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingBottom: bottomPadding,
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
        No results for &quot;{query}&quot;
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
  const { loadAndPlay, currentTrack, addToQueue, addToQueueNext } =
    usePlayerControls();

  const [query, setQuery] = useState("");
  const [artists, setArtists] = useState<ArtistResult[]>([]);
  const [results, setResults] = useState<YouTubeSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [youtubeAvailable, setYoutubeAvailable] = useState(true);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  const [history, setHistory] = useState<string[]>([]);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const [playlistTrackId, setPlaylistTrackId] = useState<string | null>(null);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const bottomContentPadding = useBottomOverlaySpacing(24);

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
      setYoutubeAvailable(true);
      return;
    }

    setIsSearching(true);
    setError(null);
    setHasSearched(true);

    try {
      const data = await SearchService.searchYouTube(trimmed);
      setArtists(data.artists);
      setResults(data.results);
      setYoutubeAvailable(data.youtubeAvailable);
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
      setYoutubeAvailable(false);
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
    setYoutubeAvailable(true);
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
        if (wasLiked) {
          next.delete(track.id);
        } else {
          next.add(track.id);
        }
        return next;
      });
      try {
        if (wasLiked) {
          await TracksService.unlike(track.id);
        } else {
          await TracksService.like(track.id);
        }
      } catch {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (wasLiked) {
            next.add(track.id);
          } else {
            next.delete(track.id);
          }
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
          onPress={() => {
            if (item.track) {
              void handleTrackPress(item.track);
            }
          }}
          onLongPress={() => {
            if (item.track) {
              handleLongPress(item.track);
            }
          }}
          onTrackRequested={handleTrackRequested}
        />
      );
    },
    [currentTrack, handleTrackPress, handleLongPress, handleTrackRequested],
  );

  const keyExtractor = useCallback(
    (item: YouTubeSearchResult, index: number) =>
      item.videoId !== "" ? item.videoId : `db-${item.track?.id ?? index}`,
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

      {/* YouTube unavailable banner */}
      {hasSearched && !isSearching && !youtubeAvailable && (
        <YouTubeUnavailableBanner />
      )}

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
            paddingBottom: bottomContentPadding,
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
          bottomPadding={bottomContentPadding}
        />
      )}

      {/* Idle state */}
      {showIdle && !isSearching && !showHistory && (
        <IdleState bottomPadding={bottomContentPadding} />
      )}

      {/* Empty state */}
      {showEmpty && (
        <EmptyState query={query} bottomPadding={bottomContentPadding} />
      )}

      {/* Results: artists + tracks */}
      {!isSearching && (artists.length > 0 || results.length > 0) && (
        <FlatList
          data={results}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          initialNumToRender={12}
          maxToRenderPerBatch={16}
          windowSize={10}
          removeClippedSubviews
          ListHeaderComponent={
            <ArtistSection artists={artists} onPress={handleArtistPress} />
          }
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
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingBottom: bottomContentPadding,
          }}
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
