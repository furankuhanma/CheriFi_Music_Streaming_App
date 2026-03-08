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
  // Like
  isLiked: boolean;
  toggleLike: () => Promise<void>;
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

  // Seed isLiked from the track whenever currentTrack changes
  useEffect(() => {
    setIsLiked(currentTrack?.isLiked ?? false);
  }, [currentTrack?.id]);

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
    setIsLoading(status.isBuffering);

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
    async (track: Track, shouldPlay = true) => {
      lastLoadParamsRef.current = { track, shouldPlay };
      setPlaybackError(null);
      setIsLoading(true);
      setCurrentTrack(track);
      setPlaybackPosition(0);
      setDuration(0);

      const streamUri = TracksService.streamUrl(track.id);

      let attempt = 0;

      while (attempt < MAX_RETRIES) {
        try {
          const { sound: newSound } = await Audio.Sound.createAsync(
            { uri: streamUri },
            { shouldPlay },
            onPlaybackStatusUpdate,
          );

          const oldSound = soundRef.current;
          soundRef.current = newSound;
          await oldSound?.unloadAsync();

          setIsPlaying(shouldPlay);
          setIsLoading(false);
          setIsInitialized(true);

          TracksService.recordPlay(track.id);

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

  // ── Fetch queue ───────────────────────────────────────────────────────────
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

  useEffect(() => {
    fetchQueue();
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

  // ── Like / Unlike ─────────────────────────────────────────────────────────
  const toggleLike = async () => {
    if (!currentTrack) return;

    // Optimistic update
    const prev = isLiked;
    setIsLiked(!prev);

    try {
      if (prev) {
        await TracksService.unlike(currentTrack.id);
      } else {
        await TracksService.like(currentTrack.id);
      }
    } catch (error) {
      // Revert on failure
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
