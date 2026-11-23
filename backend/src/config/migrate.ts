import { pool } from './database';

const migration = `
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    google_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    sender_email VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255) NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled',
    sent_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    batch_id UUID,
    bullmq_job_id VARCHAR(255),
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_emails_status ON emails(status);
  CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at ON emails(scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_emails_user_id ON emails(user_id);
  CREATE INDEX IF NOT EXISTS idx_emails_batch_id ON emails(batch_id);
  CREATE INDEX IF NOT EXISTS idx_emails_sender ON emails(sender_email);
  CREATE INDEX IF NOT EXISTS idx_emails_idempotency ON emails(idempotency_key);

  CREATE TABLE IF NOT EXISTS slack_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slack_team_id VARCHAR(255) NOT NULL,
    slack_team_name VARCHAR(255),
    slack_webhook_url TEXT,
    slack_access_token TEXT NOT NULL,
    slack_channel_id VARCHAR(255),
    slack_channel_name VARCHAR(255),
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, slack_team_id)
  );

  CREATE TABLE IF NOT EXISTS ethereal_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_email VARCHAR(255) UNIQUE NOT NULL,
    ethereal_user VARCHAR(255) NOT NULL,
    ethereal_pass VARCHAR(255) NOT NULL,
    smtp_host VARCHAR(255) NOT NULL DEFAULT 'smtp.ethereal.email',
    smtp_port INTEGER NOT NULL DEFAULT 587,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
  );
`;

async function runMigration() {
  console.log('Running database migration...');
  try {
    await pool.query(migration);
    console.log('Migration completed successfully.');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
