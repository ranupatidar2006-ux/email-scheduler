import { Queue, QueueEvents } from 'bullmq';
import { createRedisConnection } from '../config/redis';

const connection = createRedisConnection();

export const emailQueue = new Queue('email-sending', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: { count: 1000 }, // Keep last 1000 completed
    removeOnFail: { count: 5000 },     // Keep last 5000 failed
  },
});

export const queueEvents = new QueueEvents('email-sending', { connection: createRedisConnection() });

/**
 * Schedule an email job with BullMQ delayed job.
 * The delay is calculated from now until the scheduled time.
 */
export async function scheduleEmailJob(params: {
  emailId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: Date;
  userId: string;
}): Promise<string> {
  const now = Date.now();
  const scheduledTime = new Date(params.scheduledAt).getTime();
  const delay = Math.max(0, scheduledTime - now);

  const job = await emailQueue.add(
    'send-email',
    {
      emailId: params.emailId,
      senderEmail: params.senderEmail,
      recipientEmail: params.recipientEmail,
      subject: params.subject,
      body: params.body,
      userId: params.userId,
    },
    {
      delay,
      jobId: params.emailId, // Use email ID as job ID for idempotency
    }
  );

  console.log(`Job ${job.id} scheduled with delay ${delay}ms (fires at ${params.scheduledAt})`);
  return job.id!;
}

/**
 * Recover pending emails after server restart.
 * Re-queue any emails that are still scheduled in the DB
 * but may have lost their BullMQ job.
 */
export async function recoverPendingJobs(emails: Array<{
  id: string;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_at: Date;
  user_id: string;
}>): Promise<number> {
  let recovered = 0;

  for (const email of emails) {
    // Check if job already exists in BullMQ
    const existingJob = await emailQueue.getJob(email.id);
    if (existingJob) {
      const state = await existingJob.getState();
      if (state !== 'completed' && state !== 'failed') {
        continue; // Job still active, skip
      }
    }

    // Re-schedule the job
    const now = Date.now();
    const scheduledTime = new Date(email.scheduled_at).getTime();

    if (scheduledTime <= now) {
      // Overdue — schedule immediately
      await emailQueue.add(
        'send-email',
        {
          emailId: email.id,
          senderEmail: email.sender_email,
          recipientEmail: email.recipient_email,
          subject: email.subject,
          body: email.body,
          userId: email.user_id,
        },
        {
          jobId: email.id,
        }
      );
    } else {
      await scheduleEmailJob({
        emailId: email.id,
        senderEmail: email.sender_email,
        recipientEmail: email.recipient_email,
        subject: email.subject,
        body: email.body,
        scheduledAt: email.scheduled_at,
        userId: email.user_id,
      });
    }

    recovered++;
  }

  return recovered;
}
