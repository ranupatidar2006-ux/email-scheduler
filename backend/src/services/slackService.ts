import { query } from '../config/database';
import { config } from '../config/env';

export class SlackService {
  /**
   * Get Slack OAuth authorization URL.
   */
  getAuthUrl(userId: string): string {
    const params = new URLSearchParams({
      client_id: config.slackClientId,
      scope: 'chat:write,incoming-webhook',
      redirect_uri: config.slackRedirectUri,
      state: userId,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Exchange OAuth code for token and store it.
   */
  async handleCallback(code: string, userId: string): Promise<void> {
    const response = await fetch('https://slack.com/api/oauth.v2.access', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.slackClientId,
        client_secret: config.slackClientSecret,
        code,
        redirect_uri: config.slackRedirectUri,
      }),
    });

    const data = await response.json() as {
      ok: boolean;
      error?: string;
      team: { id: string; name: string };
      access_token: string;
      incoming_webhook?: { channel_id: string; channel: string; url: string };
    };

    if (!data.ok) {
      throw new Error(`Slack OAuth error: ${data.error}`);
    }

    await query(
      `INSERT INTO slack_integrations (user_id, slack_team_id, slack_team_name, slack_access_token, slack_webhook_url, slack_channel_id, slack_channel_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, slack_team_id) DO UPDATE SET
         slack_access_token = EXCLUDED.slack_access_token,
         slack_webhook_url = EXCLUDED.slack_webhook_url,
         slack_channel_id = EXCLUDED.slack_channel_id,
         slack_channel_name = EXCLUDED.slack_channel_name,
         connected_at = NOW()`,
      [
        userId,
        data.team.id,
        data.team.name,
        data.access_token,
        data.incoming_webhook?.url || null,
        data.incoming_webhook?.channel_id || null,
        data.incoming_webhook?.channel || null,
      ]
    );
  }

  /**
   * Send a Slack notification about rate limit being hit.
   */
  async notifyRateLimitHit(userId: string, senderEmail: string, currentCount: number, limit: number): Promise<void> {
    const result = await query(
      `SELECT * FROM slack_integrations WHERE user_id = $1 LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // No Slack connected — silently skip
      console.log(`No Slack integration for user ${userId}, skipping rate limit notification`);
      return;
    }

    const integration = result.rows[0];
    const webhookUrl = integration.slack_webhook_url;
    const accessToken = integration.slack_access_token;

    const message = {
      text: `⚠️ *Rate Limit Reached*\n\nSender: \`${senderEmail}\`\nEmails sent this hour: *${currentCount}/${limit}*\nEmails will be delayed until the next hour window.\n\n_Sent by Email Scheduler_`,
    };

    try {
      if (webhookUrl) {
        // Use incoming webhook
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(message),
        });
      } else if (accessToken && integration.slack_channel_id) {
        // Use chat.postMessage API
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            channel: integration.slack_channel_id,
            ...message,
          }),
        });
      }

      console.log(`Slack notification sent for rate limit hit: ${senderEmail}`);
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      // Don't throw — Slack notification failure shouldn't block email processing
    }
  }

  async getIntegration(userId: string) {
    const result = await query(
      `SELECT id, user_id, slack_team_name, slack_channel_name, connected_at FROM slack_integrations WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  async disconnect(userId: string): Promise<void> {
    await query(`DELETE FROM slack_integrations WHERE user_id = $1`, [userId]);
  }
}

export const slackService = new SlackService();
