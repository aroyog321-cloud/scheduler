// src/routes/schedules.js
const router = require("express").Router();
const { z } = require("zod");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { schedulePublishJob, cancelPublishJob } = require("../queue");
const aiService = require("../services/ai");
const logger = require("../logger");

const VALID_PLATFORMS = ["YOUTUBE", "INSTAGRAM", "TIKTOK", "LINKEDIN", "FACEBOOK", "TWITTER", "PINTEREST"];

// ─── POST /api/schedules/bulk ──────────────────────────────────────────
// Bulk schedule multiple posts at once (CSV / array upload)
router.post("/bulk", requireAuth, async (req, res, next) => {
  try {
    const schema = z.object({
      posts: z.array(z.object({
        title: z.string().min(1).max(100),
        caption: z.string().max(2200).optional(),
        description: z.string().max(5000).optional(),
        hashtags: z.array(z.string()).optional().default([]),
        platforms: z.array(z.enum(VALID_PLATFORMS)).min(1),
        scheduledAt: z.string().datetime(),
        mediaFileId: z.string().uuid().optional(),
        privacyStatus: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional().default("PUBLIC"),
      })).min(1).max(100),
    });

    const { posts } = schema.parse(req.body);

    // Validate all times are in the future
    const now = new Date();
    const invalidTimes = posts.filter(p => new Date(p.scheduledAt) <= now);
    if (invalidTimes.length > 0) {
      return res.status(400).json({
        error: `${invalidTimes.length} post(s) have scheduledAt in the past`,
        count: invalidTimes.length,
      });
    }

    // Validate all media files belong to user
    const mediaIds = posts.map(p => p.mediaFileId).filter(Boolean);
    if (mediaIds.length > 0) {
      const mediaFiles = await prisma.mediaFile.findMany({
        where: { id: { in: mediaIds }, userId: req.user.id },
        select: { id: true },
      });
      const validIds = new Set(mediaFiles.map(f => f.id));
      const invalidMedia = mediaIds.filter(id => !validIds.has(id));
      if (invalidMedia.length > 0) {
        return res.status(400).json({ error: "Some media files not found", invalidMedia });
      }
    }

    // Create all posts in a transaction
    const created = await prisma.$transaction(
      posts.map(p =>
        prisma.scheduledPost.create({
          data: {
            userId: req.user.id,
            title: p.title,
            caption: p.caption,
            description: p.description,
            hashtags: p.hashtags,
            platforms: p.platforms,
            scheduledAt: new Date(p.scheduledAt),
            privacyStatus: p.privacyStatus,
            mediaFileId: p.mediaFileId || null,
            status: "SCHEDULED",
          },
        })
      )
    );

    // Queue all jobs
    const jobResults = await Promise.allSettled(
      created.map(post => schedulePublishJob(post.id, post.scheduledAt))
    );

    // Update jobIds
    await Promise.all(
      created.map((post, i) => {
        const jobResult = jobResults[i];
        if (jobResult.status === "fulfilled") {
          return prisma.scheduledPost.update({
            where: { id: post.id },
            data: { jobId: jobResult.value },
          });
        }
      })
    );

    logger.info(`Bulk scheduled ${created.length} posts for user ${req.user.id}`);
    res.status(201).json({
      created: created.length,
      posts: created.map(p => ({ id: p.id, title: p.title, scheduledAt: p.scheduledAt, platforms: p.platforms })),
    });
  } catch (err) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── PATCH /api/schedules/:id/reschedule ──────────────────────────────
// Drag-and-drop reschedule: change time of a single post
router.patch("/:id/reschedule", requireAuth, async (req, res, next) => {
  try {
    const { scheduledAt } = z.object({
      scheduledAt: z.string().datetime(),
    }).parse(req.body);

    const newTime = new Date(scheduledAt);
    if (newTime <= new Date()) {
      return res.status(400).json({ error: "scheduledAt must be in the future" });
    }

    const post = await prisma.scheduledPost.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });
    if (!["DRAFT", "SCHEDULED"].includes(post.status)) {
      return res.status(400).json({ error: `Cannot reschedule a post with status: ${post.status}` });
    }

    // Cancel existing job, create new one
    if (post.jobId) await cancelPublishJob(post.jobId);
    const newJobId = await schedulePublishJob(post.id, newTime);

    const updated = await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { scheduledAt: newTime, jobId: newJobId, status: "SCHEDULED" },
    });

    logger.info(`Post ${post.id} rescheduled to ${newTime.toISOString()}`);
    res.json({ post: updated });
  } catch (err) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── PATCH /api/schedules/:id/cancel ──────────────────────────────────
router.patch("/:id/cancel", requireAuth, async (req, res, next) => {
  try {
    const post = await prisma.scheduledPost.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!post) return res.status(404).json({ error: "Post not found" });

    if (post.jobId) await cancelPublishJob(post.jobId);

    const updated = await prisma.scheduledPost.update({
      where: { id: post.id },
      data: { status: "CANCELLED" },
    });
    res.json({ post: updated });
  } catch (err) { next(err); }
});

// ─── POST /api/schedules/ai-generate ──────────────────────────────────
// Generate full post content from a topic using AI, return draft ready to schedule
router.post("/ai-generate", requireAuth, async (req, res, next) => {
  try {
    const { topic, tone, platforms } = z.object({
      topic: z.string().min(3).max(200),
      tone: z.string().optional().default("engaging"),
      platforms: z.array(z.enum(VALID_PLATFORMS)).optional().default(["YOUTUBE", "INSTAGRAM"]),
    }).parse(req.body);

    const generated = await aiService.generateContent({ topic, tone, platforms });
    res.json({ generated });
  } catch (err) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── POST /api/schedules/ai-caption ───────────────────────────────────
// Rewrite or generate captions
router.post("/ai-caption", requireAuth, async (req, res, next) => {
  try {
    const { caption, style, topic, platform, count } = z.object({
      caption: z.string().optional(),
      style: z.string().optional(),
      topic: z.string().optional(),
      platform: z.enum(VALID_PLATFORMS).optional().default("INSTAGRAM"),
      count: z.number().int().min(1).max(5).optional().default(3),
    }).parse(req.body);

    if (caption && style) {
      const result = await aiService.rewriteCaption({ caption, style });
      return res.json(result);
    }
    if (topic) {
      const result = await aiService.generateCaptionVariants({ topic, platform, count });
      return res.json(result);
    }
    return res.status(400).json({ error: "Provide either caption+style or topic" });
  } catch (err) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── POST /api/schedules/ai-hashtags ──────────────────────────────────
router.post("/ai-hashtags", requireAuth, async (req, res, next) => {
  try {
    const { topic, platform, count } = z.object({
      topic: z.string().min(2).max(200),
      platform: z.enum(VALID_PLATFORMS).optional().default("INSTAGRAM"),
      count: z.number().int().min(5).max(30).optional().default(15),
    }).parse(req.body);

    const result = await aiService.generateHashtags({ topic, platform, count });
    res.json(result);
  } catch (err) {
    if (err.name === "ZodError") return res.status(400).json({ error: err.errors });
    next(err);
  }
});

// ─── GET /api/schedules/best-times ────────────────────────────────────
router.get("/best-times", requireAuth, async (req, res) => {
  const { platform } = req.query;
  const result = aiService.suggestPostingTimes(
    (platform || "INSTAGRAM").toUpperCase(),
    req.user.timezone
  );
  res.json(result);
});

// ─── GET /api/schedules/queue-status ─────────────────────────────────
// Show BullMQ queue health
router.get("/queue-status", requireAuth, async (req, res, next) => {
  try {
    const { getQueue, QUEUE_NAMES } = require("../queue");
    const queue = getQueue(QUEUE_NAMES.PUBLISH);

    const [waiting, active, completed, failed, delayed] = await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
    ]);

    res.json({
      queue: QUEUE_NAMES.PUBLISH,
      counts: { waiting, active, completed, failed, delayed },
    });
  } catch (err) { next(err); }
});

module.exports = router;
