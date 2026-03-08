import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Test user ────────────────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 12);

  const user = await prisma.user.upsert({
    where: { email: "test@cherifi.com" },
    update: {},
    create: {
      email: "test@cherifi.com",
      username: "testuser",
      displayName: "Test User",
      passwordHash,
    },
  });

  console.log(`✅ User: ${user.email}`);

  // ── Artists ───────────────────────────────────────────────────────────────
  const arianaGrande = await prisma.artist.upsert({
    where: { id: "artist-1" },
    update: {},
    create: {
      id: "artist-1",
      name: "Ariana Grande",
      bio: "American singer and actress",
      imageUrl: "https://picsum.photos/seed/ariana/200",
    },
  });

  console.log(`✅ Artist: ${arianaGrande.name}`);

  // ── Albums ────────────────────────────────────────────────────────────────
  const myEverything = await prisma.album.upsert({
    where: { id: "album-1" },
    update: {},
    create: {
      id: "album-1",
      title: "My Everything",
      coverUrl: "https://picsum.photos/seed/myeverything/200",
      artistId: arianaGrande.id,
      releaseDate: new Date("2014-08-25"),
    },
  });

  console.log(`✅ Album: ${myEverything.title}`);

  // ── Tracks ────────────────────────────────────────────────────────────────
  // NOTE: Place your actual mp3 file in uploads/ and update audioUrl below.
  // The path should be relative to the project root e.g. ./uploads/track.mp3
  const track = await prisma.track.upsert({
    where: { id: "track-1" },
    update: {},
    create: {
      id: "track-1",
      title: "Bang Bang",
      duration: 213, // seconds
      audioUrl: "./uploads/bang-bang.mp3", // ← update this path
      coverUrl: "https://picsum.photos/seed/bangbang/200",
      artistId: arianaGrande.id,
      albumId: myEverything.id,
      genre: "Pop",
      playCount: 0,
    },
  });

  console.log(`✅ Track: ${track.title}`);
  console.log(`\n🎵 Seed complete!`);
  console.log(`\nTest credentials:`);
  console.log(`  Email:    test@cherifi.com`);
  console.log(`  Password: password123`);
  console.log(`\n⚠️  Remember to copy your mp3 to: uploads/bang-bang.mp3`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
