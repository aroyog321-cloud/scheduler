// src/routes/platforms.js
const router = require("express").Router();
const crypto = require("crypto");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const youtubeService = require("../services/youtube");
const instagramService = require("../services/instagram");
const logger = require("../logger");

// Temporary state store (use Redis in production for multi-instance)
const oauthStates = new Map();

// ─── GET /api/platforms ───────────────────────────────────────────────
// List connected accounts
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const accounts = await prisma.platformAccount.findMany({
      where: { userId: req.user.id, isActive: true },
      select: {
        id: true, platform: true, platformUserId: true,
        platformUsername: true, scopes: true, connectedAt: true,
        tokenExpiresAt: true,
      },
      orderBy: { connectedAt: "asc" },
    });
    res.json({ accounts });
  } catch (err) { next(err); }
});

// ─── DELETE /api/platforms/:id ────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.platformAccount.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { isActive: false },
    });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─────────────────────────────────────────────────────────────────────
//  YOUTUBE
// ─────────────────────────────────────────────────────────────────────

// GET /api/platforms/youtube/connect  →  redirect to Google consent
router.get("/youtube/connect", requireAuth, (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, { userId: req.user.id, expires: Date.now() + 10 * 60 * 1000 });

  if (!process.env.GOOGLE_CLIENT_ID) {
    logger.info("Using mock YouTube connection since GOOGLE_CLIENT_ID is empty");
    return res.json({ authUrl: `/api/platforms/youtube/mock-callback?state=${state}` });
  }

  const authUrl = youtubeService.getAuthUrl(state);
  res.json({ authUrl });
});

// GET /api/platforms/youtube/mock-callback (for dev testing without keys)
router.get("/youtube/mock-callback", async (req, res, next) => {
  try {
    const { state } = req.query;
    const stateData = oauthStates.get(state);
    if (!stateData) return res.redirect(`${process.env.FRONTEND_URL}/settings?error=invalid_state`);
    
    await prisma.platformAccount.upsert({
      where: { userId_platform_platformUserId: { userId: stateData.userId, platform: "YOUTUBE", platformUserId: "mock-channel-id" } },
      update: { isActive: true, platformUsername: "Mock YouTube Channel" },
      create: { userId: stateData.userId, platform: "YOUTUBE", platformUserId: "mock-channel-id", platformUsername: "Mock YouTube Channel", accessToken: "mock-token" },
    });
    res.redirect(`${process.env.FRONTEND_URL}/settings?connected=youtube`);
  } catch (err) { next(err); }
});

// GET /api/platforms/youtube/callback
router.get("/youtube/callback", async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) return res.redirect(`${process.env.FRONTEND_URL}/settings?error=youtube_denied`);

    const stateData = oauthStates.get(state);
    if (!stateData || Date.now() > stateData.expires) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings?error=invalid_state`);
    }
    oauthStates.delete(state);

    const { tokens, channelId, channelTitle } = await youtubeService.exchangeCode(code);

    // Upsert platform account
    await prisma.platformAccount.upsert({
      where: {
        userId_platform_platformUserId: {
          userId: stateData.userId,
          platform: "YOUTUBE",
          platformUserId: channelId,
        },
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        isActive: true,
        platformUsername: channelTitle,
        scopes: tokens.scope?.split(" ") || [],
      },
      create: {
        userId: stateData.userId,
        platform: "YOUTUBE",
        platformUserId: channelId,
        platformUsername: channelTitle,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
        scopes: tokens.scope?.split(" ") || [],
      },
    });

    logger.info(`YouTube connected: user=${stateData.userId} channel=${channelTitle}`);
    res.redirect(`${process.env.FRONTEND_URL}/settings?connected=youtube`);
  } catch (err) {
    logger.error("YouTube OAuth callback error:", err.message);
    res.redirect(`${process.env.FRONTEND_URL}/settings?error=youtube_failed`);
  }
});

// ─────────────────────────────────────────────────────────────────────
//  INSTAGRAM
// ─────────────────────────────────────────────────────────────────────

// GET /api/platforms/instagram/connect
router.get("/instagram/connect", requireAuth, (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  oauthStates.set(state, { userId: req.user.id, expires: Date.now() + 10 * 60 * 1000 });

  if (!process.env.META_APP_ID) {
    logger.info("Using mock Instagram connection since META_APP_ID is empty");
    return res.json({ authUrl: `/api/platforms/instagram/mock-callback?state=${state}` });
  }

  const authUrl = instagramService.getAuthUrl(state);
  res.json({ authUrl });
});

// GET /api/platforms/instagram/mock-callback (for dev testing without keys)
router.get("/instagram/mock-callback", async (req, res, next) => {
  try {
    const { state } = req.query;
    const stateData = oauthStates.get(state);
    if (!stateData) return res.redirect(`${process.env.FRONTEND_URL}/settings?error=invalid_state`);
    
    await prisma.platformAccount.upsert({
      where: { userId_platform_platformUserId: { userId: stateData.userId, platform: "INSTAGRAM", platformUserId: "mock-ig-id" } },
      update: { isActive: true, platformUsername: "Mock Instagram Account" },
      create: { userId: stateData.userId, platform: "INSTAGRAM", platformUserId: "mock-ig-id", platformUsername: "Mock Instagram Account", accessToken: "mock-token" },
    });
    res.redirect(`${process.env.FRONTEND_URL}/settings?connected=instagram`);
  } catch (err) { next(err); }
});

// GET /api/platforms/instagram/callback
router.get("/instagram/callback", async (req, res, next) => {
  try {
    const { code, state, error } = req.query;

    if (error) return res.redirect(`${process.env.FRONTEND_URL}/settings?error=instagram_denied`);

    const stateData = oauthStates.get(state);
    if (!stateData || Date.now() > stateData.expires) {
      return res.redirect(`${process.env.FRONTEND_URL}/settings?error=invalid_state`);
    }
    oauthStates.delete(state);

    const result = await instagramService.exchangeCode(code);

    await prisma.platformAccount.upsert({
      where: {
        userId_platform_platformUserId: {
          userId: stateData.userId,
          platform: "INSTAGRAM",
          platformUserId: result.igAccountId,
        },
      },
      update: {
        accessToken: result.accessToken,
        tokenExpiresAt: result.expiresAt,
        isActive: true,
        platformUsername: result.username,
        scopes: ["instagram_basic", "instagram_content_publish"],
      },
      create: {
        userId: stateData.userId,
        platform: "INSTAGRAM",
        platformUserId: result.igAccountId,
        platformUsername: result.username,
        accessToken: result.accessToken,
        tokenExpiresAt: result.expiresAt,
        scopes: ["instagram_basic", "instagram_content_publish"],
      },
    });

    logger.info(`Instagram connected: user=${stateData.userId} ig=@${result.username}`);
    res.redirect(`${process.env.FRONTEND_URL}/settings?connected=instagram`);
  } catch (err) {
    logger.error("Instagram OAuth callback error:", err.message);
    res.redirect(`${process.env.FRONTEND_URL}/settings?error=instagram_failed&msg=${encodeURIComponent(err.message)}`);
  }
});

module.exports = router;
