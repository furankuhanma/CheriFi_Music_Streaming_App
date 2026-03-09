import React, { useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  Dimensions,
  FlatList,
  PanResponder,
  Image,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer, Track } from "../context/PlayerContext";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.4;

type Props = {
  visible: boolean;
  onClose: () => void;
};

export default function QueueSheet({ visible, onClose }: Props) {
  const { queue, currentTrack, playTrack, isLoading, refetchQueue } =
    usePlayer();

  const insets = useSafeAreaInsets();
  const translateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const isDragging = useRef(false);
  const listRef = useRef<FlatList>(null);

  // ── Open / close animation ────────────────────────────────────────────────
  useEffect(() => {
    if (isDragging.current) {
      isDragging.current = false;
      return;
    }

    Animated.spring(translateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }, [visible]);

  // ── Scroll to current track on open ──────────────────────────────────────
  useEffect(() => {
    if (!visible || !currentTrack) return;
    const idx = queue.findIndex((t) => t.id === currentTrack.id);
    if (idx > 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: idx,
          animated: true,
          viewOffset: 16,
        });
      }, 350);
    }
  }, [visible]);

  // ── Pan dismiss ───────────────────────────────────────────────────────────
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        dy > 8 && Math.abs(dy) > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) translateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DISMISS_THRESHOLD || vy > VELOCITY_THRESHOLD) {
          isDragging.current = true;
          onClose();
          Animated.spring(translateY, {
            toValue: SHEET_HEIGHT,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
            velocity: vy,
          }).start();
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  const currentIndex = queue.findIndex((t) => t.id === currentTrack?.id);
  const upNext = currentIndex >= 0 ? queue.slice(currentIndex + 1) : queue;
  const playedTracks = currentIndex > 0 ? queue.slice(0, currentIndex) : [];

  const renderTrack = useCallback(
    ({ item, index }: { item: Track; index: number }) => {
      const isActive = item.id === currentTrack?.id;
      const isPast = currentIndex >= 0 && queue.indexOf(item) < currentIndex;

      return (
        <TouchableOpacity
          onPress={() => playTrack(item)}
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingVertical: 10,
            paddingHorizontal: 16,
            backgroundColor: isActive ? "rgba(29,185,84,0.08)" : "transparent",
            borderRadius: 10,
            marginHorizontal: 8,
            marginVertical: 2,
          }}
          accessibilityRole="button"
          accessibilityLabel={`Play ${item.title} by ${item.artist.name}${isActive ? ", currently playing" : ""}`}
          accessibilityState={{ selected: isActive }}
        >
          {/* Cover */}
          <View
            style={{
              width: 46,
              height: 46,
              borderRadius: 6,
              overflow: "hidden",
              backgroundColor: "#2A2A2A",
              marginRight: 12,
            }}
          >
            {item.coverUrl ? (
              <Image
                source={{ uri: item.coverUrl }}
                style={{
                  width: "100%",
                  height: "100%",
                  opacity: isPast ? 0.4 : 1,
                }}
                accessibilityElementsHidden
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: "center",
                  justifyContent: "center",
                }}
                accessibilityElementsHidden
              >
                <Ionicons name="musical-note" size={20} color="#555" />
              </View>
            )}

            {/* Playing indicator overlay */}
            {isActive && (
              <View
                style={{
                  position: "absolute",
                  inset: 0,
                  backgroundColor: "rgba(0,0,0,0.45)",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 6,
                }}
                accessibilityElementsHidden
              >
                <Ionicons name="musical-notes" size={18} color="#1DB954" />
              </View>
            )}
          </View>

          {/* Info */}
          <View style={{ flex: 1 }} accessibilityElementsHidden>
            <Text
              style={{
                color: isActive ? "#1DB954" : isPast ? "#555" : "white",
                fontSize: 14,
                fontWeight: isActive ? "700" : "500",
              }}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text
              style={{
                color: isActive ? "#1DB954" : isPast ? "#444" : "#888",
                fontSize: 12,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {item.artist.name}
            </Text>
          </View>

          {/* Duration */}
          <Text
            style={{
              color: isPast ? "#444" : "#666",
              fontSize: 12,
              marginLeft: 8,
            }}
            accessibilityElementsHidden
          >
            {formatDuration(item.duration)}
          </Text>

          {isActive && (
            <View style={{ marginLeft: 8 }} accessibilityElementsHidden>
              <Ionicons name="volume-high" size={16} color="#1DB954" />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [currentTrack, currentIndex, queue, playTrack],
  );

  const SectionHeader = ({
    title,
    count,
  }: {
    title: string;
    count: number;
  }) => (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 8,
      }}
    >
      <Text
        style={{
          color: "#888",
          fontSize: 12,
          fontWeight: "700",
          letterSpacing: 0.8,
          textTransform: "uppercase",
        }}
      >
        {title}
      </Text>
      <View
        style={{
          marginLeft: 8,
          backgroundColor: "#2A2A2A",
          borderRadius: 10,
          paddingHorizontal: 6,
          paddingVertical: 2,
        }}
      >
        <Text style={{ color: "#666", fontSize: 11, fontWeight: "600" }}>
          {count}
        </Text>
      </View>
    </View>
  );

  if (!visible && translateY) {
    // Still render so it can animate out
  }

  return (
    <>
      {/* Backdrop */}
      {visible && (
        <TouchableOpacity
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.55)",
          }}
          onPress={onClose}
          activeOpacity={1}
          accessibilityLabel="Close queue"
          accessibilityHint="Double tap to close the queue"
        />
      )}

      {/* Sheet */}
      <Animated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY }],
        }}
        accessibilityViewIsModal={visible}
      >
        <View
          style={{
            height: SHEET_HEIGHT,
            backgroundColor: "#1A1A1A",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: insets.bottom,
            overflow: "hidden",
          }}
        >
          {/* Drag handle area */}
          <View
            {...panResponder.panHandlers}
            style={{ paddingBottom: 12, paddingTop: 12, alignItems: "center" }}
            accessible={false}
          >
            <View
              style={{
                width: 36,
                height: 4,
                borderRadius: 2,
                backgroundColor: "#444",
              }}
              accessibilityElementsHidden
            />
          </View>

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingBottom: 8,
            }}
            accessible={false}
          >
            <Text
              style={{
                color: "white",
                fontSize: 18,
                fontWeight: "700",
                flex: 1,
              }}
              accessibilityRole="header"
            >
              Queue
            </Text>
            <TouchableOpacity
              onPress={refetchQueue}
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#2A2A2A",
                borderRadius: 16,
                paddingHorizontal: 12,
                paddingVertical: 6,
                marginRight: 8,
              }}
              accessibilityRole="button"
              accessibilityLabel="Refresh queue"
              accessibilityHint="Double tap to load new recommendations"
            >
              <Ionicons
                name="refresh"
                size={14}
                color="#888"
                style={{ marginRight: 4 }}
              />
              <Text style={{ color: "#888", fontSize: 12, fontWeight: "600" }}>
                Refresh
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              style={{ padding: 4 }}
              accessibilityRole="button"
              accessibilityLabel="Close queue"
            >
              <Ionicons name="close" size={22} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View
            style={{
              height: 1,
              backgroundColor: "#2A2A2A",
              marginHorizontal: 20,
              marginBottom: 4,
            }}
          />

          {isLoading && queue.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ActivityIndicator color="#1DB954" />
              <Text style={{ color: "#666", marginTop: 12, fontSize: 13 }}>
                Loading queue…
              </Text>
            </View>
          ) : queue.length === 0 ? (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 32,
              }}
            >
              <Ionicons
                name="musical-notes-outline"
                size={40}
                color="#333"
                style={{ marginBottom: 12 }}
              />
              <Text
                style={{ color: "#666", fontSize: 14, textAlign: "center" }}
              >
                No tracks in queue. Tap refresh to load recommendations.
              </Text>
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={queue}
              keyExtractor={(item) => item.id}
              renderItem={renderTrack}
              onScrollToIndexFailed={() => {}}
              ListHeaderComponent={
                <>
                  {currentTrack && (
                    <>
                      <SectionHeader title="Now Playing" count={1} />
                      {renderTrack({
                        item: currentTrack,
                        index: currentIndex,
                      })}
                    </>
                  )}
                  {upNext.length > 0 && (
                    <SectionHeader title="Up Next" count={upNext.length} />
                  )}
                </>
              }
              getItemLayout={(_, index) => ({
                length: 66,
                offset: 66 * index,
                index,
              })}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              accessibilityLabel="Track queue"
            />
          )}
        </View>
      </Animated.View>
    </>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
