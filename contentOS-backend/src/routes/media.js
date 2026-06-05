// src/routes/media.js
const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const prisma = require("../db");
const { requireAuth } = require("../middleware/auth");
const { mediaUpload, UPLOAD_DIR } = require("../middleware/upload");
const { scheduleAiGenerateJob } = require("../queue");
const aiService = require("../services/ai");
const logger = require("../logger");

// ─── POST /api/media/upload ───────────────────────────────────────────
// Upload a video or image. Returns mediaFile record + triggers AI generation.
router.post(
  "/upload",
  requireAuth,
  mediaUpload.single("file"),
  async (req, res, next) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file provided" });

      const { file } = req;
      const storageUrl = file.path;  // local path; replace with R2 URL in production

      const mediaFile = await prisma.mediaFile.create({
        data: {
          userId: req.user.id,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          sizeBytes: BigInt(file.size),
          storageUrl,
        },
      });

      logger.info(`Media uploaded: ${file.originalname} (${(file.size / 1024 / 1024).toFixed(1)} MB) by user ${req.user.id}`);

      // Optionally auto-generate AI content in background
      const autoGenerate = req.query.ai !== "false";
      let aiJobId = null;
      if (autoGenerate && process.env.OPENAI_API_KEY) {
        aiJobId = await scheduleAiGenerateJob(mediaFile.id, req.user.id);
      }

      res.status(201).json({
        mediaFile: { ...mediaFile, sizeBytes: Number(mediaFile.sizeBytes) },
        aiJobId,
        message: aiJobId ? "File uploaded. AI content generation started." : "File uploaded.",
      });
    } catch (err) { next(err); }
  }
);

// ─── POST /api/media/:id/generate-ai ─────────────────────────────────
// Manually trigger AI content generation for an uploaded file
router.post("/:id/generate-ai", requireAuth, async (req, res, next) => {
  try {
    const mediaFile = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!mediaFile) return res.status(404).json({ error: "Media file not found" });

    const generated = await aiService.generateContentFromMedia(mediaFile);
    res.json({ generated });
  } catch (err) { next(err); }
});

// ─── GET /api/media ───────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const where = { userId: req.user.id };
    if (req.query.folder && req.query.folder !== "All") where.folder = req.query.folder;
    if (req.query.tag) where.tags = { has: req.query.tag };

    const [files, total] = await Promise.all([
      prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: { id: true, originalName: true, mimeType: true, sizeBytes: true, storageUrl: true, thumbnail: true, tags: true, folder: true, createdAt: true },
      }),
      prisma.mediaFile.count({ where }),
    ]);

    res.json({
      files: files.map((f) => ({ ...f, sizeBytes: Number(f.sizeBytes) })),
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

// ─── DELETE /api/media/:id ────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!file) return res.status(404).json({ error: "Media file not found" });

    // Delete from disk if local
    if (file.storageUrl && !file.storageUrl.startsWith("http")) {
      const filePath = path.isAbsolute(file.storageUrl)
        ? file.storageUrl
        : path.join(UPLOAD_DIR, path.basename(file.storageUrl));
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await prisma.mediaFile.delete({ where: { id: file.id } });
    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── PATCH /api/media/:id ─────────────────────────────────────────────
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const file = await prisma.mediaFile.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!file) return res.status(404).json({ error: "Media file not found" });

    const { originalName, folder, tags } = req.body;
    const data = {};
    if (originalName !== undefined) data.originalName = originalName;
    if (folder !== undefined) data.folder = folder;
    if (tags !== undefined) data.tags = tags;

    const updated = await prisma.mediaFile.update({
      where: { id: file.id },
      data,
    });
    
    res.json({ file: { ...updated, sizeBytes: Number(updated.sizeBytes) } });
  } catch (err) { next(err); }
});

// ─── Serve local upload files (dev only) ─────────────────────────────
if (process.env.NODE_ENV !== "production") {
  const express = require("express");
  router.use("/files", requireAuth, express.static(UPLOAD_DIR));
}

module.exports = router;
