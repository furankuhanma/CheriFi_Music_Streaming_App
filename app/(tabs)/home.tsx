// CheriFi/app/(tabs)/home.tsx

import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Image,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../context/PlayerContext";
import { RecommendationsService } from "../services/recommendations.service";
import { TracksService, Track } from "../services/tracks.service";
import { PlaylistsService, Playlist } from "../services/playlists.api";
import PlaylistCover from "../components/PlaylistCover";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import TrackActionsSheet from "../components/TrackActionsSheet";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = 140;

// ─── Greeting ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning 👋";
  if (hour < 18) return "Good afternoon 👋";
  return "Good evening 👋";
}

// ─── Skeleton: grid card ──────────────────────────────────────────────────────

function SkeletonGridCard() {
  return (
    <View
      className="bg-[#282828] rounded-md flex-row items-center overflow-hidden"
      style={{ width: "48%", height: 56 }}
    >
      <View style={{ width: 56, height: 56, backgroundColor: "#1E1E1E" }} />
      <View className="flex-1 mx-3 h-3 rounded bg-[#1E1E1E]" />
    </View>
  );
}

// ─── Skeleton: horizontal card ────────────────────────────────────────────────

function SkeletonHCard() {
  return (
    <View style={{ width: CARD_WIDTH, marginRight: 12 }}>
      <View
        style={{
          width: CARD_WIDTH,
          height: CARD_WIDTH,
          borderRadius: 8,
          backgroundColor: "#282828",
          marginBottom: 8,
        }}
      />
      <View className="h-3 w-4/5 rounded bg-[#282828] mb-1.5" />
      <View className="h-3 w-3/5 rounded bg-[#1E1E1E]" />
    </View>
  );
}

// ─── Skeleton: track row ──────────────────────────────────────────────────────

function SkeletonRow() {
  return (
    <View className="flex-row items-center py-3 px-1">
      <View className="w-12 h-12 rounded-md bg-[#282828] mr-3" />
      <View className="flex-1">
        <View className="h-3 w-2/3 rounded bg-[#282828] mb-2" />
        <View className="h-3 w-1/3 rounded bg-[#1E1E1E]" />
      </View>
    </View>
  );
}

// ─── Horizontal track card ────────────────────────────────────────────────────

function TrackCard({
  track,
  isActive,
  onPress,
  onLongPress,
}: {
  track: Track;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      style={{ width: CARD_WIDTH, marginRight: 12 }}
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title} by ${track.artist.name}`}
    >
      {track.coverUrl ? (
        <Image
          source={{ uri: track.coverUrl }}
          style={{
            width: CARD_WIDTH,
            height: CARD_WIDTH,
            borderRadius: 8,
            backgroundColor: "#282828",
            marginBottom: 8,
          }}
        />
      ) : (
        <View
          style={{
            width: CARD_WIDTH,
            height: CARD_WIDTH,
            borderRadius: 8,
            backgroundColor: "#282828",
            marginBottom: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="musical-note" size={36} color="#555" />
        </View>
      )}

      <Text
        numberOfLines={1}
        style={{
          color: isActive ? "#1DB954" : "white",
          fontSize: 13,
          fontWeight: "600",
          marginBottom: 2,
        }}
      >
        {track.title}
      </Text>
      <Text numberOfLines={1} style={{ color: "#B3B3B3", fontSize: 11 }}>
        {track.artist.name}
      </Text>

      {isActive && (
        <View style={{ position: "absolute", top: 8, right: 8 }}>
          <View
            style={{
              backgroundColor: "#1DB954",
              borderRadius: 12,
              padding: 4,
            }}
          >
            <Ionicons name="musical-notes" size={12} color="white" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Horizontal section ───────────────────────────────────────────────────────

function HorizontalSection({
  title,
  tracks,
  isLoading,
  currentTrackId,
  onTrackPress,
  onTrackLongPress,
}: {
  title: string;
  tracks: Track[];
  isLoading: boolean;
  currentTrackId: string | null;
  onTrackPress: (track: Track) => void;
  onTrackLongPress: (track: Track) => void;
}) {
  if (!isLoading && tracks.length === 0) return null;

  return (
    <View className="mb-8">
      <Text className="text-white text-xl font-bold mb-4">{title}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonHCard key={i} />)
          : tracks.map((track) => (
              <TrackCard
                key={track.id}
                track={track}
                isActive={track.id === currentTrackId}
                onPress={() => onTrackPress(track)}
                onLongPress={() => onTrackLongPress(track)}
              />
            ))}
      </ScrollView>
    </View>
  );
}

// ─── Vertical track row ───────────────────────────────────────────────────────

function TrackRow({
  track,
  isActive,
  onPress,
  onLongPress,
}: {
  track: Track;
  isActive: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const mins = Math.floor(track.duration / 60);
  const secs = String(track.duration % 60).padStart(2, "0");

  return (
    <TouchableOpacity
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      className="flex-row items-center py-3 px-1"
      accessibilityRole="button"
      accessibilityLabel={`Play ${track.title} by ${track.artist.name}`}
    >
      {track.coverUrl ? (
        <Image
          source={{ uri: track.coverUrl }}
          className="w-12 h-12 rounded-md mr-3"
        />
      ) : (
        <View className="w-12 h-12 rounded-md bg-[#282828] mr-3 items-center justify-center">
          <Ionicons name="musical-note" size={20} color="#B3B3B3" />
        </View>
      )}

      <View className="flex-1">
        <Text
          className="font-semibold text-sm mb-0.5"
          style={{ color: isActive ? "#1DB954" : "white" }}
          numberOfLines={1}
        >
          {track.title}
        </Text>
        <Text className="text-[#B3B3B3] text-xs" numberOfLines={1}>
          {track.artist.name}
        </Text>
      </View>

      {isActive && (
        <Ionicons
          name="musical-notes"
          size={14}
          color="#1DB954"
          style={{ marginRight: 8 }}
        />
      )}
      <Text className="text-[#B3B3B3] text-xs">
        {mins}:{secs}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Vertical section ─────────────────────────────────────────────────────────

function VerticalSection({
  title,
  tracks,
  isLoading,
  error,
  onRetry,
  currentTrackId,
  onTrackPress,
  onTrackLongPress,
}: {
  title: string;
  tracks: Track[];
  isLoading: boolean;
  error: boolean;
  onRetry: () => void;
  currentTrackId: string | null;
  onTrackPress: (track: Track) => void;
  onTrackLongPress: (track: Track) => void;
}) {
  return (
    <View className="mb-8">
      <Text className="text-white text-xl font-bold mb-3">{title}</Text>

      {isLoading && (
        <>
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </>
      )}

      {error && !isLoading && (
        <View className="flex-row items-center bg-[#1E1E1E] rounded-lg p-3">
          <Ionicons name="warning-outline" size={16} color="#FF4444" />
          <Text className="text-[#FF4444] text-sm flex-1 ml-2">
            Couldn't load tracks.
          </Text>
          <TouchableOpacity onPress={onRetry}>
            <Text className="text-[#1DB954] text-sm font-semibold">Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {!isLoading && !error && tracks.length === 0 && (
        <Text className="text-[#B3B3B3] text-sm">No tracks found.</Text>
      )}

      {!isLoading &&
        !error &&
        tracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            isActive={track.id === currentTrackId}
            onPress={() => onTrackPress(track)}
            onLongPress={() => onTrackLongPress(track)}
          />
        ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const {
    playTrack,
    currentTrack,
    addToQueue,
    addToQueueNext,
    isLiked,
    toggleLike,
  } = usePlayer();

  // Vertical sections
  const [forYou, setForYou] = useState<Track[]>([]);
  const [popular, setPopular] = useState<Track[]>([]);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [popularLoading, setPopularLoading] = useState(true);
  const [forYouError, setForYouError] = useState(false);
  const [popularError, setPopularError] = useState(false);

  // Horizontal sections
  const [liked, setLiked] = useState<Track[]>([]);
  const [recentlyPlayed, setRecentlyPlayed] = useState<Track[]>([]);
  const [likedLoading, setLikedLoading] = useState(true);
  const [recentLoading, setRecentLoading] = useState(true);

  // Playlist grid
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

  // Action sheet / modal
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [playlistTrackId, setPlaylistTrackId] = useState<string | null>(null);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // ── Loaders ─────────────────────────────────────────────────────────────────

  const loadForYou = async () => {
    setForYouLoading(true);
    setForYouError(false);
    try {
      const tracks = await RecommendationsService.smart();
      setForYou(tracks);
      setLikedIds((prev) => {
        const next = new Set(prev);
        tracks.forEach((t) => {
          if (t.isLiked) next.add(t.id);
        });
        return next;
      });
    } catch {
      setForYouError(true);
    } finally {
      setForYouLoading(false);
    }
  };

  const loadPopular = async () => {
    setPopularLoading(true);
    setPopularError(false);
    try {
      const tracks = await RecommendationsService.popular();
      setPopular(tracks);
      setLikedIds((prev) => {
        const next = new Set(prev);
        tracks.forEach((t) => {
          if (t.isLiked) next.add(t.id);
        });
        return next;
      });
    } catch {
      setPopularError(true);
    } finally {
      setPopularLoading(false);
    }
  };

  const loadLiked = async () => {
    setLikedLoading(true);
    try {
      const tracks = await TracksService.getLiked(20);
      setLiked(tracks);
    } catch {
      // silently fail — section just won't show
    } finally {
      setLikedLoading(false);
    }
  };

  const loadRecentlyPlayed = async () => {
    setRecentLoading(true);
    try {
      const tracks = await TracksService.getRecentlyPlayed(20);
      setRecentlyPlayed(tracks);
    } catch {
      // silently fail
    } finally {
      setRecentLoading(false);
    }
  };

  const loadPlaylists = async () => {
    setPlaylistsLoading(true);
    try {
      const data = await PlaylistsService.getAll();
      setPlaylists(data.slice(0, 4));
    } catch {
      // silently fail
    } finally {
      setPlaylistsLoading(false);
    }
  };

  useEffect(() => {
    loadForYou();
    loadPopular();
    loadLiked();
    loadRecentlyPlayed();
    loadPlaylists();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleLongPress = useCallback((track: Track) => {
    setSelectedTrack(track);
    setSheetVisible(true);
  }, []);

  const handleLikeToggle = useCallback(
    async (track: Track) => {
      const wasLiked = likedIds.has(track.id);
      setLikedIds((prev) => {
        const next = new Set(prev);
        wasLiked ? next.delete(track.id) : next.add(track.id);
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
          wasLiked ? next.add(track.id) : next.delete(track.id);
          return next;
        });
      }
    },
    [likedIds],
  );

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <ScrollView className="px-4 pt-6" showsVerticalScrollIndicator={false}>
        {/* Greeting */}
        <Text className="text-white text-2xl font-bold mb-6">
          {getGreeting()}
        </Text>

        {/* ── Playlist quick-access grid ── */}
        {(playlistsLoading || playlists.length > 0) && (
          <View className="flex-row flex-wrap gap-2 mb-8">
            {playlistsLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <SkeletonGridCard key={i} />
                ))
              : playlists.map((playlist) => (
                  <TouchableOpacity
                    key={playlist.id}
                    className="bg-[#282828] rounded-md flex-row items-center overflow-hidden"
                    style={{ width: "48%", height: 56 }}
                  >
                    <PlaylistCover playlist={playlist} size={56} rounded={0} />
                    <Text
                      className="text-white font-semibold text-sm ml-3 flex-1"
                      numberOfLines={1}
                    >
                      {playlist.title}
                    </Text>
                  </TouchableOpacity>
                ))}
          </View>
        )}

        {/* ── Recently Liked — horizontal swipeable cards ── */}
        <HorizontalSection
          title="Recently Liked"
          tracks={liked}
          isLoading={likedLoading}
          currentTrackId={currentTrack?.id ?? null}
          onTrackPress={playTrack}
          onTrackLongPress={handleLongPress}
        />

        {/* ── Jump Back In — horizontal swipeable cards ── */}
        <HorizontalSection
          title="Jump Back In"
          tracks={recentlyPlayed}
          isLoading={recentLoading}
          currentTrackId={currentTrack?.id ?? null}
          onTrackPress={playTrack}
          onTrackLongPress={handleLongPress}
        />

        {/* ── For You — vertical track list ── */}
        <VerticalSection
          title="For You"
          tracks={forYou}
          isLoading={forYouLoading}
          error={forYouError}
          onRetry={loadForYou}
          currentTrackId={currentTrack?.id ?? null}
          onTrackPress={playTrack}
          onTrackLongPress={handleLongPress}
        />

        {/* ── Popular — vertical track list ── */}
        <VerticalSection
          title="Popular"
          tracks={popular}
          isLoading={popularLoading}
          error={popularError}
          onRetry={loadPopular}
          currentTrackId={currentTrack?.id ?? null}
          onTrackPress={playTrack}
          onTrackLongPress={handleLongPress}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

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

      {/* Add to playlist modal */}
      <AddToPlaylistModal
        trackId={playlistTrackId}
        visible={playlistModalVisible}
        onClose={() => setPlaylistModalVisible(false)}
      />
    </SafeAreaView>
  );
}
