import React, { useEffect } from "react";
import { View, Text, Image, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDownload, DownloadNotification } from "../context/DownloadContext";

/**
 * Bottom snackbar/toast notification for download initiation
 * - Slides up from bottom with smooth animation
 * - Auto-dismisses after specified time (default 3s)
 * - Displays song title, artist, and cover
 */
export function DownloadNotificationBar() {
  const { notifications, removeNotification } = useDownload();
  const insets = useSafeAreaInsets();

  // Show the first notification in the queue
  const currentNotification = notifications[0];

  return (
    <>
      {currentNotification && (
        <NotificationItem
          notification={currentNotification}
          bottomOffset={insets.bottom}
          onDismiss={() => removeNotification(currentNotification.id)}
        />
      )}
    </>
  );
}

interface NotificationItemProps {
  notification: DownloadNotification;
  bottomOffset: number;
  onDismiss: () => void;
}

function NotificationItem({
  notification,
  bottomOffset,
  onDismiss,
}: NotificationItemProps) {
  const translateY = useSharedValue(200);

  useEffect(() => {
    // Slide in animation
    translateY.value = withTiming(0, { duration: 300 });

    // Auto-dismiss
    const timer = setTimeout(() => {
      translateY.value = withTiming(200, { duration: 300 }, () => {
        onDismiss();
      });
    }, notification.dismissAfter ?? 3000);

    return () => clearTimeout(timer);
  }, [notification.id, notification.dismissAfter, translateY, onDismiss]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  }, []);

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          bottom: bottomOffset + 16,
          left: 16,
          right: 16,
          zIndex: 1000,
        },
        animatedStyle,
      ]}
    >
      <View className="bg-[#1DB954]/90 rounded-full px-4 py-3 flex-row items-center gap-3 shadow-lg">
        {/* Cover art */}
        {notification.coverUrl ? (
          <Image
            source={{ uri: notification.coverUrl }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 8,
              backgroundColor: "#282828",
            }}
          />
        ) : (
          <View className="w-10 h-10 bg-[#282828] rounded-lg items-center justify-center">
            <Ionicons name="musical-notes" size={20} color="#888" />
          </View>
        )}

        {/* Text content */}
        <View className="flex-1">
          <Text className="text-white font-semibold text-sm" numberOfLines={1}>
            {notification.title}
          </Text>
          <Text className="text-white/80 text-xs" numberOfLines={1}>
            {notification.message}
          </Text>
        </View>

        {/* Close button */}
        <Pressable onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={20} color="white" />
        </Pressable>
      </View>
    </Animated.View>
  );
}
