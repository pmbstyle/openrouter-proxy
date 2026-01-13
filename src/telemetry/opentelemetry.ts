/**
 * OpenTelemetry Initialization
 * Sets up observability with Prometheus metrics export
 */

import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { config } from '../utils/config';
import { logger } from '../utils/logger';

export const initializeOpenTelemetry = (): void => {
  // Skip in test environment
  if (config.server.nodeEnv === 'test') {
    return;
  }

  const resource = Resource.default().merge(
    new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'llm-proxy',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.server.nodeEnv,
    })
  );

  const prometheusExporter = new PrometheusExporter({
    port: 9464,
    endpoint: '/metrics',
  });

  const sdk = new NodeSDK({
    resource,
    traceExporter: undefined, // Add Jaeger/OTLP exporter if needed
    metricReader: prometheusExporter,
    instrumentations: [getNodeAutoInstrumentations()],
    spanProcessor: undefined,
  });

  try {
    sdk.start();
    logger.info('OpenTelemetry initialized successfully');
    logger.info('Prometheus metrics available at http://localhost:9464/metrics');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error({ error: message }, 'Failed to initialize OpenTelemetry');
  }

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk.shutdown()
      .then(() => logger.info('OpenTelemetry shut down successfully'))
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        logger.error({ error: message }, 'Error shutting down OpenTelemetry');
      });
  });
};
