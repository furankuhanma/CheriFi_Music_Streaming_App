import * as DocumentPicker from "expo-document-picker";
import { Directory, File, Paths } from "expo-file-system";

import { Track } from "./tracks.service";

// ─── Constants ────────────────────────────────────────────────────────────────

const LOCAL_TRACK_PREFIX = "local:";

// Directory inside the app's document storage where we copy imported files.
// Keeping them here (instead of referencing the original URI) means they
// survive Android scoped-storage revocations and app restarts.
const LOCAL_MUSIC_DIR = new Directory(Paths.document, "local_music");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Ensure our local_music/ folder exists. */
function ensureDir(): void {
  // idempotent: true — safe to call even if the directory already exists.
  LOCAL_MUSIC_DIR.create({ idempotent: true });
}

/**
 * Strip the extension and clean up a filename to use as a track title.
 * e.g.  "01 - My Song (feat. Artist).mp3"  →  "01 - My Song (feat. Artist)"
 */
function titleFromFilename(filename: string): string {
  return filename.replace(/\.[^/.]+$/, "").trim() || filename;
}

/** Build a stable local ID from the destination file URI. */
function localId(destUri: string): string {
  return LOCAL_TRACK_PREFIX + destUri;
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type LocalTrack = Track & {
  /** Always starts with "local:" so we can distinguish from server tracks. */
  id: string;
  /** Absolute file:// URI pointing to the copied file in our sandbox. */
  localUri: string;
};

export const LocalTracksService = {
  /** Returns true if a track ID belongs to a locally imported file. */
  isLocal(trackId: string): boolean {
    return trackId.startsWith(LOCAL_TRACK_PREFIX);
  },

  /**
   * Decode a local track ID back to the playable file:// URI.
   * The ID is "local:" + the absolute file URI.
   */
  localUri(trackId: string): string {
    return trackId.slice(LOCAL_TRACK_PREFIX.length);
  },

  /**
   * Open the system file picker (audio files only) and let the user choose
   * one or more files. Each chosen file is:
   *   1. Copied into `local_music/` inside our sandbox.
   *   2. Converted into a `LocalTrack` object ready to store / play.
   *
   * Returns an array of newly imported tracks (may be empty if cancelled).
   *
   * IMPORTANT: copyToCacheDirectory MUST be true so that Android content://
   * URIs are materialised as readable file:// paths before we copy them.
   */
  async pickAndImport(): Promise<LocalTrack[]> {
    const result = await DocumentPicker.getDocumentAsync({
      type: "audio/*",
      multiple: true,
      copyToCacheDirectory: true, // ← CRITICAL: converts content:// → file://
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return [];
    }

    ensureDir();

    const imported: LocalTrack[] = [];

    for (const asset of result.assets) {
      try {
        const originalName =
          asset.name ?? asset.uri.split("/").pop() ?? "track";
        const safeFilename = originalName.replace(/[^a-zA-Z0-9._\- ]/g, "_");

        const destFile = new File(LOCAL_MUSIC_DIR, safeFilename);

        // Copy only if not already there (idempotent re-import).
        if (!destFile.exists) {
          // asset.uri is now guaranteed to be a file:// URI
          const sourceFile = new File(asset.uri);
          sourceFile.copy(LOCAL_MUSIC_DIR);
        }

        // Encode the full destination URI into the ID so we can recover it later.
        const id = localId(destFile.uri);
        const title = titleFromFilename(originalName);

        const track: LocalTrack = {
          id,
          title,
          duration: 0, // unknown without parsing ID3 tags
          audioUrl: destFile.uri,
          localUri: destFile.uri, // authoritative playable URI
          coverUrl: null,
          artist: { id: "local-artist", name: "Unknown Artist" },
          album: null,
          genre: null,
          playCount: 0,
          isLiked: false,
          inLibrary: true,
        };

        imported.push(track);
      } catch (err) {
        console.warn("[LocalTracksService] Failed to import file:", err);
      }
    }

    return imported;
  },

  /**
   * Delete the physical file for a local track.
   */
  async remove(track: LocalTrack): Promise<void> {
    try {
      const file = new File(track.localUri);
      if (file.exists) {
        file.delete();
      }
    } catch (err) {
      console.warn("[LocalTracksService] Failed to delete local file:", err);
    }
  },
};