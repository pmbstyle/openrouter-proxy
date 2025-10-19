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

  // Handle different types of errors
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
        retryAfter: 60, // seconds
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

  // Handle specific error types
  if (error.name === 'ValidationError') {
    res.status(400).json({
      error: {
        code: 400,
        message: 'Validation error',
        type: 'validation',
        details: error.message,
      },
    });
    return;
  }


  if (error.name === 'ForbiddenError') {
    res.status(403).json({
      error: {
        code: 403,
        message: 'Forbidden',
        type: 'authorization',
      },
    });
    return;
  }

  if (error.name === 'NotFoundError') {
    res.status(404).json({
      error: {
        code: 404,
        message: 'Not found',
        type: 'not_found',
      },
    });
    return;
  }

  if (error.name === 'ConflictError') {
    res.status(409).json({
      error: {
        code: 409,
        message: 'Conflict',
        type: 'conflict',
      },
    });
    return;
  }

  if (error.name === 'TooManyRequestsError') {
    res.status(429).json({
      error: {
        code: 429,
        message: 'Too many requests',
        type: 'rate_limit',
      },
    });
    return;
  }

  // Handle OpenRouter specific errors
  if (error.message?.includes('OpenRouter')) {
    res.status(502).json({
      error: {
        code: 502,
        message: 'OpenRouter service unavailable',
        type: 'openrouter',
      },
    });
    return;
  }

  // Handle timeout errors
  if (error.message?.includes('timeout')) {
    res.status(408).json({
      error: {
        code: 408,
        message: 'Request timeout',
        type: 'timeout',
      },
    });
    return;
  }

  // Handle network errors
  if (error.message?.includes('ECONNREFUSED') || error.message?.includes('ENOTFOUND')) {
    res.status(503).json({
      error: {
        code: 503,
        message: 'Service unavailable',
        type: 'network_error',
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
