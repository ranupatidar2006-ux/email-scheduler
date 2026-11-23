# Email Scheduler Service

A production-grade email scheduling service with a React dashboard, built with **BullMQ + Redis** for reliable job scheduling, **PostgreSQL** for persistence, **Elasticsearch** for search, and **Ethereal Email** for fake SMTP.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   React UI  │────▶│  Express API │────▶│ PostgreSQL  │
│  (Vite+TS)  │     │  (TypeScript)│     │  (Persist)  │
└─────────────┘     └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐     ┌─────────────┐
                    │   BullMQ     │────▶│    Redis     │
                    │  (Scheduler) │     │  (Queue)    │
                    └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐     ┌─────────────┐
                    │   Worker     │────▶│  Ethereal   │
                    │  (Processor) │     │  (SMTP)     │
                    └──────┬───────┘     └─────────────┘
                           │
                    ┌──────▼───────┐     ┌─────────────┐
                    │ Rate Limiter │     │Elasticsearch│
                    │  (Redis)     │     │  (Search)   │
                    └──────────────┘     └─────────────┘
```

## Tech Stack

| Layer        | Technology                           |
| ------------ | ------------------------------------ |
| Backend      | Express.js + TypeScript              |
| Queue        | BullMQ (backed by Redis)             |
| Database     | PostgreSQL                           |
| Search       | Elasticsearch 8.x                    |
| SMTP         | Ethereal Email (fake SMTP)           |
| Frontend     | React 18 + TypeScript + Tailwind CSS |
| Auth         | Google OAuth 2.0                     |
| Notifications| Slack OAuth + Webhooks               |
| Infra        | Docker Compose                       |

## Features

- **Email Scheduling**: Schedule emails via API with configurable delay and timing
- **BullMQ Delayed Jobs**: No cron — uses BullMQ delayed jobs for precise scheduling
- **Multi-Sender Support**: Each sender gets their own Ethereal SMTP account
- **Rate Limiting**: Redis-backed per-sender and global hourly rate limits
- **Slack Notifications**: Real OAuth flow — notifies when rate limits are hit
- **Elasticsearch Search**: Full-text search across all email fields
- **BullMQ Dashboard**: Live queue visibility at `/admin/queues`
- **Restart Recovery**: Pending jobs are recovered from PostgreSQL on startup
- **Idempotency**: Duplicate emails are prevented via unique idempotency keys
- **CSV Upload**: Upload lead lists as CSV/TXT files
- **Google OAuth**: Real Google login with user profiles

## Rate Limiting Strategy

### Delay Between Emails
- **Default**: 2 seconds between individual sends (configurable via `DELAY_BETWEEN_EMAILS_MS`)
- **Implementation**: Worker adds an artificial delay before each SMTP send to mimic provider throttling
- **Additionally**: BullMQ worker-level limiter restricts to 10 jobs/second for micro-throttling

### Emails Per Hour (Rate Limiting)
- **Global limit**: `MAX_EMAILS_PER_HOUR=200` (configurable)
- **Per-sender limit**: `MAX_EMAILS_PER_HOUR_PER_SENDER=50` (configurable)
- **Implementation**: Redis-backed sliding window counters
  - Keys: `rate:global:{hour_window}` and `rate:sender:{email}:{hour_window}`
  - TTL: 2 hours (auto-cleanup)
  - Atomic increment via Redis pipeline
- **When limit is reached**:
  - Job is NOT dropped or permanently failed
  - Job is re-added to BullMQ with a delay until the next hour window
  - Status updated to `rate_limited` in DB
  - Slack notification sent (once per sender per hour window)
- **Thread safety**: Redis `INCR` is atomic; safe across multiple workers/instances

### Behavior Under Load (1000+ emails at same time)
- BullMQ processes jobs with configurable concurrency (default: 5 workers)
- Each job checks rate limit before sending
- When hourly limit is hit, remaining jobs are automatically delayed to the next hour
- Order is preserved as much as possible (re-queued jobs maintain their original order)

## Setup Instructions

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- Google Cloud Console project (for OAuth)
- Slack App (for notifications)

### 1. Clone & Install

```bash
git clone <repo-url>
cd email-scheduler

# Install backend
cd backend
cp .env.example .env
npm install

# Install frontend
cd ../frontend
cp .env.example .env
npm install
```

### 2. Start Infrastructure

```bash
# From project root
docker-compose up -d
```

This starts PostgreSQL, Redis, and Elasticsearch.

### 3. Configure Environment

**Backend `.env`:**
```
PORT=3001
DATABASE_URL=postgresql://scheduler:scheduler_pass@localhost:5432/email_scheduler
REDIS_HOST=localhost
REDIS_PORT=6379
ELASTICSEARCH_URL=http://localhost:9200
MAX_EMAILS_PER_HOUR=200
MAX_EMAILS_PER_HOUR_PER_SENDER=50
DELAY_BETWEEN_EMAILS_MS=2000
WORKER_CONCURRENCY=5
GOOGLE_CLIENT_ID=<your-google-client-id>
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
SLACK_CLIENT_ID=<your-slack-client-id>
SLACK_CLIENT_SECRET=<your-slack-client-secret>
SLACK_REDIRECT_URI=http://localhost:3001/api/slack/callback
FRONTEND_URL=http://localhost:5173
```

**Frontend `.env`:**
```
VITE_GOOGLE_CLIENT_ID=<your-google-client-id>
```

### 4. Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable "Google Sign-In" API
3. Create OAuth 2.0 credentials (Web application)
4. Add `http://localhost:5173` as authorized origin
5. Copy Client ID to both `.env` files

### 5. Slack App Setup

1. Go to [Slack API](https://api.slack.com/apps)
2. Create new app → "From scratch"
3. Add OAuth scopes: `chat:write`, `incoming-webhook`
4. Set redirect URL: `http://localhost:3001/api/slack/callback`
5. Copy Client ID and Client Secret to backend `.env`

### 6. Run Database Migration

```bash
cd backend
npm run db:migrate
```

### 7. Start Development Servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev

# Terminal 2 — Frontend
cd frontend
npm run dev
```

### 8. Access

| Service        | URL                                    |
| -------------- | -------------------------------------- |
| Frontend       | http://localhost:5173                   |
| Backend API    | http://localhost:3001                   |
| BullMQ Dashboard | http://localhost:3001/admin/queues    |
| Health Check   | http://localhost:3001/health            |

## API Endpoints

| Method | Endpoint               | Description                    | Auth |
| ------ | ---------------------- | ------------------------------ | ---- |
| POST   | `/api/auth/google`     | Google OAuth login             | No   |
| GET    | `/api/auth/me`         | Get current user               | Yes  |
| POST   | `/api/emails/schedule` | Schedule a batch of emails     | Yes  |
| GET    | `/api/emails/scheduled`| List scheduled emails          | Yes  |
| GET    | `/api/emails/sent`     | List sent emails               | Yes  |
| GET    | `/api/emails/search`   | Search emails (Elasticsearch)  | Yes  |
| GET    | `/api/emails/:id`      | Get single email               | Yes  |
| POST   | `/api/upload/csv`      | Parse CSV for email addresses  | Yes  |
| GET    | `/api/slack/connect`   | Get Slack OAuth URL            | Yes  |
| GET    | `/api/slack/callback`  | Slack OAuth callback           | No   |
| GET    | `/api/slack/status`    | Check Slack connection status  | Yes  |
| POST   | `/api/slack/disconnect`| Disconnect Slack               | Yes  |
| GET    | `/api/rate-limit/status` | Current rate limit counts    | Yes  |

## Persistence & Recovery

The system survives restarts without losing jobs:

1. **All emails are persisted in PostgreSQL** before being queued in BullMQ
2. **Redis has AOF persistence** enabled (`appendonly yes`) — BullMQ jobs survive Redis restarts
3. **On server startup**, the recovery process:
   - Queries PostgreSQL for emails with status `scheduled`, `queued`, or `rate_limited`
   - Checks if each has an active BullMQ job
   - Re-schedules any missing jobs with the correct delay
4. **Idempotency**: Each email has a unique `idempotency_key` (sender + recipient + time + subject) — duplicates are silently ignored

## Project Structure

```
email-scheduler/
├── docker-compose.yml
├── backend/
│   ├── src/
│   │   ├── config/          # DB, Redis, ES, env configuration
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/       # Auth middleware
│   │   ├── routes/           # Express routes
│   │   ├── services/         # Business logic (email, SMTP, queue, rate limiter, Slack)
│   │   ├── workers/          # BullMQ worker
│   │   ├── types/            # TypeScript interfaces
│   │   └── index.ts          # App entry point
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/       # Reusable UI components
│   │   │   ├── ui/           # Button, Input, Modal, StatusBadge, etc.
│   │   │   ├── layout/       # Header
│   │   │   └── emails/       # EmailTable, ComposeModal, SearchBar, Pagination
│   │   ├── pages/            # LoginPage, DashboardPage
│   │   ├── hooks/            # useAuth
│   │   ├── services/         # API client (axios)
│   │   ├── types/            # TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── tailwind.config.js
└── README.md
```
