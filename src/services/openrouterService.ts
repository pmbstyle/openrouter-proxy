/**
 * OpenRouter Service
 * Core integration with OpenRouter API
 */

import http from 'http';
import https from 'https';
import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { config } from '../utils/config';
import { logger, createRequestLogger } from '../utils/logger';
import { hasMessage } from '../utils/typeGuards';
import { SENSITIVE_HEADERS } from '../utils/constants';
import {
  OpenRouterRequest,
  OpenRouterResponse,
  Model,
  GenerationStats,
} from '../types/openrouter';
import { InferenceRequest, InferenceResponse, StreamingInferenceResponse } from '../types/inference';

// Configure http/https agents for connection pooling
const httpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 100,
  maxFreeSockets: 50,
  timeout: config.openrouter.timeout,
});

const httpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 60000,
  maxSockets: 100,
  maxFreeSockets: 50,
  timeout: config.openrouter.timeout,
});

interface RequestMetadata {
  requestId: string;
  startTime: number;
}

interface ExtendedAxiosRequestConfig extends InternalAxiosRequestConfig {
  metadata?: RequestMetadata;
}

export class OpenRouterService {
  private client: AxiosInstance;
  private requestCount = 0;
  private readonly maxRetries: number;

  constructor() {
    this.maxRetries = config.openrouter.maxRetries;

    this.client = axios.create({
      baseURL: config.openrouter.baseUrl,
      timeout: config.openrouter.timeout,
      httpAgent,
      httpsAgent,
      headers: {
        'Authorization': `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://llm-proxy.com',
        'X-Title': 'LLM Proxy Service',
      },
    });

    this.setupInterceptors();
  }

  private redactSensitiveData(config: ExtendedAxiosRequestConfig): void {
    // Redact sensitive headers
    if (config.headers) {
      for (const header of SENSITIVE_HEADERS) {
        if (header in config.headers) {
          (config.headers as Record<string, unknown>)[header] = '[REDACTED]';
        }
      }
    }
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (requestConfig: ExtendedAxiosRequestConfig) => {
        this.requestCount++;
        const requestId = `req_${this.requestCount}_${Date.now()}`;
        requestConfig.metadata = { requestId, startTime: Date.now() };

        const requestLogger = createRequestLogger({ requestId });

        // Redact sensitive data before logging
        this.redactSensitiveData(requestConfig);

        requestLogger.info('OpenRouter request initiated', {
          url: requestConfig.url,
          method: requestConfig.method,
        });

        return requestConfig;
      },
      (error) => {
        logger.error({ error: error instanceof Error ? error.message : String(error) }, 'OpenRouter request interceptor error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        const metadata = (response.config as ExtendedAxiosRequestConfig).metadata;
        const { requestId, startTime } = metadata || {};
        const duration = Date.now() - (startTime || 0);

        const requestLogger = createRequestLogger({ requestId });
        requestLogger.info('OpenRouter request completed', {
          status: response.status,
          duration,
        });

        return response;
      },
      (error) => {
        const { requestId, startTime } = error.config?.metadata || {};
        const duration = Date.now() - (startTime || 0);

        const requestLogger = createRequestLogger({ requestId });
        requestLogger.error('OpenRouter request failed', {
          status: error.response?.status,
          duration,
          error: error.message,
        });

        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleError(error: unknown): Error {
    if (!axios.isAxiosError(error)) {
      const customError = new Error(error instanceof Error ? error.message : 'Unknown error');
      (customError as unknown as { code: number }).code = 500;
      (customError as unknown as { type: string }).type = 'internal';
      return customError;
    }

    if (error && typeof error === 'object' && 'response' in error) {
      const err = error as { response: { status: number; data: { error?: { message?: string; metadata?: unknown } } } };
      const { status, data } = err.response;
      const message = data?.error?.message || 'OpenRouter API error';
      const customError = new Error(message);
      (customError as unknown as { code: number }).code = status;
      (customError as unknown as { type: string }).type = 'openrouter';
      (customError as unknown as { metadata?: unknown }).metadata = data?.error?.metadata;
      return customError;
    }

    if (error && typeof error === 'object' && 'request' in error) {
      const customError = new Error('OpenRouter API request timeout');
      (customError as unknown as { code: number }).code = 408;
      (customError as unknown as { type: string }).type = 'timeout';
      return customError;
    }

    const customError = new Error(error instanceof Error ? error.message : 'Unknown error');
    (customError as unknown as { code: number }).code = 500;
    (customError as unknown as { type: string }).type = 'internal';
    return customError;
  }

  async createCompletion(request: InferenceRequest): Promise<InferenceResponse> {
    const openrouterRequest: OpenRouterRequest = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.max_tokens,
      tools: request.tools,
      stream: false,
      stop: request.stop,
      top_p: request.top_p,
      top_k: request.top_k,
      frequency_penalty: request.frequency_penalty,
      presence_penalty: request.presence_penalty,
      repetition_penalty: request.repetition_penalty,
      seed: request.seed,
      response_format: request.response_format,
      tool_choice: request.tool_choice,
      parallel_tool_calls: request.parallel_tool_calls,
      verbosity: request.verbosity,
      user: request.user,
    };

    try {
      const response: AxiosResponse<OpenRouterResponse> = await this.client.post(
        '/chat/completions',
        openrouterRequest
      );

      return this.transformResponse(response.data);
    } catch (error) {
      logger.error({ error: (error as Error).message, request }, 'Failed to create completion');
      throw error;
    }
  }

  async createStreamingCompletion(request: InferenceRequest): Promise<ReadableStream> {
    const openrouterRequest: OpenRouterRequest = {
      ...request,
      stream: true,
    };

    try {
      const response = await this.client.post('/chat/completions', openrouterRequest, {
        responseType: 'stream',
      });

      return this.transformStreamingResponse(response.data);
    } catch (error) {
      logger.error({ error: (error as Error).message, request }, 'Failed to create streaming completion');
      throw error;
    }
  }

  async getModels(): Promise<Model[]> {
    try {
      const response: AxiosResponse<{ data: Model[] }> = await this.client.get('/models');
      return response.data.data;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to get models');
      throw error;
    }
  }

  async getModel(modelId: string): Promise<Model | null> {
    try {
      const models = await this.getModels();
      return models.find(model => model.id === modelId) || null;
    } catch (error) {
      logger.error({ error: (error as Error).message, modelId }, 'Failed to get model');
      throw error;
    }
  }

  async getUsageStats(generationId: string): Promise<GenerationStats> {
    try {
      const response: AxiosResponse<GenerationStats> = await this.client.get(
        `/generation?id=${generationId}`
      );
      return response.data;
    } catch (error) {
      logger.error({ error: (error as Error).message, generationId }, 'Failed to get usage stats');
      throw error;
    }
  }

  private transformResponse(response: OpenRouterResponse): InferenceResponse {
    return {
      id: response.id,
      choices: response.choices.map(choice => {
        if (hasMessage(choice)) {
          return {
            finish_reason: choice.finish_reason,
            message: {
              content: choice.message.content || null,
              role: choice.message.role || 'assistant',
              tool_calls: choice.message.tool_calls,
            },
          };
        }
        // Fallback for other choice types
        return {
          finish_reason: choice.finish_reason,
          message: {
            content: null,
            role: 'assistant',
            tool_calls: undefined,
          },
        };
      }),
      usage: response.usage || {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
      model: response.model,
      created: response.created,
      object: 'chat.completion',
    };
  }

  private transformStreamingResponse(stream: { on: (event: string, callback: (data?: unknown) => void) => void }): ReadableStream {
    const decoder = new TextDecoder();
    let buffer = '';
    const self = this;

    return new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: unknown) => {
          // Node.js streams emit Buffer objects
          buffer += decoder.decode(chunk as Buffer, { stream: true });
          
          // Process complete lines
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith('data: ')) {
              const data = trimmedLine.slice(6);
              if (data === '[DONE]') {
                controller.close();
                return;
              }

              try {
                const parsed = JSON.parse(data);
                const transformed = self.transformStreamingChunk(parsed);
                controller.enqueue(JSON.stringify(transformed) + '\n');
              } catch (error) {
                // Ignore invalid JSON
              }
            }
          }
        });

        stream.on('end', () => {
          controller.close();
        });

        stream.on('error', (err) => {
          controller.error(err instanceof Error ? err : new Error(String(err)));
        });
      },
    });
  }

  private transformStreamingChunk(chunk: { id: string; model: string; created: number; choices: Array<{ index: number; delta: Record<string, unknown>; finish_reason: string | null }> }): StreamingInferenceResponse {
    return {
      id: chunk.id,
      choices: chunk.choices.map((choice) => ({
        finish_reason: choice.finish_reason,
        delta: {
          content: typeof choice.delta?.content === 'string' ? choice.delta.content : null,
          role: typeof choice.delta?.role === 'string' ? choice.delta.role : undefined,
          tool_calls: Array.isArray(choice.delta?.tool_calls) ? choice.delta.tool_calls : undefined,
        },
      })),
      model: chunk.model,
      created: chunk.created,
      object: 'chat.completion.chunk',
    };
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/models');
      return true;
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'OpenRouter health check failed');
      return false;
    }
  }

  getRequestCount(): number {
    return this.requestCount;
  }
}
