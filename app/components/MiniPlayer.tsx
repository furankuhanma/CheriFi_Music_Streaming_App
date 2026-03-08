import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Animated,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  usePlayer,
  SCREEN_HEIGHT,
  MINI_PLAYER_HEIGHT,
} from "../context/PlayerContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function MiniPlayer() {
  const { currentTrack, isExpanded, setIsExpanded, isPlaying, setIsPlaying } =
    usePlayer();
  const insets = useSafeAreaInsets();

  const animHeight = useRef(new Animated.Value(MINI_PLAYER_HEIGHT)).current;
  const animOpacityMini = useRef(new Animated.Value(1)).current;
  const animOpacityFull = useRef(new Animated.Value(0)).current;
  const animAlbumSize = useRef(new Animated.Value(44)).current;

  useEffect(() => {
    if (isExpanded) {
      Animated.parallel([
        Animated.spring(animHeight, {
          toValue: SCREEN_HEIGHT,
          useNativeDriver: false,
          bounciness: 0,
        }),
        Animated.timing(animOpacityMini, {
          toValue: 0,
          duration: 150,
          useNativeDriver: false,
        }),
        Animated.timing(animOpacityFull, {
          toValue: 1,
          duration: 300,
          delay: 150,
          useNativeDriver: false,
        }),
        Animated.spring(animAlbumSize, {
          toValue: 280,
          useNativeDriver: false,
          bounciness: 4,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(animHeight, {
          toValue: MINI_PLAYER_HEIGHT,
          useNativeDriver: false,
          bounciness: 0,
        }),
        Animated.timing(animOpacityFull, {
          toValue: 0,
          duration: 100,
          useNativeDriver: false,
        }),
        Animated.timing(animOpacityMini, {
          toValue: 1,
          duration: 200,
          delay: 100,
          useNativeDriver: false,
        }),
        Animated.spring(animAlbumSize, {
          toValue: 44,
          useNativeDriver: false,
          bounciness: 4,
        }),
      ]).start();
    }
  }, [isExpanded]);

  return (
    <Animated.View
      className="bg-[#121212] border-t border-[#282828] overflow-hidden"
      style={{ height: animHeight }}
    >
      {/* ─── MINI PLAYER ─── */}
      <Animated.View style={{ opacity: animOpacityMini }}>
        <TouchableOpacity
          onPress={() => setIsExpanded(true)}
          activeOpacity={0.9}
          className="px-3 py-2"
        >
          {/* Row: art + info + controls */}
          <View className="flex-row items-center">
            {/* Album Art */}
            <Animated.Image
              source={{ uri: currentTrack.albumArt }}
              style={{
                width: 44,
                height: 44,
                borderRadius: 4,
                marginRight: 10,
              }}
            />

            {/* Title + Artist */}
            <View className="flex-1">
              <Text
                className="text-white text-sm font-semibold"
                numberOfLines={1}
              >
                {currentTrack.title}
              </Text>
              <Text className="text-[#B3B3B3] text-xs" numberOfLines={1}>
                {currentTrack.artist}
              </Text>
            </View>

            {/* Like button */}
            <TouchableOpacity className="p-2">
              <Ionicons name="heart-outline" size={20} color="#B3B3B3" />
            </TouchableOpacity>

            {/* Previous */}
            <TouchableOpacity className="p-2">
              <Ionicons name="play-skip-back" size={20} color="white" />
            </TouchableOpacity>

            {/* Play / Pause */}
            <TouchableOpacity
              onPress={() => setIsPlaying(!isPlaying)}
              className="p-2"
            >
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={22}
                color="white"
              />
            </TouchableOpacity>

            {/* Next */}
            <TouchableOpacity className="p-2">
              <Ionicons name="play-skip-forward" size={20} color="white" />
            </TouchableOpacity>
          </View>

          {/* Progress Bar */}
          <View className="h-0.5 bg-[#333] mt-2 rounded-full">
            <View className="h-0.5 bg-[#1DB954] w-[30%] rounded-full" />
          </View>
        </TouchableOpacity>
      </Animated.View>

      {/* ─── EXPANDED PLAYER ─── */}
      <Animated.View
        className="absolute inset-0 px-6 items-center"
        style={{
          opacity: animOpacityFull,
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
        }}
      >
        {/* Header */}
        <View className="flex-row items-center w-full mb-8">
          <TouchableOpacity onPress={() => setIsExpanded(false)}>
            <Ionicons name="chevron-down" size={28} color="white" />
          </TouchableOpacity>
          <Text className="text-white flex-1 text-center font-semibold text-sm">
            Now Playing
          </Text>
          <TouchableOpacity>
            <Ionicons name="ellipsis-horizontal" size={24} color="white" />
          </TouchableOpacity>
        </View>

        {/* Album Art */}
        <Animated.Image
          source={{ uri: currentTrack.albumArt }}
          style={{
            width: animAlbumSize,
            height: animAlbumSize,
            borderRadius: 8,
            marginBottom: 32,
          }}
        />

        {/* Track Info + Like */}
        <View className="flex-row items-center w-full mb-6">
          <View className="flex-1">
            <Text className="text-white text-2xl font-bold" numberOfLines={1}>
              {currentTrack.title}
            </Text>
            <Text className="text-[#B3B3B3] text-base mt-1" numberOfLines={1}>
              {currentTrack.artist}
            </Text>
          </View>
          <TouchableOpacity className="p-2">
            <Ionicons name="heart-outline" size={24} color="#B3B3B3" />
          </TouchableOpacity>
        </View>

        {/* Seek Bar */}
        <View className="w-full mb-2">
          <View className="h-1 bg-[#333] rounded-full">
            <View className="h-1 bg-[#1DB954] w-[30%] rounded-full" />
          </View>
          <View className="flex-row justify-between mt-1">
            <Text className="text-[#B3B3B3] text-xs">1:02</Text>
            <Text className="text-[#B3B3B3] text-xs">3:22</Text>
          </View>
        </View>

        {/* Main Controls */}
        <View className="flex-row items-center justify-between w-full mt-4">
          <TouchableOpacity>
            <Ionicons name="shuffle" size={22} color="#B3B3B3" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="play-skip-back" size={32} color="white" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setIsPlaying(!isPlaying)}
            className="w-16 h-16 rounded-full bg-white items-center justify-center"
          >
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={32}
              color="black"
            />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="play-skip-forward" size={32} color="white" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="repeat" size={22} color="#B3B3B3" />
          </TouchableOpacity>
        </View>

        {/* Bottom Actions */}
        <View className="flex-row justify-around w-full mt-8">
          <TouchableOpacity>
            <Ionicons name="share-outline" size={22} color="#B3B3B3" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="add-circle-outline" size={22} color="#B3B3B3" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="download-outline" size={22} color="#B3B3B3" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="mic-outline" size={22} color="#B3B3B3" />
          </TouchableOpacity>
          <TouchableOpacity>
            <Ionicons name="list-outline" size={22} color="#B3B3B3" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Animated.View>
  );
}
