import { Request, Response } from 'express';
import { slackService } from '../services/slackService';
import { config } from '../config/env';

export class SlackController {
  /**
   * GET /api/slack/connect
   * Returns Slack OAuth URL for the user.
   */
  async connect(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const authUrl = slackService.getAuthUrl(userId);
    res.json({ url: authUrl });
  }

  /**
   * GET /api/slack/callback
   * Handles Slack OAuth callback.
   */
  async callback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state: userId } = req.query;

      if (!code || !userId) {
        res.status(400).json({ error: 'Missing code or state' });
        return;
      }

      await slackService.handleCallback(code as string, userId as string);

      // Redirect back to frontend with success
      res.redirect(`${config.frontendUrl}/dashboard?slack=connected`);
    } catch (error) {
      console.error('Slack callback error:', error);
      res.redirect(`${config.frontendUrl}/dashboard?slack=error`);
    }
  }

  /**
   * GET /api/slack/status
   */
  async status(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    const integration = await slackService.getIntegration(userId);
    res.json({
      connected: !!integration,
      integration,
    });
  }

  /**
   * POST /api/slack/disconnect
   */
  async disconnect(req: Request, res: Response): Promise<void> {
    const userId = req.user!.id;
    await slackService.disconnect(userId);
    res.json({ message: 'Slack disconnected' });
  }
}

export const slackController = new SlackController();
