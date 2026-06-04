// src/routes/auth.js
const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");

function signToken(userId) {
  return jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// ─── POST /api/auth/register ───────────────────────────────────────────
router.post("/register", async (req, res, next) => {
  try {
    const schema = z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().optional(),
    });
    const { email, password, name } = schema.parse(req.body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: "Email already registered" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
      select: { id: true, email: true, name: true, plan: true, createdAt: true },
    });

    res.status(201).json({ token: signToken(user.id), user });
  } catch (err) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = z.object({
      email: z.string().email(),
      password: z.string(),
    }).parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const safe = { id: user.id, email: user.email, name: user.name, plan: user.plan };
    res.json({ token: signToken(user.id), user: safe });
  } catch (err) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  res.json({ user: req.user });
});

// ─── PUT /api/auth/me ─────────────────────────────────────────────────
router.put("/me", requireAuth, async (req, res, next) => {
  try {
    const data = z.object({
      name: z.string().optional(),
      timezone: z.string().optional(),
    }).parse(req.body);

    const updated = await prisma.user.update({
      where: { id: req.user.id },
      data,
      select: { id: true, email: true, name: true, plan: true, timezone: true },
    });
    res.json({ user: updated });
  } catch (err) { next(err); }
});

// ─── POST /api/auth/mcp-key ───────────────────────────────────────────
// Generate an API key for AI agents
router.post("/mcp-key", requireAuth, async (req, res, next) => {
  try {
    const { label = "AI Agent", scopes = ["posts:read", "posts:write", "analytics:read"] } = req.body;

    const rawKey = `mcp_${require("crypto").randomBytes(32).toString("hex")}`;
    const keyHash = await bcrypt.hash(rawKey, 10);

    const key = await prisma.mcpApiKey.create({
      data: { userId: req.user.id, keyHash, label, scopes },
      select: { id: true, label: true, scopes: true, createdAt: true },
    });

    // Return raw key ONCE — not stored in plain text
    res.status(201).json({ ...key, key: rawKey, warning: "Store this key securely. It will not be shown again." });
  } catch (err) { next(err); }
});

// ─── GET /api/auth/mcp-keys ───────────────────────────────────────────
router.get("/mcp-keys", requireAuth, async (req, res, next) => {
  try {
    const keys = await prisma.mcpApiKey.findMany({
      where: { userId: req.user.id, revokedAt: null },
      select: { id: true, label: true, scopes: true, lastUsedAt: true, createdAt: true },
    });
    res.json({ keys });
  } catch (err) { next(err); }
});

// ─── DELETE /api/auth/mcp-key/:id ─────────────────────────────────────
router.delete("/mcp-key/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.mcpApiKey.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { revokedAt: new Date() },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
