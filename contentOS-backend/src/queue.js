require("dotenv").config();
const { Queue } = require("bullmq");
const IORedis = require("ioredis");
const logger = require("./logger");

let redisConnection = null;

async function connectRedis() {
  const raw = process.env.REDIS_URL || "redis://localhost:6379";
  const redisUrl = raw.replace(/['"]/g, "").trim();
  const isTLS = redisUrl.startsWith("rediss://");

  return new Promise((resolve, reject) => {
    redisConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: true,
      tls: isTLS ? { rejectUnauthorized: false } : undefined,
      retryStrategy(times) {
        if (times > 3) return null;
        return Math.min(times * 500, 2000);
      },
    });

    redisConnection.on("connect", () => {
      logger.info("Redis connected");
      resolve(redisConnection);
    });

    redisConnection.on("error", (err) => {
      logger.error("Redis error: " + err.message);
    });

    redisConnection.connect().catch(reject);
  });
}

function getRedis() {
  if (!redisConnection) throw new Error("Redis not connected.");
  return redisConnection;
}

const QUEUE_NAMES = { PUBLISH: "publish-post", AI_GENERATE: "ai-generate" };
const queues = {};

function getQueue(name) {
  if (!queues[name]) {
    queues[name] = new Queue(name, {
      connection: getRedis(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 500 },
      },
    });
  }
  return queues[name];
}

async function schedulePublishJob(postId, runAt) {
  const queue = getQueue(QUEUE_NAMES.PUBLISH);
  const delay = Math.max(0, new Date(runAt).getTime() - Date.now());
  const job = await queue.add("publish", { postId }, { delay, jobId: "post-" + postId });
  logger.info("Publish job scheduled: post=" + postId);
  return job.id;
}

async function cancelPublishJob(jobId) {
  const queue = getQueue(QUEUE_NAMES.PUBLISH);
  const job = await queue.getJob(jobId);
  if (job) await job.remove();
}

async function scheduleAiGenerateJob(mediaFileId, userId) {
  const queue = getQueue(QUEUE_NAMES.AI_GENERATE);
  const job = await queue.add("generate", { mediaFileId, userId });
  return job.id;
}

module.exports = { connectRedis, getRedis, getQueue, schedulePublishJob, cancelPublishJob, scheduleAiGenerateJob, QUEUE_NAMES };
