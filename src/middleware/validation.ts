/**
 * Request Validation Middleware
 * Validates request parameters using Joi schemas
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger, createRequestLogger } from '../utils/logger';

// Inference request validation schema
const inferenceRequestSchema = Joi.object({
  model: Joi.string().required().messages({
    'string.empty': 'Model is required',
    'any.required': 'Model is required',
  }),
  messages: Joi.array().items(
    Joi.object({
      role: Joi.string().valid('user', 'assistant', 'system', 'tool').required(),
      content: Joi.alternatives().try(
        Joi.string(),
        Joi.array().items(
          Joi.object({
            type: Joi.string().valid('text', 'image_url').required(),
            text: Joi.string().when('type', { is: 'text', then: Joi.required() }),
            image_url: Joi.object({
              url: Joi.string().required(),
              detail: Joi.string().valid('auto', 'low', 'high').optional(),
            }).when('type', { is: 'image_url', then: Joi.required() }),
          })
        )
      ).required(),
      name: Joi.string().optional(),
      tool_call_id: Joi.string().when('role', { is: 'tool', then: Joi.required() }),
    })
  ).min(1).required().messages({
    'array.min': 'At least one message is required',
    'any.required': 'Messages are required',
  }),
  temperature: Joi.number().min(0).max(2).optional(),
  max_tokens: Joi.number().integer().min(1).optional(),
  tools: Joi.array().items(
    Joi.object({
      type: Joi.string().valid('function').required(),
      function: Joi.object({
        name: Joi.string().required(),
        description: Joi.string().optional(),
        parameters: Joi.object().required(),
      }).required(),
    })
  ).optional(),
  stream: Joi.boolean().optional(),
  stop: Joi.alternatives().try(
    Joi.string(),
    Joi.array().items(Joi.string())
  ).optional(),
  top_p: Joi.number().min(0).max(1).optional(),
  top_k: Joi.number().integer().min(0).optional(),
  frequency_penalty: Joi.number().min(-2).max(2).optional(),
  presence_penalty: Joi.number().min(-2).max(2).optional(),
  repetition_penalty: Joi.number().min(0).max(2).optional(),
  seed: Joi.number().integer().optional(),
  response_format: Joi.object({
    type: Joi.string().valid('json_object').required(),
  }).optional(),
  tool_choice: Joi.alternatives().try(
    Joi.string().valid('none', 'auto'),
    Joi.object({
      type: Joi.string().valid('function').required(),
      function: Joi.object({
        name: Joi.string().required(),
      }).required(),
    })
  ).optional(),
  parallel_tool_calls: Joi.boolean().optional(),
  verbosity: Joi.string().valid('low', 'medium', 'high').optional(),
  user: Joi.string().optional(),
});

// Model request validation schema
const modelRequestSchema = Joi.object({
  id: Joi.string().optional(),
  provider: Joi.string().optional(),
  search: Joi.string().optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional(),
});


// WebSocket message validation schema
const websocketMessageSchema = Joi.object({
  type: Joi.string().valid(
    'inference_request',
    'inference_response',
    'error',
    'heartbeat',
    'close'
  ).required(),
  id: Joi.string().required(),
  data: Joi.object().optional(),
  error: Joi.object({
    code: Joi.number().required(),
    message: Joi.string().required(),
    type: Joi.string().valid(
      'validation',
      'rate_limit',
      'openrouter',
      'internal'
    ).required(),
    details: Joi.object().optional(),
  }).optional(),
  timestamp: Joi.number().optional(),
  reason: Joi.string().optional(),
  code: Joi.number().optional(),
});

export const validateInferenceRequest = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = inferenceRequestSchema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });
    requestLogger.warn('Validation failed for inference request', {
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      })),
    });

    res.status(400).json({
      error: {
        code: 400,
        message: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      },
    });
    return;
  }

  req.body = value;
  next();
};

export const validateModelRequest = (req: Request, res: Response, next: NextFunction): void => {
  const { error, value } = modelRequestSchema.validate(req.query, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });
    requestLogger.warn('Validation failed for model request', {
      errors: error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value,
      })),
    });

    res.status(400).json({
      error: {
        code: 400,
        message: 'Validation failed',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      },
    });
    return;
  }

  req.query = value;
  next();
};


export const validateWebSocketMessage = (message: any): { valid: boolean; error?: any; data?: any } => {
  const { error, value } = websocketMessageSchema.validate(message, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return {
      valid: false,
      error: {
        code: 400,
        message: 'Invalid WebSocket message format',
        details: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
        })),
      },
    };
  }

  return {
    valid: true,
    data: value,
  };
};

// Custom validation for specific fields
export const validateModelId = (modelId: string): boolean => {
  // Basic model ID validation (provider/model format)
  const modelIdPattern = /^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/;
  return modelIdPattern.test(modelId);
};


export const validateRequestSize = (req: Request, res: Response, next: NextFunction): void => {
  const contentLength = parseInt(req.get('content-length') || '0', 10);
  const maxSize = 10 * 1024 * 1024; // 10MB

  if (contentLength > maxSize) {
    res.status(413).json({
      error: {
        code: 413,
        message: 'Request too large',
        maxSize: maxSize,
      },
    });
    return;
  }

  next();
};
