/**
 * Inference Routes
 * API endpoints for inference requests
 */

import { Router } from 'express';
import { InferenceController } from '../controllers/inferenceController';
import { OpenRouterService } from '../services/openrouterService';
import { ModelRegistryService } from '../services/modelRegistryService';
import { defaultRateLimiter, inferenceRateLimiter } from '../middleware/rateLimiting';
import { validateInferenceRequest, validateRequestSize } from '../middleware/validation';

const router = Router();

// Initialize services
const openrouterService = new OpenRouterService();
const modelRegistryService = new ModelRegistryService(openrouterService);
const inferenceController = new InferenceController(
  openrouterService,
  modelRegistryService
);

/**
 * @route POST /api/v1/inference
 * @desc Create a completion
 * @access Public
 */
router.post(
  '/',
  defaultRateLimiter,
  validateRequestSize,
  validateInferenceRequest,
  inferenceController.createCompletion
);

/**
 * @route POST /api/v1/inference/stream
 * @desc Create a streaming completion
 * @access Public
 */
router.post(
  '/stream',
  inferenceRateLimiter,
  validateRequestSize,
  validateInferenceRequest,
  inferenceController.createStreamingCompletion
);

export default router;
