// CheriFi/app/(tabs)/home.tsx
// Changes from original:
//   1. Import AddToPlaylistModal
//   2. Add playlistTrackId + playlistModalVisible state
//   3. Replace Alert.alert("Add to Playlist") with modal open
//   4. Add <AddToPlaylistModal> at the bottom of the return

import { useEffect, useState, useCallback, useRef } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Modal,
  Animated,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../context/PlayerContext";
import { RecommendationsService } from "../services/recommendations.service";
import { TracksService, Track } from "../services/tracks.service";
import AddToPlaylistModal from "../components/AddToPlaylistModal"; // ← NEW

const recentItems = ["Liked Songs", "Daily Mix 1", "Top Hits", "Chill Vibes"];

// ─── Track Action Sheet ───────────────────────────────────────────────────────

type TrackAction = {
  icon: string;
  label: string;
  color?: string;
  onPress: () => void;
};

function TrackActionSheet({
  track,
  visible,
  onClose,
  actions,
}: {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
  actions: TrackAction[];
}) {
  const translateY = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 600,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [visible]);

  if (!mounted && !visible) return null;

  return (
    <Modal
      visible={mounted || visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.6)",
          opacity: backdropOpacity,
        }}
        pointerEvents={visible ? "auto" : "none"}
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          onPress={onClose}
          activeOpacity={1}
          accessibilityLabel="Close menu"
        />
      </Animated.View>

      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "#1A1A1A",
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: 36,
          transform: [{ translateY }],
        }}
      >
        <View style={{ alignItems: "center", paddingVertical: 12 }}>
          <View
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              backgroundColor: "#444",
            }}
          />
        </View>

        {track && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingBottom: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#2A2A2A",
              marginBottom: 8,
            }}
          >
            {track.coverUrl ? (
              <Image
                source={{ uri: track.coverUrl }}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  marginRight: 12,
                }}
              />
            ) : (
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 6,
                  backgroundColor: "#2A2A2A",
                  marginRight: 12,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="musical-note" size={20} color="#555" />
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text
                style={{ color: "white", fontSize: 15, fontWeight: "700" }}
                numberOfLines={1}
              >
                {track.title}
              </Text>
              <Text
                style={{ color: "#888", fontSize: 13, marginTop: 2 }}
                numberOfLines={1}
              >
                {track.artist.name}
              </Text>
            </View>
          </View>
        )}

        {actions.map((action) => (
          <TouchableOpacity
            key={action.label}
            onPress={() => {
              onClose();
              setTimeout(action.onPress, 200);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 14,
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Ionicons
              name={action.icon as any}
              size={22}
              color={action.color ?? "#B3B3B3"}
              style={{ marginRight: 16, width: 24 }}
            />
            <Text
              style={{
                color: action.color ?? "white",
                fontSize: 15,
                fontWeight: "500",
              }}
            >
              {action.label}
            </Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

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

// ─── Track row ────────────────────────────────────────────────────────────────

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
      accessibilityHint="Double tap to play. Hold for more options."
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

// ─── Section ──────────────────────────────────────────────────────────────────

function Section({
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

  const [forYou, setForYou] = useState<Track[]>([]);
  const [popular, setPopular] = useState<Track[]>([]);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [popularLoading, setPopularLoading] = useState(true);
  const [forYouError, setForYouError] = useState(false);
  const [popularError, setPopularError] = useState(false);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  // ── NEW: playlist modal state ─────────────────────────────────────────────
  const [playlistTrackId, setPlaylistTrackId] = useState<string | null>(null);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);

  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // ── Data loading ────────────────────────────────────────────────────────────

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

  useEffect(() => {
    loadForYou();
    loadPopular();
  }, []);

  // ── Long press handler ──────────────────────────────────────────────────────

  const handleLongPress = useCallback((track: Track) => {
    setSelectedTrack(track);
    setSheetVisible(true);
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

  // ── Build actions ───────────────────────────────────────────────────────────

  const buildActions = (track: Track): TrackAction[] => {
    const trackIsLiked = likedIds.has(track.id);
    return [
      {
        icon: "play-skip-forward-outline",
        label: "Play next",
        onPress: () => addToQueueNext(track),
      },
      {
        icon: "add-circle-outline",
        label: "Add to queue",
        onPress: () => addToQueue(track),
      },
      {
        icon: trackIsLiked ? "heart" : "heart-outline",
        label: trackIsLiked ? "Remove from liked songs" : "Add to liked songs",
        color: trackIsLiked ? "#1DB954" : undefined,
        onPress: () => handleLikeToggle(track),
      },
      {
        icon: "list-outline",
        label: "Add to playlist",
        // ── CHANGED: open modal instead of Alert ────────────────────────────
        onPress: () => {
          setPlaylistTrackId(track.id);
          setPlaylistModalVisible(true);
        },
      },
      {
        icon: "download-outline",
        label: "Download",
        onPress: () => Alert.alert("Download", "Coming soon"),
      },
    ];
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <ScrollView className="px-4 pt-6" showsVerticalScrollIndicator={false}>
        <Text className="text-white text-2xl font-bold mb-6">
          Good evening 👋
        </Text>

        <View className="flex-row flex-wrap gap-2 mb-8">
          {recentItems.map((item) => (
            <View
              key={item}
              className="bg-[#282828] rounded-md flex-row items-center overflow-hidden"
              style={{ width: "48%", height: 56 }}
            >
              <View className="w-14 h-14 bg-[#1DB954]" />
              <Text
                className="text-white font-semibold text-sm ml-3 flex-1"
                numberOfLines={1}
              >
                {item}
              </Text>
            </View>
          ))}
        </View>

        <Section
          title="For You"
          tracks={forYou}
          isLoading={forYouLoading}
          error={forYouError}
          onRetry={loadForYou}
          currentTrackId={currentTrack?.id ?? null}
          onTrackPress={playTrack}
          onTrackLongPress={handleLongPress}
        />

        <Section
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
      <TrackActionSheet
        track={selectedTrack}
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        actions={selectedTrack ? buildActions(selectedTrack) : []}
      />

      {/* Add to playlist modal — NEW */}
      <AddToPlaylistModal
        trackId={playlistTrackId}
        visible={playlistModalVisible}
        onClose={() => setPlaylistModalVisible(false)}
      />
    </SafeAreaView>
  );
}
