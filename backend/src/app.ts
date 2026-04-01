import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";

import authRoutes from "./modules/auth/auth.routes";
import tracksRoutes from "./modules/tracks/tracks.routes";
import recommendationsRoutes from "./modules/recommendations/recommendations.routes";
import playlistsRoutes from "./modules/playlist/playlists.routes";
import songRequestRoutes from "./modules/song-request/songrequest.routes";
import { errorHandler } from "./middleware/errorHandler";
import searchRoutes from "./modules/search/search.routes";


const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS Configuration for Production ──────────────────────────────────────────
// Mobile apps (React Native Expo) may not send Origin headers consistently,
// so we allow requests with proper auth tokens or from known origins.
// In production, CLIENT_URL should be set to the actual domain.
app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        process.env.CLIENT_URL,
        "http://localhost:8081", // Development
        "http://localhost:3000",  // Development
        "http://127.0.0.1:8081",  // Development
      ].filter(Boolean);

      // Allow requests with no origin (common in mobile apps, preflight requests)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("CORS not allowed"), false);
      }
    },
    credentials: true,
  }),
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, error: "Too many requests, please try again later" },  skip: (req) => {
    // Don't rate limit health checks and static files
    return req.path === "/health" || req.path.startsWith("/uploads");
  },});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, error: "Too many auth attempts, please try again later" },
  skip: (req) => {
    if (req.path === "/me") return true;
    if (req.path === "/refresh") return true;
    return false;
  },
});

app.use(limiter);

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Logging ───────────────────────────────────────────────────────────────────
if (process.env.NODE_ENV !== "test") {
  app.use(morgan(process.env.NODE_ENV === "development" ? "dev" : "combined"));
}

// ── Static uploads ────────────────────────────────────────────────────────────
app.use(
  "/uploads",
  express.static(path.resolve(process.env.UPLOADS_DIR ?? "./uploads")),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/tracks", tracksRoutes);
app.use("/api/recommendations", recommendationsRoutes);
app.use("/api/playlists", playlistsRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/song-requests", songRequestRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_, res) => {
  res.json({ success: true, message: "CheriFi API is running" });
});

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((_, res) => {
  res.status(404).json({ success: false, error: "Route not found" });
});

// ── Error handler ─────────────────────────────────────────────────────────────
app.use(errorHandler);

export default app;