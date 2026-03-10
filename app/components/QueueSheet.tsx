/**
 * QueueSheet — Spotify-style queue bottom sheet with:
 *   • Reanimated 4 worklet-driven ghost (zero JS-thread jitter)
 *   • useFrameCallback auto-scroll (UI thread, gradient speed)
 *   • withSpring neighbour shifts driven from shared values
 *   • Swipe-left to remove, tap to skip-to, drag handle to reorder
 */
import React, { useRef, useEffect, useCallback, useState, memo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Animated as RNAnimated,
  Dimensions,
  PanResponder,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
} from "react-native";
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedRef,
  useFrameCallback,
  useAnimatedReaction,
  withSpring,
  withTiming,
  runOnJS,
  scrollTo,
  Easing,
  makeMutable,
  type SharedValue,
} from "react-native-reanimated";
import { Swipeable } from "react-native-gesture-handler";
import * as Haptics from "expo-haptics";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { usePlayer, Track } from "../context/PlayerContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const SCREEN_HEIGHT = Dimensions.get("window").height;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.75;
const DISMISS_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.4;
const ITEM_HEIGHT = 66;

// Auto-scroll zones: how many px from the top/bottom edge triggers scrolling
const SCROLL_ZONE = 80;
// Maximum scroll speed (px / frame at 60fps ≈ 6 px/ms)
const MAX_SCROLL_SPEED = 12;

// Spring config used for neighbour shifts — tuned for snappy but smooth feel
const SHIFT_SPRING = { damping: 22, stiffness: 260, mass: 0.7 };
// Spring for ghost lift/drop scale
const SCALE_SPRING = { damping: 18, stiffness: 300, mass: 0.6 };

type Props = {
  visible: boolean;
  onClose: () => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── DragHandle ───────────────────────────────────────────────────────────────

interface DragHandleProps {
  index: number;
  onStartDrag: (index: number) => void;
  onUpdateDrag: (dy: number) => void;
  onEndDrag: () => void;
  blocked: boolean;
}

const DragHandle = memo(function DragHandle({
  index,
  onStartDrag,
  onUpdateDrag,
  onEndDrag,
  blocked,
}: DragHandleProps) {
  // Store latest prop values in refs so the stable PanResponder always reads
  // the most recent ones without being recreated.
  const blockedRef = useRef(blocked);
  const indexRef = useRef(index);
  const onStartRef = useRef(onStartDrag);
  const onUpdateRef = useRef(onUpdateDrag);
  const onEndRef = useRef(onEndDrag);

  useEffect(() => {
    blockedRef.current = blocked;
  }, [blocked]);
  useEffect(() => {
    indexRef.current = index;
  }, [index]);
  useEffect(() => {
    onStartRef.current = onStartDrag;
  }, [onStartDrag]);
  useEffect(() => {
    onUpdateRef.current = onUpdateDrag;
  }, [onUpdateDrag]);
  useEffect(() => {
    onEndRef.current = onEndDrag;
  }, [onEndDrag]);

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isActiveRef = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !blockedRef.current,
      // Only capture move events after the long-press fires.
      onMoveShouldSetPanResponder: () => isActiveRef.current,
      onMoveShouldSetPanResponderCapture: () => isActiveRef.current,

      onPanResponderGrant: () => {
        if (blockedRef.current) return;
        longPressTimerRef.current = setTimeout(() => {
          isActiveRef.current = true;
          onStartRef.current(indexRef.current);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
            () => {},
          );
        }, 280);
      },

      onPanResponderMove: (_, { dy }) => {
        if (!isActiveRef.current) return;
        onUpdateRef.current(dy);
      },

      onPanResponderRelease: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isActiveRef.current) {
          isActiveRef.current = false;
          onEndRef.current();
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        }
      },

      onPanResponderTerminate: () => {
        if (longPressTimerRef.current) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        if (isActiveRef.current) {
          isActiveRef.current = false;
          onEndRef.current();
        }
      },
    }),
  ).current;

  return (
    <View
      {...panResponder.panHandlers}
      style={{
        width: 44,
        height: ITEM_HEIGHT,
        alignItems: "center",
        justifyContent: "center",
        opacity: blocked ? 0.25 : 1,
      }}
      accessibilityLabel="Drag to reorder"
      accessibilityHint="Long press and drag up or down to reorder"
      accessibilityRole="adjustable"
    >
      <Ionicons name="reorder-three-outline" size={22} color="#666" />
    </View>
  );
});

// ─── DeleteAction ─────────────────────────────────────────────────────────────

function DeleteAction({
  progress,
  onDelete,
}: {
  progress: RNAnimated.AnimatedInterpolation<number>;
  onDelete: () => void;
}) {
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1],
    extrapolate: "clamp",
  });

  return (
    <TouchableOpacity
      onPress={onDelete}
      activeOpacity={0.8}
      style={{
        width: 80,
        height: ITEM_HEIGHT,
        backgroundColor: "#C0392B",
        alignItems: "center",
        justifyContent: "center",
      }}
      accessibilityRole="button"
      accessibilityLabel="Remove from queue"
    >
      <RNAnimated.View
        style={{ alignItems: "center", transform: [{ scale }] }}
        accessibilityElementsHidden
      >
        <Ionicons name="trash-outline" size={20} color="white" />
        <Text
          style={{
            color: "white",
            fontSize: 10,
            fontWeight: "700",
            marginTop: 3,
            letterSpacing: 0.4,
          }}
        >
          Remove
        </Text>
      </RNAnimated.View>
    </TouchableOpacity>
  );
}

// ─── UpNextRow ─────────────────────────────────────────────────────────────────
// Each row in the "Up Next" list.
// shiftSV is a Reanimated SharedValue<number> — driven from the parent's
// useAnimatedReaction so all shift animations live on the UI thread.

interface UpNextRowProps {
  item: Track;
  index: number;
  isDragging: boolean;
  isGhost: boolean;
  shiftSV: SharedValue<number>;
  onStartDrag: (index: number) => void;
  onUpdateDrag: (dy: number) => void;
  onEndDrag: () => void;
  onRemove: (id: string) => void;
  onSkipTo: (id: string) => void;
}

const UpNextRow = memo(function UpNextRow({
  item,
  index,
  isDragging,
  isGhost,
  shiftSV,
  onStartDrag,
  onUpdateDrag,
  onEndDrag,
  onRemove,
  onSkipTo,
}: UpNextRowProps) {
  const swipeableRef = useRef<Swipeable>(null);

  useEffect(() => {
    if (isDragging) swipeableRef.current?.close();
  }, [isDragging]);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: shiftSV.value }],
  }));

  const renderRightActions = useCallback(
    (progress: RNAnimated.AnimatedInterpolation<number>) => (
      <DeleteAction
        progress={progress}
        onDelete={() => {
          swipeableRef.current?.close();
          onRemove(item.id);
        }}
      />
    ),
    [item.id, onRemove],
  );

  return (
    <Reanimated.View style={[{ height: ITEM_HEIGHT }, rowStyle]}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          flex: 1,
          opacity: isGhost ? 0.2 : 1,
        }}
      >
        <Swipeable
          ref={swipeableRef}
          renderRightActions={renderRightActions}
          friction={2}
          rightThreshold={40}
          overshootRight={false}
          enabled={!isDragging}
          containerStyle={{ flex: 1 }}
        >
          <TouchableOpacity
            onPress={() => onSkipTo(item.id)}
            activeOpacity={0.7}
            style={{
              flexDirection: "row",
              alignItems: "center",
              height: ITEM_HEIGHT,
              paddingHorizontal: 16,
              backgroundColor: "#1A1A1A",
            }}
            accessibilityRole="button"
            accessibilityLabel={`Skip to ${item.title} by ${item.artist.name}`}
            accessibilityHint="Double tap to start playing this track"
          >
            <View
              style={{
                width: 42,
                height: 42,
                borderRadius: 6,
                overflow: "hidden",
                backgroundColor: "#2A2A2A",
                marginRight: 12,
              }}
              accessibilityElementsHidden
            >
              {item.coverUrl ? (
                <Image
                  source={{ uri: item.coverUrl }}
                  style={{ width: "100%", height: "100%" }}
                  accessibilityElementsHidden
                />
              ) : (
                <View
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Ionicons name="musical-note" size={18} color="#555" />
                </View>
              )}
            </View>

            <View style={{ flex: 1 }} accessibilityElementsHidden>
              <Text
                style={{ color: "white", fontSize: 14, fontWeight: "500" }}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              <Text
                style={{ color: "#888", fontSize: 12, marginTop: 2 }}
                numberOfLines={1}
              >
                {item.artist.name}
              </Text>
            </View>

            <Text
              style={{ color: "#555", fontSize: 12, marginLeft: 8 }}
              accessibilityElementsHidden
            >
              {formatDuration(item.duration)}
            </Text>
          </TouchableOpacity>
        </Swipeable>

        <DragHandle
          index={index}
          blocked={isDragging}
          onStartDrag={onStartDrag}
          onUpdateDrag={onUpdateDrag}
          onEndDrag={onEndDrag}
        />
      </View>
    </Reanimated.View>
  );
});

// ─── GhostRow ─────────────────────────────────────────────────────────────────
// Lifted clone that tracks the finger. All transforms are driven by
// Reanimated SharedValues so they run entirely on the UI thread.

interface GhostRowProps {
  item: Track;
  ghostY: SharedValue<number>;
  ghostScale: SharedValue<number>;
}

function GhostRow({ item, ghostY, ghostScale }: GhostRowProps) {
  const ghostStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: ghostY.value }, { scale: ghostScale.value }],
  }));

  return (
    <Reanimated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          height: ITEM_HEIGHT,
          zIndex: 100,
        },
        ghostStyle,
        Platform.select({
          ios: {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.55,
            shadowRadius: 14,
          },
          android: { elevation: 14 },
        }),
      ]}
    >
      <View
        style={{
          flex: 1,
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: "#2E2E2E",
          borderRadius: 10,
          marginHorizontal: 4,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.1)",
        }}
      >
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 6,
            overflow: "hidden",
            backgroundColor: "#3A3A3A",
            marginLeft: 16,
            marginRight: 12,
          }}
        >
          {item.coverUrl ? (
            <Image
              source={{ uri: item.coverUrl }}
              style={{ width: "100%", height: "100%" }}
            />
          ) : (
            <View
              style={{
                flex: 1,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name="musical-note" size={18} color="#555" />
            </View>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text
            style={{ color: "white", fontSize: 14, fontWeight: "600" }}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text
            style={{ color: "#aaa", fontSize: 12, marginTop: 2 }}
            numberOfLines={1}
          >
            {item.artist.name}
          </Text>
        </View>

        <Text style={{ color: "#555", fontSize: 12, marginHorizontal: 8 }}>
          {formatDuration(item.duration)}
        </Text>

        <View
          style={{ width: 44, alignItems: "center", justifyContent: "center" }}
        >
          <Ionicons name="reorder-three-outline" size={22} color="#888" />
        </View>
      </View>
    </Reanimated.View>
  );
}

// ─── NowPlayingRow ─────────────────────────────────────────────────────────────

function NowPlayingRow({ track }: { track: Track }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: "rgba(29,185,84,0.08)",
        borderRadius: 10,
        marginHorizontal: 8,
        marginVertical: 2,
      }}
      accessible
      accessibilityLabel={`Now playing: ${track.title} by ${track.artist.name}`}
    >
      <View
        style={{
          width: 46,
          height: 46,
          borderRadius: 6,
          overflow: "hidden",
          backgroundColor: "#2A2A2A",
          marginRight: 12,
        }}
        accessibilityElementsHidden
      >
        {track.coverUrl ? (
          <Image
            source={{ uri: track.coverUrl }}
            style={{ width: "100%", height: "100%" }}
            accessibilityElementsHidden
          />
        ) : (
          <View
            style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
          >
            <Ionicons name="musical-note" size={20} color="#555" />
          </View>
        )}
        <View
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.45)",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 6,
          }}
          accessibilityElementsHidden
        >
          <Ionicons name="musical-notes" size={18} color="#1DB954" />
        </View>
      </View>

      <View style={{ flex: 1 }} accessibilityElementsHidden>
        <Text
          style={{ color: "#1DB954", fontSize: 14, fontWeight: "700" }}
          numberOfLines={1}
        >
          {track.title}
        </Text>
        <Text
          style={{ color: "#1DB954", fontSize: 12, marginTop: 2 }}
          numberOfLines={1}
        >
          {track.artist.name}
        </Text>
      </View>

      <Text
        style={{ color: "#555", fontSize: 12, marginLeft: 8 }}
        accessibilityElementsHidden
      >
        {formatDuration(track.duration)}
      </Text>

      <View style={{ marginLeft: 8 }} accessibilityElementsHidden>
        <Ionicons name="volume-high" size={16} color="#1DB954" />
      </View>
    </View>
  );
}

// ─── SectionHeader ─────────────────────────────────────────────────────────────

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 20,
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
        accessibilityRole="header"
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
}

// ─── QueueSheet ───────────────────────────────────────────────────────────────

export default function QueueSheet({ visible, onClose }: Props) {
  const {
    queue,
    currentTrack,
    skipToTrack,
    removeFromQueue,
    reorderQueue,
    isLoading,
    refetchQueue,
  } = usePlayer();

  const insets = useSafeAreaInsets();

  // ── Sheet slide (RN Animated — sheet itself doesn't need UI-thread perf) ──
  const sheetTranslateY = useRef(new RNAnimated.Value(SHEET_HEIGHT)).current;
  const isDismissingRef = useRef(false);

  useEffect(() => {
    if (isDismissingRef.current) {
      isDismissingRef.current = false;
      return;
    }
    RNAnimated.spring(sheetTranslateY, {
      toValue: visible ? 0 : SHEET_HEIGHT,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }, [visible]);

  // ── Sheet dismiss pan ─────────────────────────────────────────────────────
  const sheetPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, { dy, dx }) =>
        dy > 8 && Math.abs(dy) > Math.abs(dx),
      onPanResponderMove: (_, { dy }) => {
        if (dy > 0) sheetTranslateY.setValue(dy);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        if (dy > DISMISS_THRESHOLD || vy > VELOCITY_THRESHOLD) {
          isDismissingRef.current = true;
          onClose();
          RNAnimated.spring(sheetTranslateY, {
            toValue: SHEET_HEIGHT,
            useNativeDriver: true,
            bounciness: 0,
            speed: 20,
            velocity: vy,
          }).start();
        } else {
          RNAnimated.spring(sheetTranslateY, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 4,
          }).start();
        }
      },
    }),
  ).current;

  // ── Derived queue data ────────────────────────────────────────────────────
  const currentQueueIndex = queue.findIndex((t) => t.id === currentTrack?.id);
  const upNext =
    currentQueueIndex >= 0 ? queue.slice(currentQueueIndex + 1) : [];

  // Refs used inside worklets / stable callbacks
  const upNextRef = useRef(upNext);
  const currentQueueIndexRef = useRef(currentQueueIndex);
  useEffect(() => {
    upNextRef.current = upNext;
  });
  useEffect(() => {
    currentQueueIndexRef.current = currentQueueIndex;
  });

  // ── Reanimated shared values for the drag ghost ───────────────────────────
  // ghostY: absolute Y position inside the "Up Next" relative container.
  // ghostScale: slight scale-up while lifted.
  // dragging: 1 while a drag is active, 0 otherwise (used in worklets).
  // dragFrom / dragHover: indices into upNext.
  const ghostY = useSharedValue(0);
  const ghostScale = useSharedValue(1);
  const draggingSV = useSharedValue(0);
  const dragFromSV = useSharedValue(-1);
  const dragHoverSV = useSharedValue(-1);

  // ── Per-item shift shared values ──────────────────────────────────────────
  // We keep a stable map keyed by track id. Values persist across renders.
  const itemShiftSVs = useRef<Map<string, SharedValue<number>>>(new Map());
  // makeMutable (not useSharedValue) because this runs inside a callback and
  // must not violate the rules of hooks.
  const getItemSV = useCallback((id: string) => {
    if (!itemShiftSVs.current.has(id)) {
      itemShiftSVs.current.set(id, makeMutable(0));
    }
    return itemShiftSVs.current.get(id)!;
  }, []);

  // Pre-create SVs for all current items
  upNext.forEach((t) => getItemSV(t.id));

  // ── Neighbour shift reaction (runs on UI thread) ──────────────────────────
  // Every time dragHoverSV changes, spring each item's shift into place.
  // We pass upNextRef.current.length as a plain value captured at reaction
  // creation time — the dependency array keeps it fresh.
  useAnimatedReaction(
    () => ({
      from: dragFromSV.value,
      hover: dragHoverSV.value,
      active: draggingSV.value,
    }),
    ({ from, hover, active }) => {
      // We cannot access React state from a worklet, so we derive the
      // neighbour behaviour purely from shared value indices.
      // The reaction fires synchronously on the UI thread whenever any of
      // the three values change.
      const count = upNextRef.current.length;
      for (let i = 0; i < count; i++) {
        const sv = itemShiftSVs.current.get(upNextRef.current[i].id);
        if (!sv) continue;

        let target = 0;
        if (active === 1 && from >= 0 && hover >= 0 && i !== from) {
          if (from < hover && i > from && i <= hover) {
            target = -ITEM_HEIGHT;
          } else if (from > hover && i >= hover && i < from) {
            target = ITEM_HEIGHT;
          }
        }
        sv.value = withSpring(target, SHIFT_SPRING);
      }
    },
    [upNext.length],
  );

  // ── ScrollView ref + scroll offset tracking ───────────────────────────────
  const scrollRef = useAnimatedRef<Reanimated.ScrollView>();
  const scrollOffsetSV = useSharedValue(0);
  // Scrollable content height is tracked so we know the max scroll position.
  const scrollContentHeightSV = useSharedValue(0);
  const scrollViewHeightSV = useSharedValue(0);

  // ── Auto-scroll frame callback ────────────────────────────────────────────
  // Runs every frame while dragging. Reads ghostY relative to the ScrollView
  // viewport and scrolls at a speed proportional to edge proximity.
  const autoScrollFrame = useFrameCallback(() => {
    "worklet";
    if (draggingSV.value !== 1) return;

    const viewportH = scrollViewHeightSV.value;
    if (viewportH <= 0) return;

    // ghostY is in "Up Next list" coordinate space (0 = top of list).
    // The ghost's position within the ScrollView viewport is:
    //   ghostY_content = ghostY + upNextListOffset_in_scrollContent
    // We approximate upNextListOffset by subtracting the portion of scroll
    // content above the list. Since we don't measure it precisely, we use
    // a simpler model: the ghost's visible top = ghostY - scrollOffset.
    // This is accurate when the ghost is within the Up Next section.
    const ghostViewportTop = ghostY.value - scrollOffsetSV.value;
    const ghostViewportBottom = ghostViewportTop + ITEM_HEIGHT;

    const maxScroll = scrollContentHeightSV.value - viewportH;
    if (maxScroll <= 0) return;

    let speed = 0;

    if (ghostViewportTop < SCROLL_ZONE) {
      // Near the top — scroll up. Quadratic ramp for gradual feel.
      const ratio = Math.max(0, 1 - ghostViewportTop / SCROLL_ZONE);
      speed = -MAX_SCROLL_SPEED * ratio * ratio;
    } else if (ghostViewportBottom > viewportH - SCROLL_ZONE) {
      // Near the bottom — scroll down.
      const distFromBottom = viewportH - ghostViewportBottom;
      const ratio = Math.max(0, 1 - distFromBottom / SCROLL_ZONE);
      speed = MAX_SCROLL_SPEED * ratio * ratio;
    }

    if (speed !== 0) {
      const newOffset = Math.max(
        0,
        Math.min(scrollOffsetSV.value + speed, maxScroll),
      );
      scrollOffsetSV.value = newOffset;
      scrollTo(scrollRef, 0, newOffset, false);
    }
  }, false); // false = starts inactive; enabled in handleStartDrag

  // ── React-side drag state (only used to control isDragging boolean) ───────
  const [isDragging, setIsDragging] = useState(false);
  const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
  const [dragHoverIndex, setDragHoverIndex] = useState<number | null>(null);

  const dragFromRef = useRef<number | null>(null);
  const dragHoverRef = useRef<number | null>(null);

  // ── Drag callbacks (called from JS thread via DragHandle PanResponder) ────

  const handleStartDrag = useCallback((index: number) => {
    dragFromRef.current = index;
    dragHoverRef.current = index;

    // Set shared values — immediately available on UI thread
    ghostY.value = index * ITEM_HEIGHT;
    ghostScale.value = withSpring(1.045, SCALE_SPRING);
    draggingSV.value = 1;
    dragFromSV.value = index;
    dragHoverSV.value = index;

    // Enable the auto-scroll frame callback
    autoScrollFrame.setActive(true);

    setIsDragging(true);
    setDragFromIndex(index);
    setDragHoverIndex(index);
  }, []);

  const handleUpdateDrag = useCallback((dy: number) => {
    const from = dragFromRef.current;
    if (from === null) return;

    const listLength = upNextRef.current.length;
    const maxTop = Math.max(0, (listLength - 1) * ITEM_HEIGHT);

    // ghostY in Up-Next-list content space (not affected by scroll offset —
    // auto-scroll is handled by the frame callback independently).
    const clampedY = Math.max(0, Math.min(from * ITEM_HEIGHT + dy, maxTop));
    ghostY.value = clampedY;

    const newHover = Math.max(
      0,
      Math.min(Math.round(clampedY / ITEM_HEIGHT), listLength - 1),
    );

    if (newHover !== dragHoverRef.current) {
      dragHoverRef.current = newHover;
      dragHoverSV.value = newHover;
      setDragHoverIndex(newHover);
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const handleEndDrag = useCallback(() => {
    const from = dragFromRef.current;
    const hover = dragHoverRef.current;

    autoScrollFrame.setActive(false);

    ghostScale.value = withSpring(1, SCALE_SPRING);
    draggingSV.value = 0;
    dragFromSV.value = -1;
    dragHoverSV.value = -1;

    if (from !== null && hover !== null && from !== hover) {
      reorderQueue(
        currentQueueIndexRef.current + 1 + from,
        currentQueueIndexRef.current + 1 + hover,
      );
    }

    // Spring all shift values back to 0 (covers edge case where reorderQueue
    // hasn't re-rendered yet).
    upNextRef.current.forEach((item) => {
      const sv = itemShiftSVs.current.get(item.id);
      if (sv) sv.value = withSpring(0, { ...SHIFT_SPRING, damping: 30 });
    });

    dragFromRef.current = null;
    dragHoverRef.current = null;
    setIsDragging(false);
    setDragFromIndex(null);
    setDragHoverIndex(null);
  }, [reorderQueue]);

  const handleSkipTo = useCallback(
    (trackId: string) => {
      skipToTrack(trackId);
    },
    [skipToTrack],
  );

  const ghostItem =
    dragFromIndex !== null ? (upNext[dragFromIndex] ?? null) : null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
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
          accessibilityHint="Double tap to dismiss the queue"
        />
      )}

      <RNAnimated.View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          transform: [{ translateY: sheetTranslateY }],
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
          {/* Drag-to-dismiss handle */}
          <View
            {...sheetPanResponder.panHandlers}
            style={{ paddingTop: 12, paddingBottom: 12, alignItems: "center" }}
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

          <View
            style={{
              height: 1,
              backgroundColor: "#2A2A2A",
              marginHorizontal: 20,
              marginBottom: 4,
            }}
          />

          {/* Body */}
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
                No tracks in queue. Tap Refresh to load recommendations.
              </Text>
            </View>
          ) : (
            // Reanimated ScrollView so scrollTo() can target it from a worklet
            <Reanimated.ScrollView
              ref={scrollRef}
              scrollEnabled={!isDragging}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 16 }}
              accessibilityLabel="Track queue"
              scrollEventThrottle={16}
              onScroll={(e) => {
                scrollOffsetSV.value = e.nativeEvent.contentOffset.y;
              }}
              onLayout={(e) => {
                scrollViewHeightSV.value = e.nativeEvent.layout.height;
              }}
              onContentSizeChange={(_, h) => {
                scrollContentHeightSV.value = h;
              }}
            >
              {currentTrack && (
                <>
                  <SectionHeader title="Now Playing" count={1} />
                  <NowPlayingRow track={currentTrack} />
                </>
              )}

              {upNext.length > 0 ? (
                <>
                  <SectionHeader title="Up Next" count={upNext.length} />
                  <Text
                    style={{
                      color: "#444",
                      fontSize: 11,
                      paddingHorizontal: 20,
                      marginBottom: 4,
                    }}
                    accessibilityElementsHidden
                  >
                    Swipe left to remove · Long-press ☰ to reorder · Tap to
                    play
                  </Text>

                  {/* Relative container for ghost positioning */}
                  <View style={{ position: "relative" }}>
                    {upNext.map((item, index) => (
                      <UpNextRow
                        key={item.id}
                        item={item}
                        index={index}
                        isDragging={isDragging}
                        isGhost={isDragging && dragFromIndex === index}
                        shiftSV={getItemSV(item.id)}
                        onStartDrag={handleStartDrag}
                        onUpdateDrag={handleUpdateDrag}
                        onEndDrag={handleEndDrag}
                        onRemove={removeFromQueue}
                        onSkipTo={handleSkipTo}
                      />
                    ))}

                    {isDragging && ghostItem && (
                      <GhostRow
                        item={ghostItem}
                        ghostY={ghostY}
                        ghostScale={ghostScale}
                      />
                    )}
                  </View>
                </>
              ) : (
                currentTrack && (
                  <View
                    style={{
                      alignItems: "center",
                      paddingTop: 28,
                      paddingHorizontal: 32,
                    }}
                  >
                    <Text
                      style={{
                        color: "#555",
                        fontSize: 13,
                        textAlign: "center",
                      }}
                    >
                      Nothing up next. Tap "Refresh" to load more tracks.
                    </Text>
                  </View>
                )
              )}
            </Reanimated.ScrollView>
          )}
        </View>
      </RNAnimated.View>
    </>
  );
}
