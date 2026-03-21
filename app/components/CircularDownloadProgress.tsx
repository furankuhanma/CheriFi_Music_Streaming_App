import React, { useMemo } from "react";
import { View, Pressable, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from "react-native-reanimated";
import { DownloadState } from "../context/DownloadContext";

const RING_SIZE = 48;

type CircularDownloadProgressProps = {
  progress: number; // 0-1
  state: DownloadState;
  onPress?: () => void;
};

/**
 * iOS-style circular download progress indicator
 * - Uses border + rotation to create a progress ring
 * - Shows percentage or pause/play icon in the center
 * - Animated via Reanimated
 */
export function CircularDownloadProgress({
  progress,
  state,
  onPress,
}: CircularDownloadProgressProps) {
  // Clamp progress between 0 and 1
  const clampedProgress = Math.max(0, Math.min(1, progress));

  // Determine which icon to show in the center
  const centerIcon = useMemo(() => {
    switch (state) {
      case "completed":
        return { name: "checkmark-circle-sharp", color: "#1DB954" };
      case "downloading":
        return null; // Show percentage instead
      case "paused":
        return { name: "play-circle", color: "#FFA500" };
      case "failed":
        return { name: "alert-circle", color: "#FF4D4D" };
      case "cancelled":
        return { name: "close-circle", color: "#666" };
      default:
        return null;
    }
  }, [state]);

  const percentageText = useMemo(() => {
    if (state === "downloading") {
      return Math.round(clampedProgress * 100).toString();
    }
    return null;
  }, [clampedProgress, state]);

  // Determine ring color based on state
  const ringColor = useMemo(() => {
    switch (state) {
      case "downloading":
        return "#1DB954";
      case "completed":
        return "#1DB954";
      case "paused":
        return "#FFA500";
      case "failed":
      case "cancelled":
        return "#FF4D4D";
      default:
        return "#666";
    }
  }, [state]);

  // Rotation animation: 0-100% progress = 0-360 degrees
  const animatedRotationStyle = useAnimatedStyle(() => {
    const rotation = interpolate(
      clampedProgress,
      [0, 1],
      [0, 360],
      Extrapolate.CLAMP,
    );
    return {
      transform: [{ rotate: `${rotation}deg` }],
    };
  }, [clampedProgress]);

  return (
    <Pressable onPress={onPress} disabled={!onPress}>
      <View className="relative items-center justify-center">
        {/* Background circle */}
        <View
          className="rounded-full"
          style={{
            width: RING_SIZE,
            height: RING_SIZE,
            backgroundColor: "#282828",
          }}
        >
          {/* Progress ring overlay - uses conic gradient effect */}
          <Animated.View
            style={[
              {
                width: RING_SIZE,
                height: RING_SIZE,
                borderRadius: RING_SIZE / 2,
                borderWidth: 3,
                borderColor: "transparent",
                borderTopColor: ringColor,
                borderRightColor: ringColor,
                opacity: clampedProgress > 0 ? 1 : 0,
              },
              animatedRotationStyle,
            ]}
            pointerEvents="none"
          />

          {/* Center content */}
          <View className="absolute inset-0 items-center justify-center">
            {centerIcon ? (
              <Ionicons
                name={centerIcon.name as any}
                size={24}
                color={centerIcon.color}
              />
            ) : percentageText ? (
              <Text className="text-xs font-bold text-white">
                {percentageText}%
              </Text>
            ) : null}
          </View>
        </View>
      </View>
    </Pressable>
  );
}
