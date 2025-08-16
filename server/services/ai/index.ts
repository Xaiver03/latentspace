// AI Services Index - Central export for all AI functionality
export type {
  // Core interfaces
  AIService,
  AIProviderAdapter, 
  AIRouter,
  AICache,
  AIAnalytics,
  AIManager
} from './ai-service';

export type {
  // Data types
  EmbeddingOptions,
  CompletionOptions,
  EmbeddingResult,
  CompletionResult,
  UserProfile,
  EnhancedProfile,
  CompatibilityScore,
  Recommendation,
  MatchPreferences,
  MatchResult,
  ProviderConfig,
  AIRequest,
  AIResponse,
  ProviderHealth,
  
  // Error types
  AIServiceError,
  ProviderError,
  RateLimitError
} from './types';

export type {
  // Additional types
  CacheEntry,
  CacheStats,
  ProviderStats,
  RoutingConfig
} from './types';

// Core implementations  
export { SmartAIManager, getAIManager, initializeAIManager } from './ai-manager';
export { SmartAIRouter } from './ai-router';
export { BaseProviderAdapter } from './base-provider-adapter';

// All provider adapters
export {
  OpenAIAdapter,
  ClaudeAdapter,
  DeepSeekAdapter,
  QwenAdapter,
  KimiAdapter,
  SiliconFlowAdapter,
  createOpenAIAdapter,
  createClaudeAdapter,
  createDeepSeekAdapter,
  createQwenAdapter,
  createKimiAdapter,
  createSiliconFlowAdapter,
  PROVIDER_CONFIGS,
  getAvailableProviderIds,
  createProviderById,
  createConfiguredProviders,
  getProviderConfig,
  getAvailableProviders,
  PROVIDER_RECOMMENDATIONS,
  getRecommendedProviders
} from './providers/index';

// Utility functions for backward compatibility with existing embedding service
export function createLegacyEmbeddingService() {
  const aiManager = getAIManager();
  
  return {
    async generateProfileEmbedding(profile: any) {
      const profileText = buildLegacyProfileText(profile);
      const result = await aiManager.generateEmbedding(profileText);
      
      return {
        embedding: result.embedding,
        tokens: result.tokens
      };
    },
    
    async generateSearchEmbedding(query: string): Promise<number[]> {
      const result = await aiManager.generateEmbedding(query);
      return result.embedding;
    },
    
    // Static methods from original EmbeddingService
    cosineSimilarity: aiManager.calculateSimilarity.bind(aiManager),
    
    findSimilarProfiles(
      queryEmbedding: number[],
      profileEmbeddings: Array<{ id: number; embedding: number[] }>,
      topK: number = 10
    ) {
      return aiManager.findSimilarEmbeddings(
        queryEmbedding,
        profileEmbeddings.map(p => ({ id: p.id.toString(), embedding: p.embedding })),
        topK
      ).map((result: any) => ({ id: parseInt(result.id), similarity: result.similarity }));
    }
  };
}

function buildLegacyProfileText(profile: any): string {
  const parts: string[] = [];

  // Role and experience
  parts.push(`Role: ${profile.roleIntent} with ${profile.seniority} experience level`);

  // Skills
  if (profile.skills && profile.skills.length > 0) {
    parts.push(`Core skills: ${profile.skills.join(', ')}`);
  }

  // Industries
  if (profile.industries && profile.industries.length > 0) {
    parts.push(`Industry focus: ${profile.industries.join(', ')}`);
  }

  // Technology stack
  if (profile.techStack && profile.techStack.length > 0) {
    parts.push(`Technology stack: ${profile.techStack.join(', ')}`);
  }

  // Work style
  if (profile.workStyle) {
    const workStyleText = Object.entries(profile.workStyle)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    parts.push(`Work style: ${workStyleText}`);
  }

  // Values
  if (profile.values) {
    const valuesText = Object.entries(profile.values)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
    parts.push(`Values: ${valuesText}`);
  }

  // Bio (most important part)
  if (profile.bio) {
    parts.push(`Biography: ${profile.bio}`);
  }

  return parts.join('. ');
}

// Quick start function for easy integration
export async function initializeAI(config?: {
  providers?: string[];
  routingStrategy?: 'cost-optimized' | 'performance-optimized' | 'quality-optimized' | 'round-robin';
  cacheEnabled?: boolean;
}) {
  const aiManager = await initializeAIManager({
    routing: {
      defaultStrategy: config?.routingStrategy || 'cost-optimized'
    }
  });
  
  console.log('🤖 AI System initialized with multi-provider support');
  console.log('Available providers:', aiManager.listProviders().map((p: any) => p.id).join(', '));
  
  return aiManager;
}

// Health check function
export async function checkAIHealth() {
  const aiManager = getAIManager();
  const health = await aiManager.getSystemHealth();
  
  return {
    status: health.overall,
    providers: health.providers,
    emergencyMode: aiManager.isEmergencyMode()
  };
}

// Cost tracking utilities  
export async function getAICosts(timeRange?: { start: Date; end: Date }) {
  const aiManager = getAIManager();
  const analytics = aiManager.getAnalytics();
  
  if (timeRange) {
    return await analytics.getSystemStats(timeRange);
  } else {
    // Default to last 30 days
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    return await analytics.getSystemStats({ start, end });
  }
}