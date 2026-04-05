import { useMemo } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MINI_PLAYER_HEIGHT, usePlayer } from "../context/PlayerContext";

const TAB_BAR_HEIGHT = 60;

/**
 * Returns a stable bottom spacing value for tab screens so content does not end
 * up behind the tab bar, mini player, or gesture area.
 */
export function useBottomOverlaySpacing(extra = 0): number {
  const insets = useSafeAreaInsets();
  const { currentTrack, isExpanded } = usePlayer();

  return useMemo(() => {
    const miniPlayerHeight = currentTrack && !isExpanded ? MINI_PLAYER_HEIGHT : 0;
    return TAB_BAR_HEIGHT + insets.bottom + miniPlayerHeight + extra;
  }, [currentTrack, isExpanded, insets.bottom, extra]);
}
