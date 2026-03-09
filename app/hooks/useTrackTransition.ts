import { useRef, useEffect } from "react";
import { Animated } from "react-native";

export type TrackTransitionValues = {
  albumOpacity: Animated.Value;
  albumScale: Animated.Value;
  titleOpacity: Animated.Value;
  titleTranslateX: Animated.Value;
  artistOpacity: Animated.Value;
  artistTranslateX: Animated.Value;
};

/**
 * Animates album art, title, and artist whenever `trackId` changes.
 * - Album art: scale down + fade out, then scale up + fade in
 * - Title / Artist: slide out left + fade, then slide in from right + fade in
 *
 * Skip all animations on first render so the initial track just appears.
 */
export function useTrackTransition(trackId: string): TrackTransitionValues {
  const albumOpacity = useRef(new Animated.Value(1)).current;
  const albumScale = useRef(new Animated.Value(1)).current;
  const titleOpacity = useRef(new Animated.Value(1)).current;
  const titleTranslateX = useRef(new Animated.Value(0)).current;
  const artistOpacity = useRef(new Animated.Value(1)).current;
  const artistTranslateX = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // ── Phase 1: exit ─────────────────────────────────────────────────────
    const exitAlbum = Animated.parallel([
      Animated.timing(albumOpacity, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.spring(albumScale, {
        toValue: 0.92,
        useNativeDriver: true,
        speed: 30,
        bounciness: 0,
      }),
    ]);

    const exitText = Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(titleTranslateX, {
        toValue: -24,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(artistOpacity, {
        toValue: 0,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(artistTranslateX, {
        toValue: -24,
        duration: 100,
        useNativeDriver: true,
      }),
    ]);

    // ── Phase 2: reset positions (instant, no animation) ─────────────────
    const resetPositions = () => {
      titleTranslateX.setValue(24);
      artistTranslateX.setValue(24);
      albumScale.setValue(0.92);
    };

    // ── Phase 3: enter ────────────────────────────────────────────────────
    const enterAlbum = Animated.parallel([
      Animated.timing(albumOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.spring(albumScale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 14,
        bounciness: 6,
      }),
    ]);

    const enterText = Animated.parallel([
      Animated.timing(titleOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(titleTranslateX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 18,
        bounciness: 4,
      }),
      Animated.timing(artistOpacity, {
        toValue: 1,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.spring(artistTranslateX, {
        toValue: 0,
        useNativeDriver: true,
        speed: 16,
        bounciness: 4,
      }),
    ]);

    Animated.sequence([
      Animated.parallel([exitAlbum, exitText]),
      { start: (cb: any) => { resetPositions(); cb({ finished: true }); } } as any,
      Animated.parallel([enterAlbum, enterText]),
    ]).start();
  }, [trackId]);

  return {
    albumOpacity,
    albumScale,
    titleOpacity,
    titleTranslateX,
    artistOpacity,
    artistTranslateX,
  };
}

export default function UseTrackTransitionModule() {
  return null;
}