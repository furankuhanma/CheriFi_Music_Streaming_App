// CheriFi/app/(tabs)/home.tsx

import { useEffect, useState, useCallback } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  Image,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { usePlayer } from "../context/PlayerContext";
import {
  RecommendationsService,
  HomeFeedSection,
  HomeFeedTrackSection,
  HomeFeedAlbumSection,
  HomeFeedArtistSection,
  HomeFeedPlaylistSection,
} from "../services/recommendations.service";
import { TracksService, Track } from "../services/tracks.service";
import { PlaylistsService, Playlist } from "../services/playlists.api";
import PlaylistCover from "../components/PlaylistCover";
import AddToPlaylistModal from "../components/AddToPlaylistModal";
import TrackActionsSheet from "../components/TrackActionsSheet";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_WIDTH = 140;
const ARTIST_CARD_WIDTH = 110;

// ─── Greeting ─────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning 👋";
  if (hour < 18) return "Good afternoon 👋";
  return "Good evening 👋";
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

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

function SkeletonFeed() {
  return (
    <>
      <View className="mb-8">
        <View className="h-5 w-40 rounded bg-[#282828] mb-4" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonHCard key={i} />
          ))}
        </ScrollView>
      </View>
      <View className="mb-8">
        <View className="h-5 w-32 rounded bg-[#282828] mb-4" />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </View>
      <View className="mb-8">
        <View className="h-5 w-44 rounded bg-[#282828] mb-4" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonHCard key={i} />
          ))}
        </ScrollView>
      </View>
    </>
  );
}

// ─── Track card (large horizontal) ───────────────────────────────────────────

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

// ─── Track row (small vertical) ───────────────────────────────────────────────

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

// ─── Album card ───────────────────────────────────────────────────────────────

function AlbumCard({
  album,
  onPress,
}: {
  album: HomeFeedAlbumSection["albums"][number];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ width: CARD_WIDTH, marginRight: 12 }}
    >
      {album.coverUrl ? (
        <Image
          source={{ uri: album.coverUrl }}
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
          <Ionicons name="disc" size={36} color="#555" />
        </View>
      )}
      <Text
        numberOfLines={1}
        style={{
          color: "white",
          fontSize: 13,
          fontWeight: "600",
          marginBottom: 2,
        }}
      >
        {album.title}
      </Text>
      <Text numberOfLines={1} style={{ color: "#B3B3B3", fontSize: 11 }}>
        {album.artist.name}
      </Text>
      <Text
        numberOfLines={1}
        style={{ color: "#555", fontSize: 10, marginTop: 2 }}
      >
        {album.trackCount} {album.trackCount === 1 ? "song" : "songs"}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Artist card ──────────────────────────────────────────────────────────────

function ArtistCard({
  artist,
  onPress,
}: {
  artist: HomeFeedArtistSection["artists"][number];
  onPress: () => void;
}) {
  const displayImage = artist.imageUrl ?? artist.fallbackCoverUrl ?? null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        width: ARTIST_CARD_WIDTH,
        marginRight: 12,
        alignItems: "center",
      }}
    >
      {displayImage ? (
        <Image
          source={{ uri: displayImage }}
          style={{
            width: ARTIST_CARD_WIDTH,
            height: ARTIST_CARD_WIDTH,
            borderRadius: ARTIST_CARD_WIDTH / 2,
            backgroundColor: "#282828",
            marginBottom: 8,
          }}
        />
      ) : (
        <View
          style={{
            width: ARTIST_CARD_WIDTH,
            height: ARTIST_CARD_WIDTH,
            borderRadius: ARTIST_CARD_WIDTH / 2,
            backgroundColor: "#282828",
            marginBottom: 8,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="person" size={36} color="#555" />
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

// ─── Public playlist card ─────────────────────────────────────────────────────

function PublicPlaylistCard({
  playlist,
  onPress,
}: {
  playlist: HomeFeedPlaylistSection["playlists"][number];
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{ width: CARD_WIDTH, marginRight: 12 }}
    >
      {playlist.coverUrl ? (
        <Image
          source={{ uri: playlist.coverUrl }}
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
          <Ionicons name="musical-notes" size={36} color="#555" />
        </View>
      )}
      <Text
        numberOfLines={1}
        style={{
          color: "white",
          fontSize: 13,
          fontWeight: "600",
          marginBottom: 2,
        }}
      >
        {playlist.title}
      </Text>
      <Text numberOfLines={1} style={{ color: "#B3B3B3", fontSize: 11 }}>
        by {playlist.owner.username}
      </Text>
      <Text
        numberOfLines={1}
        style={{ color: "#555", fontSize: 10, marginTop: 2 }}
      >
        {playlist.trackCount} {playlist.trackCount === 1 ? "song" : "songs"}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────
// Centralised so future "See all" buttons only need adding in one place.

function SectionHeader({ title }: { title: string }) {
  return <Text className="text-white text-xl font-bold mb-4">{title}</Text>;
}

// ─── Section renderers ────────────────────────────────────────────────────────

function TrackLargeSection({
  section,
  currentTrackId,
  onTrackPress,
  onTrackLongPress,
}: {
  section: HomeFeedTrackSection;
  currentTrackId: string | null;
  onTrackPress: (track: Track) => void;
  onTrackLongPress: (track: Track) => void;
}) {
  return (
    <View className="mb-8">
      <SectionHeader title={section.title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {section.tracks.map((track) => (
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

function TrackSmallSection({
  section,
  currentTrackId,
  onTrackPress,
  onTrackLongPress,
}: {
  section: HomeFeedTrackSection;
  currentTrackId: string | null;
  onTrackPress: (track: Track) => void;
  onTrackLongPress: (track: Track) => void;
}) {
  return (
    <View className="mb-8">
      <SectionHeader title={section.title} />
      {section.tracks.map((track) => (
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

function AlbumSection({ section }: { section: HomeFeedAlbumSection }) {
  const router = useRouter();
  return (
    <View className="mb-8">
      <SectionHeader title={section.title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {section.albums.map((album) => (
          <AlbumCard
            key={album.id}
            album={album}
            onPress={() =>
              router.push({
                pathname: "/collection",
                params: {
                  type: "album",
                  id: album.id,
                  title: album.title,
                  coverUrl: album.coverUrl ?? "",
                  subtitle: album.artist.name,
                },
              })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function ArtistSection({ section }: { section: HomeFeedArtistSection }) {
  const router = useRouter();
  return (
    <View className="mb-8">
      <SectionHeader title={section.title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {section.artists.map((artist) => (
          <ArtistCard
            key={artist.id}
            artist={artist}
            onPress={() =>
              router.push({
                pathname: "/collection",
                params: {
                  type: "artist",
                  id: artist.id,
                  title: artist.name,
                  coverUrl: artist.imageUrl ?? artist.fallbackCoverUrl ?? "",
                },
              })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

function PlaylistSection({ section }: { section: HomeFeedPlaylistSection }) {
  const router = useRouter();
  return (
    <View className="mb-8">
      <SectionHeader title={section.title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingRight: 16 }}
      >
        {section.playlists.map((playlist) => (
          <PublicPlaylistCard
            key={playlist.id}
            playlist={playlist}
            onPress={() =>
              router.push({
                pathname: "/collection",
                params: {
                  type: "playlist",
                  id: playlist.id,
                  title: playlist.title,
                  coverUrl: playlist.coverUrl ?? "",
                  subtitle: `by ${playlist.owner.username}`,
                },
              })
            }
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Dynamic section dispatcher ───────────────────────────────────────────────

function FeedSection({
  section,
  currentTrackId,
  onTrackPress,
  onTrackLongPress,
}: {
  section: HomeFeedSection;
  currentTrackId: string | null;
  onTrackPress: (track: Track) => void;
  onTrackLongPress: (track: Track) => void;
}) {
  if (section.type === "tracks" && section.variant === "large") {
    return (
      <TrackLargeSection
        section={section}
        currentTrackId={currentTrackId}
        onTrackPress={onTrackPress}
        onTrackLongPress={onTrackLongPress}
      />
    );
  }
  if (section.type === "tracks" && section.variant === "small") {
    return (
      <TrackSmallSection
        section={section}
        currentTrackId={currentTrackId}
        onTrackPress={onTrackPress}
        onTrackLongPress={onTrackLongPress}
      />
    );
  }
  if (section.type === "albums") {
    return <AlbumSection section={section} />;
  }
  if (section.type === "artists") {
    return <ArtistSection section={section} />;
  }
  if (section.type === "playlists") {
    return <PlaylistSection section={section} />;
  }
  return null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { playTrack, currentTrack, addToQueue, addToQueueNext, toggleLike } =
    usePlayer();

  const [feedSections, setFeedSections] = useState<HomeFeedSection[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [feedError, setFeedError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistsLoading, setPlaylistsLoading] = useState(true);

  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [playlistTrackId, setPlaylistTrackId] = useState<string | null>(null);
  const [playlistModalVisible, setPlaylistModalVisible] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set());

  // ── Loaders ──────────────────────────────────────────────────────────────────

  // forceRefresh = true busts the in-memory feed cache and always hits the network.
  // Pass false on first mount so navigating back to Home is instant.
  const loadFeed = useCallback(async (forceRefresh = false) => {
    setFeedError(false);
    try {
      const sections = await RecommendationsService.homeFeed(forceRefresh);
      setFeedSections(sections);
      sections.forEach((section) => {
        if (section.type === "tracks") {
          setLikedIds((prev) => {
            const next = new Set(prev);
            section.tracks.forEach((t) => {
              if (t.isLiked) next.add(t.id);
            });
            return next;
          });
        }
      });
    } catch (e) {
      console.log("feed error:", e);
      setFeedError(true);
    }
  }, []);

  const loadPlaylists = useCallback(async () => {
    setPlaylistsLoading(true);
    try {
      const data = await PlaylistsService.getQuickAccess(4);
      setPlaylists(data);
    } catch {
      // silently fail
    } finally {
      setPlaylistsLoading(false);
    }
  }, []);

  // First mount: use cache if available (forceRefresh = false)
  const loadAll = useCallback(
    async (forceRefresh = false) => {
      setFeedLoading(true);
      await Promise.all([loadFeed(forceRefresh), loadPlaylists()]);
      setFeedLoading(false);
    },
    [loadFeed, loadPlaylists],
  );

  useEffect(() => {
    loadAll(false);
  }, []);

  // ── Pull-to-refresh — always bypasses cache ───────────────────────────────────

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // forceRefresh = true: bust the cache and get a brand-new feed layout
    await Promise.all([loadFeed(true), loadPlaylists()]);
    setRefreshing(false);
  }, [loadFeed, loadPlaylists]);

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
                    onPress={() =>
                      router.push({
                        pathname: "/collection",
                        params: {
                          type: "playlist",
                          id: playlist.id,
                          title: playlist.title,
                          coverUrl: playlist.coverUrl ?? "",
                          subtitle: `by ${playlist.owner?.username ?? "Unknown"}`,
                        },
                      })
                    }
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

        {/* ── Feed loading skeleton ── */}
        {feedLoading && <SkeletonFeed />}

        {/* ── Feed error ── */}
        {feedError && !feedLoading && (
          <View className="flex-row items-center bg-[#1E1E1E] rounded-lg p-3 mb-8">
            <Ionicons name="warning-outline" size={16} color="#FF4444" />
            <Text className="text-[#FF4444] text-sm flex-1 ml-2">
              Couldn't load your feed.
            </Text>
            <TouchableOpacity onPress={() => loadAll(true)}>
              <Text className="text-[#1DB954] text-sm font-semibold">
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Dynamic feed sections ── */}
        {!feedLoading &&
          !feedError &&
          feedSections.map((section, index) => (
            <FeedSection
              key={`${section.type}-${section.title}-${index}`}
              section={section}
              currentTrackId={currentTrack?.id ?? null}
              onTrackPress={playTrack}
              onTrackLongPress={handleLongPress}
            />
          ))}

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
