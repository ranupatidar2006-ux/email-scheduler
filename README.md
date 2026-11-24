# Email Scheduler

A full-stack email scheduling application built with React, Node.js, TypeScript, Express, PostgreSQL, Redis, BullMQ, and Ethereal Email.

## Tech Stack

- **Frontend:** React / TypeScript
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL
- **Queue:** BullMQ
- **Queue Storage:** Redis
- **Email Testing:** Ethereal Email
- **Search:** Elasticsearch
- **Queue Dashboard:** Bull Board

## Project Structure

```text
email-scheduler/
├── backend/
├── frontend/
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Prerequisites

Install the following before running the project:

- Node.js and npm
- Docker Desktop
- Git
- GitHub account

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/email-scheduler.git
cd email-scheduler
```

### 2. Start Infrastructure

Start PostgreSQL, Redis, and Elasticsearch using Docker Compose:

```bash
docker compose up -d
```

Check the running containers:

```bash
docker compose ps
```

### 3. Backend Setup

Navigate to the backend:

```bash
cd backend
npm install
```

Create a `.env` file using the provided `.env.example`:

```bash
cp .env.example .env
```

Configure the required environment variables.

Run database migrations using the migration command configured in `backend/package.json`.

Start the backend:

```bash
npm run dev
```

Run the BullMQ worker using the worker script configured in `backend/package.json`.

### 4. Frontend Setup

Open another terminal:

```bash
cd frontend
npm install
```

Create the frontend environment file:

```bash
cp .env.example .env
```

Configure the required frontend environment variables.

Start the frontend:

```bash
npm run dev
```

Open the local URL displayed in the terminal.

## Ethereal Email Setup

Ethereal Email provides a test SMTP service for safely testing email delivery without sending emails to real recipients.

1. Visit https://ethereal.email/
2. Create a test account.
3. Copy the SMTP credentials.
4. Add the credentials to the backend `.env` file.

Example configuration:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_username
SMTP_PASS=your_ethereal_password
SMTP_FROM=your_verified_sender
```

Use the exact variable names expected by the backend configuration.

After sending a test email, use the Ethereal preview URL or dashboard to view the email.

## Environment Variables

Create separate environment files for the backend and frontend.

### Backend

Example:

```env
DATABASE_URL=postgresql://scheduler:scheduler_pass@localhost:5432/email_scheduler

REDIS_HOST=localhost
REDIS_PORT=6379

ELASTICSEARCH_URL=http://localhost:9200

SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your_ethereal_username
SMTP_PASS=your_ethereal_password
SMTP_FROM=your_sender_email

GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

SLACK_CLIENT_ID=your_slack_client_id
SLACK_CLIENT_SECRET=your_slack_client_secret
```

Add any additional variables required by the application, such as OAuth callback URLs, session secrets, or frontend URLs.

### Frontend

Configure the Google OAuth client ID and backend API URL using the variable names expected by the frontend.

Never expose private client secrets in frontend environment variables.

**Important:** Do not commit `.env` files or credentials to GitHub.

## Architecture Overview

### 1. How Scheduling Works

1. The user creates an email campaign through the frontend.
2. The backend validates the email details and scheduling configuration.
3. Campaign and recipient information is stored in PostgreSQL.
4. The backend creates delayed jobs in BullMQ.
5. BullMQ stores job data in Redis.
6. When a job becomes eligible, a worker processes it.
7. The worker checks rate limits before sending.
8. The email is sent through the configured SMTP provider.
9. The email status is updated in the database.

### 2. Persistence and Restart Handling

PostgreSQL stores application data such as campaigns, recipients, and email statuses.

BullMQ uses Redis to store queued and delayed jobs.

Redis persistence is enabled through the Docker Compose configuration.

After a restart:

- PostgreSQL retains stored application records.
- Redis retains persisted queue data.
- BullMQ can recover and continue processing eligible jobs.
- The application can reconcile job status with database records.

Email sending should use idempotency and status checks to reduce duplicate sends during retries or restarts.

### 3. Rate Limiting

The application uses a configured hourly email limit.

Rate-limit checks should use shared state in Redis or the database so multiple workers cannot independently exceed the same sender's limit.

When the limit is reached:

- The worker postpones or reschedules the email.
- The email remains pending.
- The application notifies the user through the configured Slack integration, if implemented.

### 4. Concurrency

BullMQ workers process jobs with configurable concurrency.

Concurrency controls how many jobs a worker can process at the same time.

The configured delay between sends and hourly rate limit are applied separately from worker concurrency.

## Features

### Backend

- [ ] Email scheduling with BullMQ
- [ ] Delayed job processing
- [ ] PostgreSQL persistence
- [ ] Redis queue persistence
- [ ] BullMQ worker
- [ ] Configurable worker concurrency
- [ ] Sender-based hourly rate limiting
- [ ] Rescheduling when the rate limit is reached
- [ ] Idempotency and retry handling
- [ ] Ethereal SMTP integration
- [ ] Slack OAuth and rate-limit notifications
- [ ] Elasticsearch email search
- [ ] Bull Board queue monitoring

### Frontend

- [ ] Google OAuth login
- [ ] Dashboard
- [ ] Scheduled and sent email tabs
- [ ] Email compose form
- [ ] CSV lead upload
- [ ] Subject and email body input
- [ ] Scheduling date and time
- [ ] Delay between emails
- [ ] Hourly sending limit configuration
- [ ] Email status tables
- [ ] Loading, empty, and error states

## Queue Monitoring

Bull Board provides a dashboard to monitor queue activity, including waiting, delayed, active, completed, and failed jobs.

Open the configured Bull Board URL after starting the backend.

## Security

- Environment variables are excluded from Git.
- OAuth credentials are stored on the backend.
- SMTP credentials are kept private.
- The repository is private and shared only with authorized reviewers.

## Author
Ranu Vinod Patidar

GitHub: https://github.com/ranupatidar2006-ux

DEMO VIDEO
Watch the Email Scheduler Demo : https://drive.google.com/file/d/1UltoUXVpfymyDlAbibV4riuyttM5inwL/view?usp=sharing
