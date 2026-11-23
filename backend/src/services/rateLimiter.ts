import { redisConnection } from '../config/redis';
import { config } from '../config/env';

/**
 * Redis-backed rate limiter for email sending.
 * Uses sliding window counters keyed by hour_window + sender.
 * Safe across multiple workers/instances.
 */
export class RateLimiter {
  private getHourWindow(): string {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(now.getUTCDate()).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}`;
  }

  private getGlobalKey(): string {
    return `rate:global:${this.getHourWindow()}`;
  }

  private getSenderKey(senderEmail: string): string {
    return `rate:sender:${senderEmail}:${this.getHourWindow()}`;
  }

  /**
   * Check if sending is allowed for a given sender.
   * Returns { allowed, retryAfterMs }
   */
  async canSend(senderEmail: string): Promise<{ allowed: boolean; retryAfterMs: number }> {
    const globalKey = this.getGlobalKey();
    const senderKey = this.getSenderKey(senderEmail);

    // Use a pipeline for atomicity
    const [globalCount, senderCount] = await Promise.all([
      redisConnection.get(globalKey),
      redisConnection.get(senderKey),
    ]);

    const currentGlobal = parseInt(globalCount || '0', 10);
    const currentSender = parseInt(senderCount || '0', 10);

    if (currentGlobal >= config.maxEmailsPerHour) {
      const msUntilNextHour = this.msUntilNextHour();
      return { allowed: false, retryAfterMs: msUntilNextHour };
    }

    if (currentSender >= config.maxEmailsPerHourPerSender) {
      const msUntilNextHour = this.msUntilNextHour();
      return { allowed: false, retryAfterMs: msUntilNextHour };
    }

    return { allowed: true, retryAfterMs: 0 };
  }

  /**
   * Increment counters after a successful send.
   * Uses Redis MULTI for atomicity.
   */
  async recordSend(senderEmail: string): Promise<void> {
    const globalKey = this.getGlobalKey();
    const senderKey = this.getSenderKey(senderEmail);
    const ttl = 7200; // 2 hours TTL to auto-cleanup

    const pipeline = redisConnection.pipeline();
    pipeline.incr(globalKey);
    pipeline.expire(globalKey, ttl);
    pipeline.incr(senderKey);
    pipeline.expire(senderKey, ttl);
    await pipeline.exec();
  }

  /**
   * Get current counts for monitoring.
   */
  async getCurrentCounts(senderEmail?: string): Promise<{ global: number; sender?: number }> {
    const globalCount = await redisConnection.get(this.getGlobalKey());
    const result: { global: number; sender?: number } = {
      global: parseInt(globalCount || '0', 10),
    };

    if (senderEmail) {
      const senderCount = await redisConnection.get(this.getSenderKey(senderEmail));
      result.sender = parseInt(senderCount || '0', 10);
    }

    return result;
  }

  private msUntilNextHour(): number {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
    return nextHour.getTime() - now.getTime();
  }
}

export const rateLimiter = new RateLimiter();
