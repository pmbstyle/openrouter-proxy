import { Redis } from 'ioredis';

let redis: Redis | null = null;

beforeAll(async () => {
  // Setup test Redis instance if REDIS_URL is provided
  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    redis = new Redis({
      host: 'localhost',
      port: 6379,
      db: 15, // Use separate DB for tests
      maxRetriesPerRequest: 3,
    });

    // Flush test DB before all tests
    try {
      await redis.flushdb();
      console.log('Test Redis database flushed');
    } catch (error) {
      console.warn('Could not connect to Redis, skipping Redis tests:', error);
      redis = null;
    }
  } else {
    console.log('REDIS_URL not set, Redis tests will be skipped');
  }
});

afterAll(async () => {
  if (redis) {
    await redis.flushdb();
    await redis.quit();
    console.log('Test Redis connection closed');
  }
});

beforeEach(async () => {
  // Flush before each test
  if (redis) {
    await redis.flushdb();
  }
});

export { redis };
