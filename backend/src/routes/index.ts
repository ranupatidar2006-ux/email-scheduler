import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../middleware/auth';
import { emailController } from '../controllers/emailController';
import { authController } from '../controllers/authController';
import { slackController } from '../controllers/slackController';
import { uploadController } from '../controllers/uploadController';
import { rateLimiter } from '../services/rateLimiter';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ---- Auth Routes ----
router.post('/auth/google', (req, res) => authController.googleLogin(req, res));
router.get('/auth/me', authMiddleware, (req, res) => authController.getMe(req, res));

// ---- Email Routes (all protected) ----
router.post('/emails/schedule', authMiddleware, (req, res) => emailController.scheduleBatch(req, res));
router.get('/emails/scheduled', authMiddleware, (req, res) => emailController.getScheduled(req, res));
router.get('/emails/sent', authMiddleware, (req, res) => emailController.getSent(req, res));
router.get('/emails/search', authMiddleware, (req, res) => emailController.search(req, res));
router.get('/emails/:id', authMiddleware, (req, res) => emailController.getById(req, res));

// ---- File Upload Routes ----
router.post('/upload/csv', authMiddleware, upload.single('file'), (req, res) => uploadController.parseCSV(req, res));

// ---- Slack Routes ----
router.get('/slack/connect', authMiddleware, (req, res) => slackController.connect(req, res));
router.get('/slack/callback', (req, res) => slackController.callback(req, res)); // No auth — this is an OAuth redirect
router.get('/slack/status', authMiddleware, (req, res) => slackController.status(req, res));
router.post('/slack/disconnect', authMiddleware, (req, res) => slackController.disconnect(req, res));

// ---- Rate Limit Status (for dashboard) ----
router.get('/rate-limit/status', authMiddleware, async (req, res) => {
  try {
    const senderEmail = req.query.sender_email as string;
    const counts = await rateLimiter.getCurrentCounts(senderEmail);
    res.json(counts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get rate limit status' });
  }
});

export default router;
