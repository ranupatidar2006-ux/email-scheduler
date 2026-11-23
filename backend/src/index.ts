import express from 'express';
import cors from 'cors';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config/env';
import { initElasticsearch } from './config/elasticsearch';
import { emailQueue, recoverPendingJobs } from './services/queueService';
import { emailService } from './services/emailService';
import { startEmailWorker } from './workers/emailWorker';
import routes from './routes';

async function main() {
  const app = express();

  // Middleware
  app.use(cors({
    origin: config.frontendUrl,
    credentials: true,
  }));
  app.use(express.json());

  // ---- BullMQ Dashboard ----
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(emailQueue)],
    serverAdapter,
  });

  app.use('/admin/queues', serverAdapter.getRouter());

  // ---- API Routes ----
  app.use('/api', routes);

  // ---- Health Check ----
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // ---- Initialize Elasticsearch ----
  await initElasticsearch();

  // ---- Start Worker ----
  const worker = startEmailWorker();

  // ---- Recover Pending Jobs on Startup ----
  try {
    const pendingEmails = await emailService.getPendingEmailsForRecovery();
    if (pendingEmails.length > 0) {
      const recovered = await recoverPendingJobs(pendingEmails);
      console.log(`Recovered ${recovered} pending email jobs after startup`);
    }
  } catch (error) {
    console.error('Job recovery failed:', error);
  }

  // ---- Start Server ----
  app.listen(config.port, () => {
    console.log(`
╔══════════════════════════════════════════════╗
║       Email Scheduler Backend Started        ║
╠══════════════════════════════════════════════╣
║  API:        http://localhost:${config.port}          ║
║  BullMQ UI:  http://localhost:${config.port}/admin/queues ║
║  Health:     http://localhost:${config.port}/health       ║
╚══════════════════════════════════════════════╝
    `);
  });

  // ---- Graceful Shutdown ----
  const shutdown = async () => {
    console.log('Shutting down gracefully...');
    await worker.close();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
