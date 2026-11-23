export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
}

export interface Email {
  id: string;
  user_id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: string;
  status: 'scheduled' | 'queued' | 'sending' | 'sent' | 'failed' | 'rate_limited';
  sent_at?: string;
  error_message?: string;
  batch_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface SlackStatus {
  connected: boolean;
  integration?: {
    id: string;
    slack_team_name: string;
    slack_channel_name: string;
    connected_at: string;
  };
}

export interface ScheduleRequest {
  sender_email: string;
  subject: string;
  body: string;
  recipients: string[];
  start_time: string;
  delay_between_emails_ms: number;
  hourly_limit: number;
}
