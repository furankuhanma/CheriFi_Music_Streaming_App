import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LocalTrack,
  LocalTracksService,
} from "../services/localTracks.service";

// ─── Storage key ──────────────────────────────────────────────────────────────

const STORAGE_KEY = "@cherifi:localTracks";

// ─── Types ────────────────────────────────────────────────────────────────────

type LocalTracksContextType = {
  /** All imported local tracks, newest first. */
  localTracks: LocalTrack[];
  /** True while the initial AsyncStorage read is in progress. */
  isHydrated: boolean;
  /** Open the file picker and import selected audio files. */
  importTracks: () => Promise<void>;
  /** Remove a local track from the library and delete its file. */
  removeLocalTrack: (trackId: string) => Promise<void>;
};

// ─── Context ──────────────────────────────────────────────────────────────────

const LocalTracksContext = createContext<LocalTracksContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function LocalTracksProvider({ children }: { children: ReactNode }) {
  const [localTracks, setLocalTracks] = useState<LocalTrack[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // ── Hydrate from AsyncStorage on mount ─────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const parsed: LocalTrack[] = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setLocalTracks(parsed);
          }
        }
      } catch (err) {
        console.warn("[LocalTracksContext] Failed to load local tracks:", err);
      } finally {
        setIsHydrated(true);
      }
    })();
  }, []);

  // ── Persist helper ─────────────────────────────────────────────────────────
  const persist = useCallback(async (tracks: LocalTrack[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    } catch (err) {
      console.warn("[LocalTracksContext] Failed to persist local tracks:", err);
    }
  }, []);

  // ── Import ─────────────────────────────────────────────────────────────────
  const importTracks = useCallback(async () => {
    try {
      const imported = await LocalTracksService.pickAndImport();

      if (imported.length === 0) return; // cancelled or nothing picked

      setLocalTracks((prev) => {
        // Merge: skip duplicates (same id = same filename), prepend new ones.
        const existingIds = new Set(prev.map((t) => t.id));
        const fresh = imported.filter((t) => !existingIds.has(t.id));

        if (fresh.length === 0) return prev; // all duplicates, nothing to do

        const next = [...fresh, ...prev];
        void persist(next);
        return next;
      });
    } catch (err) {
      console.warn("[LocalTracksContext] importTracks error:", err);
      Alert.alert(
        "Import failed",
        "Could not import the selected file(s). Please try again.",
      );
    }
  }, [persist]);

  // ── Remove ─────────────────────────────────────────────────────────────────
  const removeLocalTrack = useCallback(
    async (trackId: string) => {
      const track = localTracks.find((t) => t.id === trackId);
      if (!track) return;

      // Delete the physical file (best-effort).
      await LocalTracksService.remove(track);

      setLocalTracks((prev) => {
        const next = prev.filter((t) => t.id !== trackId);
        void persist(next);
        return next;
      });
    },
    [localTracks, persist],
  );

  const value = useMemo<LocalTracksContextType>(
    () => ({ localTracks, isHydrated, importTracks, removeLocalTrack }),
    [localTracks, isHydrated, importTracks, removeLocalTrack],
  );

  return (
    <LocalTracksContext.Provider value={value}>
      {children}
    </LocalTracksContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useLocalTracks() {
  const ctx = useContext(LocalTracksContext);
  if (!ctx) {
    throw new Error("useLocalTracks must be used within a LocalTracksProvider");
  }
  return ctx;
}
