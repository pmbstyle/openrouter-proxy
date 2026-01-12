/**
 * Usage Tracking Types
 * For statistics and metrics tracking
 */

export interface UsageRecord {
  requestId: string;
  apiKey?: string; // First 8 chars of API key for identification
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  stream: boolean;
  success: boolean;
  errorType?: string;
  duration: number; // Request duration in ms
}

export interface UsageStats {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  avgDuration: number;
  modelBreakdown: ModelStats;
  timeSeriesData: TimeSeriesPoint[];
}

export interface ModelStats {
  [modelName: string]: {
    requests: number;
    tokens: number;
    cost: number;
  };
}

export interface TimeSeriesPoint {
  timestamp: number;
  requests: number;
  tokens: number;
  cost: number;
}

export interface UsageSummary {
  global: UsageStats;
  perApiKey?: {
    [apiKey: string]: UsageStats;
  };
}

export interface UsageFilters {
  startTime?: number;
  endTime?: number;
  model?: string;
  apiKey?: string;
}
