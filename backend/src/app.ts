import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";

import authRoutes from "./modules/auth/auth.routes";
import tracksRoutes from "./modules/tracks/tracks.routes";
import recommendationsRoutes from "./modules/recommendations/recommendations.routes";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL ?? "http://localhost:8081",
    credentials: true,
  }),
);

// ── Rate limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, error: "Too many requests, please try again later" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20, // stricter for auth endpoints
  message: { success: false, error: "Too many auth attempts, please try again later" },
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
// Serves album art and other static assets
app.use(
  "/uploads",
  express.static(path.resolve(process.env.UPLOADS_DIR ?? "./uploads")),
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/tracks", tracksRoutes);
app.use("/api/recommendations", recommendationsRoutes);

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
