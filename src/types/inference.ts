/**
 * Inference Request/Response Types
 * Internal types for the proxy service
 */

import { OpenRouterRequest, OpenRouterResponse, Message, Tool } from './openrouter';

export type InferenceRequest = {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  tools?: Tool[];
  stream?: boolean;
  stop?: string | string[];
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  seed?: number;
  response_format?: { type: 'json_object' };
  tool_choice?: 'none' | 'auto' | { type: 'function'; function: { name: string } };
  parallel_tool_calls?: boolean;
  verbosity?: 'low' | 'medium' | 'high';
  user?: string;
};

export type InferenceResponse = {
  id: string;
  choices: Array<{
    finish_reason: string | null;
    message: {
      content: string | null;
      role: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
  created: number;
  object: 'chat.completion';
};

export type StreamingInferenceResponse = {
  id: string;
  choices: Array<{
    finish_reason: string | null;
    delta: {
      content: string | null;
      role?: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
  model: string;
  created: number;
  object: 'chat.completion.chunk';
};

export type InferenceError = {
  code: number;
  message: string;
  type: 'validation' | 'rate_limit' | 'openrouter' | 'internal';
  details?: Record<string, unknown>;
};

export type ModelInfo = {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  supported_parameters: string[];
  is_moderated: boolean;
  max_completion_tokens?: number;
};

export type InferenceContext = {
  requestId: string;
  timestamp: number;
  model: string;
  stream: boolean;
  startTime: number;
};

export type InferenceMetrics = {
  requestId: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  duration: number;
  timestamp: number;
  success: boolean;
  error?: string;
};
