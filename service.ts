/**
 * RNTP Background Playback Service
 *
 * Registered at app startup via TrackPlayer.registerPlaybackService() in
 * index.js. This is the single authoritative service handler. Runs on the JS
 * thread for the lifetime of the player, even when the app is backgrounded.
 *
 * Handles all remote-control events fired by:
 *  - Android media notification buttons
 *  - Lock-screen transport controls
 *  - Bluetooth headset / headphone buttons
 *  - Android Auto / WearOS
 */
import TrackPlayer, { Event } from 'react-native-track-player';

module.exports = async function () {
  // ── Play / Pause / Stop ──────────────────────────────────────────────────
  TrackPlayer.addEventListener(Event.RemotePlay, () => TrackPlayer.play());
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.stop());

  // ── Skip ─────────────────────────────────────────────────────────────────
  // Sequential skip is the correct behaviour from external controls.
  // Shuffle / repeat logic is applied reactively in PlayerContext via the
  // PlaybackActiveTrackChanged event.
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

  // ── Audio interruptions (phone calls, other apps stealing focus) ─────────
  // autoHandleInterruptions is also enabled in setupPlayer, but we handle
  // permanent focus loss explicitly here.
  TrackPlayer.addEventListener(
    Event.RemoteDuck,
    async ({ paused, permanent }) => {
      if (permanent) {
        // Another music app has taken over — stop entirely
        await TrackPlayer.stop();
      } else if (paused) {
        // Transient loss (phone call, notification sound) — pause
        await TrackPlayer.pause();
      } else {
        // Focus regained — resume
        await TrackPlayer.play();
      }
    },
  );
};
