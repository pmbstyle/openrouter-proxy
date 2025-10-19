/**
 * Structured Logging Infrastructure
 * Using Pino for high-performance logging
 */

import pino from 'pino';
import { config } from './config';

const createLogger = () => {
  const isDevelopment = config.server.nodeEnv === 'development';
  const isTest = config.server.nodeEnv === 'test';

  const baseConfig: pino.LoggerOptions = {
    level: config.logging.level,
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  if (isDevelopment && !isTest) {
    return pino(
      {
        ...baseConfig,
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
      },
      pino.destination(1) // stdout
    );
  }

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
  logger.error({ ...context, error: error.message, stack: error.stack, type: 'error' }, message);
};

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
