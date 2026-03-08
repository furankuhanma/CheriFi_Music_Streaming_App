/*
  Warnings:

  - A unique constraint covering the columns `[audioUrl]` on the table `tracks` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "tracks_audioUrl_key" ON "tracks"("audioUrl");
