/**
 * migrate-mysql-to-postgres.ts
 *
 * Migrates tracks from the old MySQL database into the new PostgreSQL database.
 *
 * Usage:
 *   npx ts-node migrate-mysql-to-postgres.ts
 *
 * Requirements:
 *   npm install mysql2 @prisma/client
 *
 * Set these env vars (or edit the MYSQL_CONFIG below directly):
 *   MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 */

import mysql from "mysql2/promise";
import { PrismaClient } from "@prisma/client";

// ─── MySQL config ─────────────────────────────────────────────────────────────

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST ?? "localhost",
  port: parseInt(process.env.MYSQL_PORT ?? "3306"),
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? "vibestream",
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface MySQLTrack {
  id: number;
  video_id: string;
  title: string;
  artist: string;
  album: string | null;
  cover_url: string | null;
  duration: number;
  play_count: number;
  local_path: string;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const prisma = new PrismaClient();

async function main() {
  console.log("🔌 Connecting to MySQL...");
  const mysql_conn = await mysql.createConnection(MYSQL_CONFIG);
  console.log("✅ MySQL connected\n");

  // Fetch only tracks that have a local file
  const [rows] = await mysql_conn.execute<any[]>(
    `SELECT id, video_id, title, artist, album, cover_url, duration, play_count, local_path
     FROM tracks
     WHERE local_path IS NOT NULL
     ORDER BY id ASC`,
  );

  const tracks = rows as MySQLTrack[];
  console.log(`📦 Found ${tracks.length} tracks with local files\n`);

  // ── Artist cache — avoid redundant DB lookups ──────────────────────────────
  const artistCache = new Map<string, string>(); // name → postgres id

async function getOrCreateArtist(name: string): Promise<string> {
  const key = name.trim().toLowerCase();
  if (artistCache.has(key)) return artistCache.get(key)!;

  let artist = await prisma.artist.findFirst({
    where: { name: name.trim() },
  });

  if (!artist) {
    artist = await prisma.artist.create({
      data: { name: name.trim() },
    });
  }

  artistCache.set(key, artist.id);
  return artist.id;
}
  // ── Migrate tracks ─────────────────────────────────────────────────────────
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const track of tracks) {
    try {
      const artistName = track.artist?.trim() || "Unknown Artist";
      const artistId = await getOrCreateArtist(artistName);

      // Use upsert keyed on audioUrl so re-running is safe
      await prisma.track.upsert({
        where: { audioUrl: track.local_path } as any,
        create: {
          title: track.title?.trim() || "Untitled",
          duration: track.duration ?? 0,
          audioUrl: track.local_path,
          coverUrl: track.cover_url ?? null,
          artistId,
          albumId: null,
          genre: null,
          playCount: track.play_count ?? 0,
        },
        update: {
          // Update play count and cover if re-running
          playCount: track.play_count ?? 0,
          coverUrl: track.cover_url ?? null,
        },
      });

      inserted++;
      process.stdout.write(`\r  ✓ ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
    } catch (err: any) {
      failed++;
      console.error(`\n  ✗ Failed: "${track.title}" — ${err.message}`);
    }
  }

  console.log("\n");
  console.log("─────────────────────────────");
  console.log(`✅ Done!`);
  console.log(`   Inserted : ${inserted}`);
  console.log(`   Skipped  : ${skipped}`);
  console.log(`   Failed   : ${failed}`);
  console.log("─────────────────────────────");

  await mysql_conn.end();
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("Fatal error:", err);
  await prisma.$disconnect();
  process.exit(1);
});