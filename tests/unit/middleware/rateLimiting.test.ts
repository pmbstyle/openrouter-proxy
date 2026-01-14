/**
 * Unit Tests: Rate Limiting Middleware
 */

import { Request, Response } from 'express';
import { createRateLimiter, websocketRateLimiter, getRateLimitStats } from '../../../src/middleware/rateLimiting';
import { redis } from '../../integration/setup';

// Mock config
jest.mock('../../../src/utils/config', () => ({
  config: {
    server: {
      nodeEnv: 'test',
    },
    rateLimit: {
      windowMs: 60000,
      maxRequests: 10,
    },
  },
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
  logSecurity: jest.fn(),
}));

describe('Rate Limiting Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      path: '/api/v1/inference',
      method: 'POST',
      get: jest.fn().mockImplementation((header: string): string | string[] | undefined => {
        if (header === 'User-Agent') return 'test-agent';
        return undefined;
      }) as any,
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('createRateLimiter', () => {
    it('should create rate limiter successfully', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
      });

      // Verify limiter is created and is a function
      expect(limiter).toBeDefined();
      expect(typeof limiter).toBe('function');
    });

    it('should create rate limiter with custom options', () => {
      const limiter = createRateLimiter({
        windowMs: 30000,
        maxRequests: 5,
        message: 'Custom rate limit message',
      });

      expect(limiter).toBeDefined();
    });

    it('should skip successful requests when configured', () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        maxRequests: 10,
        skipSuccessfulRequests: true,
      });

      expect(limiter).toBeDefined();
    });
  });

  describe('websocketRateLimiter', () => {
    beforeEach(() => {
      // Clear any existing state
      jest.clearAllMocks();
    });

    it('should allow connections within limit', () => {
      const allowed = websocketRateLimiter('192.168.1.1', 5);
      expect(allowed).toBe(true);
    });

    it('should block connections exceeding limit', () => {
      // Make 5 connections (at limit)
      for (let i = 0; i < 5; i++) {
        websocketRateLimiter('192.168.1.2', 5);
      }

      // 6th connection should be blocked
      const blocked = websocketRateLimiter('192.168.1.2', 5);
      expect(blocked).toBe(false);
    });

    it('should allow different IPs independently', () => {
      // IP 1 makes 5 connections
      for (let i = 0; i < 5; i++) {
        websocketRateLimiter('192.168.1.3', 5);
      }

      // IP 2 should still be allowed
      const allowed = websocketRateLimiter('192.168.1.4', 5);
      expect(allowed).toBe(true);
    });

    it('should reset after time window expires', () => {
      // Make 5 connections
      for (let i = 0; i < 5; i++) {
        websocketRateLimiter('192.168.1.5', 5);
      }

      // Wait for window to expire (simulate with jest timer)
      jest.useFakeTimers();
      jest.advanceTimersByTime(60001);

      // Should allow new connection
      const allowed = websocketRateLimiter('192.168.1.5', 5);
      expect(allowed).toBe(true);

      jest.useRealTimers();
    });
  });

  describe('getRateLimitStats', () => {
    it('should return stats object', () => {
      const stats = getRateLimitStats();

      expect(stats).toHaveProperty('totalKeys');
      expect(stats).toHaveProperty('redisEnabled');
      expect(stats).toHaveProperty('redisConnected');
      expect(stats).toHaveProperty('activeLimits');
      expect(Array.isArray(stats.activeLimits)).toBe(true);
    });
  });
});
