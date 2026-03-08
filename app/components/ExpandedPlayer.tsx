import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  PanResponder,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { usePlayer } from "../context/PlayerContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DISMISS_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

export default function ExpandedPlayer() {
  const { currentTrack, isExpanded, setIsExpanded, isPlaying, setIsPlaying } =
    usePlayer();
  const insets = useSafeAreaInsets();

  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const albumSize = useRef(new Animated.Value(280)).current;
  const isDragging = useRef(false); // tracks if dismiss came from a swipe

  // Only runs for tap-triggered open/close — swipe handles its own animation
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

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) => {
        return dy > 10 && Math.abs(dy) > Math.abs(dx);
      },
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DISMISS_THRESHOLD || vy > VELOCITY_THRESHOLD) {
          // Mark as swipe-dismissed so useEffect skips its animation
          isDragging.current = true;
          setIsExpanded(false);

          // Continue sliding down from current finger position
          Animated.spring(translateY, {
            toValue: SCREEN_HEIGHT,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
            velocity: vy,
          }).start();
        } else {
          // Snap back to fully open
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 6,
          }).start();
        }
      },
    }),
  ).current;

  return (
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
          alignSelf: "center",
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
        <IconButton name="ellipsis-horizontal" size={24} color="white" />
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
        <IconButton name="shuffle" size={22} color="#B3B3B3" />
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
        <IconButton name="repeat" size={22} color="#B3B3B3" />
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
        <IconButton name="share-outline" size={22} color="#B3B3B3" />
        <IconButton name="add-circle-outline" size={22} color="#B3B3B3" />
        <IconButton name="download-outline" size={22} color="#B3B3B3" />
        <IconButton name="mic-outline" size={22} color="#B3B3B3" />
        <IconButton name="list-outline" size={22} color="#B3B3B3" />
      </View>
    </Animated.View>
  );
}

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
