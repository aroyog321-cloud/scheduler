// src/index.js
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { createServer } = require("http");

const logger = require("./logger");
const { connectRedis } = require("./queue");
const authRoutes = require("./routes/auth");
const platformRoutes = require("./routes/platforms");
const mediaRoutes = require("./routes/media");
const postRoutes = require("./routes/posts");
const scheduleRoutes = require("./routes/schedules");
const mcpRoutes = require("./routes/mcp");
const analyticsRoutes = require("./routes/analytics");

const app = express();
const httpServer = createServer(app);

// ─── Security Middleware ───────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: [process.env.FRONTEND_URL || "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Global rate limit
app.use(rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
}));

// ─── Health Check ──────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), service: "ContentOS API" });
});

// ─── Routes ───────────────────────────────────────────────────────────
app.use("/api/auth", authRoutes);
app.use("/api/platforms", platformRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/mcp", mcpRoutes);   // MCP tool endpoints for AI agents

// ─── 404 ──────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// ─── Global Error Handler ─────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  logger.error(err.stack || err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ─── Start ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 4000;

async function start() {
  try {
    await connectRedis();
    httpServer.listen(PORT, () => {
      logger.info(`ContentOS API running on http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
}

start();

module.exports = { app };
