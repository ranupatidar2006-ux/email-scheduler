import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { emailService } from '../services/emailService';
import { scheduleEmailJob } from '../services/queueService';
import { searchEmails } from '../config/elasticsearch';
import { BatchScheduleRequest } from '../types';

export class EmailController {
  /**
   * POST /api/emails/schedule
   * Schedule a batch of emails.
   */
  async scheduleBatch(req: Request, res: Response): Promise<void> {
    try {
      const { sender_email, subject, body, recipients, start_time, delay_between_emails_ms, hourly_limit } = req.body as BatchScheduleRequest;
      const userId = req.user!.id;

      if (!sender_email || !subject || !body || !recipients?.length || !start_time) {
        res.status(400).json({ error: 'Missing required fields: sender_email, subject, body, recipients, start_time' });
        return;
      }

      const batchId = uuidv4();
      const startTime = new Date(start_time);
      const delay = delay_between_emails_ms || 2000;
      const scheduledEmails = [];

      for (let i = 0; i < recipients.length; i++) {
        const recipientEmail = recipients[i].trim();
        if (!recipientEmail) continue;

        // Calculate scheduled time: start_time + (index * delay)
        const scheduledAt = new Date(startTime.getTime() + i * delay);

        // Create email record in DB
        const email = await emailService.createEmail({
          user_id: userId,
          sender_email,
          recipient_email: recipientEmail,
          subject,
          body,
          scheduled_at: scheduledAt,
          batch_id: batchId,
        });

        // Schedule with BullMQ
        const jobId = await scheduleEmailJob({
          emailId: email.id,
          senderEmail: sender_email,
          recipientEmail: recipientEmail,
          subject,
          body,
          scheduledAt,
          userId,
        });

        await emailService.updateEmailStatus(email.id, 'queued', { bullmq_job_id: jobId });

        scheduledEmails.push({
          id: email.id,
          recipient_email: recipientEmail,
          scheduled_at: scheduledAt,
          job_id: jobId,
        });
      }

      res.status(201).json({
        message: `${scheduledEmails.length} emails scheduled successfully`,
        batch_id: batchId,
        emails: scheduledEmails,
      });
    } catch (error) {
      console.error('Schedule batch error:', error);
      res.status(500).json({ error: 'Failed to schedule emails' });
    }
  }

  /**
   * GET /api/emails/scheduled
   */
  async getScheduled(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await emailService.getScheduledEmails(userId, page, limit);
      res.json(result);
    } catch (error) {
      console.error('Get scheduled error:', error);
      res.status(500).json({ error: 'Failed to fetch scheduled emails' });
    }
  }

  /**
   * GET /api/emails/sent
   */
  async getSent(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await emailService.getSentEmails(userId, page, limit);
      res.json(result);
    } catch (error) {
      console.error('Get sent error:', error);
      res.status(500).json({ error: 'Failed to fetch sent emails' });
    }
  }

  /**
   * GET /api/emails/search
   * Search emails via Elasticsearch.
   */
  async search(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { query: q, status, sender_email, from_date, to_date, page, limit } = req.query;

      const result = await searchEmails({
        query: q as string,
        status: status as string,
        sender_email: sender_email as string,
        user_id: userId,
        from_date: from_date as string,
        to_date: to_date as string,
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 20,
      });

      res.json(result);
    } catch (error) {
      console.error('Search error:', error);
      res.status(500).json({ error: 'Search failed' });
    }
  }

  /**
   * GET /api/emails/:id
   */
  async getById(req: Request, res: Response): Promise<void> {
    try {
      const email = await emailService.getEmailById(req.params.id);
      if (!email) {
        res.status(404).json({ error: 'Email not found' });
        return;
      }
      res.json(email);
    } catch (error) {
      console.error('Get email error:', error);
      res.status(500).json({ error: 'Failed to fetch email' });
    }
  }
}

export const emailController = new EmailController();
