/**
 * Inference Controller
 * Handles inference requests and responses
 */

import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { OpenRouterService } from '../services/openrouterService';
import { ModelRegistryService } from '../services/modelRegistryService';
import { createRequestLogger, logRequest, logResponse } from '../utils/logger';
import { InferenceRequest, InferenceContext } from '../types/inference';
import { calculateCost, estimatePromptTokens } from '../utils/costCalculator';
import { asyncHandler } from '../middleware/errorHandler';

export class InferenceController {
  constructor(
    private openrouterService: OpenRouterService,
    private modelRegistryService: ModelRegistryService
  ) {}

  createCompletion = asyncHandler(async (req: any, res: Response): Promise<void> => {
    const requestId = uuidv4();
    const startTime = Date.now();
    const context: InferenceContext = {
      requestId,
      timestamp: startTime,
      model: req.body.model,
      stream: false,
      startTime,
    };

    const requestLogger = createRequestLogger(context);
    logRequest(context, 'Inference request received');

    try {
      // Validate model
      const modelExists = await this.modelRegistryService.validateModel(req.body.model);
      if (!modelExists) {
        res.status(400).json({
          error: {
            code: 400,
            message: `Model '${req.body.model}' not found or not supported`,
            type: 'validation',
          },
        });
        return;
      }

      // Create completion
      const response = await this.openrouterService.createCompletion(req.body as InferenceRequest);
      
      logResponse(context, 'Inference request completed');

      res.json(response);
    } catch (error: any) {
      requestLogger.error('Inference request failed', { error: error.message });
      throw error;
    }
  });

  createStreamingCompletion = asyncHandler(async (req: any, res: Response): Promise<void> => {
    const requestId = uuidv4();
    const startTime = Date.now();
    const context: InferenceContext = {
      requestId,
      timestamp: startTime,
      model: req.body.model,
      stream: true,
      startTime,
    };

    const requestLogger = createRequestLogger(context);
    logRequest(context, 'Streaming inference request received');

    try {
      // Validate model
      const modelExists = await this.modelRegistryService.validateModel(req.body.model);
      if (!modelExists) {
        res.status(400).json({
          error: {
            code: 400,
            message: `Model '${req.body.model}' not found or not supported`,
            type: 'validation',
          },
        });
        return;
      }

      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      // Create streaming completion
      const stream = await this.openrouterService.createStreamingCompletion(req.body as InferenceRequest);
      
      let totalTokens = 0;
      let promptTokens = 0;
      let completionTokens = 0;
      let content = '';

      const reader = stream.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.trim() === '') continue;
            
            try {
              const data = JSON.parse(line);
              
              // Track content for token estimation
              if (data.choices?.[0]?.delta?.content) {
                content += data.choices[0].delta.content;
              }

              // Send chunk to client
              res.write(`data: ${line}\n\n`);
            } catch (parseError) {
              // Ignore invalid JSON
            }
          }
        }

        // Estimate tokens using proper tokenization
        promptTokens = estimatePromptTokens(req.body.messages);
        completionTokens = Math.ceil(content.length / 4); // Still simplified for completion
        totalTokens = promptTokens + completionTokens;

        // Send final usage data
        const usageData = {
          id: requestId,
          object: 'chat.completion.chunk',
          choices: [{
            finish_reason: 'stop',
            delta: { content: '' }
          }],
          usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
          },
          model: req.body.model,
          created: Math.floor(Date.now() / 1000),
        };

        res.write(`data: ${JSON.stringify(usageData)}\n\n`);
        res.write('data: [DONE]\n\n');

        logResponse(context, 'Streaming inference request completed');

      } finally {
        reader.cancel();
        res.end();
      }
    } catch (error: any) {
      requestLogger.error('Streaming inference request failed', { error: error.message });
      throw error;
    }
  });

}
