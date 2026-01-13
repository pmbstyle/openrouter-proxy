/**
 * Unit Tests: Authentication Middleware
 */

import { Request, Response, NextFunction } from 'express';
import { authenticateApiKey, optionalAuth } from '../../../src/middleware/authentication';
import { AuthorizationError } from '../../../src/middleware/errorHandler';

// Mock config
jest.mock('../../../src/utils/config', () => ({
  config: {
    authentication: {
      enabled: true,
      apiKeys: ['valid-key-123', 'another-key-456'],
    },
    server: {
      nodeEnv: 'test',
    },
  },
}));

// Mock logger
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Authentication Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      ip: '127.0.0.1',
      get: jest.fn((header) => {
        if (header === 'User-Agent') return 'test-agent';
        return undefined;
      }),
    };
    mockRes = {};
    mockNext = jest.fn();
  });

  describe('authenticateApiKey', () => {
    it('should allow valid API key', () => {
      mockReq.headers['x-api-key'] = 'valid-key-123';

      authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('valid-key');
    });

    it('should reject missing API key', () => {
      expect(() => {
        authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AuthorizationError);
      expect(() => {
        authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow('API key is required');
    });

    it('should reject invalid API key', () => {
      mockReq.headers['x-api-key'] = 'invalid-key';

      expect(() => {
        authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AuthorizationError);
      expect(() => {
        authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow('Invalid API key');
    });

    it('should reject in production when authentication disabled', () => {
      const { config } = require('../../../src/utils/config');
      config.server.nodeEnv = 'production';
      config.authentication.enabled = false;

      expect(() => {
        authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AuthorizationError);
      expect(() => {
        authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow('Authentication required in production');
    });

    it('should allow in development when authentication disabled', () => {
      const { config } = require('../../../src/utils/config');
      config.server.nodeEnv = 'development';
      config.authentication.enabled = false;

      authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
    });

    it('should reject when no API keys configured', () => {
      const { config } = require('../../../src/utils/config');
      config.authentication.apiKeys = [];

      mockReq.headers['x-api-key'] = 'some-key';

      expect(() => {
        authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow(AuthorizationError);
      expect(() => {
        authenticateApiKey(mockReq as Request, mockRes as Response, mockNext);
      }).toThrow('Server configuration error: no API keys configured');
    });
  });

  describe('optionalAuth', () => {
    it('should not fail without API key', () => {
      optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBeUndefined();
    });

    it('should attach valid API key info', () => {
      mockReq.headers['x-api-key'] = 'valid-key-123';

      optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBe('valid-key');
    });

    it('should not attach info for invalid key', () => {
      mockReq.headers['x-api-key'] = 'invalid-key';

      optionalAuth(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalledWith();
      expect((mockReq as any).apiKey).toBeUndefined();
    });

    it('should handle exceptions gracefully', () => {
      // Force an exception by making req.headers throw
      mockReq.get = jest.fn(() => {
        throw new Error('Test error');
      });

      // Should not throw, should call next
      expect(() => {
        optionalAuth(mockReq as Request, mockRes as Response, mockNext);
      }).not.toThrow();

      expect(mockNext).toHaveBeenCalledWith();
    });
  });
});
