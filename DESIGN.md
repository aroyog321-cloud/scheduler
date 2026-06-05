# ContentOS System Design Document

## 1. Overview
ContentOS is an AI-native full-stack social media scheduling platform. It allows users to upload media, generate AI-optimized titles, captions, and hashtags, and schedule cross-platform posts (YouTube, Instagram, etc.). A distinguishing feature is its **Model Context Protocol (MCP)** integration, which allows external AI agents to manage the content pipeline seamlessly.

## 2. High-Level Architecture
The system is divided into three main components: a frontend single-page application, a backend REST API, and an asynchronous worker process for publishing and AI generation.

### Architecture Components
* **Frontend (React + Vite)**: A dashboard where users manage their content calendar, view analytics, upload media, and connect social media accounts.
* **Backend API (Express.js)**: Handles user authentication, OAuth flows for social platforms, media file uploads, post scheduling logic, and exposes the MCP endpoints.
* **Worker Process (BullMQ)**: A background Node.js process dedicated to executing delayed jobs. This includes uploading media to YouTube/Instagram APIs at the scheduled time and running long-lived AI content generation tasks.
* **Primary Database (PostgreSQL)**: Managed via Prisma ORM. Stores structured data including user accounts, post metadata, and OAuth tokens.
* **Queue & Cache (Redis)**: Powers BullMQ for reliable, persistent task scheduling and distributed locking.
* **Media Storage**: Local disk storage (`/uploads`) for development, designed to integrate with S3-compatible object storage (e.g., Cloudflare R2) in production.

## 3. Data Model
The database is structured around the following core entities:

* **User**: Represents a registered account with subscription plan details (Free, Creator, Agency).
* **PlatformAccount**: Stores OAuth access and refresh tokens for connected platforms (YouTube, Instagram).
* **MediaFile**: Tracks uploaded assets (images/videos), their storage paths, and metadata.
* **ScheduledPost**: Represents a content piece scheduled for publishing. Includes metadata like title, caption, hashtags, scheduled time, and target platforms.
* **PostPlatformResult**: Tracks the specific success or failure status of a post on a per-platform basis.
* **McpApiKey**: Manages scoped API keys issued to external AI agents for MCP integration.

## 4. Core Workflows

### 4.1. Platform Integration (OAuth)
1. User initiates a connection to a platform (e.g., YouTube) from the frontend.
2. Backend returns the platform's OAuth consent URL.
3. User authorizes ContentOS; the platform redirects back to the backend with an authorization code.
4. Backend exchanges the code for access/refresh tokens and stores them securely in `PlatformAccount`.

### 4.2. Scheduling and Publishing
1. **Schedule**: A user or AI agent creates a `ScheduledPost` via the API, specifying the `mediaFileId`, content, target platforms, and a `scheduledAt` timestamp.
2. **Queue**: The backend API calculates the delay (from now to `scheduledAt`) and pushes a job to the Redis-backed BullMQ `publish` queue.
3. **Execute**: When the delay expires, the standalone `Worker` picks up the job.
4. **Publish**: The worker fetches the media file and user tokens, then makes simultaneous API calls to the target platforms (e.g., streaming video to YouTube, pushing to Instagram Graph API).
5. **Update**: The worker logs the outcome in `PostPlatformResult` and updates the parent `ScheduledPost` status to `PUBLISHED` or `FAILED`.

### 4.3. AI Context and Generation
* Users can request AI assistance to rewrite captions, extract hashtags, or brainstorm topics.
* When uploading media, users can opt into background AI generation, which pushes a job to the `ai-generate` queue to preemptively generate contextual copy using the OpenAI or Google Generative AI SDKs.

### 4.4. Model Context Protocol (MCP)
ContentOS provides a built-in MCP server interface for local or remote AI agents (like Claude Desktop or Cursor).
* Agents authenticate via a unique `x-mcp-api-key`.
* They can dynamically discover tools (endpoints) to retrieve analytics, draft posts, or modify the scheduling calendar on the user's behalf.

## 5. Technology Stack
* **Frontend**: React 18, Vite, React Router, CSS (Vanilla/Modules).
* **Backend**: Node.js 20+, Express.js, Prisma ORM.
* **Workers**: BullMQ, ioredis.
* **Infrastructure**: Docker (Postgres, Redis), easily deployable to Render / Supabase / Upstash.
* **Third-Party APIs**: Google APIs (YouTube Data V3), Meta Graph API (Instagram), OpenAI API, Google Generative AI.
