export interface EmailJob {
  id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  status: 'scheduled' | 'queued' | 'sending' | 'sent' | 'failed' | 'rate_limited';
  sent_at?: Date;
  error_message?: string;
  batch_id?: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface BatchScheduleRequest {
  sender_email: string;
  subject: string;
  body: string;
  recipients: string[];
  start_time: string; // ISO timestamp
  delay_between_emails_ms: number;
  hourly_limit: number;
}

export interface User {
  id: string;
  google_id: string;
  email: string;
  name: string;
  avatar_url?: string;
  created_at: Date;
}

export interface SlackIntegration {
  id: string;
  user_id: string;
  slack_team_id: string;
  slack_team_name: string;
  slack_webhook_url: string;
  slack_access_token: string;
  slack_channel_id: string;
  slack_channel_name: string;
  connected_at: Date;
}

export interface EtherealAccount {
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface EmailSearchParams {
  query?: string;
  status?: string;
  sender_email?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}
