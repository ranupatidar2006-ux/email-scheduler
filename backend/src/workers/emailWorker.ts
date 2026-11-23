import { Worker, Job } from 'bullmq';
import { createRedisConnection } from '../config/redis';
import { emailService } from '../services/emailService';
import { smtpService } from '../services/smtpService';
import { rateLimiter } from '../services/rateLimiter';
import { slackService } from '../services/slackService';
import { emailQueue } from '../services/queueService';
import { config } from '../config/env';

interface EmailJobData {
  emailId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  userId: string;
}

let rateLimitNotified = new Set<string>(); // Track notifications per hour window

function getHourKey(sender: string): string {
  const now = new Date();
  const hour = `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
  return `${sender}:${hour}`;
}

export function startEmailWorker(): Worker {
  const worker = new Worker<EmailJobData>(
    'email-sending',
    async (job: Job<EmailJobData>) => {
      const { emailId, senderEmail, recipientEmail, subject, body, userId } = job.data;

      console.log(`Processing job ${job.id} for email ${emailId}`);

      // Check rate limit before sending
      const { allowed, retryAfterMs } = await rateLimiter.canSend(senderEmail);

      if (!allowed) {
        console.log(`Rate limit hit for ${senderEmail}, rescheduling in ${retryAfterMs}ms`);

        // Update status to rate_limited
        await emailService.updateEmailStatus(emailId, 'rate_limited');

        // Send Slack notification (once per sender per hour window)
        const hourKey = getHourKey(senderEmail);
        if (!rateLimitNotified.has(hourKey)) {
          rateLimitNotified.add(hourKey);
          const counts = await rateLimiter.getCurrentCounts(senderEmail);
          await slackService.notifyRateLimitHit(
            userId,
            senderEmail,
            counts.sender || 0,
            config.maxEmailsPerHourPerSender
          );

          // Clear the notification flag after the hour passes
          setTimeout(() => rateLimitNotified.delete(hourKey), retryAfterMs + 1000);
        }

        // Re-add job with delay to next hour window
        await emailQueue.add(
          'send-email',
          job.data,
          {
            delay: retryAfterMs + 1000, // +1s buffer
            jobId: `${emailId}-retry-${Date.now()}`,
          }
        );

        return { status: 'rate_limited', retryAfterMs };
      }

      // Enforce minimum delay between sends
      await new Promise(resolve => setTimeout(resolve, config.delayBetweenEmailsMs));

      // Update status to sending
      await emailService.updateEmailStatus(emailId, 'sending');

      try {
        // Send via Ethereal SMTP
        const result = await smtpService.sendEmail({
          sender_email: senderEmail,
          recipient_email: recipientEmail,
          subject,
          body,
        });

        // Record the send for rate limiting
        await rateLimiter.recordSend(senderEmail);

        // Update status to sent
        await emailService.updateEmailStatus(emailId, 'sent', {
          sent_at: new Date(),
        });

        console.log(`Email ${emailId} sent successfully. Preview: ${result.previewUrl}`);
        return { status: 'sent', messageId: result.messageId, previewUrl: result.previewUrl };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Failed to send email ${emailId}:`, errorMessage);

        await emailService.updateEmailStatus(emailId, 'failed', {
          error_message: errorMessage,
        });

        throw error; // Let BullMQ handle retry
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: config.workerConcurrency,
      limiter: {
        max: 10,       // Max 10 jobs per duration window
        duration: 1000, // Per second — provides micro-level throttling
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(`Email worker started with concurrency: ${config.workerConcurrency}`);
  return worker;
}
