import { Redis } from 'ioredis';

const REDIS_HOST = process.env.REDIS_HOST || 'localhost';
const REDIS_PORT = process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379;
const REDIS_PASSWORD = process.env.REDIS_PASSWORD;

// Connection options for BullMQ (to avoid type conflicts)
export const redisConnectionOptions = {
  host: REDIS_HOST,
  port: REDIS_PORT,
  password: REDIS_PASSWORD,
  maxRetriesPerRequest: null,
};

const redis = new Redis(redisConnectionOptions);

redis.on('connect', () => {
  console.log('[redis] Connected to Redis');
});

redis.on('error', (err) => {
  console.error('[redis] Connection error:', err);
});

export default redis;
