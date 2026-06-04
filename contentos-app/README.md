# ContentOS — Frontend

React + Vite frontend for ContentOS. Connects to the Node.js backend for real social media scheduling.

---

## Quick Start

### 1. Prerequisites
- Node.js 18+
- The **backend** running on `http://localhost:4000` (see `contentOS-backend/`)

### 2. Install & run

```bash
cd contentos-app
npm install
npm run dev
```

App opens at **http://localhost:3000**

The `vite.config.js` proxies all `/api` requests to `http://localhost:4000`,
so there are no CORS issues in development.

---

## Pages & Features

| Page | Path | What it does |
|---|---|---|
| **Login** | `/login` | JWT login → stored in localStorage |
| **Register** | `/register` | Creates account, redirects to Connect Accounts |
| **Dashboard** | `/dashboard` | Stats overview, upcoming posts, connected platforms |
| **Create Post** | `/create` | Upload file → fill title/caption/hashtags → pick platforms → schedule |
| **Calendar** | `/calendar` | Monthly calendar with all scheduled posts, click day to see details |
| **All Posts** | `/posts` | List view with status filters, cancel button |
| **Media Library** | `/media` | Upload/delete media files |
| **AI Studio** | `/ai-studio` | Generate titles, captions, hashtags; rewrite captions |
| **Connect Accounts** | `/platforms` | OAuth connect/disconnect YouTube & Instagram |
| **Analytics** | `/analytics` | Activity heatmap, YouTube analytics, Instagram insights |
| **Settings** | `/settings` | Profile, MCP API keys, queue status |

---

## How the Create Post flow works

1. **Upload file** — drag/drop or click, file goes to `POST /api/media/upload`
2. **AI Generate** — optionally hit "✦ AI Generate" to auto-fill title/caption/hashtags via OpenAI
3. **Select platforms** — only shows platforms you've connected in Connect Accounts
4. **Set date/time** — datetime picker (must be in the future)
5. **Schedule Post** — calls `POST /api/posts`, backend queues a BullMQ job
6. **Worker publishes** — at the scheduled time, `src/worker.js` wakes up and calls YouTube/Instagram APIs

---

## How OAuth connect works

1. Click **Connect** on YouTube or Instagram
2. Frontend calls `GET /api/platforms/youtube/connect` (with JWT)
3. Backend returns `{ authUrl }` — Google/Facebook OAuth consent URL
4. Frontend redirects user: `window.location.href = authUrl`
5. User approves, platform redirects back to `http://localhost:4000/api/platforms/youtube/callback`
6. Backend saves tokens, redirects to `http://localhost:3000/platforms?connected=youtube`
7. Frontend shows success toast

---

## Environment

No `.env` needed for the frontend — the Vite proxy handles the API URL.

For **production**, set `VITE_API_URL` and update `api.js` baseURL:

```js
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || "/api" });
```

---

## Production Build

```bash
npm run build
# Output in /dist — deploy to Vercel, Netlify, or Cloudflare Pages
```

For Vercel/Netlify add a rewrite rule so `/api/*` → your backend URL.

---

## Tech Stack

- **React 18** + hooks
- **React Router v6** (client-side routing, protected routes)
- **Axios** (API client with JWT interceptors + auto-redirect on 401)
- **Vite** (dev server + build)
- No CSS framework — pure CSS variables for theming
