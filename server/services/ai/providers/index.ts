// AI Providers Index - Central export for all provider adapters
export { OpenAIAdapter, createOpenAIAdapter } from './openai-adapter';
export { ClaudeAdapter, createClaudeAdapter } from './claude-adapter';
export { DeepSeekAdapter, createDeepSeekAdapter } from './deepseek-adapter';
export { QwenAdapter, createQwenAdapter } from './qwen-adapter';
export { KimiAdapter, createKimiAdapter } from './kimi-adapter';
export { SiliconFlowAdapter, createSiliconFlowAdapter } from './siliconflow-adapter';

import type { AIProviderAdapter } from '../ai-service';
import { createOpenAIAdapter } from './openai-adapter';
import { createClaudeAdapter } from './claude-adapter';
import { createDeepSeekAdapter } from './deepseek-adapter';
import { createQwenAdapter } from './qwen-adapter';
import { createKimiAdapter } from './kimi-adapter';
import { createSiliconFlowAdapter } from './siliconflow-adapter';

/**
 * Provider factory function type
 */
export type ProviderFactory = (apiKey?: string) => AIProviderAdapter;

/**
 * Available provider configurations
 */
export const PROVIDER_CONFIGS = {
  openai: {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'OpenAI (GPT & Embeddings)',
    envKeys: ['OPENAI_API_KEY'],
    factory: createOpenAIAdapter,
    priority: 1,
    description: 'Industry leading AI models with excellent embedding quality'
  },
  claude: {
    id: 'claude',
    name: 'Anthropic',
    displayName: 'Claude (Anthropic)', 
    envKeys: ['ANTHROPIC_API_KEY', 'CLAUDE_API_KEY'],
    factory: createClaudeAdapter,
    priority: 2,
    description: 'High-quality conversational AI with strong reasoning capabilities'
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    displayName: 'DeepSeek (中国AI)',
    envKeys: ['DEEPSEEK_API_KEY'],
    factory: createDeepSeekAdapter,
    priority: 3,
    description: 'Cost-effective AI models with competitive performance'
  },
  qwen: {
    id: 'qwen',
    name: 'Alibaba Cloud',
    displayName: 'Qwen (阿里云)',
    envKeys: ['QWEN_API_KEY', 'DASHSCOPE_API_KEY'],
    factory: createQwenAdapter,
    priority: 4,
    description: 'Alibaba Cloud AI models with strong Chinese language support'
  },
  kimi: {
    id: 'kimi',
    name: 'Moonshot AI',
    displayName: 'Kimi (月之暗面)',
    envKeys: ['KIMI_API_KEY', 'MOONSHOT_API_KEY'],
    factory: createKimiAdapter,
    priority: 5,
    description: 'Large context window AI models ideal for long documents'
  },
  siliconflow: {
    id: 'siliconflow',
    name: 'SiliconFlow',
    displayName: 'SiliconFlow (硅基流动)',
    envKeys: ['SILICONFLOW_API_KEY'],
    factory: createSiliconFlowAdapter,
    priority: 6,
    description: 'Multi-model platform with various open-source AI models'
  }
} as const;

/**
 * Get all available provider IDs
 */
export function getAvailableProviderIds(): string[] {
  return Object.keys(PROVIDER_CONFIGS);
}

/**
 * Create a provider by ID
 */
export function createProviderById(providerId: string, apiKey?: string): AIProviderAdapter | null {
  const config = PROVIDER_CONFIGS[providerId as keyof typeof PROVIDER_CONFIGS];
  if (!config) {
    throw new Error(`Unknown provider: ${providerId}`);
  }
  
  return config.factory(apiKey);
}

/**
 * Create all configured providers based on environment variables
 */
export function createConfiguredProviders(): AIProviderAdapter[] {
  const providers: AIProviderAdapter[] = [];
  
  Object.values(PROVIDER_CONFIGS).forEach(config => {
    // Check if any of the required environment variables are set
    const hasApiKey = config.envKeys.some(envKey => process.env[envKey]);
    
    if (hasApiKey) {
      try {
        const provider = config.factory();
        if (provider.isConfigured()) {
          providers.push(provider);
        }
      } catch (error) {
        console.warn(`Failed to create provider ${config.id}:`, error);
      }
    }
  });
  
  // Sort by priority
  return providers.sort((a, b) => {
    const aPriority = PROVIDER_CONFIGS[a.providerId as keyof typeof PROVIDER_CONFIGS]?.priority || 999;
    const bPriority = PROVIDER_CONFIGS[b.providerId as keyof typeof PROVIDER_CONFIGS]?.priority || 999;
    return aPriority - bPriority;
  });
}

/**
 * Get provider configuration by ID
 */
export function getProviderConfig(providerId: string) {
  return PROVIDER_CONFIGS[providerId as keyof typeof PROVIDER_CONFIGS] || null;
}

/**
 * Check which providers are available based on environment variables
 */
export function getAvailableProviders(): Array<{
  id: string;
  name: string;
  displayName: string;
  description: string;
  available: boolean;
  envKeys: string[];
}> {
  return Object.values(PROVIDER_CONFIGS).map(config => ({
    id: config.id,
    name: config.name,
    displayName: config.displayName,
    description: config.description,
    available: config.envKeys.some(envKey => !!process.env[envKey]),
    envKeys: config.envKeys
  }));
}

/**
 * Provider recommendation based on use case
 */
export const PROVIDER_RECOMMENDATIONS = {
  cost_optimized: ['deepseek', 'siliconflow', 'qwen', 'kimi', 'openai', 'claude'],
  quality_optimized: ['claude', 'openai', 'deepseek', 'qwen', 'kimi', 'siliconflow'],
  performance_optimized: ['openai', 'deepseek', 'siliconflow', 'claude', 'qwen', 'kimi'],
  chinese_optimized: ['qwen', 'deepseek', 'kimi', 'siliconflow', 'openai', 'claude']
} as const;

/**
 * Get recommended providers for a specific use case
 */
export function getRecommendedProviders(
  useCase: keyof typeof PROVIDER_RECOMMENDATIONS
): string[] {
  return PROVIDER_RECOMMENDATIONS[useCase] || [];
}