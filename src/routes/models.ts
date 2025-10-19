/**
 * Models Routes
 * API endpoints for model management
 */

import { Router, Request, Response } from 'express';
import { ModelRegistryService } from '../services/modelRegistryService';
import { OpenRouterService } from '../services/openrouterService';
import { defaultRateLimiter } from '../middleware/rateLimiting';
import { validateModelRequest } from '../middleware/validation';
import { asyncHandler } from '../middleware/errorHandler';
import { logger, createRequestLogger } from '../utils/logger';

const router = Router();

// Initialize services
const openrouterService = new OpenRouterService();
const modelRegistryService = new ModelRegistryService(openrouterService);

/**
 * @route GET /api/v1/models
 * @desc Get all available models
 * @access Public
 */
router.get(
  '/',
  defaultRateLimiter,
  validateModelRequest,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });
    const { provider, search, limit = 50, offset = 0 } = req.query as any;

    requestLogger.info('Models request received', { provider, search, limit, offset });

    let models = await modelRegistryService.getModels();

    // Filter by provider
    if (provider) {
      models = models.filter(model => 
        model.id.toLowerCase().startsWith(provider.toLowerCase())
      );
    }

    // Search by name or description
    if (search) {
      const searchTerm = search.toLowerCase();
      models = models.filter(model => 
        model.name.toLowerCase().includes(searchTerm) ||
        (model.description && model.description.toLowerCase().includes(searchTerm)) ||
        model.id.toLowerCase().includes(searchTerm)
      );
    }

    // Apply pagination
    const total = models.length;
    const paginatedModels = models.slice(offset as number, (offset as number) + (limit as number));

    requestLogger.info('Models request completed', { 
      total, 
      returned: paginatedModels.length,
      offset,
      limit 
    });

    res.json({
      data: paginatedModels,
      pagination: {
        total,
        limit: limit as number,
        offset: offset as number,
        hasMore: (offset as number) + (limit as number) < total,
      },
    });
  })
);

/**
 * @route GET /api/v1/models/:id
 * @desc Get a specific model by ID
 * @access Public
 */
router.get(
  '/:id',
  defaultRateLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });
    const { id } = req.params;

    requestLogger.info('Model details request received', { modelId: id });

    const model = await modelRegistryService.getModel(id);

    if (!model) {
      res.status(404).json({
        error: {
          code: 404,
          message: `Model '${id}' not found`,
          type: 'not_found',
        },
      });
      return;
    }

    requestLogger.info('Model details request completed', { modelId: id });

    res.json({ data: model });
  })
);

/**
 * @route GET /api/v1/models/:id/parameters
 * @desc Get supported parameters for a model
 * @access Public
 */
router.get(
  '/:id/parameters',
  defaultRateLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });
    const { id } = req.params;

    requestLogger.info('Model parameters request received', { modelId: id });

    const model = await modelRegistryService.getModel(id);
    if (!model) {
      res.status(404).json({
        error: {
          code: 404,
          message: `Model '${id}' not found`,
          type: 'not_found',
        },
      });
      return;
    }

    const parameters = await modelRegistryService.getSupportedParameters(id);

    requestLogger.info('Model parameters request completed', { 
      modelId: id, 
      parameterCount: parameters.length 
    });

    res.json({
      data: {
        model: id,
        supported_parameters: parameters,
      },
    });
  })
);

/**
 * @route GET /api/v1/models/:id/pricing
 * @desc Get pricing information for a model
 * @access Public
 */
router.get(
  '/:id/pricing',
  defaultRateLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });
    const { id } = req.params;

    requestLogger.info('Model pricing request received', { modelId: id });

    const model = await modelRegistryService.getModel(id);
    if (!model) {
      res.status(404).json({
        error: {
          code: 404,
          message: `Model '${id}' not found`,
          type: 'not_found',
        },
      });
      return;
    }

    const pricing = await modelRegistryService.getModelPricing(id);

    requestLogger.info('Model pricing request completed', { modelId: id });

    res.json({
      data: {
        model: id,
        pricing: pricing || model.pricing || { prompt: '0', completion: '0' },
      },
    });
  })
);

/**
 * @route GET /api/v1/models/top
 * @desc Get top models by context length
 * @access Public
 */
router.get(
  '/top',
  defaultRateLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });
    const { limit = 10 } = req.query as any;

    requestLogger.info('Top models request received', { limit });

    const models = await modelRegistryService.getTopModels(parseInt(limit as string, 10));

    requestLogger.info('Top models request completed', { 
      returned: models.length,
      limit 
    });

    res.json({
      data: models,
    });
  })
);

/**
 * @route GET /api/v1/models/search
 * @desc Search models by query
 * @access Public
 */
router.get(
  '/search',
  defaultRateLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });
    const { q, limit = 20 } = req.query as any;

    if (!q) {
      res.status(400).json({
        error: {
          code: 400,
          message: 'Query parameter "q" is required',
          type: 'validation',
        },
      });
      return;
    }

    requestLogger.info('Model search request received', { query: q, limit });

    const models = await modelRegistryService.searchModels(q as string);

    // Apply limit
    const limitedModels = models.slice(0, parseInt(limit as string, 10));

    requestLogger.info('Model search request completed', { 
      query: q,
      total: models.length,
      returned: limitedModels.length,
      limit 
    });

    res.json({
      data: limitedModels,
      query: q,
      total: models.length,
    });
  })
);

/**
 * @route GET /api/v1/models/providers
 * @desc Get all available providers
 * @access Public
 */
router.get(
  '/providers',
  defaultRateLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });

    requestLogger.info('Providers request received');

    const models = await modelRegistryService.getModels();
    const providers = new Set<string>();

    for (const model of models) {
      const provider = model.id.split('/')[0];
      if (provider) {
        providers.add(provider);
      }
    }

    const providerList = Array.from(providers).sort();

    requestLogger.info('Providers request completed', { 
      providerCount: providerList.length 
    });

    res.json({
      data: providerList,
    });
  })
);

/**
 * @route GET /api/v1/models/providers/:provider
 * @desc Get models by provider
 * @access Public
 */
router.get(
  '/providers/:provider',
  defaultRateLimiter,
  asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const requestLogger = createRequestLogger({ requestId: req.headers['x-request-id'] as string });
    const { provider } = req.params;

    requestLogger.info('Provider models request received', { provider });

    const models = await modelRegistryService.getModelsByProvider(provider);

    requestLogger.info('Provider models request completed', { 
      provider,
      modelCount: models.length 
    });

    res.json({
      data: models,
      provider,
    });
  })
);

export default router;
