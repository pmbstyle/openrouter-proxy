/**
 * Cost Calculator Utility
 * Centralized cost calculation logic
 */

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ModelPricing {
  promptCostPer1K: number;
  completionCostPer1K: number;
}

// Default pricing (simplified - in production, use actual model pricing)
const DEFAULT_PRICING: ModelPricing = {
  promptCostPer1K: 0.5, // $0.50 per 1K tokens
  completionCostPer1K: 1.5, // $1.50 per 1K tokens
};

// Model-specific pricing (simplified)
const MODEL_PRICING: Record<string, ModelPricing> = {
  'gpt-4': { promptCostPer1K: 30.0, completionCostPer1K: 60.0 },
  'gpt-4-turbo': { promptCostPer1K: 10.0, completionCostPer1K: 30.0 },
  'gpt-3.5-turbo': { promptCostPer1K: 0.5, completionCostPer1K: 1.5 },
  'claude-3-opus': { promptCostPer1K: 15.0, completionCostPer1K: 75.0 },
  'claude-3-sonnet': { promptCostPer1K: 3.0, completionCostPer1K: 15.0 },
  'claude-3-haiku': { promptCostPer1K: 0.25, completionCostPer1K: 1.25 },
};

export const calculateCost = (usage: TokenUsage, model: string): number => {
  const pricing = getModelPricing(model);
  
  const promptCost = (usage.prompt_tokens / 1000) * pricing.promptCostPer1K;
  const completionCost = (usage.completion_tokens / 1000) * pricing.completionCostPer1K;
  
  return promptCost + completionCost;
};

export const getModelPricing = (model: string): ModelPricing => {
  // Extract base model name (remove provider prefix)
  const baseModel = model.includes('/') ? model.split('/')[1] : model;
  
  // Find exact match first
  if (MODEL_PRICING[baseModel]) {
    return MODEL_PRICING[baseModel];
  }
  
  // Find partial match
  for (const [modelName, pricing] of Object.entries(MODEL_PRICING)) {
    if (baseModel.includes(modelName) || modelName.includes(baseModel)) {
      return pricing;
    }
  }
  
  // Return default pricing
  return DEFAULT_PRICING;
};

export const estimateTokens = (text: string): number => {
  // Simplified token estimation (in production, use proper tokenizer)
  // This is a rough approximation: ~4 characters per token
  return Math.ceil(text.length / 4);
};

export const estimatePromptTokens = (messages: Array<{ content: string | any[] }>): number => {
  let totalLength = 0;
  
  for (const message of messages) {
    if (typeof message.content === 'string') {
      totalLength += message.content.length;
    } else if (Array.isArray(message.content)) {
      for (const part of message.content) {
        if (part.type === 'text' && typeof part.text === 'string') {
          totalLength += part.text.length;
        }
      }
    }
  }
  
  return estimateTokens(totalLength.toString());
};
