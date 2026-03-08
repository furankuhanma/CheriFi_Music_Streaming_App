import { useRef, useEffect } from "react";
import { Animated } from "react-native";

/**
 * Returns an Animated.Value (0–1) that fades out then back in
 * whenever `trackId` changes. Wire it to the album art's opacity.
 *
 * Usage:
 *   const albumArtOpacity = useAlbumArtFade(currentTrack.id);
 *   <Animated.Image style={{ opacity: albumArtOpacity }} ... />
 */
export function useAlbumArtFade(trackId: string): Animated.Value {
  const opacity = useRef(new Animated.Value(1)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    // Skip animation on initial mount — art should just appear
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    Animated.sequence([
      Animated.timing(opacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [trackId]);

  return opacity;
}

// Required by Expo Router — files without a default export are treated as routes
export default function UseAlbumArtFadeModule() {
  return null;
}