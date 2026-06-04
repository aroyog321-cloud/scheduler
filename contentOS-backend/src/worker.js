// src/worker.js  –  Run this as a separate process: `node src/worker.js`
require("dotenv").config();

const { Worker } = require("bullmq");
const prisma = require("./db");
const logger = require("./logger");
const { connectRedis, getRedis, QUEUE_NAMES } = require("./queue");
const youtubeService = require("./services/youtube");
const instagramService = require("./services/instagram");
const aiService = require("./services/ai");
const { UPLOAD_DIR } = require("./middleware/upload");
const path = require("path");
const fs = require("fs");

// ─── Main ─────────────────────────────────────────────────────────────
async function main() {
  await connectRedis();
  startPublishWorker();
  startAiGenerateWorker();
  logger.info("ContentOS Workers started");
}

// ─────────────────────────────────────────────────────────────────────
//  PUBLISH WORKER
// ─────────────────────────────────────────────────────────────────────
function startPublishWorker() {
  const worker = new Worker(
    QUEUE_NAMES.PUBLISH,
    async (job) => {
      const { postId } = job.data;
      logger.info(`[PublishWorker] Processing post ${postId}`);

      // 1. Fetch post with media and platform accounts
      const post = await prisma.scheduledPost.findUnique({
        where: { id: postId },
        include: {
          mediaFile: true,
          user: {
            include: {
              platformAccounts: {
                where: { isActive: true },
              },
            },
          },
        },
      });

      if (!post) {
        logger.warn(`[PublishWorker] Post ${postId} not found — skipping`);
        return;
      }

      if (post.status === "CANCELLED" || post.status === "PUBLISHED") {
        logger.info(`[PublishWorker] Post ${postId} is ${post.status} — skipping`);
        return;
      }

      // 2. Mark as PUBLISHING
      await prisma.scheduledPost.update({
        where: { id: postId },
        data: { status: "PUBLISHING" },
      });

      const results = [];
      let anySuccess = false;
      let anyFailure = false;

      // 3. Publish to each requested platform
      for (const platform of post.platforms) {
        const account = post.user.platformAccounts.find((a) => a.platform === platform);
        if (!account) {
          logger.warn(`[PublishWorker] No ${platform} account for user ${post.userId} — skipping`);
          results.push({ platform, status: "FAILED", error: `No ${platform} account connected` });
          anyFailure = true;
          continue;
        }

        try {
          const result = await publishToplatform({ platform, account, post });
          results.push({ platform, status: "PUBLISHED", ...result });
          anySuccess = true;

          await prisma.postPlatformResult.create({
            data: {
              scheduledPostId: postId,
              platformAccountId: account.id,
              platform,
              status: "PUBLISHED",
              platformPostId: result.postId,
              platformUrl: result.postUrl,
              publishedAt: new Date(),
            },
          });
        } catch (err) {
          logger.error(`[PublishWorker] Failed to publish to ${platform}:`, err.message);
          results.push({ platform, status: "FAILED", error: err.message });
          anyFailure = true;

          await prisma.postPlatformResult.create({
            data: {
              scheduledPostId: postId,
              platformAccountId: account.id,
              platform,
              status: "FAILED",
              errorMessage: err.message,
            },
          });
        }
      }

      // 4. Update post status
      const finalStatus = anySuccess ? "PUBLISHED" : "FAILED";
      await prisma.scheduledPost.update({
        where: { id: postId },
        data: {
          status: finalStatus,
          publishedAt: anySuccess ? new Date() : null,
          failureReason: anyFailure && !anySuccess ? "All platforms failed" : null,
        },
      });

      // 5. Clean up temp file (only if we uploaded to all platforms)
      if (!anyFailure && post.mediaFile) {
        const filePath = resolveFilePath(post.mediaFile.storageUrl);
        if (filePath && fs.existsSync(filePath)) {
          fs.unlink(filePath, (err) => {
            if (err) logger.warn(`Could not delete temp file: ${filePath}`);
            else logger.info(`Temp file deleted: ${filePath}`);
          });
        }
      }

      logger.info(`[PublishWorker] Post ${postId} completed. Status: ${finalStatus}`);
      return results;
    },
    {
      connection: getRedis(),
      concurrency: 3,   // Process up to 3 posts simultaneously
    }
  );

  worker.on("completed", (job, result) => {
    logger.info(`[PublishWorker] Job ${job.id} completed`);
  });
  worker.on("failed", (job, err) => {
    logger.error(`[PublishWorker] Job ${job?.id} failed: ${err.message}`);
  });
  worker.on("error", (err) => logger.error("[PublishWorker] Worker error:", err));
}

// ─────────────────────────────────────────────────────────────────────
//  AI GENERATE WORKER
// ─────────────────────────────────────────────────────────────────────
function startAiGenerateWorker() {
  const worker = new Worker(
    QUEUE_NAMES.AI_GENERATE,
    async (job) => {
      const { mediaFileId, userId } = job.data;
      logger.info(`[AiWorker] Generating content for media ${mediaFileId}`);

      const mediaFile = await prisma.mediaFile.findUnique({ where: { id: mediaFileId } });
      if (!mediaFile) return;

      const generated = await aiService.generateContentFromMedia(mediaFile);
      logger.info(`[AiWorker] Generated content for media ${mediaFileId}`);
      return generated;
    },
    { connection: getRedis(), concurrency: 2 }
  );

  worker.on("failed", (job, err) => {
    logger.error(`[AiWorker] Job ${job?.id} failed: ${err.message}`);
  });
}

// ─────────────────────────────────────────────────────────────────────
//  Platform dispatch
// ─────────────────────────────────────────────────────────────────────
async function publishToplatform({ platform, account, post }) {
  const filePath = post.mediaFile ? resolveFilePath(post.mediaFile.storageUrl) : null;
  const isVideo = post.mediaFile?.mimeType?.startsWith("video/");
  const isImage = post.mediaFile?.mimeType?.startsWith("image/");

  switch (platform) {
    case "YOUTUBE": {
      if (!filePath) throw new Error("YouTube post requires a video file");
      const { videoId, videoUrl } = await youtubeService.uploadVideo({
        platformAccountId: account.id,
        filePath,
        title: post.title,
        description: post.description || post.caption || "",
        tags: post.hashtags || [],
        privacyStatus: post.privacyStatus.toLowerCase(),
        publishAt: null,  // We publish immediately when job fires
        onProgress: (bytes, total) => {
          const pct = Math.round((bytes / total) * 100);
          logger.debug(`YouTube upload ${pct}%`);
        },
      });
      return { postId: videoId, postUrl: videoUrl };
    }

    case "INSTAGRAM": {
      if (!post.mediaFile) throw new Error("Instagram post requires media");

      // For Instagram we need a publicly accessible URL.
      // In production use your R2/S3 URL. In local dev, serve via /uploads static route.
      const publicUrl = buildPublicUrl(post.mediaFile.storageUrl);

      if (isVideo) {
        return await instagramService.publishVideo({
          platformAccountId: account.id,
          videoUrl: publicUrl,
          caption: buildCaption(post.caption, post.hashtags),
        });
      } else if (isImage) {
        return await instagramService.publishPhoto({
          platformAccountId: account.id,
          imageUrl: publicUrl,
          caption: buildCaption(post.caption, post.hashtags),
        });
      }
      throw new Error("Unsupported Instagram media type");
    }

    default:
      throw new Error(`Platform ${platform} is not yet implemented`);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────
function resolveFilePath(storageUrl) {
  if (!storageUrl) return null;
  if (storageUrl.startsWith("http")) return null; // Remote URL, no local path
  if (path.isAbsolute(storageUrl)) return storageUrl;
  return path.join(UPLOAD_DIR, path.basename(storageUrl));
}

function buildPublicUrl(storageUrl) {
  if (storageUrl?.startsWith("http")) return storageUrl;
  const filename = path.basename(storageUrl || "");
  return `${process.env.APP_URL}/uploads/${filename}`;
}

function buildCaption(caption = "", hashtags = []) {
  const tags = hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ");
  return tags ? `${caption}\n\n${tags}` : caption;
}

main().catch((err) => {
  logger.error("Worker startup failed:", err);
  process.exit(1);
});
