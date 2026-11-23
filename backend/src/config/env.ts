import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://scheduler:scheduler_pass@localhost:5432/email_scheduler',

  // Redis
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
  },

  // Elasticsearch
  elasticsearchUrl: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',

  // Rate Limiting
  maxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10),
  delayBetweenEmailsMs: parseInt(process.env.DELAY_BETWEEN_EMAILS_MS || '2000', 10),
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),

  // Google OAuth
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET || '',

  // Slack OAuth
  slackClientId: process.env.SLACK_CLIENT_ID || '',
  slackClientSecret: process.env.SLACK_CLIENT_SECRET || '',
  slackRedirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:3001/api/slack/callback',

  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
