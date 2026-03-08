import React, { createContext, useState, useContext, ReactNode } from "react";
import { Dimensions } from "react-native";

export const MINI_PLAYER_HEIGHT = 70;
export const SCREEN_HEIGHT = Dimensions.get("window").height;

type Track = {
  title: string;
  artist: string;
  albumArt: string;
};

type PlayerContextType = {
  isExpanded: boolean;
  setIsExpanded: (value: boolean) => void;
  currentTrack: Track;
  isPlaying: boolean;
  setIsPlaying: (value: boolean) => void;
};

const PlayerContext = createContext<PlayerContextType | null>(null);

const mockTrack = {
  title: "Blinding Lights",
  artist: "The Weeknd",
  albumArt: "https://picsum.photos/200",
};

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <PlayerContext.Provider
      value={{
        isExpanded,
        setIsExpanded,
        currentTrack: mockTrack,
        isPlaying,
        setIsPlaying,
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
