/**
 * Metrics Middleware
 * Records HTTP request metrics using OpenTelemetry
 */

import { Request, Response, NextFunction } from 'express';
import {
  requestCounter,
  requestDuration,
  activeRequests,
  errorCounter,
} from '../telemetry/metrics';

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  // Increment active requests
  activeRequests.add(1, {
    method: req.method,
    path: req.route?.path || req.path,
  });

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Record request
    requestCounter.add(1, {
      method: req.method,
      path: req.route?.path || req.path,
      status,
    });

    // Record duration
    requestDuration.record(duration, {
      method: req.method,
      path: req.route?.path || req.path,
      status,
    });

    // Track errors
    if (status >= 400) {
      errorCounter.add(1, {
        method: req.method,
        path: req.route?.path || req.path,
        status,
        error_type: status >= 500 ? 'server_error' : 'client_error',
      });
    }

    // Decrement active requests
    activeRequests.add(-1, {
      method: req.method,
      path: req.route?.path || req.path,
    });
  });

  next();
};
