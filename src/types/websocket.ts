/**
 * WebSocket Message Types
 * For real-time streaming communication
 */

import { Message } from './openrouter';

export type WebSocketMessage = 
  | WebSocketInferenceRequest
  | WebSocketInferenceResponse
  | WebSocketError
  | WebSocketHeartbeat
  | WebSocketClose;

export type WebSocketInferenceRequest = {
  type: 'inference_request';
  id: string;
  data: {
    model: string;
    messages: Message[];
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
    stop?: string | string[];
    top_p?: number;
    top_k?: number;
    frequency_penalty?: number;
    presence_penalty?: number;
    repetition_penalty?: number;
    seed?: number;
    response_format?: { type: 'json_object' };
    user?: string;
  };
};

export type WebSocketInferenceResponse = {
  type: 'inference_response';
  id: string;
  data: {
    content?: string;
    finish_reason?: string | null;
    usage?: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    model: string;
    created: number;
  };
};

export type WebSocketError = {
  type: 'error';
  id: string;
  error: {
    code: number;
    message: string;
    type: 'validation' | 'rate_limit' | 'openrouter' | 'internal';
    details?: Record<string, unknown>;
  };
};

export type WebSocketHeartbeat = {
  type: 'heartbeat';
  timestamp: number;
};

export type WebSocketClose = {
  type: 'close';
  reason: string;
  code: number;
};

export type WebSocketConnection = {
  id: string;
  connectedAt: number;
  lastActivity: number;
  isActive: boolean;
  currentRequestId?: string;
  ip: string;
  userAgent?: string;
};

export type WebSocketStats = {
  totalConnections: number;
  activeConnections: number;
  totalMessages: number;
  totalErrors: number;
  averageConnectionDuration: number;
  peakConnections: number;
};

export type WebSocketConfig = {
  maxConnections: number;
  heartbeatInterval: number;
  connectionTimeout: number;
  messageTimeout: number;
  maxMessageSize: number;
  compression: boolean;
};
