import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Track } from "../services/tracks.service";
import { useOffline } from "../context/OfflineContext";

type Props = {
  track: Track | null;
  visible: boolean;
  onClose: () => void;
  isLiked?: boolean;
  onToggleLike?: (track: Track) => void;
  onPlayNext?: (track: Track) => void;
  onAddToQueue?: (track: Track) => void;
  onAddToPlaylist?: (track: Track) => void;
};

type Action = {
  key: string;
  icon: string;
  label: string;
  color?: string;
  loading?: boolean;
  onPress: () => void;
};

export default function TrackActionsSheet({
  track,
  visible,
  onClose,
  isLiked,
  onToggleLike,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
}: Props) {
  const translateY = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  const { getDownloadItem, toggleTrackDownload } = useOffline();

  const downloadItem = track ? getDownloadItem(track.id) : undefined;

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
  }, [visible, backdropOpacity, translateY]);

  const actions = useMemo<Action[]>(() => {
    if (!track) return [];

    const list: Action[] = [];

    if (onPlayNext) {
      list.push({
        key: "play-next",
        icon: "play-skip-forward-outline",
        label: "Play next",
        onPress: () => onPlayNext(track),
      });
    }

    if (onAddToQueue) {
      list.push({
        key: "add-queue",
        icon: "add-circle-outline",
        label: "Add to queue",
        onPress: () => onAddToQueue(track),
      });
    }

    if (onToggleLike) {
      list.push({
        key: "like",
        icon: isLiked ? "heart" : "heart-outline",
        label: isLiked ? "Remove from liked songs" : "Add to liked songs",
        color: isLiked ? "#1DB954" : undefined,
        onPress: () => onToggleLike(track),
      });
    }

    if (onAddToPlaylist) {
      list.push({
        key: "add-playlist",
        icon: "list-outline",
        label: "Add to playlist",
        onPress: () => onAddToPlaylist(track),
      });
    }

    const isDownloading = downloadItem?.status === "downloading";
    const isDownloaded = downloadItem?.status === "downloaded";
    const progressLabel = isDownloading
      ? `Downloading ${Math.round((downloadItem.progress ?? 0) * 100)}%`
      : isDownloaded
        ? "Remove download"
        : "Download offline";

    list.push({
      key: "offline",
      icon: isDownloaded ? "trash-outline" : "download-outline",
      label: progressLabel,
      color: isDownloaded ? "#FF6B6B" : undefined,
      loading: isDownloading,
      onPress: () => toggleTrackDownload(track),
    });

    return list;
  }, [
    downloadItem,
    isLiked,
    onAddToPlaylist,
    onAddToQueue,
    onPlayNext,
    onToggleLike,
    toggleTrackDownload,
    track,
  ]);

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
            key={action.key}
            onPress={() => {
              if (action.loading) return;
              onClose();
              setTimeout(action.onPress, 140);
            }}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingVertical: 14,
            }}
          >
            {action.loading ? (
              <ActivityIndicator
                size="small"
                color="#1DB954"
                style={{ marginRight: 16, width: 24 }}
              />
            ) : (
              <Ionicons
                name={action.icon as never}
                size={22}
                color={action.color ?? "#B3B3B3"}
                style={{ marginRight: 16, width: 24 }}
              />
            )}
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
