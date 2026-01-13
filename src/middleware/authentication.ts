/**
 * Authentication Middleware
 * API key-based authentication for the proxy service
 */

import { Request, Response, NextFunction } from 'express';
import { config } from '../utils/config';
import { logger } from '../utils/logger';
import { AuthorizationError } from './errorHandler';

/**
 * API Key Authentication Middleware
 * Validates API keys from the X-API-Key header
 */
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  // CRITICAL: In production, authentication must ALWAYS be enabled
  if (config.server.nodeEnv === 'production' && !config.authentication.enabled) {
    logger.error('Authentication must be enabled in production');
    throw new AuthorizationError('Authentication required in production');
  }

  // In development/test, warn but allow for testing purposes
  if (!config.authentication.enabled) {
    if (config.server.nodeEnv !== 'production') {
      logger.warn('Authentication disabled - development mode only');
      next();
      return;
    }
    throw new AuthorizationError('Authentication required');
  }

  // Ensure API keys are configured
  if (config.authentication.apiKeys.length === 0) {
    logger.error('No API keys configured');
    throw new AuthorizationError('Server configuration error: no API keys configured');
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
