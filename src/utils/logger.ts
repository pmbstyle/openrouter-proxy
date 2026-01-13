/**
 * Structured Logging Infrastructure
 * Using Pino for high-performance logging
 */

import pino from 'pino';
import { config } from './config';
import { SENSITIVE_HEADERS, SENSITIVE_FIELDS } from './constants';

/**
 * Sanitize sensitive data from strings (API keys, tokens, passwords)
 */
const sanitizeSensitiveData = (str: string | undefined): string => {
  if (!str) return '';

  let sanitized = str;

  // Redact Bearer tokens
  sanitized = sanitized.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer [REDACTED]');

  // Redact API keys (common patterns)
  sanitized = sanitized.replace(/(?:api[_-]?key|apikey|authorization)["\s:]+[A-Za-z0-9\-._~+/]+=*/gi, '$1: [REDACTED]');

  // Redact password fields
  sanitized = sanitized.replace(/password["\s:]+[^\s"']+/gi, 'password: [REDACTED]');

  // Redact token fields
  sanitized = sanitized.replace(/(?:token|secret)["\s:]+[A-Za-z0-9\-._~+/]+=*/gi, '$1: [REDACTED]');

  // Redact OpenRouter API keys (sk-or-...)
  sanitized = sanitized.replace(/sk-or-[a-zA-Z0-9\-_]+/g, 'sk-or-[REDACTED]');

  return sanitized;
};

/**
 * Sanitize file paths in stack traces (remove absolute paths)
 */
const sanitizeStackTrace = (stack: string | undefined): string | undefined => {
  if (!stack) return undefined;

  const lines = stack.split('\n');
  const sanitized = lines
    .map(line => {
      // Remove absolute paths, keep only relative paths from project root
      return line
        .replace(/\/[^\s]+\/src\//g, 'src/')
        .replace(/\/[^\s]+\/dist\//g, 'dist/')
        .replace(/\/[^\s]+\/node_modules\//g, 'node_modules/')
        .replace(/\/home\/[^\s]+/g, '~')
        .replace(/\/Users\/[^\s]+/g, '~')
        .replace(/\/mnt\/[^\s]+/g, '~');
    })
    .join('\n');

  return sanitized;
};

/**
 * Sanitize log context by removing sensitive headers and fields
 */
const sanitizeContext = (context: LogContext): LogContext => {
  const sanitized = { ...context };

  // Redact sensitive headers
  for (const header of SENSITIVE_HEADERS) {
    const key = header as keyof LogContext;
    if (sanitized[key]) {
      (sanitized as any)[key] = '[REDACTED]';
    }
  }

  // Sanitize error message and stack
  if (sanitized.error) {
    if (sanitized.error instanceof Error) {
      sanitized.error = {
        name: sanitized.error.name,
        message: sanitizeSensitiveData(sanitized.error.message),
        ...(sanitized.error.stack && { stack: sanitizeStackTrace(sanitized.error.stack) }),
      };
    }
  }

  return sanitized;
};

const createLogger = () => {
  const isDevelopment = config.server.nodeEnv === 'development';
  const isTest = config.server.nodeEnv === 'test';
  const isProduction = config.server.nodeEnv === 'production';

  const baseConfig: pino.LoggerOptions = {
    level: config.logging.level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Add service context to all logs for production
    base: {
      service: 'llm-proxy',
      environment: config.server.nodeEnv,
      version: process.env.npm_package_version || '1.0.0',
      ...(isProduction && {
        pid: process.pid,
        hostname: require('os').hostname(),
      }),
    },
  };

  // Development: pretty-printed logs with colors
  if (isDevelopment && !isTest) {
    return pino(
      {
        ...baseConfig,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname,service,environment,version',
            singleLine: false,
          },
        },
      },
      pino.destination(1) // stdout
    );
  }

  // Production/Test: structured JSON logs
  return pino(baseConfig, pino.destination(1));
};

export const logger = createLogger();

export type LogContext = {
  requestId?: string;
  model?: string;
  duration?: number;
  tokens?: number;
  cost?: number;
  error?: Error;
  [key: string]: unknown;
};

export const createRequestLogger = (context: LogContext) => {
  return logger.child(context);
};

export const logRequest = (context: LogContext, message: string) => {
  logger.info({ ...context, type: 'request' }, message);
};

export const logResponse = (context: LogContext, message: string) => {
  logger.info({ ...context, type: 'response' }, message);
};

export const logError = (context: LogContext, error: Error, message: string) => {
  const sanitizedContext = sanitizeContext(context);

  logger.error({
    ...sanitizedContext,
    error: {
      name: error.name,
      message: sanitizeSensitiveData(error.message),
      ...(error.stack && { stack: sanitizeStackTrace(error.stack) }),
    },
    type: 'error'
  }, message);
};

// Export sanitization functions for use in other modules
export { sanitizeStackTrace, sanitizeSensitiveData };

export const logUsage = (context: LogContext, message: string) => {
  logger.info({ ...context, type: 'usage' }, message);
};

export const logPerformance = (context: LogContext, message: string) => {
  logger.info({ ...context, type: 'performance' }, message);
};

export const logWebSocket = (context: LogContext, message: string) => {
  logger.info({ ...context, type: 'websocket' }, message);
};

export const logSecurity = (context: LogContext, message: string) => {
  logger.warn({ ...context, type: 'security' }, message);
};

export const logHealth = (context: LogContext, message: string) => {
  logger.info({ ...context, type: 'health' }, message);
};
