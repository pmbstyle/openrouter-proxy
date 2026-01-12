/**
 * Error Handling Middleware
 * Centralized error handling for the application
 */

import { Request, Response, NextFunction } from 'express';
import { logger, logError } from '../utils/logger';
import { InferenceError } from '../types/inference';

export interface ErrorWithCode extends Error {
  code?: number;
  type?: string;
  metadata?: Record<string, unknown>;
}

export const errorHandler = (
  error: ErrorWithCode,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const requestId = req.headers['x-request-id'] as string;

  // Log the error
  logError(
    {
      requestId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      path: req.path,
      method: req.method,
      error: error,
    },
    error,
    'Request error occurred'
  );

  // Handle specific error types using instanceof
  if (error instanceof ValidationError) {
    res.status(400).json({
      error: {
        code: 400,
        message: error.message || 'Validation error',
        type: 'validation',
        details: error.details,
      },
    });
    return;
  }

  if (error instanceof AuthorizationError) {
    res.status(403).json({
      error: {
        code: 403,
        message: error.message || 'Forbidden',
        type: 'authorization',
      },
    });
    return;
  }

  if (error instanceof NotFoundError) {
    res.status(404).json({
      error: {
        code: 404,
        message: error.message || 'Not found',
        type: 'not_found',
      },
    });
    return;
  }

  if (error instanceof ConflictError) {
    res.status(409).json({
      error: {
        code: 409,
        message: error.message || 'Conflict',
        type: 'conflict',
      },
    });
    return;
  }

  if (error instanceof RateLimitError) {
    res.status(429).json({
      error: {
        code: 429,
        message: error.message || 'Rate limit exceeded',
        type: 'rate_limit',
        retryAfter: 60,
      },
    });
    return;
  }

  if (error instanceof OpenRouterError) {
    const statusCode = error.code || 502;
    res.status(statusCode).json({
      error: {
        code: statusCode,
        message: error.message || 'OpenRouter API error',
        type: 'openrouter',
        metadata: error.metadata,
      },
    });
    return;
  }

  if (error instanceof TimeoutError) {
    res.status(408).json({
      error: {
        code: 408,
        message: error.message || 'Request timeout',
        type: 'timeout',
      },
    });
    return;
  }

  // Handle HTTP status codes
  if (error.code && error.code >= 400 && error.code < 600) {
    res.status(error.code).json({
      error: {
        code: error.code,
        message: error.message || 'Request failed',
        type: 'http_error',
        metadata: error.metadata,
      },
    });
    return;
  }

  // Handle error by type property
  if (error.type === 'validation') {
    res.status(400).json({
      error: {
        code: 400,
        message: error.message || 'Validation error',
        type: 'validation',
      },
    });
    return;
  }

  if (error.type === 'rate_limit') {
    res.status(429).json({
      error: {
        code: 429,
        message: error.message || 'Rate limit exceeded',
        type: 'rate_limit',
        retryAfter: 60,
      },
    });
    return;
  }

  if (error.type === 'openrouter') {
    const statusCode = error.code || 502;
    res.status(statusCode).json({
      error: {
        code: statusCode,
        message: error.message || 'OpenRouter API error',
        type: 'openrouter',
        metadata: error.metadata,
      },
    });
    return;
  }

  if (error.type === 'timeout') {
    res.status(408).json({
      error: {
        code: 408,
        message: 'Request timeout',
        type: 'timeout',
      },
    });
    return;
  }

  // Default to 500 Internal Server Error
  const statusCode = error.code || 500;
  res.status(statusCode).json({
    error: {
      code: statusCode,
      message: error.message || 'Internal server error',
      type: 'internal',
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack }),
    },
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      code: 404,
      message: `Route ${req.method} ${req.path} not found`,
      type: 'not_found',
    },
  });
};

export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Custom error classes
export class ValidationError extends Error {
  code = 400;
  type = 'validation';
  
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}


export class AuthorizationError extends Error {
  code = 403;
  type = 'authorization';
  
  constructor(message: string = 'Insufficient permissions') {
    super(message);
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends Error {
  code = 404;
  type = 'not_found';
  
  constructor(message: string = 'Resource not found') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends Error {
  code = 409;
  type = 'conflict';
  
  constructor(message: string = 'Resource conflict') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends Error {
  code = 429;
  type = 'rate_limit';
  
  constructor(message: string = 'Rate limit exceeded') {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class OpenRouterError extends Error {
  code = 502;
  type = 'openrouter';
  
  constructor(message: string, public metadata?: Record<string, unknown>) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

export class TimeoutError extends Error {
  code = 408;
  type = 'timeout';
  
  constructor(message: string = 'Request timeout') {
    super(message);
    this.name = 'TimeoutError';
  }
}
