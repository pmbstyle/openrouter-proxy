/**
 * Rate Limiting Middleware
 * Implements rate limiting for API requests
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import { config } from '../utils/config';
import { logger, logSecurity } from '../utils/logger';

// In-memory store for rate limiting (in production, use Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>();

export const createRateLimiter = (options: {
  windowMs: number;
  maxRequests: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
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


// WebSocket rate limiter
export const websocketRateLimiter = (connectionId: string, maxConnections: number = 5): boolean => {
  const key = `ws:${connectionId}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = maxConnections;

  const wsLimit = requestCounts.get(key);
  
  if (!wsLimit || now > wsLimit.resetTime) {
    requestCounts.set(key, {
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

// Cleanup old rate limit entries
export const cleanupRateLimits = (): void => {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, limit] of requestCounts.entries()) {
    if (now > limit.resetTime) {
      requestCounts.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info({ cleanedCount }, 'Cleaned up expired rate limits');
  }
};

// Run cleanup every 5 minutes
setInterval(cleanupRateLimits, 5 * 60 * 1000);

export const getRateLimitStats = () => {
  return {
    totalKeys: requestCounts.size,
    activeLimits: Array.from(requestCounts.entries()).map(([key, limit]) => ({
      key,
      count: limit.count,
      resetTime: new Date(limit.resetTime),
    })),
  };
};
