/**
 * Express Application Setup
 * Main application configuration and middleware setup
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createServer, Server as HttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { config } from './utils/config';
import { logger } from './utils/logger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { defaultRateLimiter } from './middleware/rateLimiting';
import { HTTP_STATUS, CACHE, DEFAULT_STREAM_TIMEOUT } from './utils/constants';

// Import services and controllers
import { OpenRouterService } from './services/openrouterService';
import { ModelRegistryService } from './services/modelRegistryService';
import { WebSocketController } from './controllers/websocketController';

// Track active connections for graceful shutdown
const activeConnections = new Set<unknown>();
let isShuttingDown = false;

// Initialize services (singleton instances) - MUST be before route imports
const openrouterService = new OpenRouterService();
const modelRegistryService = new ModelRegistryService(openrouterService);

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
const corsOptions = {
  origin: config.cors.allowedOrigins.length > 0
    ? config.cors.allowedOrigins
    : config.server.nodeEnv === 'development'
      ? ['http://localhost:3000', 'http://localhost:3001']
      : false,
  credentials: config.cors.credentials,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request ID middleware
app.use((req, res, next) => {
  req.headers['x-request-id'] = req.headers['x-request-id'] || `req_${uuidv4()}`;
  res.setHeader('X-Request-ID', req.headers['x-request-id']);
  next();
});

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      requestId: req.headers['x-request-id'],
    }, 'HTTP request completed');
  });

  next();
});

// Rate limiting
app.use(defaultRateLimiter);

// Health check endpoint
app.get('/health', async (_req, res) => {
  const health = {
    status: 'healthy' as 'healthy' | 'unhealthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env['npm_package_version'] || '1.0.0',
    environment: config.server.nodeEnv,
    openrouter: 'unknown' as 'reachable' | 'unreachable' | 'unknown',
  };

  // Check OpenRouter connectivity
  try {
    const response = await fetch(`${config.openrouter.baseUrl}/models`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.openrouter.apiKey}`,
      },
      signal: AbortSignal.timeout(5000),
    });
    health.openrouter = response.ok ? 'reachable' : 'unreachable';
  } catch {
    health.openrouter = 'unreachable';
  }

  const statusCode = health.openrouter === 'reachable' ? HTTP_STATUS.OK : HTTP_STATUS.SERVICE_UNAVAILABLE;
  health.status = health.openrouter === 'reachable' ? 'healthy' : 'unhealthy';

  res.status(statusCode).json(health);
});

// Import routes AFTER services are initialized
import inferenceRoutes from './routes/inference';
import modelRoutes from './routes/models';

// API routes
app.use('/api/v1/inference', inferenceRoutes);
app.use('/api/v1/models', modelRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware
app.use(errorHandler);

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({
  server,
  path: '/ws',
  maxPayload: config.websocket.maxConnections * 1024, // Configurable max payload in bytes
});

// Initialize WebSocket controller
const websocketController = new WebSocketController(
  wss,
  openrouterService,
  modelRegistryService
);

// Graceful shutdown
const gracefulShutdown = async (signal: string): Promise<void> => {
  if (isShuttingDown) {
    logger.warn('Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info({ signal, activeConnections: activeConnections.size }, 'Received shutdown signal');

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed, no longer accepting new connections');
  });

  // Wait for active connections to finish (up to 30 seconds)
  const shutdownTimeout = 30000;
  const checkInterval = 1000;
  let elapsed = 0;

  while (activeConnections.size > 0 && elapsed < shutdownTimeout) {
    logger.info({ activeConnections: activeConnections.size }, 'Waiting for active connections to finish...');
    await new Promise(resolve => setTimeout(resolve, checkInterval));
    elapsed += checkInterval;
  }

  if (activeConnections.size > 0) {
    logger.warn({ activeConnections: activeConnections.size }, 'Forcing shutdown with active connections remaining');
  }

  // Close WebSocket connections
  websocketController.destroy();
  logger.info('WebSocket server closed');

  logger.info('Graceful shutdown complete');
  process.exit(0);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, 'Uncaught exception');
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error({ reason, promise }, 'Unhandled promise rejection');
  process.exit(1);
});

// Export for use in routes
export { app, server, websocketController, openrouterService, modelRegistryService };
