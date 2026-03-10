/**
 * PlayerContext — React Native Track Player edition
 *
 * All audio is now driven by RNTP (react-native-track-player), which provides:
 *  • Background playback via a native foreground service (Android) / AVSession (iOS)
 *  • System notification with artwork, title, artist and transport controls
 *  • Lock-screen / Bluetooth / CarPlay / Android Auto controls
 *  • Audio session management and focus / interruption handling
 *  • On-device audio caching (Android, via maxCacheSize in setupPlayer)
 *
 * The public API (PlayerContextType) is unchanged so all consumer components
 * (MiniPlayer, ExpandedPlayer, QueueSheet) continue to work without modification.
 */

import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import { AppState, Dimensions } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TrackPlayer, {
  Event,
  State,
  RepeatMode as RNTPRepeatMode,
  Capability,
  AppKilledPlaybackBehavior,
  useProgress,
  useTrackPlayerEvents,
  type AddTrack,
} from "react-native-track-player";
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
  skipToTrack: (trackId: string) => void;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Map our app Track → RNTP AddTrack (all playback metadata for the notification). */
function toRNTPTrack(track: Track): AddTrack {
  return {
    id: track.id,
    url: TracksService.streamUrl(track.id),
    title: track.title,
    artist: track.artist.name,
    artwork: track.coverUrl ?? undefined,
    /** Duration in seconds — RNTP's native unit. */
    duration: track.duration,
    genre: track.genre ?? undefined,
    album: track.album?.title,
  };
}

function mapRepeatMode(mode: RepeatMode): RNTPRepeatMode {
  if (mode === "one") return RNTPRepeatMode.Track;
  if (mode === "all") return RNTPRepeatMode.Queue;
  return RNTPRepeatMode.Off;
}

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

// ─── Context ──────────────────────────────────────────────────────────────────

const PlayerContext = createContext<PlayerContextType | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  // ── Refs (always current — safe inside event handlers & async callbacks) ──
  const currentIndexRef = useRef(0);
  const repeatModeRef = useRef<RepeatMode>("off");
  const isShuffleRef = useRef(false);
  /** Shadow of the queue state — avoids stale closures in RNTP event handlers. */
  const queueRef = useRef<Track[]>([]);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSetupDoneRef = useRef(false);

  // ── React state (drives UI) ───────────────────────────────────────────────
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [playbackError, setPlaybackError] = useState<PlaybackErrorType>(null);
  const [isLiked, setIsLiked] = useState(false);

  // ── RNTP reactive hooks ───────────────────────────────────────────────────
  /**
   * useProgress polls RNTP every 200 ms.
   * position and duration are in **seconds** — multiplied ×1000 before
   * exposing them so the public API stays in milliseconds.
   */
  const { position, duration: rnDuration } = useProgress(200);

  // ── Polled playback state ─────────────────────────────────────────────────
  /**
   * usePlaybackState() / Event.PlaybackState use NativeEventEmitter internally,
   * which is unreliable on the New Architecture (TurboModules). Direct
   * imperative calls (getPlaybackState, play, pause) work fine, so we poll
   * every 250 ms instead. play/pause/togglePlay also write liveState
   * synchronously (optimistic update) so the button icon flips instantly
   * without waiting for the next tick.
   */
  const [liveState, setLiveState] = useState<State | undefined>(undefined);

  useEffect(() => {
    let active = true;
    // Seed immediately on mount so the first render already reflects reality.
    TrackPlayer.getPlaybackState()
      .then(({ state }) => {
        if (active) setLiveState(state as State);
      })
      .catch(() => {});

    const poll = setInterval(async () => {
      try {
        const { state } = await TrackPlayer.getPlaybackState();
        if (active) setLiveState(state as State);
      } catch {}
    }, 250);

    return () => {
      active = false;
      clearInterval(poll);
    };
  }, []);

  // ── Active-track sync when app returns to foreground ──────────────────────
  /**
   * When the user changes tracks via notification controls while the app is
   * backgrounded, the PlaybackActiveTrackChanged event may have been missed.
   * Whenever the app comes back to the foreground we do a one-shot reconcile
   * so the in-app UI always matches what's playing.
   */
  useEffect(() => {
    const handleAppStateChange = async (nextState: string) => {
      if (nextState !== "active") return;
      try {
        const idx = await TrackPlayer.getActiveTrackIndex();
        if (
          idx !== null &&
          idx !== undefined &&
          idx !== currentIndexRef.current &&
          queueRef.current.length > 0
        ) {
          const next = queueRef.current[idx];
          if (next) {
            currentIndexRef.current = idx;
            setCurrentTrack(next);
          }
        }
      } catch {}
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  // ── Derived playback booleans ─────────────────────────────────────────────
  const isPlaying = liveState === State.Playing;
  const isLoading =
    liveState === State.Loading || liveState === State.Buffering;

  /** Playback position exposed to consumers, in milliseconds. */
  const playbackPosition = position * 1000;
  /** Track duration exposed to consumers, in milliseconds. */
  const duration = rnDuration * 1000;

  // ── Keep ref mirrors up-to-date ───────────────────────────────────────────
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    isShuffleRef.current = isShuffle;
  }, [isShuffle]);
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);

  // ── Like state follows the current track ─────────────────────────────────
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

  // ── RNTP event listeners ───────────────────────────────────────────────────
  /**
   * useTrackPlayerEvents uses a savedHandler ref internally so the inline
   * handler always sees fresh refs without stale-closure risk.
   */
  useTrackPlayerEvents(
    [Event.PlaybackActiveTrackChanged, Event.PlaybackError],
    async (event) => {
      // ── Track changed (auto-advance, notification next/previous) ──────────
      if (event.type === Event.PlaybackActiveTrackChanged) {
        const { index } = event;
        if (index === undefined || index === null) return;

        // Skip if we triggered this change ourselves (index already updated)
        if (index === currentIndexRef.current) return;

        const q = queueRef.current;

        if (isShuffleRef.current) {
          // RNTP auto-advanced sequentially; override with a random track
          const total = q.length;
          if (total <= 1) return;

          let randomIdx: number;
          do {
            randomIdx = Math.floor(Math.random() * total);
          } while (randomIdx === currentIndexRef.current);

          currentIndexRef.current = randomIdx;
          const next = q[randomIdx];
          if (next) {
            setCurrentTrack(next);
            await TrackPlayer.skip(randomIdx);
            TracksService.recordPlay(next.id);
          }
        } else {
          // Normal sequential advance — accept RNTP's choice
          currentIndexRef.current = index;
          const next = q[index];
          if (next) {
            setCurrentTrack(next);
            TracksService.recordPlay(next.id);
          }
        }
      }

      // ── Playback error ────────────────────────────────────────────────────
      if (event.type === Event.PlaybackError) {
        setPlaybackError(classifyError(event.message));
      }
    },
  );

  // ── fetchQueue: pull fresh recommendations ────────────────────────────────
  const fetchQueue = useCallback(async () => {
    try {
      setPlaybackError(null);
      const tracks = await RecommendationsService.smart(20);

      if (tracks.length === 0) {
        setIsInitialized(true);
        return;
      }

      queueRef.current = tracks;
      setQueue(tracks);
      currentIndexRef.current = 0;
      setCurrentTrack(tracks[0]);

      await TrackPlayer.setQueue(tracks.map(toRNTPTrack));
      // Do NOT auto-play — user should press Play
      setIsInitialized(true);
    } catch (error) {
      console.error("fetchQueue failed:", error);
      setPlaybackError("queue_failed");
      setIsInitialized(true);
    }
  }, []);

  // ── One-time RNTP setup ───────────────────────────────────────────────────
  useEffect(() => {
    if (isSetupDoneRef.current) return;
    isSetupDoneRef.current = true;

    (async () => {
      try {
        // setupPlayer throws if the native module is already initialised
        // (e.g. after a JS hot reload). Catch that specific error and
        // continue — everything else is a real failure worth re-throwing.
        try {
          await TrackPlayer.setupPlayer({
            /**
             * Android-only on-device audio cache.
             * Caches up to 50 MB of audio data so previously-played segments
             * are served locally without a second network round-trip.
             */
            maxCacheSize: 1024 * 50,
            /**
             * Let RNTP pause/resume automatically when audio focus is
             * lost/gained (phone calls, notifications, other apps).
             */
            autoHandleInterruptions: true,
          });
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!msg.includes("already been initialized")) throw e;
          // Player is already live — safe to continue with the rest of setup
        }

        await TrackPlayer.updateOptions({
          android: {
            /**
             * Stop playback and remove the notification when the user swipes
             * the app away from recents.
             */
            appKilledPlaybackBehavior:
              AppKilledPlaybackBehavior.StopPlaybackAndRemoveNotification,
            alwaysPauseOnInterruption: true,
          },
          // Full capability set — expanded notification / lock screen
          capabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
            Capability.Stop,
          ],
          // Compact notification (Android) / lock-screen controls (iOS)
          compactCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
          ],
          // Android expanded notification
          notificationCapabilities: [
            Capability.Play,
            Capability.Pause,
            Capability.SkipToNext,
            Capability.SkipToPrevious,
            Capability.SeekTo,
          ],
          progressUpdateEventInterval: 1,
        });

        // ── Restore persisted session or fetch fresh queue ────────────────
        const restored = await loadPlayerState();

        if (restored && restored.queue.length > 0) {
          const {
            queue: savedQueue,
            index,
            position: savedPosMs,
            shuffle,
            repeat,
          } = restored;

          queueRef.current = savedQueue;
          setQueue(savedQueue);
          setIsShuffle(shuffle);
          isShuffleRef.current = shuffle;
          setRepeatMode(repeat);
          repeatModeRef.current = repeat;
          currentIndexRef.current = index;
          setCurrentTrack(savedQueue[index]);

          await TrackPlayer.setQueue(savedQueue.map(toRNTPTrack));
          // skip() positions us at the saved track and seeks to the saved time
          await TrackPlayer.skip(index, savedPosMs / 1000);
          await TrackPlayer.setRepeatMode(mapRepeatMode(repeat));
          // Restore paused — don't auto-play on app open
          setIsInitialized(true);
        } else {
          await fetchQueue();
        }
      } catch (error) {
        console.error("RNTP setup error:", error);
        setPlaybackError("load_failed");
        setIsInitialized(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Playback controls ─────────────────────────────────────────────────────

  const play = useCallback(async () => {
    setPlaybackError(null);
    const { state } = await TrackPlayer.getPlaybackState();
    if (state === State.Error) {
      await TrackPlayer.retry();
    } else {
      await TrackPlayer.play();
    }
    setLiveState(State.Playing);
  }, []);

  const pause = useCallback(async () => {
    await TrackPlayer.pause();
    setLiveState(State.Paused);
  }, []);

  const togglePlay = useCallback(async () => {
    try {
      const { state } = await TrackPlayer.getPlaybackState();
      if (state === State.Playing) {
        await TrackPlayer.pause();
        setLiveState(State.Paused);
      } else {
        setPlaybackError(null);
        if (state === State.Error) {
          await TrackPlayer.retry();
        } else {
          await TrackPlayer.play();
        }
        setLiveState(State.Playing);
      }
    } catch (error) {
      console.warn("togglePlay error:", error);
    }
  }, []);

  /**
   * Seek to an absolute position.
   * @param positionMs  Target position in milliseconds (consumer API).
   *                    Converted to seconds before calling RNTP.
   */
  const seekTo = useCallback(async (positionMs: number) => {
    await TrackPlayer.seekTo(positionMs / 1000);
  }, []);

  const retryLoad = useCallback(async () => {
    setPlaybackError(null);
    const { state } = await TrackPlayer.getPlaybackState();
    if (state === State.Error) {
      await TrackPlayer.retry();
      setLiveState(State.Playing);
    } else if (currentTrack) {
      await TrackPlayer.play();
      setLiveState(State.Playing);
    } else {
      await fetchQueue();
    }
  }, [currentTrack, fetchQueue]);

  const refetchQueue = useCallback(async () => {
    await fetchQueue();
  }, [fetchQueue]);

  // ── playNext / playPrevious ───────────────────────────────────────────────

  const playNext = useCallback(async () => {
    const q = queueRef.current;
    if (q.length === 0) return;

    let nextIndex: number;

    if (isShuffleRef.current) {
      do {
        nextIndex = Math.floor(Math.random() * q.length);
      } while (q.length > 1 && nextIndex === currentIndexRef.current);
    } else {
      const candidate = currentIndexRef.current + 1;
      if (repeatModeRef.current === "off" && candidate >= q.length) {
        await TrackPlayer.pause();
        setLiveState(State.Paused);
        return;
      }
      nextIndex = candidate % q.length;
    }

    currentIndexRef.current = nextIndex;
    setCurrentTrack(q[nextIndex]);

    await TrackPlayer.skip(nextIndex);
    await TrackPlayer.play();
    setLiveState(State.Playing);
    TracksService.recordPlay(q[nextIndex].id);
  }, []);

  const playPrevious = useCallback(async () => {
    const q = queueRef.current;
    if (q.length === 0) return;

    // If more than 3 seconds in, restart the current track
    if (position > 3) {
      await TrackPlayer.seekTo(0);
      return;
    }

    const prevIndex = (currentIndexRef.current - 1 + q.length) % q.length;
    currentIndexRef.current = prevIndex;
    setCurrentTrack(q[prevIndex]);

    await TrackPlayer.skip(prevIndex);
    await TrackPlayer.play();
    setLiveState(State.Playing);
    TracksService.recordPlay(q[prevIndex].id);
  }, [position]);

  const playTrack = useCallback(async (track: Track) => {
    const q = queueRef.current;
    const idx = q.findIndex((t) => t.id === track.id);
    if (idx === -1) return;

    currentIndexRef.current = idx;
    setCurrentTrack(q[idx]);

    await TrackPlayer.skip(idx);
    await TrackPlayer.play();
    setLiveState(State.Playing);
    TracksService.recordPlay(track.id);
  }, []);

  // ── Shuffle / Repeat ─────────────────────────────────────────────────────

  const toggleShuffle = useCallback(() => {
    setIsShuffle((prev) => {
      isShuffleRef.current = !prev;
      return !prev;
    });
  }, []);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((prev) => {
      const next: RepeatMode =
        prev === "off" ? "all" : prev === "all" ? "one" : "off";
      repeatModeRef.current = next;
      TrackPlayer.setRepeatMode(mapRepeatMode(next));
      return next;
    });
  }, []);

  // ── Queue management ──────────────────────────────────────────────────────

  /** Append a track to the end of the queue (no-op if already present). */
  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => {
      if (prev.find((t) => t.id === track.id)) return prev;
      const next = [...prev, track];
      queueRef.current = next;
      TrackPlayer.add(toRNTPTrack(track));
      return next;
    });
  }, []);

  /**
   * Insert a track immediately after the currently playing one.
   * If the track is already in the queue it is moved to that position.
   */
  const addToQueueNext = useCallback((track: Track) => {
    setQueue((prev) => {
      const existingIdx = prev.findIndex((t) => t.id === track.id);
      const filtered = prev.filter((t) => t.id !== track.id);
      const insertAt = currentIndexRef.current + 1;
      const next = [
        ...filtered.slice(0, insertAt),
        track,
        ...filtered.slice(insertAt),
      ];
      queueRef.current = next;

      if (existingIdx !== -1) {
        const adjustedTo = existingIdx < insertAt ? insertAt - 1 : insertAt;
        TrackPlayer.move(existingIdx, adjustedTo);
      } else {
        TrackPlayer.add(toRNTPTrack(track), insertAt);
      }

      return next;
    });
  }, []);

  /** Remove a track from the queue by its ID. */
  const removeFromQueue = useCallback((trackId: string) => {
    setQueue((prev) => {
      const idx = prev.findIndex((t) => t.id === trackId);
      if (idx === -1) return prev;

      if (idx < currentIndexRef.current) {
        currentIndexRef.current = Math.max(0, currentIndexRef.current - 1);
      }

      const next = prev.filter((t) => t.id !== trackId);
      queueRef.current = next;
      TrackPlayer.remove(idx);
      return next;
    });
  }, []);

  /**
   * Reorder the queue by moving a track from one index to another.
   * currentIndexRef is updated so the playing track stays active.
   */
  const reorderQueue = useCallback((fromIndex: number, toIndex: number) => {
    setQueue((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);

      const activeId = prev[currentIndexRef.current]?.id;
      const newIdx = next.findIndex((t) => t.id === activeId);
      if (newIdx !== -1) currentIndexRef.current = newIdx;

      queueRef.current = next;
      TrackPlayer.move(fromIndex, toIndex);
      return next;
    });
  }, []);

  /**
   * Jump to a specific upcoming track, discarding everything before it.
   * Equivalent to "Play from here" in the queue sheet.
   */
  const skipToTrack = useCallback((trackId: string) => {
    const q = queueRef.current;
    const idx = q.findIndex((t) => t.id === trackId);
    if (idx === -1 || idx === currentIndexRef.current) return;

    const newQueue = q.slice(idx);
    currentIndexRef.current = 0;
    queueRef.current = newQueue;
    setQueue(newQueue);
    setCurrentTrack(newQueue[0]);

    TrackPlayer.setQueue(newQueue.map(toRNTPTrack)).then(async () => {
      await TrackPlayer.play();
      setLiveState(State.Playing);
      TracksService.recordPlay(newQueue[0].id);
    });
  }, []);

  // ── Like / Unlike ─────────────────────────────────────────────────────────

  const toggleLike = useCallback(async () => {
    if (!currentTrack) return;
    const prev = isLiked;
    setIsLiked(!prev);
    try {
      if (prev) {
        await TracksService.unlike(currentTrack.id);
      } else {
        await TracksService.like(currentTrack.id);
      }
    } catch {
      setIsLiked(prev);
    }
  }, [currentTrack, isLiked]);

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
        skipToTrack,
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
