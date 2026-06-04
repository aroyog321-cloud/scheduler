// src/routes/mcp.js
// ─────────────────────────────────────────────────────────────────────
//  ContentOS MCP Server  –  REST endpoints that AI agents can call
//
//  Auth: pass "x-mcp-api-key: YOUR_KEY" header
//  All responses are JSON with a consistent { ok, result, error } shape.
//
//  Available tools:
//    Content     upload_content, delete_content, list_content
//    Scheduling  create_post, schedule_post, reschedule_post, cancel_post,
//                list_posts, get_post
//    AI          generate_title, generate_caption, generate_hashtags,
//                generate_content, rewrite_caption
//    Analytics   get_overview, get_youtube_analytics, get_instagram_analytics
//    Account     list_platforms
//    Meta        list_tools (MCP manifest)
// ─────────────────────────────────────────────────────────────────────

const router = require("express").Router();
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const prisma = require("../db");
const { requireMcpKey } = require("../middleware/auth");
const { schedulePublishJob, cancelPublishJob } = require("../queue");
const aiService = require("../services/ai");
const youtubeService = require("../services/youtube");
const instagramService = require("../services/instagram");
const logger = require("../logger");

// Stricter rate limit for MCP endpoints
const mcpLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, error: "MCP rate limit exceeded (60 req/min)" },
});

router.use(mcpLimit);

// ─── Consistent response helper ───────────────────────────────────────
function ok(res, result) {
  res.json({ ok: true, result });
}
function fail(res, status, message) {
  res.status(status).json({ ok: false, error: message });
}

// ─────────────────────────────────────────────────────────────────────
//  META
// ─────────────────────────────────────────────────────────────────────

// GET /api/mcp/tools  —  MCP manifest listing all available tools
router.get("/tools", (_req, res) => {
  res.json({
    name: "contentOS",
    version: "1.0.0",
    description: "AI-native social media scheduling platform",
    tools: [
      // ── Scheduling ──
      {
        name: "create_post",
        description: "Create and schedule a social media post",
        inputSchema: {
          type: "object",
          required: ["title", "platforms", "scheduledAt"],
          properties: {
            title: { type: "string", description: "Post title (YouTube) or first line (others)", maxLength: 100 },
            caption: { type: "string", description: "Instagram/social caption", maxLength: 2200 },
            description: { type: "string", description: "YouTube long description", maxLength: 5000 },
            hashtags: { type: "array", items: { type: "string" }, description: "Hashtags without # symbol" },
            platforms: { type: "array", items: { type: "string", enum: ["YOUTUBE","INSTAGRAM","TIKTOK","LINKEDIN","FACEBOOK","TWITTER"] } },
            scheduledAt: { type: "string", format: "date-time", description: "ISO 8601 datetime" },
            mediaFileId: { type: "string", format: "uuid", description: "ID from upload_content" },
            privacyStatus: { type: "string", enum: ["PUBLIC","UNLISTED","PRIVATE"], default: "PUBLIC" },
          },
        },
      },
      {
        name: "schedule_post",
        description: "Set or change the scheduled time of an existing post",
        inputSchema: {
          type: "object",
          required: ["postId", "scheduledAt"],
          properties: {
            postId: { type: "string", format: "uuid" },
            scheduledAt: { type: "string", format: "date-time" },
          },
        },
      },
      {
        name: "reschedule_post",
        description: "Move a scheduled post to a new date/time",
        inputSchema: {
          type: "object",
          required: ["postId", "scheduledAt"],
          properties: {
            postId: { type: "string" },
            scheduledAt: { type: "string", format: "date-time" },
          },
        },
      },
      {
        name: "cancel_post",
        description: "Cancel a scheduled post",
        inputSchema: { type: "object", required: ["postId"], properties: { postId: { type: "string" } } },
      },
      {
        name: "list_posts",
        description: "List scheduled and published posts",
        inputSchema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["DRAFT","SCHEDULED","PUBLISHED","FAILED","CANCELLED"] },
            platform: { type: "string" },
            from: { type: "string", format: "date" },
            to: { type: "string", format: "date" },
            limit: { type: "integer", default: 10, maximum: 50 },
          },
        },
      },
      {
        name: "get_post",
        description: "Get details of a specific post",
        inputSchema: { type: "object", required: ["postId"], properties: { postId: { type: "string" } } },
      },
      // ── AI ──
      {
        name: "generate_title",
        description: "Generate an optimized YouTube/social title for a topic",
        inputSchema: { type: "object", required: ["topic"], properties: { topic: { type: "string" }, tone: { type: "string" } } },
      },
      {
        name: "generate_caption",
        description: "Generate an Instagram/social caption for a topic or post",
        inputSchema: {
          type: "object",
          required: ["topic"],
          properties: {
            topic: { type: "string" },
            platform: { type: "string", enum: ["INSTAGRAM","YOUTUBE","TIKTOK","LINKEDIN"] },
            count: { type: "integer", default: 1 },
          },
        },
      },
      {
        name: "generate_hashtags",
        description: "Generate relevant hashtags for a topic",
        inputSchema: {
          type: "object",
          required: ["topic"],
          properties: {
            topic: { type: "string" },
            platform: { type: "string" },
            count: { type: "integer", default: 15 },
          },
        },
      },
      {
        name: "generate_content",
        description: "Generate complete post content (title, caption, hashtags, description) from a topic",
        inputSchema: {
          type: "object",
          required: ["topic"],
          properties: {
            topic: { type: "string" },
            tone: { type: "string", default: "engaging" },
            platforms: { type: "array", items: { type: "string" } },
          },
        },
      },
      {
        name: "rewrite_caption",
        description: "Rewrite an existing caption in a different style",
        inputSchema: {
          type: "object",
          required: ["caption"],
          properties: {
            caption: { type: "string" },
            style: { type: "string", enum: ["shorter","longer","formal","casual","question"], default: "shorter" },
          },
        },
      },
      // ── Analytics ──
      {
        name: "get_analytics",
        description: "Get analytics overview for the user's account",
        inputSchema: {
          type: "object",
          properties: {
            platform: { type: "string", enum: ["YOUTUBE","INSTAGRAM","overview"] },
            startDate: { type: "string", format: "date" },
            endDate: { type: "string", format: "date" },
          },
        },
      },
      // ── Account ──
      {
        name: "list_platforms",
        description: "List connected social media platforms",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  });
});

// ─────────────────────────────────────────────────────────────────────
//  All protected tool routes below require MCP key auth
// ─────────────────────────────────────────────────────────────────────
router.use(requireMcpKey);

// ─── POST /api/mcp/create_post ────────────────────────────────────────
router.post("/create_post", async (req, res, next) => {
  try {
    const data = z.object({
      title: z.string().min(1).max(100),
      caption: z.string().max(2200).optional(),
      description: z.string().max(5000).optional(),
      hashtags: z.array(z.string()).optional().default([]),
      platforms: z.array(z.string()).min(1),
      scheduledAt: z.string().datetime(),
      mediaFileId: z.string().uuid().optional(),
      privacyStatus: z.enum(["PUBLIC","UNLISTED","PRIVATE"]).optional().default("PUBLIC"),
    }).parse(req.body);

    const scheduledAt = new Date(data.scheduledAt);
    if (scheduledAt <= new Date()) return fail(res, 400, "scheduledAt must be in the future");

    const post = await prisma.scheduledPost.create({
      data: {
        userId: req.user.id,
        title: data.title,
        caption: data.caption,
        description: data.description,
        hashtags: data.hashtags,
        platforms: data.platforms,
        scheduledAt,
        privacyStatus: data.privacyStatus,
        mediaFileId: data.mediaFileId || null,
        status: "SCHEDULED",
        aiGenerated: true,
      },
    });

    const jobId = await schedulePublishJob(post.id, scheduledAt);
    await prisma.scheduledPost.update({ where: { id: post.id }, data: { jobId } });

    logger.info(`[MCP] create_post: ${post.id} by agent for user ${req.user.id}`);
    ok(res, { postId: post.id, title: post.title, scheduledAt: post.scheduledAt, platforms: post.platforms });
  } catch (err) {
    if (err.name === "ZodError") return fail(res, 400, err.errors.map(e => e.message).join(", "));
    next(err);
  }
});

// ─── POST /api/mcp/schedule_post ──────────────────────────────────────
router.post("/schedule_post", async (req, res, next) => {
  try {
    const { postId, scheduledAt } = z.object({
      postId: z.string(),
      scheduledAt: z.string().datetime(),
    }).parse(req.body);

    const newTime = new Date(scheduledAt);
    if (newTime <= new Date()) return fail(res, 400, "scheduledAt must be in the future");

    const post = await prisma.scheduledPost.findFirst({ where: { id: postId, userId: req.user.id } });
    if (!post) return fail(res, 404, "Post not found");

    if (post.jobId) await cancelPublishJob(post.jobId);
    const newJobId = await schedulePublishJob(post.id, newTime);

    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { scheduledAt: newTime, jobId: newJobId, status: "SCHEDULED" },
    });

    ok(res, { postId: post.id, scheduledAt: newTime });
  } catch (err) {
    if (err.name === "ZodError") return fail(res, 400, err.errors.map(e => e.message).join(", "));
    next(err);
  }
});

// ─── POST /api/mcp/reschedule_post ────────────────────────────────────
router.post("/reschedule_post", async (req, res, next) => {
  try {
    const { postId, scheduledAt } = z.object({ postId: z.string(), scheduledAt: z.string().datetime() }).parse(req.body);
    const post = await prisma.scheduledPost.findFirst({ where: { id: postId, userId: req.user.id } });
    if (!post) return fail(res, 404, "Post not found");

    const newTime = new Date(scheduledAt);
    if (post.jobId) await cancelPublishJob(post.jobId);
    const newJobId = await schedulePublishJob(post.id, newTime);
    await prisma.scheduledPost.update({ where: { id: post.id }, data: { scheduledAt: newTime, jobId: newJobId } });

    ok(res, { postId, rescheduledTo: newTime });
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/cancel_post ────────────────────────────────────────
router.post("/cancel_post", async (req, res, next) => {
  try {
    const { postId } = z.object({ postId: z.string() }).parse(req.body);
    const post = await prisma.scheduledPost.findFirst({ where: { id: postId, userId: req.user.id } });
    if (!post) return fail(res, 404, "Post not found");

    if (post.jobId) await cancelPublishJob(post.jobId);
    await prisma.scheduledPost.update({ where: { id: post.id }, data: { status: "CANCELLED" } });
    ok(res, { postId, cancelled: true });
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/list_posts ─────────────────────────────────────────
router.post("/list_posts", async (req, res, next) => {
  try {
    const { status, platform, from, to, limit = 10 } = req.body;
    const posts = await prisma.scheduledPost.findMany({
      where: {
        userId: req.user.id,
        ...(status && { status }),
        ...(platform && { platforms: { has: platform } }),
        ...(from || to) && { scheduledAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } },
      },
      orderBy: { scheduledAt: "asc" },
      take: Math.min(limit, 50),
      select: { id: true, title: true, platforms: true, status: true, scheduledAt: true, publishedAt: true },
    });
    ok(res, { posts, count: posts.length });
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/get_post ───────────────────────────────────────────
router.post("/get_post", async (req, res, next) => {
  try {
    const { postId } = z.object({ postId: z.string() }).parse(req.body);
    const post = await prisma.scheduledPost.findFirst({
      where: { id: postId, userId: req.user.id },
      include: { mediaFile: true, platformResults: true },
    });
    if (!post) return fail(res, 404, "Post not found");
    ok(res, { post });
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/generate_title ────────────────────────────────────
router.post("/generate_title", async (req, res, next) => {
  try {
    const { topic, tone = "engaging" } = z.object({
      topic: z.string().min(2),
      tone: z.string().optional(),
    }).parse(req.body);

    const result = await aiService.generateContent({ topic, tone, platforms: ["YOUTUBE"] });
    ok(res, { title: result.title, contentIdeas: result.contentIdeas });
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/generate_caption ──────────────────────────────────
router.post("/generate_caption", async (req, res, next) => {
  try {
    const { topic, platform = "INSTAGRAM", count = 1 } = z.object({
      topic: z.string().min(2),
      platform: z.string().optional(),
      count: z.number().int().min(1).max(5).optional(),
    }).parse(req.body);

    if (count === 1) {
      const result = await aiService.generateContent({ topic, platforms: [platform] });
      ok(res, { caption: result.caption, hashtags: result.hashtags });
    } else {
      const result = await aiService.generateCaptionVariants({ topic, platform, count });
      ok(res, result);
    }
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/generate_hashtags ─────────────────────────────────
router.post("/generate_hashtags", async (req, res, next) => {
  try {
    const { topic, platform = "INSTAGRAM", count = 15 } = z.object({
      topic: z.string().min(2),
      platform: z.string().optional(),
      count: z.number().int().min(5).max(30).optional(),
    }).parse(req.body);

    const result = await aiService.generateHashtags({ topic, platform, count });
    ok(res, result);
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/generate_content ──────────────────────────────────
router.post("/generate_content", async (req, res, next) => {
  try {
    const { topic, tone, platforms } = z.object({
      topic: z.string().min(2),
      tone: z.string().optional().default("engaging"),
      platforms: z.array(z.string()).optional().default(["YOUTUBE", "INSTAGRAM"]),
    }).parse(req.body);

    const result = await aiService.generateContent({ topic, tone, platforms });
    ok(res, result);
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/rewrite_caption ────────────────────────────────────
router.post("/rewrite_caption", async (req, res, next) => {
  try {
    const { caption, style } = z.object({
      caption: z.string().min(1),
      style: z.enum(["shorter", "longer", "formal", "casual", "question"]).optional().default("shorter"),
    }).parse(req.body);

    const result = await aiService.rewriteCaption({ caption, style });
    ok(res, result);
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/get_analytics ──────────────────────────────────────
router.post("/get_analytics", async (req, res, next) => {
  try {
    const { platform = "overview", startDate, endDate } = req.body;
    const userId = req.user.id;

    if (platform === "overview" || !platform) {
      const [published, scheduled, failed] = await Promise.all([
        prisma.scheduledPost.count({ where: { userId, status: "PUBLISHED" } }),
        prisma.scheduledPost.count({ where: { userId, status: "SCHEDULED" } }),
        prisma.scheduledPost.count({ where: { userId, status: "FAILED" } }),
      ]);
      return ok(res, { platform: "overview", publishedPosts: published, scheduledPosts: scheduled, failedPosts: failed });
    }

    if (platform === "YOUTUBE") {
      const account = await prisma.platformAccount.findFirst({
        where: { userId, platform: "YOUTUBE", isActive: true },
      });
      if (!account) return fail(res, 404, "YouTube not connected");
      const data = await youtubeService.getChannelAnalytics(account.id, { startDate, endDate });
      return ok(res, { platform: "YOUTUBE", data });
    }

    if (platform === "INSTAGRAM") {
      const account = await prisma.platformAccount.findFirst({
        where: { userId, platform: "INSTAGRAM", isActive: true },
      });
      if (!account) return fail(res, 404, "Instagram not connected");
      const data = await instagramService.getAccountInsights(account.id);
      return ok(res, { platform: "INSTAGRAM", data });
    }

    fail(res, 400, `Unsupported platform for analytics: ${platform}`);
  } catch (err) { next(err); }
});

// ─── POST /api/mcp/list_platforms ────────────────────────────────────
router.post("/list_platforms", async (req, res, next) => {
  try {
    const accounts = await prisma.platformAccount.findMany({
      where: { userId: req.user.id, isActive: true },
      select: { id: true, platform: true, platformUsername: true, connectedAt: true, tokenExpiresAt: true },
    });
    ok(res, { platforms: accounts });
  } catch (err) { next(err); }
});

module.exports = router;
