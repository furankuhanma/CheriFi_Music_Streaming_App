import "dotenv/config";
import app from "./app";
import { prisma } from "./config/db";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

async function main() {
  // Verify DB connection before accepting requests
  await prisma.$connect();
  console.log("✅ Database connected");

  app.listen(PORT, () => {
    console.log(`🎵 CheriFi API running on http://localhost:${PORT}`);
    console.log(`   Environment: ${process.env.NODE_ENV ?? "development"}`);
    console.log(`   Health: http://localhost:${PORT}/health`);
  });
}

main().catch((err) => {
  console.error("❌ Failed to start server:", err);
  process.exit(1);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  await prisma.$disconnect();
  console.log("Server shut down gracefully");
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await prisma.$disconnect();
  process.exit(0);
});
