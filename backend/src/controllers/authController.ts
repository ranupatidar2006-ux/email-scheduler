import { Request, Response } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { query } from '../config/database';
import { config } from '../config/env';

const googleClient = new OAuth2Client(config.googleClientId);

export class AuthController {
  /**
   * POST /api/auth/google
   * Verify Google token and return user data.
   */
  async googleLogin(req: Request, res: Response): Promise<void> {
    try {
      const { token } = req.body;

      if (!token) {
        res.status(400).json({ error: 'Token is required' });
        return;
      }

      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: config.googleClientId,
      });

      const payload = ticket.getPayload();
      if (!payload) {
        res.status(401).json({ error: 'Invalid token' });
        return;
      }

      // Upsert user
      const result = await query(
        `INSERT INTO users (google_id, email, name, avatar_url)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (google_id) DO UPDATE SET
           email = EXCLUDED.email,
           name = EXCLUDED.name,
           avatar_url = EXCLUDED.avatar_url
         RETURNING id, google_id, email, name, avatar_url, created_at`,
        [payload.sub, payload.email, payload.name, payload.picture]
      );

      res.json({
        user: result.rows[0],
        token, // Return the same Google token for subsequent API calls
      });
    } catch (error) {
      console.error('Google auth error:', error);
      res.status(401).json({ error: 'Authentication failed' });
    }
  }

  /**
   * GET /api/auth/me
   */
  async getMe(req: Request, res: Response): Promise<void> {
    res.json({ user: req.user });
  }
}

export const authController = new AuthController();
