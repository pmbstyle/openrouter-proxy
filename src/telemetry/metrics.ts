/**
 * Custom Metrics Definitions
 * OpenTelemetry metrics for monitoring application performance
 */

import { metrics } from '@opentelemetry/api';
import { Counter, Histogram, UpDownCounter } from '@opentelemetry/api';

const meter = metrics.getMeter('llm-proxy');

// Request counters
export const requestCounter = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

export const requestDuration = meter.createHistogram('http_request_duration_ms', {
  description: 'HTTP request duration in milliseconds',
});

export const activeRequests = meter.createUpDownCounter('http_requests_active', {
  description: 'Number of active HTTP requests',
});

// Inference metrics
export const inferenceCounter = meter.createCounter('inference_requests_total', {
  description: 'Total number of inference requests',
});

export const inferenceDuration = meter.createHistogram('inference_duration_ms', {
  description: 'Inference request duration in milliseconds',
});

export const inferenceTokens = meter.createHistogram('inference_tokens', {
  description: 'Number of tokens processed',
});

export const inferenceCost = meter.createCounter('inference_cost_total', {
  description: 'Total cost of inference requests in USD',
});

// WebSocket metrics
export const websocketConnections = meter.createUpDownCounter('websocket_connections', {
  description: 'Number of active WebSocket connections',
});

export const websocketMessages = meter.createCounter('websocket_messages_total', {
  description: 'Total number of WebSocket messages',
});

export const websocketErrors = meter.createCounter('websocket_errors_total', {
  description: 'Total number of WebSocket errors',
});

// Error tracking
export const errorCounter = meter.createCounter('errors_total', {
  description: 'Total number of errors',
});
