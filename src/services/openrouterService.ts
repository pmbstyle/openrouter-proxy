/**
 * OpenRouter Service
 * Core integration with OpenRouter API
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { config } from '../utils/config';
import { logger, createRequestLogger } from '../utils/logger';
import { hasMessage } from '../utils/typeGuards';
import {
  OpenRouterRequest,
  OpenRouterResponse,
  Model,
  GenerationStats,
  ErrorResponse,
} from '../types/openrouter';
import { InferenceRequest, InferenceResponse, StreamingInferenceResponse } from '../types/inference';

export class OpenRouterService {
  private client: AxiosInstance;
  private requestCount = 0;
  private readonly maxRetries: number;

  constructor() {
    this.maxRetries = config.openrouter.maxRetries;
    
    this.client = axios.create({
      baseURL: config.openrouter.baseUrl,
      timeout: config.openrouter.timeout,
      headers: {
        'Authorization': `Bearer ${config.openrouter.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://llm-proxy.com',
        'X-Title': 'LLM Proxy Service',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        this.requestCount++;
        const requestId = `req_${this.requestCount}_${Date.now()}`;
        (config as any).metadata = { requestId, startTime: Date.now() };
        
        const requestLogger = createRequestLogger({ requestId });
        requestLogger.info('OpenRouter request initiated', {
          url: config.url,
          method: config.method,
          data: config.data,
        });
        
        return config;
      },
      (error) => {
        logger.error({ error: error.message }, 'OpenRouter request interceptor error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        const { requestId, startTime } = (response.config as any).metadata || {};
        const duration = Date.now() - (startTime || 0);
        
        const requestLogger = createRequestLogger({ requestId });
        requestLogger.info('OpenRouter request completed', {
          status: response.status,
          duration,
          data: response.data,
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
          data: error.response?.data,
        });
        
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private handleError(error: any): Error {
    if (error.response) {
      const { status, data } = error.response;
      const errorResponse: ErrorResponse = {
        code: status,
        message: data?.error?.message || 'OpenRouter API error',
        metadata: data?.error?.metadata,
      };
      
      const customError = new Error(errorResponse.message);
      (customError as any).code = errorResponse.code;
      (customError as any).metadata = errorResponse.metadata;
      (customError as any).type = 'openrouter';
      
      return customError;
    }
    
    if (error.request) {
      const customError = new Error('OpenRouter API request timeout');
      (customError as any).code = 408;
      (customError as any).type = 'timeout';
      
      return customError;
    }
    
    const customError = new Error(error.message || 'Unknown OpenRouter error');
    (customError as any).code = 500;
    (customError as any).type = 'internal';
    
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

  private transformStreamingResponse(stream: any): ReadableStream {
    const decoder = new TextDecoder();
    let buffer = '';

    return new ReadableStream({
      start(controller) {
        stream.on('data', (chunk: Buffer) => {
          buffer += decoder.decode(chunk, { stream: true });
          
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
                const transformed = (this as any).transformStreamingChunk(parsed);
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

        stream.on('error', (error: Error) => {
          controller.error(error);
        });
      },
    });
  }

  private transformStreamingChunk(chunk: any): StreamingInferenceResponse {
    return {
      id: chunk.id,
      choices: chunk.choices.map((choice: any) => ({
        finish_reason: choice.finish_reason,
        delta: {
          content: choice.delta?.content || null,
          role: choice.delta?.role,
          tool_calls: choice.delta?.tool_calls,
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
