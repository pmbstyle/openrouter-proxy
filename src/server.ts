/**
 * Server Entry Point
 * Starts the HTTP and WebSocket servers
 */

import { config, validateConfig } from './utils/config';
import { logger } from './utils/logger';
import { app, server } from './app';

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

  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to start server');
    process.exit(1);
  }
};

// Start the server
startServer();
