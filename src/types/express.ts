/**
 * Extended Express Request Types
 * Type-safe extensions for Express Request objects
 */

import { Request } from 'express';

/**
 * Authenticated Request with API Key Information
 */
export interface AuthenticatedRequest extends Request {
  /**
   * Hash of the API key (first 8 characters) for logging purposes
   * Not the full API key for security reasons
   */
  apiKey?: string;
}

/**
 * Model Query Parameters
 */
export interface ModelQueryParams {
  provider?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

/**
 * Model Search Query Parameters
 */
export interface ModelSearchQueryParams {
  q?: string;
  limit?: number;
}

/**
 * Top Models Query Parameters
 */
export interface TopModelsQueryParams {
  limit?: number;
}

/**
 * WebSocket Error Parameter Type
 */
export interface WebSocketErrorParams {
  code?: number;
  message?: string;
  type?: string;
  details?: unknown;
}

/**
 * Streaming Chunk Types
 */
export interface StreamingDelta {
  content?: string | null;
  role?: string;
  tool_calls?: Array<unknown>;
}

export interface StreamingChoice {
  index?: number;
  delta: StreamingDelta;
  finish_reason: string | null;
}

export interface StreamingChunk {
  id: string;
  choices: StreamingChoice[];
  model: string;
  created: number;
  object?: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}
