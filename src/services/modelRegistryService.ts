/**
 * Model Registry Service
 * Manages model information and validation
 */

import { Model } from '../types/openrouter';
import { ModelInfo } from '../types/inference';
import { OpenRouterService } from './openrouterService';
import { logger } from '../utils/logger';

export class ModelRegistryService {
  private models: Map<string, Model> = new Map();
  private lastUpdated: number = 0;
  private readonly cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  private openrouterService: OpenRouterService;

  constructor(openrouterService: OpenRouterService) {
    this.openrouterService = openrouterService;
  }

  async getModels(): Promise<ModelInfo[]> {
    await this.refreshModelsIfNeeded();
    
    return Array.from(this.models.values()).map(model => this.transformModel(model));
  }

  async getModel(modelId: string): Promise<ModelInfo | null> {
    await this.refreshModelsIfNeeded();
    
    const model = this.models.get(modelId);
    return model ? this.transformModel(model) : null;
  }

  async validateModel(modelId: string): Promise<boolean> {
    const model = await this.getModel(modelId);
    return model !== null;
  }

  async getSupportedParameters(modelId: string): Promise<string[]> {
    const model = await this.getModel(modelId);
    if (!model) {
      return [];
    }

    // Base parameters supported by most models
    const baseParameters = [
      'temperature',
      'max_tokens',
      'top_p',
      'frequency_penalty',
      'presence_penalty',
      'stop',
      'stream',
    ];

    // Model-specific parameters based on provider
    const provider = this.getProviderFromModelId(modelId);
    const providerParameters = this.getProviderSpecificParameters(provider);

    return [...baseParameters, ...providerParameters];
  }

  async getModelPricing(modelId: string): Promise<{ prompt: string; completion: string } | null> {
    const model = await this.getModel(modelId);
    return model?.pricing || null;
  }

  async getModelContextLength(modelId: string): Promise<number> {
    const model = await this.getModel(modelId);
    return model?.context_length || 0;
  }

  async isModelModerated(modelId: string): Promise<boolean> {
    const model = await this.getModel(modelId);
    return model?.is_moderated || false;
  }

  async getTopModels(limit: number = 10): Promise<ModelInfo[]> {
    const models = await this.getModels();
    
    // Sort by context length and return top models
    return models
      .sort((a, b) => b.context_length - a.context_length)
      .slice(0, limit);
  }

  async searchModels(query: string): Promise<ModelInfo[]> {
    const models = await this.getModels();
    const lowercaseQuery = query.toLowerCase();
    
    return models.filter(model => 
      model.id.toLowerCase().includes(lowercaseQuery) ||
      model.name.toLowerCase().includes(lowercaseQuery) ||
      (model.description && model.description.toLowerCase().includes(lowercaseQuery))
    );
  }

  async getModelsByProvider(provider: string): Promise<ModelInfo[]> {
    const models = await this.getModels();
    
    return models.filter(model => 
      this.getProviderFromModelId(model.id) === provider
    );
  }

  private async refreshModelsIfNeeded(): Promise<void> {
    const now = Date.now();
    
    if (this.models.size === 0 || (now - this.lastUpdated) > this.cacheTimeout) {
      await this.refreshModels();
    }
  }

  private async refreshModels(): Promise<void> {
    try {
      logger.info('Refreshing model registry');
      
      const models = await this.openrouterService.getModels();
      
      this.models.clear();
      for (const model of models) {
        this.models.set(model.id, model);
      }
      
      this.lastUpdated = Date.now();
      
      logger.info({ count: models.length }, 'Model registry refreshed');
    } catch (error) {
      logger.error({ error: (error as Error).message }, 'Failed to refresh model registry');
      throw error;
    }
  }

  private transformModel(model: Model): ModelInfo {
    return {
      id: model.id,
      name: model.name,
      description: model.description,
      context_length: model.context_length,
      pricing: model.pricing || { prompt: '0', completion: '0' },
      supported_parameters: this.getSupportedParametersForModel(model),
      is_moderated: model.top_provider.is_moderated,
      max_completion_tokens: model.top_provider.max_completion_tokens,
    };
  }

  private getSupportedParametersForModel(model: Model): string[] {
    const baseParameters = [
      'temperature',
      'max_tokens',
      'top_p',
      'frequency_penalty',
      'presence_penalty',
      'stop',
      'stream',
    ];

    const provider = this.getProviderFromModelId(model.id);
    const providerParameters = this.getProviderSpecificParameters(provider);

    // Check if model supports specific parameters based on architecture
    const additionalParameters: string[] = [];
    
    if (model.architecture.instruct_type) {
      additionalParameters.push('system', 'user', 'assistant');
    }

    if (model.per_request_limits && (model.per_request_limits.prompt_tokens || model.per_request_limits.completion_tokens)) {
      additionalParameters.push('max_tokens');
    }

    return [...baseParameters, ...providerParameters, ...additionalParameters];
  }

  private getProviderFromModelId(modelId: string): string {
    const parts = modelId.split('/');
    return parts[0] || 'unknown';
  }

  private getProviderSpecificParameters(provider: string): string[] {
    const providerParameters: { [key: string]: string[] } = {
      'openai': [
        'logit_bias',
        'logprobs',
        'top_logprobs',
        'response_format',
        'seed',
        'tools',
        'tool_choice',
      ],
      'anthropic': [
        'top_k',
        'repetition_penalty',
        'min_p',
        'top_a',
      ],
      'google': [
        'top_k',
        'candidate_count',
      ],
      'cohere': [
        'top_k',
        'repetition_penalty',
      ],
      'mistral': [
        'safe_prompt',
        'random_seed',
      ],
      'deepseek': [
        'top_k',
        'repetition_penalty',
      ],
    };

    return providerParameters[provider] || [];
  }

  getCacheStats(): { size: number; lastUpdated: number; age: number } {
    return {
      size: this.models.size,
      lastUpdated: this.lastUpdated,
      age: Date.now() - this.lastUpdated,
    };
  }

  clearCache(): void {
    this.models.clear();
    this.lastUpdated = 0;
    logger.info('Model registry cache cleared');
  }
}
