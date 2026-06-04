// src/services/youtube.js
const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const prisma = require("../db");
const logger = require("../logger");

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/userinfo.email",
];

// ─── Build an OAuth2 client ───────────────────────────────────────────
function buildOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ─── Generate consent URL ─────────────────────────────────────────────
function getAuthUrl(state) {
  const client = buildOAuth2Client();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",  // Force refresh_token to be returned
    scope: SCOPES,
    state,
  });
}

// ─── Exchange code for tokens ─────────────────────────────────────────
async function exchangeCode(code) {
  const client = buildOAuth2Client();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);

  // Get channel info
  const youtube = google.youtube({ version: "v3", auth: client });
  const channelRes = await youtube.channels.list({
    part: ["snippet"],
    mine: true,
  });
  const channel = channelRes.data.items?.[0];
  if (!channel) throw new Error("No YouTube channel found for this account");

  return {
    tokens,
    channelId: channel.id,
    channelTitle: channel.snippet?.title,
  };
}

// ─── Get OAuth client with fresh tokens ───────────────────────────────
async function getAuthenticatedClient(platformAccountId) {
  const account = await prisma.platformAccount.findUnique({
    where: { id: platformAccountId },
  });
  if (!account) throw new Error("Platform account not found");

  const client = buildOAuth2Client();
  client.setCredentials({
    access_token: account.accessToken,
    refresh_token: account.refreshToken,
    expiry_date: account.tokenExpiresAt?.getTime(),
  });

  // Auto-refresh if expired or expiring soon (5 min buffer)
  const expiresAt = account.tokenExpiresAt?.getTime() || 0;
  if (Date.now() > expiresAt - 5 * 60 * 1000) {
    logger.info(`Refreshing YouTube token for account ${platformAccountId}`);
    const { credentials } = await client.refreshAccessToken();
    client.setCredentials(credentials);

    await prisma.platformAccount.update({
      where: { id: platformAccountId },
      data: {
        accessToken: credentials.access_token,
        tokenExpiresAt: credentials.expiry_date ? new Date(credentials.expiry_date) : null,
      },
    });
  }

  return client;
}

// ─── Upload video to YouTube ──────────────────────────────────────────
/**
 * Upload a video to YouTube.
 *
 * @param {object} params
 * @param {string} params.platformAccountId  - PlatformAccount.id
 * @param {string} params.filePath           - Absolute path to video file
 * @param {string} params.title
 * @param {string} params.description
 * @param {string[]} params.tags
 * @param {"public"|"unlisted"|"private"} params.privacyStatus
 * @param {Date|null} params.publishAt       - null = publish immediately
 * @param {function} [params.onProgress]     - Progress callback (bytesUploaded, totalBytes)
 * @returns {{ videoId: string, videoUrl: string }}
 */
async function uploadVideo({
  platformAccountId,
  filePath,
  title,
  description = "",
  tags = [],
  privacyStatus = "public",
  publishAt = null,
  onProgress = null,
}) {
  const auth = await getAuthenticatedClient(platformAccountId);
  const youtube = google.youtube({ version: "v3", auth });

  const fileSize = fs.statSync(filePath).size;

  const statusObj = {
    privacyStatus: publishAt ? "private" : privacyStatus, // Must be private for scheduled
    ...(publishAt && { publishAt: new Date(publishAt).toISOString() }),
    selfDeclaredMadeForKids: false,
  };

  logger.info(`Starting YouTube upload: "${title}" (${(fileSize / 1024 / 1024).toFixed(1)} MB)`);

  const response = await youtube.videos.insert(
    {
      part: ["snippet", "status"],
      requestBody: {
        snippet: {
          title: title.slice(0, 100),       // YouTube title max 100 chars
          description: description.slice(0, 5000),
          tags: tags.slice(0, 500),
          categoryId: "22",                  // People & Blogs (default)
          defaultLanguage: "en",
        },
        status: statusObj,
      },
      media: {
        mimeType: "video/*",
        body: fs.createReadStream(filePath),
      },
    },
    {
      onUploadProgress: (evt) => {
        if (onProgress) onProgress(evt.bytesRead, fileSize);
        const pct = Math.round((evt.bytesRead / fileSize) * 100);
        logger.debug(`YouTube upload progress: ${pct}%`);
      },
    }
  );

  const videoId = response.data.id;
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  logger.info(`YouTube upload complete: ${videoUrl}`);

  return { videoId, videoUrl };
}

// ─── Get channel analytics ────────────────────────────────────────────
async function getChannelAnalytics(platformAccountId, { startDate, endDate } = {}) {
  const auth = await getAuthenticatedClient(platformAccountId);
  const youtubeAnalytics = google.youtubeAnalytics({ version: "v2", auth });

  const end = endDate || new Date().toISOString().split("T")[0];
  const start = startDate || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const res = await youtubeAnalytics.reports.query({
    ids: "channel==MINE",
    startDate: start,
    endDate: end,
    metrics: "views,estimatedMinutesWatched,averageViewDuration,likes,dislikes,comments,subscribersGained",
    dimensions: "day",
    sort: "day",
  });

  return res.data;
}

// ─── Get video stats ──────────────────────────────────────────────────
async function getVideoStats(platformAccountId, videoId) {
  const auth = await getAuthenticatedClient(platformAccountId);
  const youtube = google.youtube({ version: "v3", auth });

  const res = await youtube.videos.list({
    part: ["statistics", "snippet", "status"],
    id: [videoId],
  });

  return res.data.items?.[0] || null;
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  uploadVideo,
  getChannelAnalytics,
  getVideoStats,
  getAuthenticatedClient,
};
