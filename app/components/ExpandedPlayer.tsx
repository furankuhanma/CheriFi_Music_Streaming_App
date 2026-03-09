import React, { useRef, useEffect, useState, useCallback } from "react";
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
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  usePlayer,
  RepeatMode,
  PlaybackErrorType,
} from "../context/PlayerContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTrackTransition } from "../hooks/useTrackTransition";
import QueueSheet from "./QueueSheet";

const SCREEN_HEIGHT = Dimensions.get("window").height;
const DISMISS_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 0.5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function repeatIcon(mode: RepeatMode): { name: any; color: string } {
  if (mode === "one") return { name: "repeat-outline", color: "#1DB954" };
  if (mode === "all") return { name: "repeat", color: "#1DB954" };
  return { name: "repeat", color: "#B3B3B3" };
}

function repeatLabel(mode: RepeatMode): string {
  if (mode === "one") return "Repeat: one track";
  if (mode === "all") return "Repeat: all tracks";
  return "Repeat: off";
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
}

function errorMessage(error: PlaybackErrorType): string {
  switch (error) {
    case "network":
      return "No connection. Check your network and try again.";
    case "unsupported":
      return "This track format isn't supported on your device.";
    case "interrupted":
      return "Playback was interrupted. Tap to resume.";
    case "queue_failed":
      return "Couldn't load the queue. Tap to retry.";
    case "load_failed":
    default:
      return "Couldn't load this track. Tap to retry.";
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExpandedPlayer() {
  const {
    currentTrack,
    isExpanded,
    setIsExpanded,
    isPlaying,
    isLoading,
    playbackError,
    retryLoad,
    togglePlay,
    playNext,
    playPrevious,
    playbackPosition,
    duration,
    seekTo,
    isShuffle,
    toggleShuffle,
    repeatMode,
    cycleRepeat,
    isLiked,
    toggleLike,
  } = usePlayer();

  const insets = useSafeAreaInsets();

  // ── Panel slide animation ─────────────────────────────────────────────────
  const translateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const isDragging = useRef(false);

  // Open/close animation
  useEffect(() => {
    if (isDragging.current) {
      isDragging.current = false;
      return;
    }
    Animated.spring(translateY, {
      toValue: isExpanded ? 0 : SCREEN_HEIGHT,
      useNativeDriver: true,
      bounciness: 0,
      speed: 20,
    }).start();
  }, [isExpanded]);

  // Dismiss pan responder (swipe down to close player)
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

  // ── Track transition animations ──────────────────────────────────────────
  const transition = useTrackTransition(currentTrack?.id ?? "");

  // ── Local UI state ────────────────────────────────────────────────────────
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  // Seek bar
  // -------------------------------------------------------------------------
  // ROOT CAUSE OF BUG: PanResponder.create() runs ONCE at mount. Any state
  // or prop it closes over (seekBarWidth, duration, seekTo) is frozen at
  // their initial values (0, 0, stale fn). Dragging therefore always computes
  // ratio * 0 = 0 and seeks to position 0, restarting the track.
  //
  // FIX: Store every value the responder needs in a ref. The ref object is
  // created once but its .current is always up-to-date. This lets the
  // PanResponder read the correct live values without being recreated.
  // -------------------------------------------------------------------------
  const seekBarWidthRef = useRef(0);
  const isSeekingActiveRef = useRef(false); // blocks status-update writes during drag
  const seekPositionRef = useRef(0);
  const durationRef = useRef(0);
  const seekToRef = useRef(seekTo);

  // Keep duration ref and seekTo ref in sync every render (cheap, no effect needed)
  durationRef.current = duration;
  seekToRef.current = seekTo;

  // React state — only used to trigger re-renders for the progress UI
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPosition, setSeekPosition] = useState(0);

  // Seek bar PanResponder — reads refs, never stale state
  const seekPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      onPanResponderGrant: (evt) => {
        // Mark seeking so onPlaybackStatusUpdate stops overwriting position
        isSeekingActiveRef.current = true;
        setIsSeeking(true);

        const x = evt.nativeEvent.locationX;
        const w = seekBarWidthRef.current;
        const clamped = Math.max(0, Math.min(x, w));
        const pos = w > 0 ? (clamped / w) * durationRef.current : 0;
        seekPositionRef.current = pos;
        setSeekPosition(pos);
      },

      onPanResponderMove: (evt) => {
        const x = evt.nativeEvent.locationX;
        const w = seekBarWidthRef.current;
        const clamped = Math.max(0, Math.min(x, w));
        const pos = w > 0 ? (clamped / w) * durationRef.current : 0;
        seekPositionRef.current = pos;
        setSeekPosition(pos);
      },

      onPanResponderRelease: (evt) => {
        const x = evt.nativeEvent.locationX;
        const w = seekBarWidthRef.current;
        const clamped = Math.max(0, Math.min(x, w));
        const targetMs = w > 0 ? (clamped / w) * durationRef.current : 0;

        seekPositionRef.current = targetMs;
        setSeekPosition(targetMs);

        // Perform the actual seek, then re-enable status updates
        seekToRef.current(targetMs).finally(() => {
          isSeekingActiveRef.current = false;
          setIsSeeking(false);
        });
      },

      onPanResponderTerminate: () => {
        // Gesture cancelled (e.g. another responder took over) — just unlock
        isSeekingActiveRef.current = false;
        setIsSeeking(false);
      },
    }),
  ).current;

  const onSeekBarLayout = useCallback((e: LayoutChangeEvent) => {
    seekBarWidthRef.current = e.nativeEvent.layout.width;
  }, []);

  if (!currentTrack) return null;

  const displayPosition = isSeeking ? seekPosition : playbackPosition;
  const progress = duration > 0 ? (displayPosition / duration) * 100 : 0;
  const repeat = repeatIcon(repeatMode);

  // ── Play button ───────────────────────────────────────────────────────────
  const renderPlayButton = () => {
    if (isLoading) {
      return (
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: "white",
            alignItems: "center",
            justifyContent: "center",
          }}
          accessible
          accessibilityLabel="Loading track"
          accessibilityRole="progressbar"
        >
          <ActivityIndicator color="black" />
        </View>
      );
    }

    if (playbackError) {
      return (
        <TouchableOpacity
          onPress={retryLoad}
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            backgroundColor: "#FF4444",
            alignItems: "center",
            justifyContent: "center",
          }}
          accessibilityRole="button"
          accessibilityLabel="Retry loading track"
          accessibilityHint="Double tap to try loading the track again"
        >
          <Ionicons name="refresh" size={28} color="white" />
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={togglePlay}
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: "white",
          alignItems: "center",
          justifyContent: "center",
        }}
        accessibilityRole="button"
        accessibilityLabel={isPlaying ? "Pause" : "Play"}
        accessibilityHint={
          isPlaying
            ? "Double tap to pause playback"
            : "Double tap to start playback"
        }
      >
        <Ionicons name={isPlaying ? "pause" : "play"} size={32} color="black" />
      </TouchableOpacity>
    );
  };

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
        accessibilityViewIsModal={isExpanded}
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
          accessible={false}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />

        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            marginBottom: 32,
          }}
          accessible={false}
        >
          <IconButton
            name="chevron-down"
            size={28}
            color="white"
            onPress={() => setIsExpanded(false)}
            accessibilityLabel="Close player"
            accessibilityHint="Double tap to collapse the player"
          />
          <Text
            style={{
              color: "white",
              flex: 1,
              textAlign: "center",
              fontWeight: "600",
              fontSize: 14,
            }}
            accessibilityRole="header"
          >
            Now Playing
          </Text>
          <IconButton
            name="ellipsis-horizontal"
            size={24}
            color="white"
            onPress={() => setShowContextMenu(true)}
            accessibilityLabel="More options"
            accessibilityHint="Double tap to open track options menu"
          />
        </View>

        {/* ── Album Art (animated on track change) ────────────────────────── */}
        <View
          style={{
            width: 280,
            height: 280,
            borderRadius: 8,
            marginBottom: 32,
            overflow: "hidden",
          }}
        >
          <Animated.View
            style={{
              width: "100%",
              height: "100%",
              opacity: transition.albumOpacity,
              transform: [{ scale: transition.albumScale }],
            }}
          >
            <Animated.Image
              source={{ uri: currentTrack.coverUrl ?? undefined }}
              style={{
                width: "100%",
                height: "100%",
                opacity: playbackError
                  ? transition.albumOpacity.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 0.4],
                    })
                  : 1,
              }}
              accessibilityLabel={`Album art for ${currentTrack.title}`}
              accessibilityIgnoresInvertColors
            />
          </Animated.View>
        </View>

        {/* ── Track Info + Like (animated on track change) ─────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            width: "100%",
            marginBottom: 24,
          }}
          accessible={false}
        >
          <View style={{ flex: 1 }}>
            {/* Title */}
            <Animated.Text
              style={{
                color: "white",
                fontSize: 22,
                fontWeight: "700",
                opacity: transition.titleOpacity,
                transform: [{ translateX: transition.titleTranslateX }],
              }}
              numberOfLines={1}
              accessible
              accessibilityLabel={`${currentTrack.title} by ${currentTrack.artist.name}`}
            >
              {currentTrack.title}
            </Animated.Text>

            {/* Artist */}
            <Animated.Text
              style={{
                color: "#B3B3B3",
                fontSize: 15,
                marginTop: 4,
                opacity: transition.artistOpacity,
                transform: [{ translateX: transition.artistTranslateX }],
              }}
              numberOfLines={1}
              accessibilityElementsHidden
            >
              {currentTrack.artist.name}
            </Animated.Text>
          </View>

          <IconButton
            name={isLiked ? "heart" : "heart-outline"}
            size={24}
            color={isLiked ? "#1DB954" : "#B3B3B3"}
            onPress={toggleLike}
            accessibilityLabel={isLiked ? "Unlike track" : "Like track"}
            accessibilityHint={
              isLiked
                ? "Double tap to remove from liked songs"
                : "Double tap to add to liked songs"
            }
          />
        </View>

        {/* ── Error banner ─────────────────────────────────────────────────── */}
        {playbackError && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: "#2A1515",
              borderRadius: 8,
              paddingHorizontal: 12,
              paddingVertical: 8,
              marginBottom: 16,
              width: "100%",
            }}
            accessible
            accessibilityRole="alert"
            accessibilityLabel={errorMessage(playbackError)}
          >
            <Ionicons
              name="warning-outline"
              size={16}
              color="#FF4444"
              style={{ marginRight: 8 }}
              accessibilityElementsHidden
            />
            <Text
              style={{ color: "#FF4444", fontSize: 13, flex: 1 }}
              accessibilityElementsHidden
            >
              {errorMessage(playbackError)}
            </Text>
          </View>
        )}

        {/* ── Seek / Progress Bar ──────────────────────────────────────────── */}
        <View
          style={{ width: "100%", marginBottom: 8 }}
          accessible
          accessibilityLabel={`Playback position: ${formatTime(displayPosition)} of ${formatTime(duration)}`}
          accessibilityRole="adjustable"
          accessibilityValue={{
            min: 0,
            max: Math.floor(duration / 1000),
            now: Math.floor(displayPosition / 1000),
          }}
          accessibilityActions={[
            { name: "increment", label: "Skip forward 10 seconds" },
            { name: "decrement", label: "Skip back 10 seconds" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") {
              seekTo(Math.min(displayPosition + 10000, duration));
            } else if (event.nativeEvent.actionName === "decrement") {
              seekTo(Math.max(displayPosition - 10000, 0));
            }
          }}
        >
          {/* Track bar — touch target */}
          <View
            onLayout={onSeekBarLayout}
            style={{
              height: 20,
              justifyContent: "center",
              // Extra vertical hit area
            }}
            {...seekPanResponder.panHandlers}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            {/* Rail */}
            <View
              style={{
                height: isSeeking ? 5 : 4,
                backgroundColor: "#333",
                borderRadius: 4,
              }}
            >
              {/* Fill */}
              <View
                style={{
                  height: "100%",
                  backgroundColor: playbackError ? "#FF4444" : "#1DB954",
                  width: `${progress}%`,
                  borderRadius: 4,
                }}
              />
            </View>

            {/* Thumb */}
            {(isSeeking || seekBarWidthRef.current > 0) && (
              <View
                style={{
                  position: "absolute",
                  left: `${progress}%` as any,
                  width: isSeeking ? 16 : 12,
                  height: isSeeking ? 16 : 12,
                  borderRadius: 8,
                  backgroundColor: "white",
                  marginLeft: isSeeking ? -8 : -6,
                  top: "50%",
                  marginTop: isSeeking ? -8 : -6,
                  elevation: 3,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: 0.3,
                  shadowRadius: 2,
                }}
              />
            )}
          </View>

          {/* Time labels */}
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              marginTop: 2,
            }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Text
              style={{ color: isSeeking ? "white" : "#B3B3B3", fontSize: 11 }}
            >
              {formatTime(displayPosition)}
            </Text>
            <Text style={{ color: "#B3B3B3", fontSize: 11 }}>
              {formatTime(duration)}
            </Text>
          </View>
        </View>

        {/* ── Main Controls ─────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            marginTop: 16,
          }}
          accessible={false}
        >
          <IconButton
            name="shuffle"
            size={22}
            color={isShuffle ? "#1DB954" : "#B3B3B3"}
            onPress={toggleShuffle}
            accessibilityLabel={isShuffle ? "Shuffle: on" : "Shuffle: off"}
            accessibilityHint="Double tap to toggle shuffle"
          />
          <IconButton
            name="play-skip-back"
            size={32}
            color="white"
            onPress={playPrevious}
            accessibilityLabel="Previous track"
            accessibilityHint="Double tap to go to previous track or restart current track"
          />

          {renderPlayButton()}

          <IconButton
            name="play-skip-forward"
            size={32}
            color="white"
            onPress={playNext}
            accessibilityLabel="Next track"
            accessibilityHint="Double tap to skip to next track"
          />

          <View accessible={false}>
            <IconButton
              name={repeat.name}
              size={22}
              color={repeat.color}
              onPress={cycleRepeat}
              accessibilityLabel={repeatLabel(repeatMode)}
              accessibilityHint="Double tap to cycle repeat mode"
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
                accessibilityElementsHidden
              >
                1
              </Text>
            )}
          </View>
        </View>

        {/* ── Bottom Actions ────────────────────────────────────────────────── */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            width: "100%",
            marginTop: 32,
          }}
          accessible={false}
        >
          <IconButton
            name="share-outline"
            size={22}
            color="#B3B3B3"
            onPress={async () => {
              try {
                await Share.share({
                  message: `Now listening to ${currentTrack.title} by ${currentTrack.artist.name}`,
                });
              } catch {}
            }}
            accessibilityLabel="Share track"
            accessibilityHint="Double tap to share this track"
          />
          <IconButton
            name="add-circle-outline"
            size={22}
            color="#B3B3B3"
            onPress={() => Alert.alert("Add to Playlist", "Coming soon")}
            accessibilityLabel="Add to playlist"
            accessibilityHint="Double tap to add this track to a playlist"
          />
          <IconButton
            name="download-outline"
            size={22}
            color="#B3B3B3"
            onPress={() => Alert.alert("Download", "Coming soon")}
            accessibilityLabel="Download track"
            accessibilityHint="Double tap to download this track for offline listening"
          />
          <IconButton
            name="mic-outline"
            size={22}
            color="#B3B3B3"
            onPress={() => Alert.alert("Lyrics", "Coming soon")}
            accessibilityLabel="Show lyrics"
            accessibilityHint="Double tap to view track lyrics"
          />
          {/* ── Queue button — now wired up ── */}
          <IconButton
            name="list-outline"
            size={22}
            color={showQueue ? "#1DB954" : "#B3B3B3"}
            onPress={() => setShowQueue(true)}
            accessibilityLabel="Show queue"
            accessibilityHint="Double tap to view the play queue"
          />
        </View>
      </Animated.View>

      {/* ── Queue Sheet ──────────────────────────────────────────────────────── */}
      <QueueSheet visible={showQueue} onClose={() => setShowQueue(false)} />

      {/* ── Context Menu Modal ───────────────────────────────────────────────── */}
      <Modal
        visible={showContextMenu}
        transparent
        animationType="slide"
        onRequestClose={() => setShowContextMenu(false)}
        accessibilityViewIsModal
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)" }}
          onPress={() => setShowContextMenu(false)}
          accessibilityLabel="Close menu"
          accessibilityHint="Double tap to dismiss the options menu"
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
            accessibilityRole="header"
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
              accessibilityRole="button"
              accessibilityLabel={label}
            >
              <Ionicons
                name={icon as any}
                size={22}
                color="white"
                style={{ marginRight: 16 }}
                accessibilityElementsHidden
              />
              <Text
                style={{ color: "white", fontSize: 15 }}
                accessibilityElementsHidden
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            onPress={() => setShowContextMenu(false)}
            style={{ marginTop: 8, alignItems: "center", paddingVertical: 12 }}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={{ color: "#B3B3B3", fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

// ─── IconButton ───────────────────────────────────────────────────────────────

function IconButton({
  name,
  size,
  color,
  onPress,
  accessibilityLabel,
  accessibilityHint,
}: {
  name: any;
  size: number;
  color: string;
  onPress?: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{ padding: 8 }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons name={name} size={size} color={color} />
    </TouchableOpacity>
  );
}
