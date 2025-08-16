// AI Service Types and Interfaces
// This file defines the core types and interfaces for the multi-provider AI architecture

export interface EmbeddingOptions {
  model?: string;
  dimensions?: number;
  encodingFormat?: 'float' | 'base64';
  user?: string;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  stop?: string | string[];
  user?: string;
}

export interface EmbeddingResult {
  embedding: number[];
  tokens: number;
  model: string;
  provider: string;
}

export interface CompletionResult {
  text: string;
  tokens: {
    prompt: number;
    completion: number;
    total: number;
  };
  model: string;
  provider: string;
  finishReason?: 'stop' | 'length' | 'content_filter' | 'function_call';
}

export interface UserProfile {
  id: string;
  basicInfo: {
    name: string;
    background: string;
    skills: string[];
    experience: string[];
  };
  entrepreneurialInfo: {
    role: 'CEO' | 'CTO' | 'CPO' | 'Other';
    stage: 'idea' | 'prototype' | 'mvp' | 'scaling';
    industry: string[];
    timeCommitment: 'fulltime' | 'parttime' | 'weekend';
    location: string;
    remoteWillingness: boolean;
  };
  preferences: {
    partnerRole: string[];
    workStyle: string[];
    values: string[];
  };
}

export interface EnhancedProfile extends UserProfile {
  aiInsights: {
    personalityTraits: string[];
    workStyleAnalysis: string;
    strengthsWeaknesses: {
      strengths: string[];
      gaps: string[];
    };
    idealPartnerProfile: string;
  };
  embeddingVector: number[];
}

export interface CompatibilityScore {
  overallScore: number; // 0-100
  dimensions: {
    roleCompatibility: number;
    skillComplementarity: number;
    valueAlignment: number;
    workStyleMatch: number;
    goalAlignment: number;
  };
  reasoning: string;
  recommendedActions: string[];
}

export interface Recommendation {
  candidateId: string;
  compatibilityScore: CompatibilityScore;
  matchReason: string;
  confidence: number;
  recommendationRank: number;
}

export interface MatchPreferences {
  roles?: string[];
  industries?: string[];
  location?: string;
  remoteOk?: boolean;
  timeCommitment?: string[];
  minExperience?: string;
  maxExperience?: string;
}

export interface MatchResult {
  userId1: string;
  userId2: string;
  compatibilityScore: CompatibilityScore;
  matchType: 'ai_recommended' | 'manual_search' | 'mutual_interest';
  timestamp: Date;
}

// Provider Configuration Types
export interface ProviderConfig {
  id: string;
  name: string;
  displayName: string;
  apiKey: string;
  baseUrl: string;
  isEnabled: boolean;
  priority: number;
  rateLimit: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  pricing: {
    embeddingCostPer1K: number;
    completionCostPer1K: number;
    currency: 'USD' | 'CNY';
  };
  capabilities: {
    supportsEmbedding: boolean;
    supportsCompletion: boolean;
    maxInputLength: number;
    embeddingDimensions: number;
  };
}

// Request and Response Types
export interface AIRequest {
  type: 'embedding' | 'completion';
  input: string;
  options?: EmbeddingOptions | CompletionOptions;
  routingStrategy?: 'cost-optimized' | 'performance-optimized' | 'quality-optimized' | 'specific-provider';
  preferredProvider?: string;
  fallbackProviders?: string[];
  cacheEnabled?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
}

export interface AIResponse {
  success: boolean;
  data?: EmbeddingResult | CompletionResult;
  error?: {
    code: string;
    message: string;
    provider?: string;
    retryable: boolean;
  };
  metadata: {
    provider: string;
    model: string;
    latency: number;
    cost?: number;
    cached: boolean;
    timestamp: Date;
  };
}

// Health Check Types
export interface ProviderHealth {
  providerId: string;
  status: 'healthy' | 'degraded' | 'down';
  latency?: number;
  lastCheck: Date;
  errorRate: number;
  uptime: number;
}

// Analytics Types  
export interface ProviderStats {
  providerId: string;
  timeRange: {
    start: Date;
    end: Date;
  };
  metrics: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageLatency: number;
    totalCost: number;
    tokenUsage: {
      prompt: number;
      completion: number;
      total: number;
    };
  };
}

// Routing Configuration Types
export interface RoutingConfig {
  defaultStrategy: 'round-robin' | 'cost-optimized' | 'performance-optimized' | 'quality-optimized';
  strategies: {
    [key: string]: {
      providerWeights: { [providerId: string]: number };
      fallbackChain: string[];
      healthCheckEnabled: boolean;
      cacheEnabled: boolean;
    };
  };
  circuitBreaker: {
    failureThreshold: number;
    resetTimeout: number;
  };
}

// Cache Types
export interface CacheEntry<T = any> {
  key: string;
  data: T;
  ttl: number;
  createdAt: Date;
  accessCount: number;
  lastAccessed: Date;
}

export interface CacheStats {
  totalEntries: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  memoryUsage: number;
}

// Error Types
export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public provider?: string,
    public retryable: boolean = false,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class ProviderError extends AIServiceError {
  constructor(
    message: string,
    provider: string,
    code: string = 'PROVIDER_ERROR',
    retryable: boolean = true,
    originalError?: Error
  ) {
    super(message, code, provider, retryable, originalError);
    this.name = 'ProviderError';
  }
}

export class RateLimitError extends AIServiceError {
  constructor(
    provider: string,
    resetTime?: Date,
    originalError?: Error
  ) {
    super(`Rate limit exceeded for provider ${provider}`, 'RATE_LIMIT_EXCEEDED', provider, true, originalError);
    this.name = 'RateLimitError';
    this.resetTime = resetTime;
  }
  
  public resetTime?: Date;
}

export class ConfigurationError extends AIServiceError {
  constructor(
    message: string,
    provider?: string,
    originalError?: Error
  ) {
    super(message, 'CONFIGURATION_ERROR', provider, false, originalError);
    this.name = 'ConfigurationError';
  }
}