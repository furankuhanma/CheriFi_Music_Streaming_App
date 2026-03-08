import React, { createContext, useState, useContext, ReactNode } from "react";
import { Dimensions } from "react-native";

export const MINI_PLAYER_HEIGHT = 70;
export const SCREEN_HEIGHT = Dimensions.get("window").height;

export type RepeatMode = "off" | "all" | "one";

type Track = {
  title: string;
  artist: string;
  albumArt: string;
};

type PlayerContextType = {
  // Playback
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  currentTrack: Track;
  isPlaying: boolean;
  setIsPlaying: (value: boolean) => void;

  // Shuffle
  isShuffle: boolean;
  toggleShuffle: () => void;

  // Repeat
  repeatMode: RepeatMode;
  cycleRepeat: () => void;

  // Volume
  volume: number;
  setVolume: (value: number) => void;
  isMuted: boolean;
  toggleMute: () => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

const mockTrack: Track = {
  title: "Blinding Lights",
  artist: "The Weeknd",
  albumArt: "https://picsum.photos/200",
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);

  const toggleShuffle = () => setIsShuffle((prev) => !prev);

  // Cycles: off → all → one → off
  const cycleRepeat = () =>
    setRepeatMode((prev) =>
      prev === "off" ? "all" : prev === "all" ? "one" : "off",
    );

  const toggleMute = () => setIsMuted((prev) => !prev);

  return (
    <PlayerContext.Provider
      value={{
        isExpanded,
        setIsExpanded,
        currentTrack: mockTrack,
        isPlaying,
        setIsPlaying,
        isShuffle,
        toggleShuffle,
        repeatMode,
        cycleRepeat,
        volume,
        setVolume,
        isMuted,
        toggleMute,
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
