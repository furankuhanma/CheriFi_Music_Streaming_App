import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Audio,
  AVPlaybackStatus,
  InterruptionModeIOS,
  InterruptionModeAndroid,
} from "expo-av";
import { RecommendationsService } from "../services/recommendations.service";
import { TracksService } from "../services/tracks.service";

export const MINI_PLAYER_HEIGHT = 70;
export const SCREEN_HEIGHT = Dimensions.get("window").height;

export type RepeatMode = "off" | "all" | "one";

// ─── Persistence keys ─────────────────────────────────────────────────────────

const STORAGE_KEY_QUEUE = "@cherifi:queue";
const STORAGE_KEY_INDEX = "@cherifi:currentIndex";
const STORAGE_KEY_POSITION = "@cherifi:position";
const STORAGE_KEY_SHUFFLE = "@cherifi:shuffle";
const STORAGE_KEY_REPEAT = "@cherifi:repeat";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Track = {
  id: string;
  title: string;
  artist: {
    id: string;
    name: string;
  };
  album: {
    id: string;
    title: string;
  } | null;
  coverUrl: string | null;
  audioUrl: string;
  duration: number;
  genre: string | null;
  playCount: number;
  isLiked?: boolean;
  inLibrary?: boolean;
};

export type PlaybackErrorType =
  | "load_failed"
  | "network"
  | "unsupported"
  | "interrupted"
  | "queue_failed"
  | null;

type PlayerContextType = {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  currentTrack: Track | null;
  queue: Track[];
  isPlaying: boolean;
  isLoading: boolean;
  isInitialized: boolean;
  playbackPosition: number;
  duration: number;
  playbackError: PlaybackErrorType;
  retryLoad: () => Promise<void>;
  refetchQueue: () => Promise<void>;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  togglePlay: () => Promise<void>;
  seekTo: (positionMs: number) => Promise<void>;
  playNext: () => Promise<void>;
  playPrevious: () => Promise<void>;
  playTrack: (track: Track) => Promise<void>;
  isShuffle: boolean;
  toggleShuffle: () => void;
  repeatMode: RepeatMode;
  cycleRepeat: () => void;
  isLiked: boolean;
  toggleLike: () => Promise<void>;
  // Queue management
  addToQueue: (track: Track) => void;
  addToQueueNext: (track: Track) => void;
  removeFromQueue: (trackId: string) => void;
  reorderQueue: (fromIndex: number, toIndex: number) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

const classifyError = (error: unknown): PlaybackErrorType => {
  const msg =
    error instanceof Error
      ? error.message.toLowerCase()
      : String(error).toLowerCase();

  if (
    msg.includes("unsupported") ||
    msg.includes("codec") ||
    msg.includes("format") ||
    msg.includes("invalid")
  ) {
    return "unsupported";
  }

  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("econnrefused") ||
    msg.includes("timeout") ||
    msg.includes("could not connect")
  ) {
    return "network";
  }

  return "load_failed";
};

// ─── Persistence helpers ──────────────────────────────────────────────────────

async function savePlayerState(
  queue: Track[],
  index: number,
  position: number,
  shuffle: boolean,
  repeat: RepeatMode,
) {
  try {
    await AsyncStorage.multiSet([
      [STORAGE_KEY_QUEUE, JSON.stringify(queue)],
      [STORAGE_KEY_INDEX, String(index)],
      [STORAGE_KEY_POSITION, String(position)],
      [STORAGE_KEY_SHUFFLE, String(shuffle)],
      [STORAGE_KEY_REPEAT, repeat],
    ]);
  } catch (e) {
    // Non-critical — silently ignore persistence errors
    console.warn("Failed to persist player state:", e);
  }
}

type RestoredState = {
  queue: Track[];
  index: number;
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
} | null;

async function loadPlayerState(): Promise<RestoredState> {
  try {
    const results = await AsyncStorage.multiGet([
      STORAGE_KEY_QUEUE,
      STORAGE_KEY_INDEX,
      STORAGE_KEY_POSITION,
      STORAGE_KEY_SHUFFLE,
      STORAGE_KEY_REPEAT,
    ]);

    const queueRaw = results[0][1];
    if (!queueRaw) return null;

    const queue: Track[] = JSON.parse(queueRaw);
    if (!Array.isArray(queue) || queue.length === 0) return null;

    const index = parseInt(results[1][1] ?? "0", 10);
    const position = parseFloat(results[2][1] ?? "0");
    const shuffle = results[3][1] === "true";
    const repeat = (results[4][1] ?? "off") as RepeatMode;

    return {
      queue,
      index: isNaN(index) ? 0 : Math.max(0, Math.min(index, queue.length - 1)),
      position: isNaN(position) ? 0 : position,
      shuffle,
      repeat,
    };
  } catch (e) {
    console.warn("Failed to load persisted player state:", e);
    return null;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentIndexRef = useRef(0);
  const isSeekingRef = useRef(false);
  const repeatModeRef = useRef<RepeatMode>("off");
  const isAudioModeReady = useRef(false);

  const lastLoadParamsRef = useRef<{
    track: Track;
    shouldPlay: boolean;
  } | null>(null);

  // Debounce timer for state persistence
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [playbackError, setPlaybackError] = useState<PlaybackErrorType>(null);
  const [isLiked, setIsLiked] = useState(false);

  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  useEffect(() => {
    setIsLiked(currentTrack?.isLiked ?? false);
  }, [currentTrack?.id]);

  // ── Persist state (debounced 2 s) ─────────────────────────────────────────
  useEffect(() => {
    if (!isInitialized || queue.length === 0) return;

    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);

    persistTimerRef.current = setTimeout(() => {
      savePlayerState(
        queue,
        currentIndexRef.current,
        playbackPosition,
        isShuffle,
        repeatMode,
      );
    }, 2000);

    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [queue, playbackPosition, isShuffle, repeatMode, isInitialized]);

  // ── Audio mode ────────────────────────────────────────────────────────────
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      interruptionModeIOS: InterruptionModeIOS.DoNotMix,
      interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).then(() => {
      isAudioModeReady.current = true;
    });

    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  // ── Playback status callback ──────────────────────────────────────────────
  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error("Stream interrupted mid-playback:", status.error);
        setPlaybackError("interrupted");
        setIsPlaying(false);
        setIsLoading(false);
      }
      return;
    }

    if (!isSeekingRef.current) {
      setPlaybackPosition(status.positionMillis);
    }
    if (status.durationMillis) {
      setDuration(status.durationMillis);
    }

    setIsPlaying(status.isPlaying);
    setIsLoading(status.isBuffering && !status.isPlaying);

    if (status.didJustFinish) {
      if (repeatModeRef.current === "one") {
        soundRef.current?.replayAsync();
      } else {
        playNextRef.current?.();
      }
    }
  }, []);

  // ── Load track (with retry) ───────────────────────────────────────────────
  const loadTrack = useCallback(
    async (track: Track, shouldPlay = true, startPositionMs = 0) => {
      lastLoadParamsRef.current = { track, shouldPlay };
      setPlaybackError(null);
      setIsLoading(true);
      setCurrentTrack(track);
      setPlaybackPosition(startPositionMs);
      setDuration(0);

      const streamUri = TracksService.streamUrl(track.id);

      let attempt = 0;

      while (attempt < MAX_RETRIES) {
        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: streamUri },
            {
              shouldPlay,
              positionMillis: startPositionMs,
            },
            onPlaybackStatusUpdate,
          );

          const oldSound = soundRef.current;
          soundRef.current = newSound;
          await oldSound?.unloadAsync();

          setIsPlaying(shouldPlay);
          setIsLoading(false);
          setIsInitialized(true);

          if (shouldPlay) {
            TracksService.recordPlay(track.id);
          }

          return;
        } catch (error) {
          attempt += 1;
          console.warn(
            `Track load attempt ${attempt}/${MAX_RETRIES} failed:`,
            error,
          );

          const errorType = classifyError(error);

          if (errorType === "unsupported") {
            setPlaybackError("unsupported");
            setIsLoading(false);
            setIsInitialized(true);
            return;
          }

          if (attempt < MAX_RETRIES) {
            await wait(RETRY_DELAY_MS);
          } else {
            setPlaybackError(errorType);
            setIsLoading(false);
            setIsInitialized(true);
          }
        }
      }
    },
    [onPlaybackStatusUpdate],
  );

  // ── Initialize: restore or fetch fresh ───────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      setIsLoading(true);
      setPlaybackError(null);

      const tracks = await RecommendationsService.smart(20);

      if (tracks.length === 0) {
        setIsLoading(false);
        setIsInitialized(true);
        return;
      }

      setQueue(tracks);
      currentIndexRef.current = 0;

      await wait(100);
      await loadTrack(tracks[0], false);
    } catch (error) {
      console.error("Failed to fetch queue:", error);
      setPlaybackError("queue_failed");
      setIsLoading(false);
      setIsInitialized(true);
    }
  }, [loadTrack]);

  const refetchQueue = useCallback(async () => {
    await fetchQueue();
  }, [fetchQueue]);

  // ── On mount: try to restore, fall back to fresh fetch ───────────────────
  useEffect(() => {
    (async () => {
      const restored = await loadPlayerState();

      if (restored && restored.queue.length > 0) {
        const {
          queue: savedQueue,
          index,
          position,
          shuffle,
          repeat,
        } = restored;

        setQueue(savedQueue);
        setIsShuffle(shuffle);
        setRepeatMode(repeat);
        repeatModeRef.current = repeat;
        currentIndexRef.current = index;

        // Load track paused at saved position — don't auto-play on restore
        await loadTrack(savedQueue[index], false, position);
      } else {
        await fetchQueue();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── retryLoad ─────────────────────────────────────────────────────────────
  const retryLoad = useCallback(async () => {
    if (!lastLoadParamsRef.current) {
      await fetchQueue();
      return;
    }
    const { track, shouldPlay } = lastLoadParamsRef.current;
    await loadTrack(track, shouldPlay);
  }, [loadTrack, fetchQueue]);

  // ── playNext ──────────────────────────────────────────────────────────────
  const playNextRef = useRef<(() => Promise<void>) | null>(null);

  const playNext = useCallback(async () => {
    const total = queue.length;
    if (total === 0) return;

    let nextIndex: number;

    if (isShuffle) {
      do {
        nextIndex = Math.floor(Math.random() * total);
      } while (total > 1 && nextIndex === currentIndexRef.current);
    } else {
      nextIndex = (currentIndexRef.current + 1) % total;
    }

    if (
      !isShuffle &&
      repeatModeRef.current === "off" &&
      nextIndex === 0 &&
      total > 1
    ) {
      await soundRef.current?.stopAsync();
      setIsPlaying(false);
      return;
    }

    currentIndexRef.current = nextIndex;
    await loadTrack(queue[nextIndex], true);
  }, [queue, isShuffle, loadTrack]);

  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const play = async () => {
    if (!soundRef.current) {
      if (currentTrack) await loadTrack(currentTrack, true);
      return;
    }
    await soundRef.current.playAsync();
  };

  const pause = async () => {
    await soundRef.current?.pauseAsync();
  };

  const togglePlay = async () => {
    isPlaying ? await pause() : await play();
  };

  const seekTo = async (positionMs: number) => {
    if (!soundRef.current) return;
    isSeekingRef.current = true;
    setPlaybackPosition(positionMs);
    await soundRef.current.setPositionAsync(positionMs);
    isSeekingRef.current = false;
  };

  const playTrack = async (track: Track) => {
    const index = queue.findIndex((t) => t.id === track.id);
    if (index !== -1) currentIndexRef.current = index;
    await loadTrack(track, true);
  };

  const playPrevious = async () => {
    if (playbackPosition > 3000) {
      await seekTo(0);
      return;
    }
    const prevIndex =
      (currentIndexRef.current - 1 + queue.length) % queue.length;
    currentIndexRef.current = prevIndex;
    await loadTrack(queue[prevIndex], true);
  };

  const toggleShuffle = () => setIsShuffle((prev) => !prev);

  const cycleRepeat = () =>
    setRepeatMode((prev) =>
      prev === "off" ? "all" : prev === "all" ? "one" : "off",
    );

  // ── Queue management ─────────────────────────────────────────────────────

  const addToQueue = (track: Track) => {
    setQueue((prev) => {
      if (prev.find((t) => t.id === track.id)) return prev; // already in queue
      return [...prev, track];
    });
  };

  const addToQueueNext = (track: Track) => {
    setQueue((prev) => {
      const filtered = prev.filter((t) => t.id !== track.id);
      const insertAt = currentIndexRef.current + 1;
      const next = [
        ...filtered.slice(0, insertAt),
        track,
        ...filtered.slice(insertAt),
      ];
      return next;
    });
  };

  const removeFromQueue = (trackId: string) => {
    setQueue((prev) => {
      const idx = prev.findIndex((t) => t.id === trackId);
      if (idx === -1) return prev;
      // Adjust currentIndex if we're removing something before it
      if (idx < currentIndexRef.current) {
        currentIndexRef.current = Math.max(0, currentIndexRef.current - 1);
      }
      return prev.filter((t) => t.id !== trackId);
    });
  };

  const reorderQueue = (fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      // Keep currentIndex pointing at the same track after reorder
      const currentTrackId = prev[currentIndexRef.current]?.id;
      const newIndex = next.findIndex((t) => t.id === currentTrackId);
      if (newIndex !== -1) currentIndexRef.current = newIndex;
      return next;
    });
  };

  // ── Like / Unlike ─────────────────────────────────────────────────────────
  const toggleLike = async () => {
    if (!currentTrack) return;
    const prev = isLiked;
    setIsLiked(!prev);
    try {
      if (prev) {
        await TracksService.unlike(currentTrack.id);
      } else {
        await TracksService.like(currentTrack.id);
      }
    } catch (error) {
      console.warn("toggleLike failed, reverting:", error);
      setIsLiked(prev);
    }
  };

  return (
    <PlayerContext.Provider
      value={{
        isExpanded,
        setIsExpanded,
        currentTrack,
        queue,
        isPlaying,
        isLoading,
        isInitialized,
        playbackPosition,
        duration,
        playbackError,
        retryLoad,
        refetchQueue,
        play,
        pause,
        togglePlay,
        seekTo,
        playNext,
        playPrevious,
        playTrack,
        isShuffle,
        toggleShuffle,
        repeatMode,
        cycleRepeat,
        isLiked,
        toggleLike,
        addToQueue,
        addToQueueNext,
        removeFromQueue,
        reorderQueue,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context)
    throw new Error("usePlayer must be used within a PlayerProvider");
  return context;
}

export default function PlayerContextModule() {
  return null;
}
