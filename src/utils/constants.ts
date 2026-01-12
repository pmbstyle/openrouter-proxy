/**
 * Application Constants
 * Centralized constants for magic numbers and configuration values
 */

export const TOKEN_ESTIMATION_RATIO = 4; // Characters per token (approximate)
export const DEFAULT_STREAM_TIMEOUT = 30000; // 30 seconds
export const WS_CONNECTION_TIMEOUT = 60000; // 1 minute
export const WS_MESSAGE_TIMEOUT = 30000; // 30 seconds
export const MAX_REQUEST_ID_ATTEMPTS = 3;

export const RATE_LIMIT = {
  CLEANUP_INTERVAL: 5 * 60 * 1000, // 5 minutes
  DEFAULT_WINDOW: 15 * 60 * 1000, // 15 minutes
  INFERENCE_WINDOW: 15 * 60 * 1000, // 15 minutes
  WS_WINDOW: 60 * 1000, // 1 minute
} as const;

export const CACHE = {
  MODEL_TTL: 5 * 60 * 1000, // 5 minutes
  MODEL_REFRESH_CHECK: 60 * 1000, // Check every minute if refresh needed
} as const;

export const ERROR_TYPES = {
  VALIDATION: 'validation',
  RATE_LIMIT: 'rate_limit',
  OPENROUTER: 'openrouter',
  INTERNAL: 'internal',
  TIMEOUT: 'timeout',
  AUTHORIZATION: 'authorization',
  NOT_FOUND: 'not_found',
} as const;

export const HTTP_STATUS = {
  OK: 200,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  REQUEST_TIMEOUT: 408,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const SENSITIVE_HEADERS = ['authorization', 'x-api-key', 'cookie', 'set-cookie'] as const;
export const SENSITIVE_FIELDS = ['password', 'token', 'key', 'secret', 'apikey', 'api_key'] as const;
