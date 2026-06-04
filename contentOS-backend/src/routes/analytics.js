// src/routes/analytics.js
const router = require("express").Router();
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const youtubeService = require("../services/youtube");
const instagramService = require("../services/instagram");
const logger = require("../logger");

// ─── GET /api/analytics/overview ──────────────────────────────────────
// Summary stats across all platforms
router.get("/overview", requireAuth, async (req, res, next) => {
  try {
    const userId = req.user.id;

    const [
      totalPosts,
      publishedPosts,
      scheduledPosts,
      failedPosts,
      platformBreakdown,
    ] = await Promise.all([
      prisma.scheduledPost.count({ where: { userId } }),
      prisma.scheduledPost.count({ where: { userId, status: "PUBLISHED" } }),
      prisma.scheduledPost.count({ where: { userId, status: "SCHEDULED" } }),
      prisma.scheduledPost.count({ where: { userId, status: "FAILED" } }),
      // Count posts per platform
      prisma.$queryRaw`
        SELECT unnest(platforms) as platform, COUNT(*) as count
        FROM scheduled_posts
        WHERE user_id = ${userId}::uuid AND status = 'PUBLISHED'
        GROUP BY platform
        ORDER BY count DESC
      `,
    ]);

    // Posts published in last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentPosts = await prisma.scheduledPost.count({
      where: { userId, status: "PUBLISHED", publishedAt: { gte: thirtyDaysAgo } },
    });

    res.json({
      overview: {
        totalPosts,
        publishedPosts,
        scheduledPosts,
        failedPosts,
        recentPosts,
        successRate: totalPosts > 0
          ? Math.round((publishedPosts / (publishedPosts + failedPosts || 1)) * 100)
          : 0,
      },
      platformBreakdown: platformBreakdown.map(row => ({
        platform: row.platform,
        count: Number(row.count),
      })),
    });
  } catch (err) { next(err); }
});

// ─── GET /api/analytics/youtube ───────────────────────────────────────
router.get("/youtube", requireAuth, async (req, res, next) => {
  try {
    const account = await prisma.platformAccount.findFirst({
      where: { userId: req.user.id, platform: "YOUTUBE", isActive: true },
    });
    if (!account) return res.status(404).json({ error: "YouTube account not connected" });

    const { startDate, endDate } = req.query;
    const data = await youtubeService.getChannelAnalytics(account.id, { startDate, endDate });
    res.json({ analytics: data });
  } catch (err) {
    logger.error("YouTube analytics error:", err.message);
    next(err);
  }
});

// ─── GET /api/analytics/youtube/video/:videoId ────────────────────────
router.get("/youtube/video/:videoId", requireAuth, async (req, res, next) => {
  try {
    const account = await prisma.platformAccount.findFirst({
      where: { userId: req.user.id, platform: "YOUTUBE", isActive: true },
    });
    if (!account) return res.status(404).json({ error: "YouTube account not connected" });

    const stats = await youtubeService.getVideoStats(account.id, req.params.videoId);
    res.json({ stats });
  } catch (err) { next(err); }
});

// ─── GET /api/analytics/instagram ─────────────────────────────────────
router.get("/instagram", requireAuth, async (req, res, next) => {
  try {
    const account = await prisma.platformAccount.findFirst({
      where: { userId: req.user.id, platform: "INSTAGRAM", isActive: true },
    });
    if (!account) return res.status(404).json({ error: "Instagram account not connected" });

    const { period = "day" } = req.query;
    const data = await instagramService.getAccountInsights(account.id, period);
    res.json({ analytics: data });
  } catch (err) {
    logger.error("Instagram analytics error:", err.message);
    next(err);
  }
});

// ─── GET /api/analytics/posts ─────────────────────────────────────────
// Posts performance summary from DB (platform result records)
router.get("/posts", requireAuth, async (req, res, next) => {
  try {
    const { from, to, platform } = req.query;

    const results = await prisma.postPlatformResult.findMany({
      where: {
        scheduledPost: { userId: req.user.id },
        status: "PUBLISHED",
        ...(platform && { platform }),
        ...(from || to) && {
          publishedAt: {
            ...(from && { gte: new Date(from) }),
            ...(to && { lte: new Date(to) }),
          },
        },
      },
      include: {
        scheduledPost: { select: { title: true, scheduledAt: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: 50,
    });

    res.json({ results });
  } catch (err) { next(err); }
});

// ─── GET /api/analytics/activity ──────────────────────────────────────
// Daily post counts for activity heatmap (last 90 days)
router.get("/activity", requireAuth, async (req, res, next) => {
  try {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

    const posts = await prisma.scheduledPost.findMany({
      where: {
        userId: req.user.id,
        status: "PUBLISHED",
        publishedAt: { gte: ninetyDaysAgo },
      },
      select: { publishedAt: true },
    });

    // Group by date
    const byDate = {};
    for (const p of posts) {
      const day = p.publishedAt.toISOString().split("T")[0];
      byDate[day] = (byDate[day] || 0) + 1;
    }

    res.json({ activity: byDate });
  } catch (err) { next(err); }
});

module.exports = router;
