// CheriFi/app/collection.tsx
// Detail screen — opens when user taps an album, artist, or playlist card on Home.
// Route params:  type: "album" | "artist" | "playlist"
//                id:   string
//                title: string
//                coverUrl?: string
//                subtitle?: string   (artist name for albums, owner for playlists)

import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Dimensions,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../context/PlayerContext";
import { TracksService, Track } from "../services/tracks.service";
import { PlaylistsService } from "../services/playlists.api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COVER_SIZE = SCREEN_WIDTH * 0.52;

// ─── Track row ────────────────────────────────────────────────────────────────

function TrackRow({
  track,
  index,
  isActive,
  onPress,
}: {
  track: Track;
  index: number;
  isActive: boolean;
  onPress: () => void;
}) {
  const mins = Math.floor(track.duration / 60);
  const secs = String(track.duration % 60).padStart(2, "0");

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 16,
      }}
    >
      {/* Index / playing indicator */}
      <View style={{ width: 32, alignItems: "center", marginRight: 12 }}>
        {isActive ? (
          <Ionicons name="musical-notes" size={16} color="#1DB954" />
        ) : (
          <Text style={{ color: "#B3B3B3", fontSize: 14 }}>{index + 1}</Text>
        )}
      </View>

      {/* Cover */}
      {track.coverUrl ? (
        <Image
          source={{ uri: track.coverUrl }}
          style={{
            width: 44,
            height: 44,
            borderRadius: 4,
            marginRight: 12,
            backgroundColor: "#282828",
          }}
        />
      ) : (
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 4,
            marginRight: 12,
            backgroundColor: "#282828",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="musical-note" size={18} color="#555" />
        </View>
      )}

      {/* Title + artist */}
      <View style={{ flex: 1, marginRight: 8 }}>
        <Text
          numberOfLines={1}
          style={{
            color: isActive ? "#1DB954" : "white",
            fontSize: 14,
            fontWeight: "600",
            marginBottom: 2,
          }}
        >
          {track.title}
        </Text>
        <Text numberOfLines={1} style={{ color: "#B3B3B3", fontSize: 12 }}>
          {track.artist.name}
        </Text>
      </View>

      {/* Duration */}
      <Text style={{ color: "#B3B3B3", fontSize: 12 }}>
        {mins}:{secs}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function CollectionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    type: "album" | "artist" | "playlist";
    id: string;
    title: string;
    coverUrl?: string;
    subtitle?: string;
  }>();

  const { type, id, title, coverUrl, subtitle } = params;

  const { loadAndPlay, currentTrack } = usePlayer();

  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  // ── Load tracks ─────────────────────────────────────────────────────────────

  const loadTracks = useCallback(async () => {
    setError(false);
    try {
      let result: Track[] = [];

      if (type === "album") {
        result = await TracksService.getByAlbum(id);
      } else if (type === "artist") {
        result = await TracksService.getByArtist(id);
      } else if (type === "playlist") {
        const playlist = await PlaylistsService.getById(id);
        result = (playlist.tracks ?? [])
          .sort((a, b) => a.position - b.position)
          .map((pt) => ({
            id: pt.track.id,
            title: pt.track.title,
            duration: pt.track.duration,
            audioUrl: pt.track.audioUrl,
            coverUrl: pt.track.coverUrl,
            artist: pt.track.artist,
            album: pt.track.album,
            genre: pt.track.genre ?? null,
            playCount: pt.track.playCount ?? 0,
            isLiked: pt.track.isLiked,
            inLibrary: pt.track.inLibrary,
          }));
      }

      setTracks(result);
    } catch (e) {
      console.error("CollectionScreen load error:", e);
      setError(true);
    }
  }, [type, id]);

  // Initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadTracks();
      setLoading(false);
    })();
  }, [loadTracks]);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTracks();
    setRefreshing(false);
  }, [loadTracks]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleTrackPress = useCallback(
    async (index: number) => {
      if (tracks.length === 0) return;
      await loadAndPlay(tracks, index);
    },
    [tracks, loadAndPlay],
  );

  const handlePlayAll = useCallback(async () => {
    if (tracks.length === 0) return;
    await loadAndPlay(tracks, 0);
  }, [tracks, loadAndPlay]);

  const handleShufflePlay = useCallback(async () => {
    if (tracks.length === 0) return;
    const randomIndex = Math.floor(Math.random() * tracks.length);
    await loadAndPlay(tracks, randomIndex);
  }, [tracks, loadAndPlay]);

  // ── Total duration ───────────────────────────────────────────────────────────

  const totalSeconds = tracks.reduce((sum, t) => sum + t.duration, 0);
  const totalMins = Math.floor(totalSeconds / 60);
  const totalHrs = Math.floor(totalMins / 60);
  const durationLabel =
    totalHrs > 0 ? `${totalHrs} hr ${totalMins % 60} min` : `${totalMins} min`;

  // ── Icon for header (when no cover) ─────────────────────────────────────────

  const placeholderIcon =
    type === "artist" ? "person" : type === "album" ? "disc" : "musical-notes";

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#121212" }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#1DB954"
          />
        }
      >
        {/* ── Header row: back button ── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 8,
            paddingTop: 8,
            paddingBottom: 4,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 8 }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* ── Hero section ── */}
        <View
          style={{ alignItems: "center", paddingTop: 16, paddingBottom: 24 }}
        >
          {/* Cover art */}
          {coverUrl ? (
            <Image
              source={{ uri: coverUrl }}
              style={{
                width: COVER_SIZE,
                height: COVER_SIZE,
                borderRadius: type === "artist" ? COVER_SIZE / 2 : 8,
                backgroundColor: "#282828",
                marginBottom: 20,
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.6,
                shadowRadius: 16,
              }}
            />
          ) : (
            <View
              style={{
                width: COVER_SIZE,
                height: COVER_SIZE,
                borderRadius: type === "artist" ? COVER_SIZE / 2 : 8,
                backgroundColor: "#282828",
                marginBottom: 20,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={placeholderIcon} size={64} color="#555" />
            </View>
          )}

          {/* Title */}
          <Text
            numberOfLines={2}
            style={{
              color: "white",
              fontSize: 22,
              fontWeight: "bold",
              textAlign: "center",
              paddingHorizontal: 24,
              marginBottom: 6,
            }}
          >
            {title}
          </Text>

          {/* Subtitle (artist name / owner) */}
          {subtitle ? (
            <Text
              numberOfLines={1}
              style={{
                color: "#B3B3B3",
                fontSize: 14,
                textAlign: "center",
                marginBottom: 4,
              }}
            >
              {subtitle}
            </Text>
          ) : null}

          {/* Track count + duration */}
          {!loading && tracks.length > 0 && (
            <Text style={{ color: "#555", fontSize: 12, marginTop: 4 }}>
              {tracks.length} {tracks.length === 1 ? "song" : "songs"} •{" "}
              {durationLabel}
            </Text>
          )}
        </View>

        {/* ── Play / Shuffle buttons ── */}
        {!loading && !error && tracks.length > 0 && (
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 24,
              gap: 12,
              marginBottom: 24,
            }}
          >
            <TouchableOpacity
              onPress={handlePlayAll}
              activeOpacity={0.8}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#1DB954",
                borderRadius: 30,
                paddingVertical: 13,
                gap: 8,
              }}
            >
              <Ionicons name="play" size={18} color="black" />
              <Text style={{ color: "black", fontWeight: "700", fontSize: 15 }}>
                Play
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShufflePlay}
              activeOpacity={0.8}
              style={{
                flex: 1,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "#282828",
                borderRadius: 30,
                paddingVertical: 13,
                gap: 8,
              }}
            >
              <Ionicons name="shuffle" size={18} color="white" />
              <Text style={{ color: "white", fontWeight: "700", fontSize: 15 }}>
                Shuffle
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Loading ── */}
        {loading && (
          <View style={{ paddingTop: 40, alignItems: "center" }}>
            <ActivityIndicator color="#1DB954" size="large" />
          </View>
        )}

        {/* ── Error ── */}
        {error && !loading && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#1E1E1E",
              borderRadius: 8,
              padding: 12,
              marginHorizontal: 16,
            }}
          >
            <Ionicons name="warning-outline" size={16} color="#FF4444" />
            <Text
              style={{ color: "#FF4444", fontSize: 13, flex: 1, marginLeft: 8 }}
            >
              Couldn't load tracks.
            </Text>
            <TouchableOpacity onPress={loadTracks}>
              <Text
                style={{ color: "#1DB954", fontSize: 13, fontWeight: "600" }}
              >
                Retry
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Empty state ── */}
        {!loading && !error && tracks.length === 0 && (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Ionicons name="musical-notes-outline" size={48} color="#555" />
            <Text style={{ color: "#B3B3B3", fontSize: 14, marginTop: 12 }}>
              No tracks found
            </Text>
          </View>
        )}

        {/* ── Track list ── */}
        {!loading && !error && tracks.length > 0 && (
          <View>
            <View
              style={{
                height: 1,
                backgroundColor: "#282828",
                marginHorizontal: 16,
                marginBottom: 8,
              }}
            />
            {tracks.map((track, index) => (
              <TrackRow
                key={track.id}
                track={track}
                index={index}
                isActive={currentTrack?.id === track.id}
                onPress={() => handleTrackPress(index)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
