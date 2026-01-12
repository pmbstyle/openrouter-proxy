/**
 * Authentication Middleware
 * API key-based authentication for the proxy service
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { HTTP_STATUS } from '../utils/constants';
import { AuthorizationError } from './errorHandler';

/**
 * API Key Authentication Middleware
 * Validates API keys from the X-API-Key header
 */
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  // Skip authentication if disabled or no API keys are configured (public mode)
  if (!config.authentication.enabled || config.authentication.apiKeys.length === 0) {
    next();
    return;
  }

  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    throw new AuthorizationError('API key is required');
  }

  if (!config.authentication.apiKeys.includes(apiKey)) {
    logger.warn({ ip: req.ip, userAgent: req.get('User-Agent') }, 'Invalid API key attempt');
    throw new AuthorizationError('Invalid API key');
  }

  // Attach API key info to request for logging
  (req as any).apiKey = apiKey.substring(0, 8); // Store only first 8 chars for logging

  next();
};

/**
 * Optional authentication - doesn't fail if no key provided
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const apiKey = req.headers['x-api-key'] as string;

    if (apiKey && config.authentication.apiKeys.includes(apiKey)) {
      (req as any).apiKey = apiKey.substring(0, 8);
    }

    next();
  } catch {
    next();
  }
};
