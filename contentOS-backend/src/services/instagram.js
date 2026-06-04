// src/services/instagram.js
const axios = require("axios");
const prisma = require("../db");
const logger = require("../logger");

const GRAPH_BASE = "https://graph.facebook.com/v19.0";

const REQUIRED_SCOPES = [
  "instagram_basic",
  "instagram_content_publish",
  "pages_show_list",
  "pages_read_engagement",
].join(",");

// ─── Generate OAuth URL ───────────────────────────────────────────────
function getAuthUrl(state) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    redirect_uri: process.env.META_REDIRECT_URI,
    scope: REQUIRED_SCOPES,
    response_type: "code",
    state,
  });
  return `https://www.facebook.com/dialog/oauth?${params}`;
}

// ─── Exchange code for long-lived user token ──────────────────────────
async function exchangeCode(code) {
  // 1. Short-lived token
  const tokenRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
    params: {
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      redirect_uri: process.env.META_REDIRECT_URI,
      code,
    },
  });
  const shortToken = tokenRes.data.access_token;

  // 2. Exchange for long-lived token (~60 days)
  const longTokenRes = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
    params: {
      grant_type: "fb_exchange_token",
      client_id: process.env.META_APP_ID,
      client_secret: process.env.META_APP_SECRET,
      fb_exchange_token: shortToken,
    },
  });
  const longToken = longTokenRes.data.access_token;
  const expiresIn = longTokenRes.data.expires_in; // seconds

  // 3. Get Facebook Pages (user must have an IG Business Account connected to a Page)
  const pagesRes = await axios.get(`${GRAPH_BASE}/me/accounts`, {
    params: { access_token: longToken, fields: "id,name,access_token,instagram_business_account" },
  });

  const pages = pagesRes.data.data || [];
  const pageWithIg = pages.find((p) => p.instagram_business_account);
  if (!pageWithIg) {
    throw new Error(
      "No Instagram Business account found. Make sure your Instagram account is a Business/Creator account connected to a Facebook Page."
    );
  }

  const igAccountId = pageWithIg.instagram_business_account.id;
  const pageToken = pageWithIg.access_token;

  // 4. Get IG username
  const igRes = await axios.get(`${GRAPH_BASE}/${igAccountId}`, {
    params: { fields: "id,username,name", access_token: pageToken },
  });

  return {
    accessToken: longToken,
    pageAccessToken: pageToken,
    igAccountId,
    username: igRes.data.username,
    expiresAt: new Date(Date.now() + expiresIn * 1000),
  };
}

// ─── Refresh Instagram token ──────────────────────────────────────────
async function refreshToken(accessToken) {
  const res = await axios.get(`${GRAPH_BASE}/oauth/access_token`, {
    params: {
      grant_type: "ig_refresh_token",
      access_token: accessToken,
    },
  });
  return {
    accessToken: res.data.access_token,
    expiresAt: new Date(Date.now() + res.data.expires_in * 1000),
  };
}

// ─── Get fresh token for account ─────────────────────────────────────
async function getFreshToken(platformAccountId) {
  const account = await prisma.platformAccount.findUnique({
    where: { id: platformAccountId },
  });
  if (!account) throw new Error("Platform account not found");

  // Refresh if expiring within 7 days
  const expiresAt = account.tokenExpiresAt?.getTime() || 0;
  if (Date.now() > expiresAt - 7 * 24 * 60 * 60 * 1000) {
    logger.info(`Refreshing Instagram token for account ${platformAccountId}`);
    const refreshed = await refreshToken(account.accessToken);
    await prisma.platformAccount.update({
      where: { id: platformAccountId },
      data: { accessToken: refreshed.accessToken, tokenExpiresAt: refreshed.expiresAt },
    });
    return refreshed.accessToken;
  }
  return account.accessToken;
}

// ─── Publish photo to Instagram ───────────────────────────────────────
/**
 * Publish a photo to Instagram.
 *
 * @param {object} params
 * @param {string} params.platformAccountId - PlatformAccount.id
 * @param {string} params.imageUrl          - Publicly accessible URL of image
 * @param {string} params.caption
 * @returns {{ postId: string, postUrl: string }}
 */
async function publishPhoto({ platformAccountId, imageUrl, caption = "" }) {
  const account = await prisma.platformAccount.findUnique({
    where: { id: platformAccountId },
  });
  const accessToken = await getFreshToken(platformAccountId);
  const igUserId = account.platformUserId;

  logger.info(`Creating Instagram photo container for user ${igUserId}`);

  // Step 1: Create media container
  const containerRes = await axios.post(
    `${GRAPH_BASE}/${igUserId}/media`,
    null,
    {
      params: {
        image_url: imageUrl,
        caption: caption.slice(0, 2200),
        access_token: accessToken,
      },
    }
  );
  const creationId = containerRes.data.id;

  // Step 2: Wait for container to be ready
  await waitForContainerReady(igUserId, creationId, accessToken);

  // Step 3: Publish
  const publishRes = await axios.post(
    `${GRAPH_BASE}/${igUserId}/media_publish`,
    null,
    { params: { creation_id: creationId, access_token: accessToken } }
  );

  const postId = publishRes.data.id;
  logger.info(`Instagram photo published: post ID ${postId}`);
  return { postId, postUrl: `https://www.instagram.com/p/${postId}/` };
}

// ─── Publish video/reel to Instagram ─────────────────────────────────
/**
 * Publish a video (Reel) to Instagram.
 *
 * @param {object} params
 * @param {string} params.platformAccountId - PlatformAccount.id
 * @param {string} params.videoUrl          - Publicly accessible URL of video
 * @param {string} params.caption
 * @param {string} params.coverUrl          - Optional thumbnail URL
 * @returns {{ postId: string, postUrl: string }}
 */
async function publishVideo({ platformAccountId, videoUrl, caption = "", coverUrl = null }) {
  const account = await prisma.platformAccount.findUnique({
    where: { id: platformAccountId },
  });
  const accessToken = await getFreshToken(platformAccountId);
  const igUserId = account.platformUserId;

  logger.info(`Creating Instagram video container for user ${igUserId}`);

  // Step 1: Create Reel container
  const containerParams = {
    media_type: "REELS",
    video_url: videoUrl,
    caption: caption.slice(0, 2200),
    share_to_feed: "true",
    access_token: accessToken,
  };
  if (coverUrl) containerParams.cover_url = coverUrl;

  const containerRes = await axios.post(
    `${GRAPH_BASE}/${igUserId}/media`,
    null,
    { params: containerParams }
  );
  const creationId = containerRes.data.id;

  // Step 2: Poll until container is ready (video processing takes time)
  await waitForContainerReady(igUserId, creationId, accessToken, 30); // up to 5 min

  // Step 3: Publish
  const publishRes = await axios.post(
    `${GRAPH_BASE}/${igUserId}/media_publish`,
    null,
    { params: { creation_id: creationId, access_token: accessToken } }
  );

  const postId = publishRes.data.id;
  logger.info(`Instagram Reel published: post ID ${postId}`);
  return { postId, postUrl: `https://www.instagram.com/reel/${postId}/` };
}

// ─── Poll until container is ready ───────────────────────────────────
async function waitForContainerReady(igUserId, creationId, accessToken, maxAttempts = 10) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await sleep(10_000); // Wait 10 seconds between checks

    const statusRes = await axios.get(`${GRAPH_BASE}/${creationId}`, {
      params: {
        fields: "status_code,status",
        access_token: accessToken,
      },
    });

    const { status_code } = statusRes.data;
    logger.debug(`Container ${creationId} status: ${status_code} (attempt ${attempt + 1})`);

    if (status_code === "FINISHED") return;
    if (status_code === "ERROR") throw new Error(`Instagram container processing failed: ${JSON.stringify(statusRes.data)}`);
    if (status_code === "EXPIRED") throw new Error("Instagram container expired before publishing");
  }
  throw new Error(`Container not ready after ${maxAttempts} attempts`);
}

// ─── Get account insights ─────────────────────────────────────────────
async function getAccountInsights(platformAccountId, period = "day") {
  const account = await prisma.platformAccount.findUnique({
    where: { id: platformAccountId },
  });
  const accessToken = await getFreshToken(platformAccountId);
  const igUserId = account.platformUserId;

  const res = await axios.get(`${GRAPH_BASE}/${igUserId}/insights`, {
    params: {
      metric: "impressions,reach,profile_views,follower_count",
      period,
      access_token: accessToken,
    },
  });
  return res.data;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = {
  getAuthUrl,
  exchangeCode,
  publishPhoto,
  publishVideo,
  getAccountInsights,
};
