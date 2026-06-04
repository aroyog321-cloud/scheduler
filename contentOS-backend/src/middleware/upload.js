// src/middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

// ─── Ensure upload dir exists ─────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ─── Storage engine ───────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

// ─── File filter ──────────────────────────────────────────────────────
const ALLOWED_VIDEO = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/webm", "video/mpeg"];
const ALLOWED_IMAGE = ["image/jpeg", "image/png", "image/gif", "image/webp"];

function fileFilter(_req, file, cb) {
  if ([...ALLOWED_VIDEO, ...ALLOWED_IMAGE].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}`));
  }
}

// ─── Multer instances ─────────────────────────────────────────────────
// 5 GB limit for video
const videoUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
});

// 50 MB limit for images
const imageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

// Generic (both)
const mediaUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 * 1024 },
});

module.exports = { videoUpload, imageUpload, mediaUpload, UPLOAD_DIR };
