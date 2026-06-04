// src/routes/posts.js
const router = require("express").Router();
const { z } = require("zod");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { schedulePublishJob, cancelPublishJob } = require("../queue");
const logger = require("../logger");

const VALID_PLATFORMS = ["YOUTUBE", "INSTAGRAM", "TIKTOK", "LINKEDIN", "FACEBOOK", "TWITTER", "PINTEREST"];

const CreatePostSchema = z.object({
  title: z.string().min(1).max(100),
  caption: z.string().max(2200).optional(),
  description: z.string().max(5000).optional(),
  hashtags: z.array(z.string()).max(30).optional().default([]),
  platforms: z.array(z.enum(VALID_PLATFORMS)).min(1),
  scheduledAt: z.string().datetime(),
  mediaFileId: z.string().uuid().optional(),
  privacyStatus: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional().default("PUBLIC"),
});

// ─── POST /api/posts ──────────────────────────────────────────────────
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const data = CreatePostSchema.parse(req.body);

    // Validate scheduled time is in the future
    const scheduledAt = new Date(data.scheduledAt);
    if (scheduledAt <= new Date()) {
      return res.status(400).json({ error: "scheduledAt must be in the future" });
    }

    // Validate media file belongs to user
    if (data.mediaFileId) {
      const media = await prisma.mediaFile.findFirst({
        where: { id: data.mediaFileId, userId: req.user.id },
      });
      if (!media) return res.status(404).json({ error: "Media file not found" });
    }

    // Validate user has connected accounts for requested platforms
    const connectedAccounts = await prisma.platformAccount.findMany({
      where: { userId: req.user.id, isActive: true, platform: { in: data.platforms } },
      select: { platform: true },
    });
    const connectedPlatforms = connectedAccounts.map((a) => a.platform);
    const missingPlatforms = data.platforms.filter((p) => !connectedPlatforms.includes(p));
    if (missingPlatforms.length > 0) {
      return res.status(400).json({
        error: `Not connected to: ${missingPlatforms.join(", ")}`,
        missingPlatforms,
      });
    }

    // Create post record
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
      },
    });

    // Queue the BullMQ job
    const jobId = await schedulePublishJob(post.id, scheduledAt);
    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { jobId },
    });

    logger.info(`Post scheduled: ${post.id} at ${scheduledAt.toISOString()} → [${data.platforms.join(", ")}]`);
    res.status(201).json({ post: { ...post, jobId } });
  } catch (err) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── GET /api/posts ───────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { status, platform, from, to, page = "1", limit = "20" } = req.query;

    const where = {
      userId: req.user.id,
      ...(status && { status }),
      ...(platform && { platforms: { has: platform } }),
      ...(from || to) && {
        scheduledAt: {
          ...(from && { gte: new Date(from) }),
          ...(to && { lte: new Date(to) }),
        },
      },
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    const [posts, total] = await Promise.all([
      prisma.scheduledPost.findMany({
        where,
        orderBy: { scheduledAt: "asc" },
        skip,
        take,
        include: {
          mediaFile: { select: { id: true, originalName: true, mimeType: true, thumbnail: true } },
          platformResults: true,
        },
      }),
      prisma.scheduledPost.count({ where }),
    ]);

    res.json({ posts, pagination: { page: parseInt(page), limit: take, total, pages: Math.ceil(total / take) } });
  } catch (err) { next(err); }
});

// ─── GET /api/posts/calendar ──────────────────────────────────────────
// Returns posts grouped for calendar view
router.get("/calendar", requireAuth, async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const y = parseInt(year) || new Date().getFullYear();
    const m = parseInt(month) || new Date().getMonth() + 1;

    const from = new Date(y, m - 1, 1);
    const to = new Date(y, m, 0, 23, 59, 59);

    const posts = await prisma.scheduledPost.findMany({
      where: { userId: req.user.id, scheduledAt: { gte: from, lte: to } },
      orderBy: { scheduledAt: "asc" },
      select: {
        id: true, title: true, platforms: true, status: true,
        scheduledAt: true, privacyStatus: true,
        mediaFile: { select: { mimeType: true, thumbnail: true } },
      },
    });

    res.json({ posts });
  } catch (err) { next(err); }
});

// ─── GET /api/posts/:id ───────────────────────────────────────────────
router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const post = await prisma.scheduledPost.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { mediaFile: true, platformResults: true },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    res.json({ post });
  } catch (err) { next(err); }
});

// ─── PUT /api/posts/:id ───────────────────────────────────────────────
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const post = await prisma.scheduledPost.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (!["DRAFT", "SCHEDULED"].includes(post.status)) {
      return res.status(400).json({ error: `Cannot edit a post with status: ${post.status}` });
    }

    const data = z.object({
      title: z.string().min(1).max(100).optional(),
      caption: z.string().max(2200).optional(),
      description: z.string().max(5000).optional(),
      hashtags: z.array(z.string()).optional(),
      platforms: z.array(z.enum(VALID_PLATFORMS)).optional(),
      scheduledAt: z.string().datetime().optional(),
      privacyStatus: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
    }).parse(req.body);

    // Re-schedule BullMQ job if time changed
    if (data.scheduledAt) {
      const newTime = new Date(data.scheduledAt);
      if (newTime <= new Date()) return res.status(400).json({ error: "scheduledAt must be in the future" });

      if (post.jobId) await cancelPublishJob(post.jobId);
      const jobId = await schedulePublishJob(post.id, newTime);
      data.jobId = jobId;
    }

    const updated = await prisma.scheduledPost.update({
      where: { id: post.id },
      data,
    });

    res.json({ post: updated });
  } catch (err) { next(err); }
});

// ─── DELETE /api/posts/:id ────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const post = await prisma.scheduledPost.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.jobId) await cancelPublishJob(post.jobId);

    await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { status: "CANCELLED" },
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

module.exports = router;
