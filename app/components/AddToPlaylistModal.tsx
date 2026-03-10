// CheriFi/components/AddToPlaylistModal.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { PlaylistsService, Playlist } from "../services/playlists.api";

type Props = {
  trackId: string | null;
  visible: boolean;
  onClose: () => void;
};

type Screen = "list" | "create";

export default function AddToPlaylistModal({
  trackId,
  visible,
  onClose,
}: Props) {
  const translateY = useRef(new Animated.Value(600)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(false);

  const [screen, setScreen] = useState<Screen>("list");
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error";
  } | null>(null);
  const toastOpacity = useRef(new Animated.Value(0)).current;
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const showToast = useCallback(
    (message: string, type: "success" | "error" = "success") => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
      setToast({ message, type });
      toastOpacity.setValue(0);
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      toastTimeout.current = setTimeout(() => {
        Animated.timing(toastOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setToast(null));
      }, 2500);
    },
    [],
  );

  // ── Animation (same pattern as TrackActionSheet in home.tsx) ───────────────
  useEffect(() => {
    if (visible) {
      setMounted(true);
      setScreen("list");
      setError(null);
      setToast(null);
      loadPlaylists();
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
        if (finished) {
          setMounted(false);
          setNewTitle("");
          setToast(null);
          if (toastTimeout.current) clearTimeout(toastTimeout.current);
        }
      });
    }
  }, [visible]);

  // Cleanup toast timeout on unmount
  useEffect(() => {
    return () => {
      if (toastTimeout.current) clearTimeout(toastTimeout.current);
    };
  }, []);

  if (!mounted && !visible) return null;

  // Check if track is already in a playlist
  function isTrackInPlaylist(playlist: Playlist): boolean {
    if (!trackId) return false;
    return playlist.tracks?.some((t) => t.trackId === trackId) ?? false;
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  async function loadPlaylists() {
    setLoading(true);
    setError(null);
    try {
      const data = await PlaylistsService.getAll();
      setPlaylists(data);
    } catch {
      setError("Couldn't load playlists.");
    } finally {
      setLoading(false);
    }
  }

  async function handleTogglePlaylist(playlist: Playlist) {
    if (!trackId) return;
    const alreadyAdded = isTrackInPlaylist(playlist);
    setToggling(playlist.id);
    setError(null);
    try {
      if (alreadyAdded) {
        await PlaylistsService.removeTrack(playlist.id, trackId);
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlist.id
              ? {
                  ...p,
                  tracks: p.tracks.filter((t) => t.trackId !== trackId),
                }
              : p,
          ),
        );
        showToast(`Removed from "${playlist.title}"`);
      } else {
        await PlaylistsService.addTrack(playlist.id, trackId);
        setPlaylists((prev) =>
          prev.map((p) =>
            p.id === playlist.id
              ? {
                  ...p,
                  tracks: [
                    ...p.tracks,
                    {
                      playlistId: playlist.id,
                      trackId,
                      position: p.tracks.length,
                      addedAt: new Date().toISOString(),
                      track: {} as any,
                    },
                  ],
                }
              : p,
          ),
        );
        showToast(`Added to "${playlist.title}"`);
      }
    } catch {
      showToast(
        alreadyAdded ? "Failed to remove track." : "Failed to add track.",
        "error",
      );
    } finally {
      setToggling(null);
    }
  }

  async function handleCreateAndAdd() {
    if (!newTitle.trim() || !trackId) return;
    Keyboard.dismiss();
    setCreating(true);
    setError(null);
    try {
      const created = await PlaylistsService.create(newTitle.trim());
      await PlaylistsService.addTrack(created.id, trackId);
      const newPlaylist: Playlist = {
        ...created,
        tracks: [
          {
            playlistId: created.id,
            trackId,
            position: 0,
            addedAt: new Date().toISOString(),
            track: {} as any,
          },
        ],
      };
      setPlaylists((prev) => [newPlaylist, ...prev]);
      setNewTitle("");
      setScreen("list");
      showToast(`Created & added to "${created.title}"`);
    } catch {
      setError("Failed to create playlist. Try again.");
    } finally {
      setCreating(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <Modal
      visible={mounted || visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        {/* Backdrop */}
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
          />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          style={{
            backgroundColor: "#1A1A1A",
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: 36,
            transform: [{ translateY }],
            maxHeight: "70%",
          }}
        >
          {/* Drag handle */}
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

          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 20,
              paddingBottom: 12,
              borderBottomWidth: 1,
              borderBottomColor: "#2A2A2A",
              marginBottom: 4,
            }}
          >
            {screen === "create" && (
              <TouchableOpacity
                onPress={() => setScreen("list")}
                style={{ marginRight: 12 }}
              >
                <Ionicons name="arrow-back" size={22} color="#B3B3B3" />
              </TouchableOpacity>
            )}
            <Text
              style={{
                color: "white",
                fontSize: 15,
                fontWeight: "700",
                flex: 1,
              }}
            >
              {screen === "list" ? "Add to Playlist" : "New Playlist"}
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#B3B3B3" />
            </TouchableOpacity>
          </View>

          {/* Error banner */}
          {error && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: "#1E1E1E",
                marginHorizontal: 20,
                marginTop: 8,
                borderRadius: 8,
                padding: 10,
              }}
            >
              <Ionicons name="warning-outline" size={16} color="#FF4444" />
              <Text
                style={{
                  color: "#FF4444",
                  fontSize: 13,
                  flex: 1,
                  marginLeft: 8,
                }}
              >
                {error}
              </Text>
              <TouchableOpacity
                onPress={screen === "list" ? loadPlaylists : undefined}
              >
                <Text
                  style={{ color: "#1DB954", fontSize: 13, fontWeight: "600" }}
                >
                  Retry
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* LIST screen */}
          {screen === "list" && (
            <>
              {/* Create new row */}
              <TouchableOpacity
                onPress={() => setScreen("create")}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 20,
                  paddingVertical: 14,
                }}
                accessibilityRole="button"
                accessibilityLabel="Create new playlist"
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 6,
                    backgroundColor: "#2A2A2A",
                    alignItems: "center",
                    justifyContent: "center",
                    marginRight: 12,
                  }}
                >
                  <Ionicons name="add" size={24} color="#1DB954" />
                </View>
                <Text
                  style={{ color: "white", fontSize: 15, fontWeight: "500" }}
                >
                  Create new playlist
                </Text>
              </TouchableOpacity>

              {loading ? (
                <ActivityIndicator color="#1DB954" style={{ marginTop: 16 }} />
              ) : (
                <FlatList
                  data={playlists}
                  keyExtractor={(item) => item.id}
                  contentContainerStyle={{ paddingBottom: 8 }}
                  ListEmptyComponent={
                    !error ? (
                      <Text
                        style={{
                          color: "#B3B3B3",
                          fontSize: 14,
                          textAlign: "center",
                          marginTop: 16,
                        }}
                      >
                        No playlists yet.
                      </Text>
                    ) : null
                  }
                  renderItem={({ item }) => {
                    const isToggling = toggling === item.id;
                    const alreadyAdded = isTrackInPlaylist(item);
                    const trackCount = item.tracks?.length ?? 0;
                    return (
                      <TouchableOpacity
                        onPress={() => handleTogglePlaylist(item)}
                        disabled={isToggling}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          paddingHorizontal: 20,
                          paddingVertical: 10,
                          opacity: isToggling ? 0.5 : 1,
                        }}
                        accessibilityRole="button"
                        accessibilityLabel={
                          alreadyAdded
                            ? `Remove from ${item.title}`
                            : `Add to ${item.title}`
                        }
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 6,
                            backgroundColor: alreadyAdded
                              ? "#1DB954"
                              : "#282828",
                            alignItems: "center",
                            justifyContent: "center",
                            marginRight: 12,
                          }}
                        >
                          {alreadyAdded ? (
                            <Ionicons name="checkmark" size={22} color="#000" />
                          ) : (
                            <Ionicons
                              name="musical-notes"
                              size={20}
                              color="#555"
                            />
                          )}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              color: alreadyAdded ? "#1DB954" : "white",
                              fontSize: 15,
                              fontWeight: "600",
                            }}
                            numberOfLines={1}
                          >
                            {item.title}
                          </Text>
                          <Text
                            style={{
                              color: "#B3B3B3",
                              fontSize: 13,
                              marginTop: 2,
                            }}
                          >
                            {trackCount} track{trackCount !== 1 ? "s" : ""}
                            {alreadyAdded ? " · Added" : ""}
                          </Text>
                        </View>
                        {isToggling ? (
                          <ActivityIndicator color="#1DB954" size="small" />
                        ) : alreadyAdded ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color="#1DB954"
                          />
                        ) : (
                          <Ionicons
                            name="add-circle-outline"
                            size={22}
                            color="#B3B3B3"
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              )}
            </>
          )}

          {/* CREATE screen */}
          {screen === "create" && (
            <View style={{ paddingHorizontal: 20, paddingTop: 16 }}>
              <TextInput
                style={{
                  backgroundColor: "#2A2A2A",
                  borderRadius: 8,
                  color: "white",
                  fontSize: 15,
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  marginBottom: 16,
                }}
                placeholder="Playlist name"
                placeholderTextColor="#555"
                value={newTitle}
                onChangeText={setNewTitle}
                autoFocus
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={handleCreateAndAdd}
              />
              <TouchableOpacity
                onPress={handleCreateAndAdd}
                disabled={!newTitle.trim() || creating}
                style={{
                  backgroundColor: "#1DB954",
                  borderRadius: 30,
                  paddingVertical: 14,
                  alignItems: "center",
                  opacity: !newTitle.trim() || creating ? 0.4 : 1,
                }}
                accessibilityRole="button"
                accessibilityLabel="Create playlist and add track"
              >
                {creating ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text
                    style={{ color: "#000", fontWeight: "700", fontSize: 15 }}
                  >
                    Create & Add Track
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Toast snackbar */}
          {toast && (
            <Animated.View
              style={{
                position: "absolute",
                bottom: 44,
                left: 20,
                right: 20,
                backgroundColor:
                  toast.type === "success" ? "#1DB954" : "#FF4444",
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 12,
                flexDirection: "row",
                alignItems: "center",
                opacity: toastOpacity,
              }}
            >
              <Ionicons
                name={
                  toast.type === "success" ? "checkmark-circle" : "alert-circle"
                }
                size={18}
                color={toast.type === "success" ? "#000" : "#fff"}
                style={{ marginRight: 8 }}
              />
              <Text
                style={{
                  color: toast.type === "success" ? "#000" : "#fff",
                  fontSize: 14,
                  fontWeight: "600",
                  flex: 1,
                }}
                numberOfLines={1}
              >
                {toast.message}
              </Text>
            </Animated.View>
          )}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
