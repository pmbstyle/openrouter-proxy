/**
 * OpenRouter API Type Definitions
 * Based on OpenRouter API documentation
 */

export type TextContent = {
  type: 'text';
  text: string;
};

export type ImageContentPart = {
  type: 'image_url';
  image_url: {
    url: string; // URL or base64 encoded image data
    detail?: string; // Optional, defaults to "auto"
  };
};

export type ContentPart = TextContent | ImageContentPart;

export type Message =
  | {
      role: 'user' | 'assistant' | 'system';
      content: string | ContentPart[];
      name?: string;
    }
  | {
      role: 'tool';
      content: string;
      tool_call_id: string;
      name?: string;
    };

export type FunctionDescription = {
  description?: string;
  name: string;
  parameters: object; // JSON Schema object
};

export type Tool = {
  type: 'function';
  function: FunctionDescription;
};

export type ToolChoice =
  | 'none'
  | 'auto'
  | {
      type: 'function';
      function: {
        name: string;
      };
    };

export type ProviderPreferences = {
  [provider: string]: {
    weight?: number;
    require_parameters?: boolean;
  };
};

export type OpenRouterRequest = {
  // Either "messages" or "prompt" is required
  messages?: Message[];
  prompt?: string;

  // Model selection
  model?: string;
  models?: string[];
  route?: 'fallback';

  // Response format
  response_format?: { type: 'json_object' };

  // Generation parameters
  stop?: string | string[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  repetition_penalty?: number;
  logit_bias?: { [key: number]: number };
  top_logprobs?: number;
  min_p?: number;
  top_a?: number;
  seed?: number;

  // Tool calling
  tools?: Tool[];
  tool_choice?: ToolChoice;
  parallel_tool_calls?: boolean;

  // Advanced parameters
  verbosity?: 'low' | 'medium' | 'high';
  prediction?: { type: 'content'; content: string };

  // OpenRouter-specific parameters
  transforms?: string[];
  provider?: ProviderPreferences;
  user?: string;

  // Headers
  'HTTP-Referer'?: string;
  'X-Title'?: string;
};

export type NonChatChoice = {
  finish_reason: string | null;
  text: string;
  error?: ErrorResponse;
};

export type NonStreamingChoice = {
  finish_reason: string | null;
  native_finish_reason: string | null;
  message: {
    content: string | null;
    role: string;
    tool_calls?: ToolCall[];
  };
  error?: ErrorResponse;
};

export type StreamingChoice = {
  finish_reason: string | null;
  native_finish_reason: string | null;
  delta: {
    content: string | null;
    role?: string;
    tool_calls?: ToolCall[];
  };
  error?: ErrorResponse;
};

export type ToolCall = {
  id: string;
  type: 'function';
  function: FunctionCall;
};

export type FunctionCall = {
  name: string;
  arguments: string;
};

export type ResponseUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

export type ErrorResponse = {
  code: number;
  message: string;
  metadata?: Record<string, unknown>;
};

export type OpenRouterResponse = {
  id: string;
  choices: (NonStreamingChoice | StreamingChoice | NonChatChoice)[];
  created: number;
  model: string;
  object: 'chat.completion' | 'chat.completion.chunk';
  system_fingerprint?: string;
  usage?: ResponseUsage;
  error?: ErrorResponse;
};

export type Model = {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  architecture: {
    modality: string;
    tokenizer: string;
    instruct_type?: string;
  };
  top_provider: {
    context_length: number;
    max_completion_tokens?: number;
    is_moderated: boolean;
  };
  per_request_limits: {
    prompt_tokens?: string;
    completion_tokens?: string;
  };
};

export type GenerationStats = {
  id: string;
  model: string;
  provider: string;
  usage: ResponseUsage;
  cost: number;
  created: number;
  status: 'completed' | 'failed' | 'cancelled';
  error?: ErrorResponse;
};

export type ModerationErrorMetadata = {
  reasons: string[];
  flagged_input: string;
  provider_name: string;
  model_slug: string;
};

export type ProviderErrorMetadata = {
  provider_name: string;
  raw: unknown;
};
