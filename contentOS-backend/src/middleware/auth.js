// src/middleware/auth.js
const jwt = require("jsonwebtoken");
const prisma = require("../db");

// ─── Standard JWT auth ────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }

    const token = header.slice(7);
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, name: true, plan: true, timezone: true },
    });

    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "Invalid or expired token" });
    }
    next(err);
  }
}

// ─── MCP API Key auth (for AI agents) ────────────────────────────────
const bcrypt = require("bcryptjs");

async function requireMcpKey(req, res, next) {
  try {
    const key = req.headers["x-mcp-api-key"] || req.query.api_key;
    if (!key) return res.status(401).json({ error: "MCP API key required" });

    // Find all active keys and compare (keys are hashed)
    const allKeys = await prisma.mcpApiKey.findMany({
      where: { revokedAt: null },
      include: { user: { select: { id: true, email: true, plan: true, timezone: true } } },
    });

    let matchedKey = null;
    for (const k of allKeys) {
      if (await bcrypt.compare(key, k.keyHash)) {
        matchedKey = k;
        break;
      }
    }

    if (!matchedKey) return res.status(401).json({ error: "Invalid MCP API key" });

    // Update last used
    await prisma.mcpApiKey.update({
      where: { id: matchedKey.id },
      data: { lastUsedAt: new Date() },
    });

    req.user = matchedKey.user;
    req.mcpKey = matchedKey;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth, requireMcpKey };
