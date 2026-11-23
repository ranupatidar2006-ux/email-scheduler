import { query } from '../config/database';
import { indexEmail, updateEmailIndex } from '../config/elasticsearch';
import { v4 as uuidv4 } from 'uuid';
import { EmailJob, PaginatedResponse } from '../types';

export class EmailService {
  async createEmail(params: {
    user_id: string;
    sender_email: string;
    recipient_email: string;
    subject: string;
    body: string;
    scheduled_at: Date;
    batch_id?: string;
  }): Promise<EmailJob> {
    const id = uuidv4();
    const idempotencyKey = `${params.sender_email}:${params.recipient_email}:${params.scheduled_at.toISOString()}:${params.subject}`;

    const result = await query(
      `INSERT INTO emails (id, user_id, sender_email, recipient_email, subject, body, scheduled_at, status, batch_id, idempotency_key)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9)
       ON CONFLICT (idempotency_key) DO NOTHING
       RETURNING *`,
      [id, params.user_id, params.sender_email, params.recipient_email, params.subject, params.body, params.scheduled_at, params.batch_id || null, idempotencyKey]
    );

    if (result.rows.length === 0) {
      // Duplicate — fetch existing
      const existing = await query(
        `SELECT * FROM emails WHERE idempotency_key = $1`,
        [idempotencyKey]
      );
      return existing.rows[0];
    }

    const email = result.rows[0];

    // Index in Elasticsearch
    await indexEmail({
      id: email.id,
      user_id: email.user_id,
      sender_email: email.sender_email,
      recipient_email: email.recipient_email,
      subject: email.subject,
      body: email.body,
      status: email.status,
      scheduled_at: email.scheduled_at,
      batch_id: email.batch_id,
      created_at: email.created_at,
    });

    return email;
  }

  async updateEmailStatus(id: string, status: string, extras?: { sent_at?: Date; error_message?: string; bullmq_job_id?: string }) {
    const setClauses = ['status = $2', 'updated_at = NOW()'];
    const values: unknown[] = [id, status];
    let paramIdx = 3;

    if (extras?.sent_at) {
      setClauses.push(`sent_at = $${paramIdx}`);
      values.push(extras.sent_at);
      paramIdx++;
    }
    if (extras?.error_message) {
      setClauses.push(`error_message = $${paramIdx}`);
      values.push(extras.error_message);
      paramIdx++;
    }
    if (extras?.bullmq_job_id) {
      setClauses.push(`bullmq_job_id = $${paramIdx}`);
      values.push(extras.bullmq_job_id);
      paramIdx++;
    }

    await query(`UPDATE emails SET ${setClauses.join(', ')} WHERE id = $1`, values);

    // Update ES index
    const updateFields: Record<string, unknown> = { status };
    if (extras?.sent_at) updateFields.sent_at = extras.sent_at;
    await updateEmailIndex(id, updateFields);
  }

  async getScheduledEmails(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<EmailJob>> {
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) FROM emails WHERE user_id = $1 AND status IN ('scheduled', 'queued', 'rate_limited')`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT * FROM emails WHERE user_id = $1 AND status IN ('scheduled', 'queued', 'rate_limited')
       ORDER BY scheduled_at ASC LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getSentEmails(userId: string, page = 1, limit = 20): Promise<PaginatedResponse<EmailJob>> {
    const offset = (page - 1) * limit;

    const countResult = await query(
      `SELECT COUNT(*) FROM emails WHERE user_id = $1 AND status IN ('sent', 'failed')`,
      [userId]
    );
    const total = parseInt(countResult.rows[0].count, 10);

    const result = await query(
      `SELECT * FROM emails WHERE user_id = $1 AND status IN ('sent', 'failed')
       ORDER BY sent_at DESC NULLS LAST LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return {
      data: result.rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getEmailById(id: string): Promise<EmailJob | null> {
    const result = await query(`SELECT * FROM emails WHERE id = $1`, [id]);
    return result.rows[0] || null;
  }

  async getPendingEmailsForRecovery(): Promise<EmailJob[]> {
    const result = await query(
      `SELECT * FROM emails WHERE status IN ('scheduled', 'queued', 'rate_limited') AND scheduled_at > NOW() - INTERVAL '24 hours' ORDER BY scheduled_at ASC`
    );
    return result.rows;
  }

  async getOverdueEmails(): Promise<EmailJob[]> {
    const result = await query(
      `SELECT * FROM emails WHERE status IN ('scheduled', 'queued') AND scheduled_at <= NOW() ORDER BY scheduled_at ASC LIMIT 100`
    );
    return result.rows;
  }
}

export const emailService = new EmailService();
