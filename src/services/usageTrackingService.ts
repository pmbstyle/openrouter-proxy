/**
 * Usage Tracking Service
 * Tracks request statistics, token usage, and costs
 * In-memory storage (can be enhanced with Redis)
 */

import { logger } from '../utils/logger';
import { UsageRecord, UsageStats, ModelStats, TimeSeriesPoint, UsageFilters, UsageSummary } from '../types/usage';
import {
  inferenceCounter,
  inferenceDuration,
  inferenceTokens,
  inferenceCost,
} from '../telemetry/metrics';

const MAX_RECORDS = 10000; // Max records to keep in memory
const MAX_TIME_SERIES_POINTS = 100; // Max time series points to keep

class UsageTrackingService {
  private records: (UsageRecord & { timestamp: number })[] = [];
  private timeSeries: TimeSeriesPoint[] = [];
  private lastCleanup = Date.now();
  private readonly cleanupInterval = 3600000; // 1 hour

  constructor() {
    // Periodic cleanup of old records
    setInterval(() => this.cleanup(), this.cleanupInterval);
  }

  /**
   * Record a usage event
   */
  recordUsage(data: UsageRecord): void {
    const record: UsageRecord & { timestamp: number } = {
      timestamp: Date.now(),
      ...data,
    };

    this.records.push(record);

    // Update time series data
    this.updateTimeSeries(record);

    // Record OpenTelemetry metrics
    inferenceCounter.add(1, {
      model: record.model,
      success: record.success.toString(),
    });

    inferenceDuration.record(record.duration, {
      model: record.model,
    });

    inferenceTokens.record(record.totalTokens, {
      model: record.model,
      token_type: 'total',
    });

    inferenceTokens.record(record.promptTokens, {
      model: record.model,
      token_type: 'prompt',
    });

    inferenceTokens.record(record.completionTokens, {
      model: record.model,
      token_type: 'completion',
    });

    inferenceCost.add(record.cost, {
      model: record.model,
    });

    // Cleanup if needed
    if (this.records.length > MAX_RECORDS) {
      this.cleanup();
    }

    logger.debug({
      requestId: record.requestId,
      model: record.model,
      tokens: record.totalTokens,
      cost: record.cost,
    }, 'Usage recorded');
  }

  /**
   * Get usage summary with optional filters
   */
  getSummary(filters?: UsageFilters): UsageStats {
    let filteredRecords = this.records;

    // Apply filters
    if (filters) {
      if (filters.startTime) {
        filteredRecords = filteredRecords.filter(r => r.timestamp >= filters.startTime!);
      }
      if (filters.endTime) {
        filteredRecords = filteredRecords.filter(r => r.timestamp <= filters.endTime!);
      }
      if (filters.model) {
        filteredRecords = filteredRecords.filter(r => r.model === filters.model);
      }
      if (filters.apiKey) {
        filteredRecords = filteredRecords.filter(r => r.apiKey === filters.apiKey);
      }
    }

    if (filteredRecords.length === 0) {
      return this.getEmptyStats();
    }

    // Calculate stats
    const successfulRequests = filteredRecords.filter(r => r.success).length;
    const failedRequests = filteredRecords.filter(r => !r.success).length;

    const totalTokens = filteredRecords.reduce((sum, r) => sum + r.totalTokens, 0);
    const promptTokens = filteredRecords.reduce((sum, r) => sum + r.promptTokens, 0);
    const completionTokens = filteredRecords.reduce((sum, r) => sum + r.completionTokens, 0);
    const totalCost = Math.round(filteredRecords.reduce((sum, r) => sum + r.cost, 0) * 1000000) / 1000000;
    const avgDuration = Math.round(filteredRecords.reduce((sum, r) => sum + r.duration, 0) / filteredRecords.length);

    // Model breakdown
    const modelBreakdown: ModelStats = {};
    for (const record of filteredRecords) {
      if (!modelBreakdown[record.model]) {
        modelBreakdown[record.model] = { requests: 0, tokens: 0, cost: 0 };
      }
      modelBreakdown[record.model].requests++;
      modelBreakdown[record.model].tokens += record.totalTokens;
      modelBreakdown[record.model].cost = Math.round((modelBreakdown[record.model].cost + record.cost) * 1000000) / 1000000;
    }

    // Time series data
    const timeSeriesData = this.getTimeSeries(filteredRecords);

    return {
      totalRequests: filteredRecords.length,
      successfulRequests,
      failedRequests,
      totalTokens,
      promptTokens,
      completionTokens,
      totalCost,
      avgDuration: Math.round(avgDuration),
      modelBreakdown,
      timeSeriesData,
    };
  }

  /**
   * Get full usage summary including per-API-key stats
   */
  getFullSummary(filters?: UsageFilters): UsageSummary {
    const global = this.getSummary(filters);

    // Get per-API-key stats if apiKey filter is not set
    const perApiKey = filters?.apiKey
      ? undefined
      : this.getPerApiKeyStats(filters);

    return {
      global,
      perApiKey,
    };
  }

  /**
   * Get statistics for each API key
   */
  private getPerApiKeyStats(filters?: UsageFilters): { [apiKey: string]: UsageStats } {
    const apiKeys = new Set(
      this.records
        .filter(r => r.apiKey)
        .map(r => r.apiKey!)
    );

    const result: { [apiKey: string]: UsageStats } = {};

    for (const apiKey of apiKeys) {
      result[apiKey] = this.getSummary({ ...filters, apiKey });
    }

    return result;
  }

  /**
   * Get time series data for filtered records
   */
  private getTimeSeries(records: (UsageRecord & { timestamp: number })[]): TimeSeriesPoint[] {
    if (records.length === 0) return [];

    // Group by hour
    const hourlyData = new Map<number, TimeSeriesPoint>();

    for (const record of records) {
      const hourTimestamp = Math.floor(record.timestamp / 3600000) * 3600000;

      if (!hourlyData.has(hourTimestamp)) {
        hourlyData.set(hourTimestamp, {
          timestamp: hourTimestamp,
          requests: 0,
          tokens: 0,
          cost: 0,
        });
      }

      const point = hourlyData.get(hourTimestamp)!;
      point.requests++;
      point.tokens += record.totalTokens;
      point.cost = Math.round((point.cost + record.cost) * 1000000) / 1000000;
    }

    return Array.from(hourlyData.values()).sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Update time series data
   */
  private updateTimeSeries(record: UsageRecord & { timestamp: number }): void {
    const hourTimestamp = Math.floor(record.timestamp / 3600000) * 3600000;

    let point = this.timeSeries.find(p => p.timestamp === hourTimestamp);

    if (point) {
      point.requests++;
      point.tokens += record.totalTokens;
      point.cost = Math.round((point.cost + record.cost) * 1000000) / 1000000;
    } else {
      this.timeSeries.push({
        timestamp: hourTimestamp,
        requests: 1,
        tokens: record.totalTokens,
        cost: Math.round(record.cost * 1000000) / 1000000,
      });
    }

    // Keep only recent time series data
    if (this.timeSeries.length > MAX_TIME_SERIES_POINTS) {
      this.timeSeries = this.timeSeries.slice(-MAX_TIME_SERIES_POINTS);
    }
  }

  /**
   * Cleanup old records
   */
  private cleanup(): void {
    const now = Date.now();
    const oneDayAgo = now - 86400000;

    // Remove records older than 24 hours
    const beforeLength = this.records.length;
    this.records = this.records.filter(r => r.timestamp > oneDayAgo);
    const removed = beforeLength - this.records.length;

    // Cleanup time series data older than 7 days
    const sevenDaysAgo = now - 604800000;
    this.timeSeries = this.timeSeries.filter(p => p.timestamp > sevenDaysAgo);

    this.lastCleanup = now;

    if (removed > 0) {
      logger.info({ removed, remaining: this.records.length }, 'Usage records cleaned up');
    }
  }

  /**
   * Get current service stats
   */
  getServiceStats(): { totalRecords: number; timeSeriesPoints: number; lastCleanup: number } {
    return {
      totalRecords: this.records.length,
      timeSeriesPoints: this.timeSeries.length,
      lastCleanup: this.lastCleanup,
    };
  }

  /**
   * Get empty stats structure
   */
  private getEmptyStats(): UsageStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalTokens: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalCost: 0,
      avgDuration: 0,
      modelBreakdown: {},
      timeSeriesData: [],
    };
  }
}

// Export singleton instance
export const usageTrackingService = new UsageTrackingService();
