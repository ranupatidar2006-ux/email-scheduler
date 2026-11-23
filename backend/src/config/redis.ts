import IORedis from 'ioredis';
import { config } from './env';

export const redisConnection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null, // Required by BullMQ
  enableReadyCheck: false,
});

// Separate connection for subscriber (BullMQ needs separate connections)
export function createRedisConnection() {
  return new IORedis({
    host: config.redis.host,
    port: config.redis.port,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

redisConnection.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redisConnection.on('connect', () => {
  console.log('Connected to Redis');
});
