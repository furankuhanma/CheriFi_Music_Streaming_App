-- CreateEnum
CREATE TYPE "SongRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'REJECTED');

-- CreateTable
CREATE TABLE "song_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawInput" TEXT NOT NULL,
    "normalizedTitle" TEXT NOT NULL,
    "normalizedArtist" TEXT NOT NULL,
    "albumHint" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "SongRequestStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "fulfilledTrackId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "song_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "song_requests_status_idx" ON "song_requests"("status");

-- CreateIndex
CREATE INDEX "song_requests_userId_idx" ON "song_requests"("userId");

-- CreateIndex
CREATE INDEX "song_requests_normalizedTitle_normalizedArtist_idx" ON "song_requests"("normalizedTitle", "normalizedArtist");

-- AddForeignKey
ALTER TABLE "song_requests" ADD CONSTRAINT "song_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "song_requests" ADD CONSTRAINT "song_requests_fulfilledTrackId_fkey" FOREIGN KEY ("fulfilledTrackId") REFERENCES "tracks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
