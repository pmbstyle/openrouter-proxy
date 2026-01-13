/**
 * Rate Limiting Middleware
 * Implements distributed rate limiting using Redis in production
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';
import { config } from '../utils/config';
import { logger, logSecurity } from '../utils/logger';

// Redis client for distributed rate limiting
let redisClient: ReturnType<typeof createClient> | null = null;
let redisConnecting = false;
let redisConnected = false;

// Initialize Redis client in production or when REDIS_URL is provided
const initializeRedisClient = async (): Promise<void> => {
  const redisUrl = process.env.REDIS_URL;

  // Only use Redis if explicitly configured (production or testing with Redis)
  if (!redisUrl) {
    logger.info('REDIS_URL not configured, using in-memory rate limiting');
    return;
  }

  if (redisConnecting || redisConnected) {
    return; // Already initializing or connected
  }

  redisConnecting = true;

  try {
    const client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries: number) => Math.min(retries * 50, 500),
      },
    });

    client.on('error', (err: Error) => {
      logger.error({ error: err.message }, 'Redis client error');
      redisConnected = false;
    });

    client.on('connect', () => {
      logger.info('Redis client connected for rate limiting');
      redisConnected = true;
      redisConnecting = false;
    });

    // Wait for connection to be established
    await client.connect();
    redisClient = client;
  } catch (error) {
    logger.error({ error }, 'Failed to initialize Redis client');
    redisConnected = false;
    redisConnecting = false;
    redisClient = null;
  }
};

// Initialize Redis client on module load (non-blocking)
if (config.server.nodeEnv === 'production' || process.env.REDIS_URL) {
  initializeRedisClient().catch(() => {
    // Error already logged in initializeRedisClient
  });
}

export const createRateLimiter = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  // Use Redis store in production if connected, otherwise use memory store
  const store = (config.server.nodeEnv === 'production' && redisConnected && redisClient)
    ? new RedisStore({
        sendCommand: async (...args: string[]) => {
          return await redisClient!.sendCommand(args);
        },
        prefix: 'rate_limit:',
      })
    : undefined;

  return rateLimit({
    store,
    windowMs: options.windowMs,
    max: options.maxRequests,
    message: options.message || 'Too many requests, please try again later',
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req: Request, res: Response) => {
      logSecurity({
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      }, 'Rate limit exceeded');

      res.status(429).json({
        error: {
          code: 429,
          message: options.message || 'Too many requests, please try again later',
          retryAfter: Math.ceil(options.windowMs / 1000),
        },
      });
    },
  });
};

// Default rate limiter
export const defaultRateLimiter = createRateLimiter({
  windowMs: config.rateLimit.windowMs,
  maxRequests: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later',
});

// Strict rate limiter for inference endpoints
export const inferenceRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 50, // 50 requests per 15 minutes
  message: 'Too many inference requests, please try again later',
});

// WebSocket rate limiter (still uses in-memory Map for simplicity)
const wsConnectionCounts = new Map<string, { count: number; resetTime: number }>();

export const websocketRateLimiter = (connectionId: string, maxConnections: number = 5): boolean => {
  const key = `ws:${connectionId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = maxConnections;

  const wsLimit = wsConnectionCounts.get(key);

  if (!wsLimit || now > wsLimit.resetTime) {
    wsConnectionCounts.set(key, {
      count: 1,
      resetTime: now + windowMs,
    });
    return true;
  }

  if (wsLimit.count >= maxRequests) {
    logSecurity({ connectionId }, 'WebSocket rate limit exceeded');
    return false;
  }

  wsLimit.count++;
  return true;
};

// Cleanup old rate limit entries (for in-memory WebSocket rate limiting)
export const cleanupRateLimits = (): void => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, limit] of wsConnectionCounts.entries()) {
    if (now > limit.resetTime) {
      wsConnectionCounts.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info({ cleanedCount }, 'Cleaned up expired WebSocket rate limits');
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

export const getRateLimitStats = () => {
  return {
    totalKeys: wsConnectionCounts.size,
    redisEnabled: !!redisClient,
    redisConnected: redisConnected,
    activeLimits: Array.from(wsConnectionCounts.entries()).map(([key, limit]) => ({
      key,
      count: limit.count,
      resetTime: new Date(limit.resetTime),
    })),
  };
};

// Graceful shutdown: close Redis connection
export const closeRateLimiting = async (): Promise<void> => {
  if (redisClient && redisConnected) {
    try {
      await redisClient.quit();
      redisConnected = false;
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error({ error }, 'Error closing Redis connection');
    }
  }
};
