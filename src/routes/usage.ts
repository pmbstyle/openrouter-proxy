/**
 * Usage Routes
 * API endpoints for usage statistics and metrics
 */

import { Router, Request, Response } from 'express';
import { usageTrackingService } from '../services/usageTrackingService';
import { asyncHandler } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @route GET /api/v1/usage/summary
 * @desc Get usage summary statistics
 * @access Public (or authenticated if enabled)
 * @query startTime - Filter by start time (timestamp)
 * @query endTime - Filter by end time (timestamp)
 * @query model - Filter by model name
 * @query apiKey - Filter by API key (admin only)
 */
router.get(
  '/summary',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;
    const model = req.query.model as string | undefined;
    const apiKey = req.query.apiKey as string | undefined;

    // Build filters
    const filters: {
      startTime?: number;
      endTime?: number;
      model?: string;
      apiKey?: string;
    } = {};

    if (startTime && !isNaN(startTime)) {
      filters.startTime = startTime;
    }
    if (endTime && !isNaN(endTime)) {
      filters.endTime = endTime;
    }
    if (model) {
      filters.model = model;
    }

    // Only allow apiKey filter if user is authenticated
    const requestApiKey = (req as any).apiKey;
    if (apiKey && requestApiKey) {
      filters.apiKey = apiKey;
    }

    const summary = usageTrackingService.getFullSummary(filters);

    logger.info({
      filters,
      recordCount: summary.global.totalRequests,
    }, 'Usage summary requested');

    res.json(summary);
  })
);

/**
 * @route GET /api/v1/usage/detailed
 * @desc Get detailed usage statistics with breakdown
 * @access Public (or authenticated if enabled)
 * @query startTime - Filter by start time (timestamp)
 * @query endTime - Filter by end time (timestamp)
 * @query model - Filter by model name
 */
router.get(
  '/detailed',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;
    const model = req.query.model as string | undefined;

    // Build filters
    const filters: {
      startTime?: number;
      endTime?: number;
      model?: string;
    } = {};

    if (startTime && !isNaN(startTime)) {
      filters.startTime = startTime;
    }
    if (endTime && !isNaN(endTime)) {
      filters.endTime = endTime;
    }
    if (model) {
      filters.model = model;
    }

    const stats = usageTrackingService.getSummary(filters);
    const serviceStats = usageTrackingService.getServiceStats();

    logger.info({
      filters,
      recordCount: stats.totalRequests,
    }, 'Detailed usage requested');

    res.json({
      stats,
      service: serviceStats,
    });
  })
);

/**
 * @route GET /api/v1/usage/models
 * @desc Get usage breakdown by model
 * @access Public (or authenticated if enabled)
 * @query startTime - Filter by start time (timestamp)
 * @query endTime - Filter by end time (timestamp)
 */
router.get(
  '/models',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;

    const filters: {
      startTime?: number;
      endTime?: number;
    } = {};

    if (startTime && !isNaN(startTime)) {
      filters.startTime = startTime;
    }
    if (endTime && !isNaN(endTime)) {
      filters.endTime = endTime;
    }

    const stats = usageTrackingService.getSummary(filters);

    logger.info({
      filters,
      modelCount: Object.keys(stats.modelBreakdown).length,
    }, 'Model usage requested');

    res.json({
      models: stats.modelBreakdown,
      totalTokens: stats.totalTokens,
      totalCost: stats.totalCost,
    });
  })
);

/**
 * @route GET /api/v1/usage/timeseries
 * @desc Get time series data for usage over time
 * @access Public (or authenticated if enabled)
 * @query startTime - Filter by start time (timestamp)
 * @query endTime - Filter by end time (timestamp)
 * @query model - Filter by model name
 */
router.get(
  '/timeseries',
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = req.query.startTime ? parseInt(req.query.startTime as string) : undefined;
    const endTime = req.query.endTime ? parseInt(req.query.endTime as string) : undefined;
    const model = req.query.model as string | undefined;

    const filters: {
      startTime?: number;
      endTime?: number;
      model?: string;
    } = {};

    if (startTime && !isNaN(startTime)) {
      filters.startTime = startTime;
    }
    if (endTime && !isNaN(endTime)) {
      filters.endTime = endTime;
    }
    if (model) {
      filters.model = model;
    }

    const stats = usageTrackingService.getSummary(filters);

    logger.info({
      filters,
      dataPoints: stats.timeSeriesData.length,
    }, 'Time series data requested');

    res.json({
      timeSeries: stats.timeSeriesData,
      summary: {
        totalRequests: stats.totalRequests,
        totalTokens: stats.totalTokens,
        totalCost: stats.totalCost,
      },
    });
  })
);

export default router;
