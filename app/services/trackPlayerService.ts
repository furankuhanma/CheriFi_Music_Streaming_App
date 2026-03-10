/**
 * RNTP Background Playback Service
 *
 * Registered at app startup via TrackPlayer.registerPlaybackService().
 * Runs on the JS side as long as the player is alive, even with the app in
 * the background. All remote-control events (notification, lock screen,
 * Bluetooth headsets, CarPlay / Android Auto) are handled here.
 */
import TrackPlayer, { Event } from "react-native-track-player";

export async function PlaybackService() {
  // ── Play / Pause / Stop ───────────────────────────────────────────────────
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());

  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());

  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());

  // ── Skip ─────────────────────────────────────────────────────────────────
  // The full shuffle/repeat logic lives in PlayerContext (React side).
  // From a notification or headset, sequential skip is the expected behaviour.
  TrackPlayer.addEventListener(Event.RemoteNext, () =>
    TrackPlayer.skipToNext(),
  );

  TrackPlayer.addEventListener(Event.RemotePrevious, () =>
    TrackPlayer.skipToPrevious(),
  );

  // ── Seek ─────────────────────────────────────────────────────────────────
  // position is in seconds (RNTP convention).
  TrackPlayer.addEventListener(Event.RemoteSeek, ({ position }) =>
    TrackPlayer.seekTo(position),
  );

  // ── Audio interruptions (phone calls, other apps stealing focus) ──────────
  // RNTP can handle this automatically via autoHandleInterruptions in
  // setupPlayer, but we also respond here for Android permanent interruptions.
  TrackPlayer.addEventListener(
    Event.RemoteDuck,
    async ({ paused, permanent }) => {
      if (permanent) {
        // Permanent focus loss (e.g. another music app started) — stop
        await TrackPlayer.stop();
      } else if (paused) {
        // Transient focus loss (phone call, notification beep) — pause
        await TrackPlayer.pause();
      } else {
        // Focus regained — resume
        await TrackPlayer.play();
      }
    },
  );
}
