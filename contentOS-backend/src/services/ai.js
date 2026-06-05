require("dotenv").config();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const logger = require("../logger");

// Models to try in order (fallback if one hits quota)
const MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-flash-latest",
];

async function askGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env");

  const genAI = new GoogleGenerativeAI(apiKey);

  for (const modelName of MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      logger.info(`Gemini OK using model: ${modelName}`);
      return text.replace(/```json|```/g, "").trim();
    } catch (err) {
      if (err.message.includes("429") || err.message.includes("quota")) {
        logger.warn(`Model ${modelName} quota exceeded, trying next...`);
        continue;
      }
      if (err.message.includes("404") || err.message.includes("not found")) {
        logger.warn(`Model ${modelName} not found, trying next...`);
        continue;
      }
      throw err;
    }
  }

  throw new Error("All Gemini models exhausted or quota exceeded. Try again in a few minutes.");
}

// ── Generate full post content ─────────────────────────────────────────
async function generateContent({
  topic,
  tone = "engaging",
  platforms = ["YOUTUBE", "INSTAGRAM"],
}) {
  const prompt = `You are a professional social media content strategist.
Generate content for a post about: "${topic}"
Tone: ${tone}
Platforms: ${platforms.join(", ")}

Reply ONLY with valid JSON. No explanation. No markdown fences. Just raw JSON:
{
  "title": "YouTube-optimized title under 100 characters",
  "caption": "Instagram caption under 200 characters",
  "description": "YouTube long description 150 words with call to action",
  "hashtags": ["ten", "relevant", "hashtags", "without", "hash", "symbol"],
  "suggestedTime": "09:00",
  "contentIdeas": ["follow-up idea 1", "follow-up idea 2", "follow-up idea 3"]
}`;

  const raw = await askGemini(prompt);

  try {
    return JSON.parse(raw);
  } catch {
    logger.error("Gemini JSON parse error. Raw response: " + raw);
    return {
      title: topic,
      caption: `Check out this content about ${topic}!`,
      description: `Discover everything about ${topic} in this post.`,
      hashtags: [
        topic.replace(/\s+/g, "").toLowerCase(),
        "content",
        "socialmedia",
        "viral",
        "trending",
      ],
      suggestedTime: "09:00",
      contentIdeas: [],
    };
  }
}

// ── Generate caption variants ──────────────────────────────────────────
async function generateCaptionVariants({ topic, platform, count = 3 }) {
  const prompt = `Generate ${count} different ${platform} captions for the topic: "${topic}".
Each should have a different style: professional, casual, motivational.

Reply ONLY with valid JSON. No markdown. No explanation:
{
  "variants": [
    { "style": "professional", "caption": "caption text here", "hashtags": ["tag1", "tag2"] },
    { "style": "casual", "caption": "caption text here", "hashtags": ["tag1", "tag2"] },
    { "style": "motivational", "caption": "caption text here", "hashtags": ["tag1", "tag2"] }
  ]
}`;

  const raw = await askGemini(prompt);
  try {
    return JSON.parse(raw);
  } catch {
    return { variants: [] };
  }
}

// ── Generate content from uploaded media file ──────────────────────────
async function generateContentFromMedia(mediaFile) {
  const topic = (mediaFile.originalName || "content")
    .replace(/\.[^.]+$/, "")
    .replace(/[-_]/g, " ");
  return await generateContent({
    topic,
    platforms: ["YOUTUBE", "INSTAGRAM"],
  });
}

// ── Generate tags from image ───────────────────────────────────────────
async function generateMediaTags(mediaFile) {
  if (!mediaFile.mimeType?.startsWith("image/")) return [];
  
  const filePath = mediaFile.storageUrl?.startsWith("http") ? null : mediaFile.storageUrl;
  if (!filePath || !fs.existsSync(filePath)) return [];

  const base64Data = fs.readFileSync(filePath).toString("base64");
  const prompt = `Analyze this image and provide exactly 3 to 5 highly relevant, single-word tags that describe its visual contents, mood, or subject matter. 
Reply ONLY with valid JSON. No markdown. No explanation:
{ "tags": ["nature", "laptop", "sunset"] }`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return [];
  
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: mediaFile.mimeType } }
    ]);
    const raw = result.response.text().replace(/```json|```/g, "").trim();
    return JSON.parse(raw).tags || [];
  } catch (err) {
    logger.error("Failed to generate media tags: " + err.message);
    return [];
  }
}

// ── Rewrite caption in different style ────────────────────────────────
async function rewriteCaption({ caption, style = "shorter" }) {
  const STYLES = {
    shorter: "Rewrite this caption to be shorter (max 100 chars) while keeping the message",
    longer: "Expand this caption with more detail and storytelling (max 400 chars)",
    formal: "Rewrite this caption in a professional formal tone",
    casual: "Rewrite this caption in a casual friendly Gen-Z tone",
    question: "Rewrite this caption ending with an engaging question to boost comments",
  };

  const instruction = STYLES[style] || `Rewrite this caption to be ${style}`;
  const prompt = `${instruction}:\n\n"${caption}"\n\nReply with ONLY the rewritten caption. No explanation. No quotes around it.`;

  const result = await askGemini(prompt);
  return { caption: result };
}

// ── Generate hashtags ──────────────────────────────────────────────────
async function generateHashtags({ topic, platform = "INSTAGRAM", count = 15 }) {
  const prompt = `Generate ${count} optimized ${platform} hashtags for the topic: "${topic}".
Mix high-volume broad hashtags and low-volume niche-specific hashtags.

Reply ONLY with valid JSON. No markdown. No explanation:
{ "hashtags": ["without", "hash", "symbol", "just", "words"] }`;

  const raw = await askGemini(prompt);
  try {
    return JSON.parse(raw);
  } catch {
    return { hashtags: [] };
  }
}

// ── Suggest best posting times ─────────────────────────────────────────
function suggestPostingTimes(platform, timezone = "UTC") {
  const defaults = {
    YOUTUBE:   ["08:00", "14:00", "18:00", "20:00"],
    INSTAGRAM: ["07:00", "11:00", "13:00", "17:00", "19:00"],
    TIKTOK:    ["07:00", "12:00", "19:00", "21:00"],
    LINKEDIN:  ["08:00", "10:00", "12:00", "17:00"],
    FACEBOOK:  ["09:00", "13:00", "15:00", "20:00"],
    TWITTER:   ["09:00", "12:00", "15:00", "18:00"],
  };
  return {
    platform,
    timezone,
    times: defaults[platform] || ["09:00", "12:00", "18:00"],
    note: "General best practices. Connect analytics for personalized suggestions.",
  };
}

module.exports = {
  generateContent,
  generateCaptionVariants,
  generateContentFromMedia,
  generateMediaTags,
  rewriteCaption,
  generateHashtags,
  suggestPostingTimes,
};