// AI Service Interface - Unified interface for all AI providers
import type {
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
  ProviderHealth,
  AIRequest,
  AIResponse
} from './types';

/**
 * Core AI Service Interface
 * All AI providers must implement this interface to ensure consistency
 */
export interface AIService {
  // Basic AI Operations
  generateEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult>;
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;
  
  // Semantic Operations
  calculateSimilarity(embedding1: number[], embedding2: number[]): number;
  findSimilarEmbeddings(queryEmbedding: number[], candidates: Array<{id: string, embedding: number[]}>, topK?: number): Array<{id: string, similarity: number}>;
  
  // Co-founder Matching Specific Operations
  analyzeCompatibility(profile1: UserProfile, profile2: UserProfile): Promise<CompatibilityScore>;
  enhanceUserProfile(profile: UserProfile): Promise<EnhancedProfile>;
  generateRecommendations(userId: string, preferences: MatchPreferences): Promise<Recommendation[]>;
  generateMatchReason(match: MatchResult): Promise<string>;
  
  // Provider Health and Status
  checkHealth(): Promise<ProviderHealth>;
  getCapabilities(): {
    supportsEmbedding: boolean;
    supportsCompletion: boolean;
    maxInputLength: number;
    embeddingDimensions: number;
  };
}

/**
 * AI Provider Adapter Interface
 * Base interface for specific provider implementations
 */
export interface AIProviderAdapter {
  // Provider Identification
  readonly providerId: string;
  readonly providerName: string;
  readonly displayName: string;
  
  // Core Operations
  generateEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult>;
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;
  
  // Health and Configuration
  checkHealth(): Promise<boolean>;
  isConfigured(): boolean;
  getConfiguration(): {
    apiKey: string;
    baseUrl: string;
    models: {
      embedding: string[];
      completion: string[];
    };
  };
  
  // Rate Limiting and Costs
  getRemainingQuota(): Promise<{
    requests: number;
    tokens: number;
    resetTime?: Date;
  }>;
  
  estimateCost(operation: 'embedding' | 'completion', tokens: number): number;
}

/**
 * AI Router Interface
 * Handles intelligent routing between providers
 */
export interface AIRouter {
  // Routing Operations
  route(request: AIRequest): Promise<AIProviderAdapter>;
  executeRequest(request: AIRequest): Promise<AIResponse>;
  
  // Provider Management
  addProvider(adapter: AIProviderAdapter): void;
  removeProvider(providerId: string): void;
  getProvider(providerId: string): AIProviderAdapter | null;
  getAvailableProviders(): AIProviderAdapter[];
  getHealthyProviders(): Promise<AIProviderAdapter[]>;
  
  // Routing Strategy
  setRoutingStrategy(strategy: 'cost-optimized' | 'performance-optimized' | 'quality-optimized' | 'round-robin'): void;
  getRoutingStrategy(): string;
}

/**
 * AI Cache Interface
 * Manages caching for AI operations
 */
export interface AICache {
  // Cache Operations
  get<T = any>(key: string): Promise<T | null>;
  set<T = any>(key: string, value: T, ttl?: number): Promise<void>;
  del(key: string): Promise<void>;
  clear(): Promise<void>;
  
  // Cache Management
  exists(key: string): Promise<boolean>;
  ttl(key: string): Promise<number>;
  expire(key: string, ttl: number): Promise<void>;
  
  // Cache Statistics
  getStats(): Promise<{
    hitRate: number;
    missRate: number;
    totalHits: number;
    totalMisses: number;
    memoryUsage: number;
  }>;
}

/**
 * AI Analytics Interface
 * Tracks usage, performance, and costs
 */
export interface AIAnalytics {
  // Usage Tracking
  trackRequest(providerId: string, operation: string, duration: number, success: boolean, cost?: number): Promise<void>;
  trackError(providerId: string, error: Error, operation: string): Promise<void>;
  
  // Performance Metrics
  getProviderStats(providerId: string, timeRange: { start: Date; end: Date }): Promise<{
    totalRequests: number;
    successRate: number;
    averageLatency: number;
    totalCost: number;
    errorRate: number;
  }>;
  
  getSystemStats(timeRange: { start: Date; end: Date }): Promise<{
    totalRequests: number;
    requestsByProvider: { [providerId: string]: number };
    costsByProvider: { [providerId: string]: number };
    averageLatency: number;
    overallSuccessRate: number;
  }>;
  
  // Cost Analysis
  getDailyCosts(): Promise<{ [date: string]: { [providerId: string]: number } }>;
  getMonthlyCosts(): Promise<{ [month: string]: { [providerId: string]: number } }>;
  getProjectedCosts(days: number): Promise<{ [providerId: string]: number }>;
}

/**
 * Main AI Manager Interface
 * Orchestrates all AI operations
 */
export interface AIManager extends AIService {
  // System Management
  initialize(config: { [providerId: string]: any }): Promise<void>;
  shutdown(): Promise<void>;
  
  // Provider Management
  getRouter(): AIRouter;
  getCache(): AICache;
  getAnalytics(): AIAnalytics;
  
  // Configuration Management
  updateProviderConfig(providerId: string, config: any): Promise<void>;
  getProviderConfig(providerId: string): any;
  listProviders(): Array<{
    id: string;
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    enabled: boolean;
  }>;
  
  // Health and Monitoring
  getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'down';
    providers: Array<{
      id: string;
      status: 'healthy' | 'degraded' | 'down';
      latency?: number;
      errorRate: number;
    }>;
  }>;
  
  // Emergency Operations
  enableEmergencyMode(): void;
  disableEmergencyMode(): void;
  isEmergencyMode(): boolean;
}