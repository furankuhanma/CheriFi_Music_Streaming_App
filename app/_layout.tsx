import "../global.css";
import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PlayerProvider } from "./context/PlayerContext";

export default function RootLayout() {
  return (
    <PlayerProvider>
      <SafeAreaProvider>
        <Slot />
      </SafeAreaProvider>
    </PlayerProvider>
  );
}
