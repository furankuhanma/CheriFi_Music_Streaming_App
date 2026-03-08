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
import { Audio, AVPlaybackStatus } from "expo-av";

export const MINI_PLAYER_HEIGHT = 70;
export const SCREEN_HEIGHT = Dimensions.get("window").height;

export type RepeatMode = "off" | "all" | "one";

// ─── Types ────────────────────────────────────────────────────────────────────

export type Track = {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  audio: any;
};

type PlayerContextType = {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  currentTrack: Track;
  queue: Track[];
  isPlaying: boolean;
  isLoading: boolean;
  playbackPosition: number;
  duration: number;
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
};

// ─── Mock Queue ───────────────────────────────────────────────────────────────

const mockQueue: Track[] = [
  {
    id: "1",
    title: "Bang Bang",
    artist: "Ariana Grande, Jessie J & Nicki Minaj",
    albumArt: "https://picsum.photos/seed/track1/200",
    audio: require("../../assets/images/music/0HDdjwpPM3Y.mp3"),
  },
];

// ─── Context ──────────────────────────────────────────────────────────────────

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const soundRef = useRef<Audio.Sound | null>(null);
  const currentIndexRef = useRef(0);
  const isSeekingRef = useRef(false);
  const repeatModeRef = useRef<RepeatMode>("off");

  const [queue, setQueue] = useState<Track[]>(mockQueue);
  const [currentTrack, setCurrentTrack] = useState<Track>(mockQueue[0]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackPosition, setPlaybackPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");

  // Keep ref in sync with state so callbacks always have latest value
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // ── Configure audio mode ──────────────────────────────────────────────────
  useEffect(() => {
    Audio.setAudioModeAsync({
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
    });
    return () => {
      soundRef.current?.unloadAsync();
    };
  }, []);

  // ── Playback status callback ──────────────────────────────────────────────
  // Uses refs instead of state to avoid stale closures
  const onPlaybackStatusUpdate = useCallback((status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

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

  // ── Load track ────────────────────────────────────────────────────────────
  const loadTrack = useCallback(
    async (track: Track, shouldPlay = true) => {
      try {
        setIsLoading(true);
        setCurrentTrack(track);
        setPlaybackPosition(0);
        setDuration(0);

        // Create new sound first, then unload old one — faster transition
        const { sound: newSound } = await Audio.Sound.createAsync(
          typeof track.audio === "string" ? { uri: track.audio } : track.audio,
          { shouldPlay },
          onPlaybackStatusUpdate,
        );

        // Unload previous only after new one is ready
        const oldSound = soundRef.current;
        soundRef.current = newSound;
        await oldSound?.unloadAsync();

        setIsPlaying(shouldPlay);
      } catch (error) {
        console.error("Failed to load track:", error);
        setIsLoading(false);
      }
    },
    [onPlaybackStatusUpdate],
  );

  // ── playNext needs to be a ref so the status callback can call it ─────────
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

  // Keep ref updated
  useEffect(() => {
    playNextRef.current = playNext;
  }, [playNext]);

  // ── Controls ──────────────────────────────────────────────────────────────
  const play = async () => {
    if (!soundRef.current) {
      await loadTrack(currentTrack, true);
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

  return (
    <PlayerContext.Provider
      value={{
        isExpanded,
        setIsExpanded,
        currentTrack,
        queue,
        isPlaying,
        isLoading,
        playbackPosition,
        duration,
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
