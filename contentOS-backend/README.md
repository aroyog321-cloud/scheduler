# ContentOS — Backend

AI-native social media scheduling API. Upload once, schedule everywhere, let AI agents manage your entire content pipeline through MCP.

---

## Architecture

```
contentOS-backend/
├── src/
│   ├── index.js          ← Express app + server startup
│   ├── worker.js         ← BullMQ workers (run separately)
│   ├── logger.js         ← Winston logger
│   ├── db.js             ← Prisma client singleton
│   ├── queue.js          ← BullMQ queue + Redis helpers
│   │
│   ├── routes/
│   │   ├── auth.js       ← Register, login, JWT, MCP API keys
│   │   ├── platforms.js  ← YouTube + Instagram OAuth connect/callback
│   │   ├── media.js      ← File upload (video/image)
│   │   ├── posts.js      ← Create/list/edit/delete scheduled posts
│   │   ├── schedules.js  ← Bulk schedule, reschedule, AI generate
│   │   ├── analytics.js  ← YouTube + Instagram + overview stats
│   │   └── mcp.js        ← All MCP tool endpoints for AI agents
│   │
│   ├── services/
│   │   ├── youtube.js    ← Google OAuth, video upload, analytics
│   │   ├── instagram.js  ← Meta OAuth, photo/reel publish, insights
│   │   └── ai.js         ← OpenAI title/caption/hashtag generation
│   │
│   └── middleware/
│       ├── auth.js       ← JWT + MCP API key middleware
│       └── upload.js     ← Multer config (5 GB video limit)
│
├── prisma/
│   └── schema.prisma     ← DB schema (User, PlatformAccount, ScheduledPost…)
├── docker-compose.yml    ← PostgreSQL + Redis + BullBoard
└── .env.example
```

---

## Quick Start

### 1. Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis) **or** a Supabase/Upstash account for free hosted versions

### 2. Clone & install

```bash
git clone https://github.com/you/contentos-backend
cd contentos-backend
npm install
```

### 3. Configure environment

```bash
cp .env.example .env
# Edit .env with your credentials (see section below)
```

### 4. Start infrastructure

```bash
# Local Docker (recommended for dev)
docker compose up -d

# Or use free hosted services:
# Postgres  → https://supabase.com  (free tier)
# Redis     → https://upstash.com   (free tier, use rediss:// URL)
```

### 5. Run database migrations

```bash
npm run db:generate   # generate Prisma client
npm run db:migrate    # run migrations (creates all tables)
```

### 6. Start API + Worker

```bash
# Terminal 1 – API server
npm run dev

# Terminal 2 – Background publish worker (REQUIRED for scheduling)
node src/worker.js
```

API will be live at **http://localhost:4000**

---

## Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://contentos:contentos_dev@localhost:5432/contentos` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | Min 32-char random string | `openssl rand -hex 32` |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth secret | From Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | YouTube OAuth callback URL | `http://localhost:4000/api/platforms/youtube/callback` |
| `META_APP_ID` | Meta (Facebook) app ID | From Meta for Developers |
| `META_APP_SECRET` | Meta app secret | From Meta for Developers |
| `META_REDIRECT_URI` | Instagram OAuth callback URL | `http://localhost:4000/api/platforms/instagram/callback` |
| `OPENAI_API_KEY` | OpenAI API key for AI features | `sk-...` |
| `APP_URL` | Public URL of this server | `http://localhost:4000` |
| `FRONTEND_URL` | Frontend URL (for OAuth redirects) | `http://localhost:3000` |

---

## Setting Up Google / YouTube API

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project → **Enable APIs**: search and enable `YouTube Data API v3`
3. Go to **Credentials** → Create **OAuth 2.0 Client ID** (type: Web Application)
4. Add authorized redirect URI: `http://localhost:4000/api/platforms/youtube/callback`
5. Copy **Client ID** and **Client Secret** to `.env`

> **Quota note**: Free quota is 10,000 units/day. `videos.insert` costs 1,600 units per upload, giving you ~6 uploads/day on the free tier. Request a quota increase for more.

---

## Setting Up Meta / Instagram API

1. Go to [developers.facebook.com](https://developers.facebook.com) → Create App → **Business** type
2. Add product: **Instagram Graph API**
3. Under App Settings → Basic: copy **App ID** and **App Secret** to `.env`
4. Under Instagram Graph API → Settings: add OAuth Redirect URI
5. Required permissions: `instagram_basic`, `instagram_content_publish`, `pages_show_list`, `pages_read_engagement`

> **Important**: Instagram Graph API **only works with Business/Creator accounts** connected to a Facebook Page. Personal accounts are not supported.

> **App Review**: For other users to connect their Instagram, you must submit your app for Meta App Review. For personal use, add yourself as a test user.

---

## API Reference

### Authentication

All protected routes require: `Authorization: Bearer <jwt_token>`

#### Register
```http
POST /api/auth/register
Content-Type: application/json

{ "email": "you@example.com", "password": "yourpassword", "name": "Your Name" }
```

#### Login
```http
POST /api/auth/login
Content-Type: application/json

{ "email": "you@example.com", "password": "yourpassword" }
```

Response: `{ "token": "eyJ...", "user": { "id": "...", "email": "..." } }`

#### Generate MCP API Key (for AI agents)
```http
POST /api/auth/mcp-key
Authorization: Bearer <token>

{ "label": "Claude Agent", "scopes": ["posts:read", "posts:write", "analytics:read"] }
```

Response includes `key` field — **save it, shown only once**.

---

### Connect Platforms

#### Connect YouTube
```http
GET /api/platforms/youtube/connect
Authorization: Bearer <token>
```
Returns `{ authUrl: "https://accounts.google.com/..." }` — redirect the user to this URL.

#### Connect Instagram
```http
GET /api/platforms/instagram/connect
Authorization: Bearer <token>
```
Returns `{ authUrl: "https://www.facebook.com/dialog/oauth?..." }`

#### List Connected Platforms
```http
GET /api/platforms
Authorization: Bearer <token>
```

---

### Upload Media

```http
POST /api/media/upload?ai=true
Authorization: Bearer <token>
Content-Type: multipart/form-data

file: <video or image file>
```

Response:
```json
{
  "mediaFile": {
    "id": "uuid",
    "originalName": "my-video.mp4",
    "mimeType": "video/mp4",
    "sizeBytes": 524288000,
    "storageUrl": "/path/to/file"
  },
  "aiJobId": "job-id",
  "message": "File uploaded. AI content generation started."
}
```

---

### Schedule a Post

```http
POST /api/posts
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "10 Productivity Hacks That Actually Work",
  "caption": "Here are the habits I use every single day 💪",
  "description": "In this video I share the 10 productivity habits...",
  "hashtags": ["productivity", "hustle", "motivation"],
  "platforms": ["YOUTUBE", "INSTAGRAM"],
  "scheduledAt": "2025-06-10T20:00:00Z",
  "mediaFileId": "uuid-from-upload",
  "privacyStatus": "PUBLIC"
}
```

### Get Calendar
```http
GET /api/posts/calendar?year=2025&month=6
Authorization: Bearer <token>
```

### Reschedule (drag & drop)
```http
PATCH /api/schedules/:id/reschedule
Authorization: Bearer <token>

{ "scheduledAt": "2025-06-11T09:00:00Z" }
```

### Bulk Schedule
```http
POST /api/schedules/bulk
Authorization: Bearer <token>

{
  "posts": [
    { "title": "Post 1", "platforms": ["YOUTUBE"], "scheduledAt": "2025-06-10T08:00:00Z", "mediaFileId": "..." },
    { "title": "Post 2", "platforms": ["INSTAGRAM"], "scheduledAt": "2025-06-11T09:00:00Z", "mediaFileId": "..." }
  ]
}
```

---

### AI Generation

#### Generate full content from topic
```http
POST /api/schedules/ai-generate
Authorization: Bearer <token>

{ "topic": "morning workout routine", "tone": "motivational", "platforms": ["YOUTUBE", "INSTAGRAM"] }
```

#### Generate/rewrite captions
```http
POST /api/schedules/ai-caption
Authorization: Bearer <token>

# Rewrite existing caption
{ "caption": "Check out my new video!", "style": "casual" }

# Generate variants from topic
{ "topic": "fitness tips", "platform": "INSTAGRAM", "count": 3 }
```

#### Generate hashtags
```http
POST /api/schedules/ai-hashtags
Authorization: Bearer <token>

{ "topic": "home workout", "platform": "INSTAGRAM", "count": 15 }
```

---

### MCP Endpoints (for AI Agents)

All MCP routes use: `x-mcp-api-key: YOUR_MCP_KEY` header

#### Discover available tools
```http
GET /api/mcp/tools
```

#### Create and schedule a post
```http
POST /api/mcp/create_post
x-mcp-api-key: mcp_abc123...

{
  "title": "My YouTube Video",
  "caption": "Watch this 👇",
  "platforms": ["YOUTUBE", "INSTAGRAM"],
  "scheduledAt": "2025-06-10T20:00:00Z",
  "mediaFileId": "uuid"
}
```

#### Generate caption via agent
```http
POST /api/mcp/generate_caption
x-mcp-api-key: mcp_abc123...

{ "topic": "AI tools for productivity", "platform": "INSTAGRAM" }
```

#### Get analytics via agent
```http
POST /api/mcp/get_analytics
x-mcp-api-key: mcp_abc123...

{ "platform": "YOUTUBE", "startDate": "2025-05-01", "endDate": "2025-05-31" }
```

---

### Analytics

```http
GET /api/analytics/overview           # Summary stats
GET /api/analytics/youtube            # YouTube channel analytics (last 30 days)
GET /api/analytics/instagram          # Instagram account insights
GET /api/analytics/activity           # Daily post counts (90 days, for heatmap)
```

---

## How Scheduling Works

```
User schedules post
        │
        ▼
POST /api/posts  →  Creates ScheduledPost in DB (status: SCHEDULED)
                 →  Adds delayed job to BullMQ (delay = ms until scheduledAt)
                 →  Returns post ID
        │
        ▼ (when delay expires)
BullMQ Worker (worker.js)
  1. Fetch ScheduledPost + MediaFile + PlatformAccounts
  2. Set status → PUBLISHING
  3. For each platform:
     ├─ YOUTUBE  → youtubeService.uploadVideo() (streams file to YouTube API)
     └─ INSTAGRAM→ instagramService.publishVideo/Photo()
                    (creates container → polls until ready → publishes)
  4. Save PostPlatformResult (postId, URL, status)
  5. Set status → PUBLISHED or FAILED
  6. Delete temp file (if all platforms succeeded)
```

---

## BullMQ Dashboard

Visit **http://localhost:3001** when Docker is running to see:
- Pending/active/completed/failed jobs
- Job details and error messages
- Manual retry of failed jobs

---

## Production Deployment

### Free stack (recommended for MVP)

| Layer | Service | Cost |
|---|---|---|
| API hosting | [Render](https://render.com) free web service | Free |
| Worker | Render background worker | Free |
| Database | [Supabase](https://supabase.com) PostgreSQL | Free (500MB) |
| Redis | [Upstash](https://upstash.com) | Free (10K req/day) |
| File storage | [Cloudflare R2](https://developers.cloudflare.com/r2/) | Free (10GB) |
| Domain | [Cloudflare](https://cloudflare.com) | Free |

**Total: $0/month**

### For Cloudflare R2 storage (production)

Replace the local `storageUrl` in `media.js` with R2 upload:

```js
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY,
    secretAccessKey: process.env.STORAGE_SECRET_KEY,
  },
});

await r2.send(new PutObjectCommand({
  Bucket: process.env.STORAGE_BUCKET,
  Key: file.filename,
  Body: fs.createReadStream(file.path),
  ContentType: file.mimetype,
}));
const storageUrl = `https://pub-<hash>.r2.dev/${file.filename}`;
```

---

## Connecting Claude / Cursor to ContentOS MCP

1. Generate an MCP API key: `POST /api/auth/mcp-key`
2. In Claude Desktop `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "contentOS": {
      "command": "curl",
      "args": ["-s", "http://localhost:4000/api/mcp/tools"],
      "env": { "MCP_API_KEY": "mcp_your_key_here" }
    }
  }
}
```

3. Or configure a custom HTTP MCP server pointing to `http://localhost:4000/api/mcp`

Now your AI agent can say:
> *"Schedule my latest video to YouTube next Tuesday at 7 PM with an AI-generated title about productivity"*

And it will call `generate_title` → `create_post` automatically.

---

## License

MIT — free to use, modify, and deploy.
