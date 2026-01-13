/**
 * Server Entry Point
 * Starts the HTTP and WebSocket servers
 */

import { config, validateConfig } from './utils/config';
import { logger } from './utils/logger';
import { app, server } from './app';
import { closeRateLimiting } from './middleware/rateLimiting';
import { initializeOpenTelemetry } from './telemetry/opentelemetry';

// Initialize OpenTelemetry before anything else
initializeOpenTelemetry();

const gracefulShutdown = async (signal: string): Promise<void> => {
  logger.info({ signal }, 'Received shutdown signal');

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  // Close Redis connection
  try {
    await closeRateLimiting();
  } catch (error) {
    logger.error({ error }, 'Error closing Redis connection');
  }

  logger.info('Graceful shutdown complete');
  process.exit(0);
};

const startServer = async (): Promise<void> => {
  try {
    // Validate configuration
    validateConfig();
    logger.info('Configuration validated successfully');

    // Start server
    const port = config.server.port;
    const host = config.server.host;

    server.listen(port, host, () => {
      logger.info({
        port,
        host,
        environment: config.server.nodeEnv,
        pid: process.pid,
      }, 'Server started successfully');

      logger.info({
        http: `http://${host}:${port}`,
        websocket: `ws://${host}:${port}/ws`,
        health: `http://${host}:${port}/health`,
        api: `http://${host}:${port}/api/v1`,
      }, 'Available endpoints');
    });

    // Handle server errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error({ port }, 'Port is already in use');
        process.exit(1);
      } else {
        logger.error({ error: error.message }, 'Server error');
        process.exit(1);
      }
    });

    // Handle graceful shutdown
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to start server');
    process.exit(1);
  }
};

// Start the server
startServer();
