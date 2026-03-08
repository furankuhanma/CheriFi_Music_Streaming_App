import React, { useRef, useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
  Modal,
  Share,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer, RepeatMode } from "../context/PlayerContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DISMISS_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

// ─── Repeat icon helper ───────────────────────────────────────────────────────

function repeatIcon(mode: RepeatMode): { name: any; color: string } {
  if (mode === "one") return { name: "repeat-outline", color: "#1DB954" };
  if (mode === "all") return { name: "repeat", color: "#1DB954" };
  return { name: "repeat", color: "#B3B3B3" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpandedPlayer() {
  const {
    currentTrack,
    isExpanded,
    setIsExpanded,
    isPlaying,
    setIsPlaying,
    isShuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
  } = usePlayer();

  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const albumSize = useRef(new Animated.Value(280)).current;
  const isDragging = useRef(false);

  const [showContextMenu, setShowContextMenu] = useState(false);

  // ── Slide in / out on isExpanded change ──────────────────────────────────
  useEffect(() => {
    if (isDragging.current) {
      isDragging.current = false;
      return;
    }
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: isExpanded ? 0 : SCREEN_HEIGHT,
        useNativeDriver: true,
        bounciness: 0,
        speed: 20,
      }),
      Animated.spring(albumSize, {
        toValue: isExpanded ? 280 : 44,
        useNativeDriver: false,
        bounciness: 4,
      }),
    ]).start();
  }, [isExpanded]);

  // ── Swipe down to dismiss ─────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        dy > 10 && Math.abs(dy) > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DISMISS_THRESHOLD || vy > VELOCITY_THRESHOLD) {
          isDragging.current = true;
          setIsExpanded(false);
          Animated.spring(translateY, {
            toValue: SCREEN_HEIGHT,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
            velocity: vy,
          }).start();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    }),
  ).current;

  // ── Action handlers ───────────────────────────────────────────────────────
  const handleShare = async () => {
    try {
      await Share.share({
        message: `Now listening to ${currentTrack.title} by ${currentTrack.artist}`,
      });
    } catch {
      Alert.alert("Error", "Could not share track");
    }
  };

  const handleAddToPlaylist = () =>
    Alert.alert("Add to Playlist", "Playlist picker coming soon");

  const handleDownload = () =>
    Alert.alert("Download", "Offline download coming soon");

  const handleLyrics = () => Alert.alert("Lyrics", "Lyrics view coming soon");

  const repeat = repeatIcon(repeatMode);

  return (
    <>
      <Animated.View
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "#121212",
          transform: [{ translateY }],
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          paddingHorizontal: 24,
          alignItems: "center",
        }}
        {...panResponder.panHandlers}
      >
        {/* Drag Handle */}
        <View
          style={{
            width: 36,
            height: 4,
            borderRadius: 2,
            backgroundColor: "#555",
            marginBottom: 16,
          }}
        />

        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            marginBottom: 32,
          }}
        >
          <IconButton
            name="chevron-down"
            size={28}
            color="white"
            onPress={() => setIsExpanded(false)}
          />
          <Text
            style={{
              color: "white",
              flex: 1,
              textAlign: "center",
              fontWeight: "600",
              fontSize: 14,
            }}
          >
            Now Playing
          </Text>
          <IconButton
            name="ellipsis-horizontal"
            size={24}
            color="white"
            onPress={() => setShowContextMenu(true)}
          />
        </View>

        {/* Album Art */}
        <Animated.Image
          source={{ uri: currentTrack.albumArt }}
          style={{
            width: albumSize,
            height: albumSize,
            borderRadius: 8,
            marginBottom: 32,
          }}
        />

        {/* Track Info + Like */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            marginBottom: 24,
          }}
        >
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: "white", fontSize: 22, fontWeight: "700" }}
              numberOfLines={1}
            >
              {currentTrack.title}
            </Text>
            <Text
              style={{ color: "#B3B3B3", fontSize: 15, marginTop: 4 }}
              numberOfLines={1}
            >
              {currentTrack.artist}
            </Text>
          </View>
          <IconButton name="heart-outline" size={24} color="#B3B3B3" />
        </View>

        {/* Seek Bar */}
        <View style={{ width: "100%", marginBottom: 8 }}>
          <View style={{ height: 4, backgroundColor: "#333", borderRadius: 2 }}>
            <View
              style={{
                height: 4,
                backgroundColor: "#1DB954",
                width: "30%",
                borderRadius: 2,
              }}
            />
          </View>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 6,
            }}
          >
            <Text style={{ color: "#B3B3B3", fontSize: 11 }}>1:02</Text>
            <Text style={{ color: "#B3B3B3", fontSize: 11 }}>3:22</Text>
          </View>
        </View>

        {/* Main Controls */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 16,
          }}
        >
          {/* Shuffle — green when active */}
          <IconButton
            name="shuffle"
            size={22}
            color={isShuffle ? "#1DB954" : "#B3B3B3"}
            onPress={toggleShuffle}
          />
          <IconButton name="play-skip-back" size={32} color="white" />
          <TouchableOpacity
            onPress={() => setIsPlaying(!isPlaying)}
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: "white",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={32}
              color="black"
            />
          </TouchableOpacity>
          <IconButton name="play-skip-forward" size={32} color="white" />
          {/* Repeat — cycles off → all → one */}
          <View>
            <IconButton
              name={repeat.name}
              size={22}
              color={repeat.color}
              onPress={cycleRepeat}
            />
            {repeatMode === "one" && (
              <Text
                style={{
                  position: "absolute",
                  top: 4,
                  right: 4,
                  color: "#1DB954",
                  fontSize: 8,
                  fontWeight: "700",
                }}
              >
                1
              </Text>
            )}
          </View>
        </View>

        {/* Bottom Actions */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            width: "100%",
            marginTop: 32,
          }}
        >
          <IconButton
            name="share-outline"
            size={22}
            color="#B3B3B3"
            onPress={handleShare}
          />
          <IconButton
            name="add-circle-outline"
            size={22}
            color="#B3B3B3"
            onPress={handleAddToPlaylist}
          />
          <IconButton
            name="download-outline"
            size={22}
            color="#B3B3B3"
            onPress={handleDownload}
          />
          <IconButton
            name="mic-outline"
            size={22}
            color="#B3B3B3"
            onPress={handleLyrics}
          />
          <IconButton name="list-outline" size={22} color="#B3B3B3" />
        </View>
      </Animated.View>

      {/* ── Context Menu Modal ────────────────────────────────────────────── */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContextMenu(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setShowContextMenu(false)}
        />
        <View
          style={{
            backgroundColor: "#282828",
            borderRadius: 12,
            padding: 16,
            marginHorizontal: 16,
            marginBottom: 40,
          }}
        >
          <Text
            style={{
              color: "white",
              fontWeight: "700",
              fontSize: 16,
              marginBottom: 16,
              textAlign: "center",
            }}
          >
            {currentTrack.title}
          </Text>
          {[
            { icon: "musical-notes-outline", label: "Go to Album" },
            { icon: "person-outline", label: "Go to Artist" },
            { icon: "radio-outline", label: "Go to Song Radio" },
            { icon: "flag-outline", label: "Report Track" },
          ].map(({ icon, label }) => (
            <TouchableOpacity
              key={label}
              onPress={() => {
                setShowContextMenu(false);
                Alert.alert(label, `${label} coming soon`);
              }}
              style={{
                flexDirection: "row",
                alignItems: "center",
                paddingVertical: 14,
              }}
            >
              <Ionicons
                name={icon as any}
                size={22}
                color="white"
                style={{ marginRight: 16 }}
              />
              <Text style={{ color: "white", fontSize: 15 }}>{label}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setShowContextMenu(false)}
            style={{ marginTop: 8, alignItems: "center", paddingVertical: 12 }}
          >
            <Text style={{ color: "#B3B3B3", fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

// ─── Reusable Icon Button ─────────────────────────────────────────────────────

function IconButton({
  name,
  size,
  color,
  onPress,
}: {
  name: any;
  size: number;
  color: string;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity onPress={onPress} style={{ padding: 8 }}>
      <Ionicons name={name} size={size} color={color} />
    </TouchableOpacity>
  );
}
