/**
 * Configuration Management
 * Handles environment-specific configuration loading
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

export type Config = {
  server: {
    port: number;
    host: string;
    nodeEnv: string;
  };
  openrouter: {
    apiKey: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
  };
  logging: {
    level: string;
  };
  websocket: {
    maxConnections: number;
    heartbeatInterval: number;
  };
  performance: {
    maxConcurrentRequests: number;
    requestTimeout: number;
  };
};

const loadConfig = (): Config => {
  const nodeEnv = process.env.NODE_ENV || 'development';
  
  // Load environment-specific config
  let envConfig = {}; 
  try {
    const configPath = path.join(__dirname, '../../config', `${nodeEnv}.json`);
    envConfig = require(configPath);
  } catch (error) {
    // Config file doesn't exist, use defaults
  }

  const defaultConfig = {
    server: {
      port: parseInt(process.env.PORT || '3000', 10),
      host: process.env.HOST || '0.0.0.0',
      nodeEnv,
    },
    openrouter: {
      apiKey: process.env.OPENROUTER_API_KEY || '',
      baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
      timeout: parseInt(process.env.OPENROUTER_TIMEOUT || '30000', 10),
      maxRetries: parseInt(process.env.OPENROUTER_MAX_RETRIES || '3', 10),
    },
    rateLimit: {
      windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
      maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    },
    logging: {
      level: process.env.LOG_LEVEL || 'info',
    },
    websocket: {
      maxConnections: parseInt(process.env.WS_MAX_CONNECTIONS || '1000', 10),
      heartbeatInterval: parseInt(process.env.WS_HEARTBEAT_INTERVAL || '30000', 10),
    },
    performance: {
      maxConcurrentRequests: parseInt(process.env.MAX_CONCURRENT_REQUESTS || '100', 10),
      requestTimeout: parseInt(process.env.REQUEST_TIMEOUT || '30000', 10),
    },
  };

  // Deep merge environment config with defaults
  const deepMerge = (target: any, source: any): any => {
    const result = { ...target };
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }
    return result;
  };

  return deepMerge(defaultConfig, envConfig);
};

export const config = loadConfig();

export const validateConfig = (): void => {
  const errors: string[] = [];

  if (!config.openrouter.apiKey) {
    errors.push('OPENROUTER_API_KEY is required');
  }

  if (config.openrouter.apiKey === 'your_openrouter_api_key_here') {
    errors.push('OPENROUTER_API_KEY must be set to a valid API key');
  }

  if (config.server.port < 1 || config.server.port > 65535) {
    errors.push('PORT must be between 1 and 65535');
  }

  if (config.rateLimit.maxRequests < 1) {
    errors.push('RATE_LIMIT_MAX_REQUESTS must be greater than 0');
  }

  if (config.websocket.maxConnections < 1) {
    errors.push('WS_MAX_CONNECTIONS must be greater than 0');
  }

  // Validate environment-specific settings
  if (config.server.nodeEnv === 'production') {
    if (config.openrouter.baseUrl !== 'https://openrouter.ai/api/v1') {
      errors.push('OPENROUTER_BASE_URL should use production URL in production');
    }
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
};
