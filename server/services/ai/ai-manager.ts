// AI Manager - Central orchestrator for all AI operations
import type {
  AIManager,
  AIService,
  AIRouter,
  AICache,
  AIAnalytics
} from './ai-service';

import type {
  UserProfile,
  EnhancedProfile,
  CompatibilityScore,
  Recommendation,
  MatchPreferences,
  MatchResult,
  EmbeddingOptions,
  CompletionOptions,
  EmbeddingResult,
  CompletionResult,
  ProviderHealth,
  AIRequest,
  AIResponse
} from './types';

import { SmartAIRouter } from './ai-router';
import { createConfiguredProviders, PROVIDER_CONFIGS } from './providers/index';

/**
 * Simple in-memory cache implementation
 */
class SimpleAICache implements AICache {
  private cache = new Map<string, { data: any; expires: number; accessCount: number }>();
  
  async get<T = any>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    entry.accessCount++;
    return entry.data as T;
  }
  
  async set<T = any>(key: string, value: T, ttl: number = 3600): Promise<void> {
    this.cache.set(key, {
      data: value,
      expires: Date.now() + (ttl * 1000),
      accessCount: 0
    });
  }
  
  async del(key: string): Promise<void> {
    this.cache.delete(key);
  }
  
  async clear(): Promise<void> {
    this.cache.clear();
  }
  
  async exists(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    return !!(entry && Date.now() <= entry.expires);
  }
  
  async ttl(key: string): Promise<number> {
    const entry = this.cache.get(key);
    if (!entry) return -2;
    
    const remaining = Math.max(0, entry.expires - Date.now()) / 1000;
    return remaining > 0 ? remaining : -1;
  }
  
  async expire(key: string, ttl: number): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      entry.expires = Date.now() + (ttl * 1000);
    }
  }
  
  async getStats() {
    const entries = Array.from(this.cache.values());
    const totalHits = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    const totalRequests = totalHits + entries.length; // Approximate
    
    return {
      hitRate: totalRequests > 0 ? totalHits / totalRequests : 0,
      missRate: totalRequests > 0 ? (totalRequests - totalHits) / totalRequests : 0,
      totalHits,
      totalMisses: totalRequests - totalHits,
      memoryUsage: this.cache.size
    };
  }
}

/**
 * Simple analytics tracker
 */
class SimpleAIAnalytics implements AIAnalytics {
  private metrics: Array<{
    providerId: string;
    operation: string;
    duration: number;
    success: boolean;
    cost?: number;
    timestamp: number;
  }> = [];
  
  async trackRequest(
    providerId: string, 
    operation: string, 
    duration: number, 
    success: boolean, 
    cost?: number
  ): Promise<void> {
    this.metrics.push({
      providerId,
      operation,
      duration,
      success,
      cost,
      timestamp: Date.now()
    });
    
    // Keep only last 10000 metrics
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-10000);
    }
  }
  
  async trackError(providerId: string, error: Error, operation: string): Promise<void> {
    await this.trackRequest(providerId, operation, 0, false);
  }
  
  async getProviderStats(providerId: string, timeRange: { start: Date; end: Date }) {
    const startTime = timeRange.start.getTime();
    const endTime = timeRange.end.getTime();
    
    const relevantMetrics = this.metrics.filter(m => 
      m.providerId === providerId && 
      m.timestamp >= startTime && 
      m.timestamp <= endTime
    );
    
    const totalRequests = relevantMetrics.length;
    const successfulRequests = relevantMetrics.filter(m => m.success).length;
    const totalLatency = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    const totalCost = relevantMetrics.reduce((sum, m) => sum + (m.cost || 0), 0);
    const failedRequests = totalRequests - successfulRequests;
    
    return {
      totalRequests,
      successRate: totalRequests > 0 ? successfulRequests / totalRequests : 0,
      averageLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      totalCost,
      errorRate: totalRequests > 0 ? failedRequests / totalRequests : 0
    };
  }
  
  async getSystemStats(timeRange: { start: Date; end: Date }) {
    const startTime = timeRange.start.getTime();
    const endTime = timeRange.end.getTime();
    
    const relevantMetrics = this.metrics.filter(m => 
      m.timestamp >= startTime && 
      m.timestamp <= endTime
    );
    
    const totalRequests = relevantMetrics.length;
    const successfulRequests = relevantMetrics.filter(m => m.success).length;
    const totalLatency = relevantMetrics.reduce((sum, m) => sum + m.duration, 0);
    
    const requestsByProvider: { [providerId: string]: number } = {};
    const costsByProvider: { [providerId: string]: number } = {};
    
    relevantMetrics.forEach(m => {
      requestsByProvider[m.providerId] = (requestsByProvider[m.providerId] || 0) + 1;
      costsByProvider[m.providerId] = (costsByProvider[m.providerId] || 0) + (m.cost || 0);
    });
    
    return {
      totalRequests,
      requestsByProvider,
      costsByProvider,
      averageLatency: totalRequests > 0 ? totalLatency / totalRequests : 0,
      overallSuccessRate: totalRequests > 0 ? successfulRequests / totalRequests : 0
    };
  }
  
  async getDailyCosts() {
    const dailyCosts: { [date: string]: { [providerId: string]: number } } = {};
    
    this.metrics.forEach(m => {
      if (m.cost) {
        const date = new Date(m.timestamp).toISOString().split('T')[0];
        if (!dailyCosts[date]) dailyCosts[date] = {};
        dailyCosts[date][m.providerId] = (dailyCosts[date][m.providerId] || 0) + m.cost;
      }
    });
    
    return dailyCosts;
  }
  
  async getMonthlyCosts() {
    const monthlyCosts: { [month: string]: { [providerId: string]: number } } = {};
    
    this.metrics.forEach(m => {
      if (m.cost) {
        const date = new Date(m.timestamp);
        const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyCosts[month]) monthlyCosts[month] = {};
        monthlyCosts[month][m.providerId] = (monthlyCosts[month][m.providerId] || 0) + m.cost;
      }
    });
    
    return monthlyCosts;
  }
  
  async getProjectedCosts(days: number) {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const recentMetrics = this.metrics.filter(m => 
      m.timestamp > now - (7 * dayMs) && m.cost // Last 7 days
    );
    
    const costsByProvider: { [providerId: string]: number } = {};
    
    recentMetrics.forEach(m => {
      if (m.cost) {
        costsByProvider[m.providerId] = (costsByProvider[m.providerId] || 0) + m.cost;
      }
    });
    
    // Project based on last 7 days average
    const projectedCosts: { [providerId: string]: number } = {};
    Object.entries(costsByProvider).forEach(([providerId, cost]) => {
      const dailyAverage = cost / 7;
      projectedCosts[providerId] = dailyAverage * days;
    });
    
    return projectedCosts;
  }
}

/**
 * Main AI Manager implementation
 */
export class SmartAIManager implements AIManager {
  private router: SmartAIRouter;
  private cache: SimpleAICache;
  private analytics: SimpleAIAnalytics;
  private emergencyMode = false;
  private config: {
    cacheEnabled: boolean;
    cacheTTL: {
      embedding: number;
      completion: number;
    };
    routingStrategy: string;
    budgetLimits: {
      daily: number;
      monthly: number;
    };
  };
  
  constructor(config?: any) {
    this.router = new SmartAIRouter(config?.routing);
    this.cache = new SimpleAICache();
    this.analytics = new SimpleAIAnalytics();
    
    this.config = {
      cacheEnabled: process.env.AI_CACHE_ENABLED === 'true',
      cacheTTL: {
        embedding: parseInt(process.env.AI_CACHE_TTL_EMBEDDING || '604800'), // 7 days
        completion: parseInt(process.env.AI_CACHE_TTL_COMPLETION || '3600')   // 1 hour
      },
      routingStrategy: process.env.AI_ROUTING_STRATEGY || 'cost-optimized',
      budgetLimits: {
        daily: parseFloat(process.env.AI_DAILY_BUDGET_LIMIT || '50'),
        monthly: parseFloat(process.env.AI_MONTHLY_BUDGET_LIMIT || '1000')
      }
    };
  }
  
  // System Management
  async initialize(config: { [providerId: string]: any } = {}): Promise<void> {
    // Create and add all configured providers
    const providers = createConfiguredProviders();
    
    for (const provider of providers) {
      this.router.addProvider(provider);
    }
    
    // Set routing strategy
    this.router.setRoutingStrategy(this.config.routingStrategy);
    
    console.log(`AI Manager initialized with ${providers.length} providers:`, 
      providers.map(p => p.providerId).join(', '));
  }
  
  async shutdown(): Promise<void> {
    await this.cache.clear();
    console.log('AI Manager shut down');
  }
  
  // Core AI Operations
  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
    const cacheKey = this.getCacheKey('embedding', text, options);
    
    // Try cache first
    if (this.config.cacheEnabled) {
      const cached = await this.cache.get<EmbeddingResult>(cacheKey);
      if (cached) {
        return { ...cached, provider: `${cached.provider}(cached)` };
      }
    }
    
    const startTime = Date.now();
    const request: AIRequest = {
      type: 'embedding',
      input: text,
      options,
      cacheEnabled: this.config.cacheEnabled,
      cacheKey,
      cacheTTL: this.config.cacheTTL.embedding
    };
    
    try {
      const response = await this.router.executeRequest(request);
      
      if (response.success && response.data) {
        const result = response.data as EmbeddingResult;
        
        // Cache the result
        if (this.config.cacheEnabled) {
          await this.cache.set(cacheKey, result, this.config.cacheTTL.embedding);
        }
        
        // Track analytics
        await this.analytics.trackRequest(
          response.metadata.provider,
          'embedding',
          response.metadata.latency,
          true,
          response.metadata.cost
        );
        
        return result;
      } else {
        throw new Error(response.error?.message || 'Embedding generation failed');
      }
    } catch (error) {
      await this.analytics.trackError('unknown', error as Error, 'embedding');
      throw error;
    }
  }
  
  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    const cacheKey = this.getCacheKey('completion', prompt, options);
    
    // Try cache first
    if (this.config.cacheEnabled) {
      const cached = await this.cache.get<CompletionResult>(cacheKey);
      if (cached) {
        return { ...cached, provider: `${cached.provider}(cached)` };
      }
    }
    
    const request: AIRequest = {
      type: 'completion',
      input: prompt,
      options,
      cacheEnabled: this.config.cacheEnabled,
      cacheKey,
      cacheTTL: this.config.cacheTTL.completion
    };
    
    try {
      const response = await this.router.executeRequest(request);
      
      if (response.success && response.data) {
        const result = response.data as CompletionResult;
        
        // Cache the result
        if (this.config.cacheEnabled) {
          await this.cache.set(cacheKey, result, this.config.cacheTTL.completion);
        }
        
        // Track analytics
        await this.analytics.trackRequest(
          response.metadata.provider,
          'completion',
          response.metadata.latency,
          true,
          response.metadata.cost
        );
        
        return result;
      } else {
        throw new Error(response.error?.message || 'Completion generation failed');
      }
    } catch (error) {
      await this.analytics.trackError('unknown', error as Error, 'completion');
      throw error;
    }
  }
  
  calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) {
      throw new Error('Embeddings must have the same dimensions');
    }
    
    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;
    
    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      magnitudeA += embedding1[i] * embedding1[i];
      magnitudeB += embedding2[i] * embedding2[i];
    }
    
    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);
    
    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }
    
    return dotProduct / (magnitudeA * magnitudeB);
  }
  
  findSimilarEmbeddings(
    queryEmbedding: number[], 
    candidates: Array<{id: string, embedding: number[]}>, 
    topK: number = 10
  ): Array<{id: string, similarity: number}> {
    const similarities = candidates.map(candidate => ({
      id: candidate.id,
      similarity: this.calculateSimilarity(queryEmbedding, candidate.embedding)
    }));
    
    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
  
  // Co-founder Matching Operations (simplified implementations)
  async analyzeCompatibility(profile1: UserProfile, profile2: UserProfile): Promise<CompatibilityScore> {
    const analysisPrompt = `Analyze the compatibility between these two co-founder profiles:

Profile 1: ${JSON.stringify(profile1, null, 2)}

Profile 2: ${JSON.stringify(profile2, null, 2)}

Provide a structured analysis with scores (0-100) for:
1. Role compatibility
2. Skill complementarity 
3. Value alignment
4. Work style match
5. Goal alignment

Also provide reasoning and recommended actions.`;

    const completion = await this.generateCompletion(analysisPrompt, {
      temperature: 0.3,
      maxTokens: 800
    });

    // Parse the response (simplified - in production would use structured parsing)
    return {
      overallScore: 75, // Would extract from AI response
      dimensions: {
        roleCompatibility: 80,
        skillComplementarity: 85,
        valueAlignment: 70,
        workStyleMatch: 75,
        goalAlignment: 65
      },
      reasoning: completion.text.substring(0, 500),
      recommendedActions: ['Schedule a video call', 'Discuss equity expectations', 'Clarify time commitments']
    };
  }
  
  async enhanceUserProfile(profile: UserProfile): Promise<EnhancedProfile> {
    const profileText = this.buildProfileText(profile);
    const embedding = await this.generateEmbedding(profileText);
    
    const analysisPrompt = `Analyze this co-founder profile and provide insights:

${profileText}

Provide:
1. Key personality traits
2. Work style analysis
3. Strengths and potential gaps
4. Ideal partner profile description`;

    const analysis = await this.generateCompletion(analysisPrompt, {
      temperature: 0.4,
      maxTokens: 600
    });

    // Simplified parsing - in production would use structured extraction
    return {
      ...profile,
      aiInsights: {
        personalityTraits: ['analytical', 'collaborative', 'driven'],
        workStyleAnalysis: analysis.text.substring(0, 200),
        strengthsWeaknesses: {
          strengths: ['technical expertise', 'leadership'],
          gaps: ['marketing experience']
        },
        idealPartnerProfile: analysis.text.substring(200, 400)
      },
      embeddingVector: embedding.embedding
    };
  }
  
  async generateRecommendations(userId: string, preferences: MatchPreferences): Promise<Recommendation[]> {
    // Simplified implementation - would integrate with database
    return [{
      candidateId: 'user-123',
      compatibilityScore: {
        overallScore: 85,
        dimensions: {
          roleCompatibility: 90,
          skillComplementarity: 85,
          valueAlignment: 80,
          workStyleMatch: 85,
          goalAlignment: 85
        },
        reasoning: 'Strong technical-business complementarity',
        recommendedActions: ['Schedule intro call']
      },
      matchReason: 'Excellent role complementarity and shared vision',
      confidence: 0.85,
      recommendationRank: 1
    }];
  }
  
  async generateMatchReason(match: MatchResult): Promise<string> {
    const prompt = `Generate a brief, engaging explanation for why these two co-founders are a good match:

Compatibility Score: ${match.compatibilityScore.overallScore}
Key Strengths: ${Object.entries(match.compatibilityScore.dimensions).map(([k, v]) => `${k}: ${v}`).join(', ')}

Provide a 1-2 sentence explanation suitable for the user interface.`;

    const completion = await this.generateCompletion(prompt, {
      temperature: 0.6,
      maxTokens: 150
    });

    return completion.text.trim();
  }
  
  async checkHealth(): Promise<ProviderHealth> {
    const systemHealth = await this.router.getSystemHealth();
    
    return {
      providerId: 'ai-manager',
      status: systemHealth.overall,
      lastCheck: new Date(),
      errorRate: 0,
      uptime: 1.0
    };
  }
  
  getCapabilities() {
    return {
      supportsEmbedding: true,
      supportsCompletion: true,
      maxInputLength: 32000,
      embeddingDimensions: 1536
    };
  }
  
  // System Management Methods
  getRouter(): AIRouter { return this.router; }
  getCache(): AICache { return this.cache; }
  getAnalytics(): AIAnalytics { return this.analytics; }
  
  async updateProviderConfig(providerId: string, config: any): Promise<void> {
    // Implementation would update provider configuration
    console.log(`Updating config for provider ${providerId}:`, config);
  }
  
  getProviderConfig(providerId: string): any {
    return PROVIDER_CONFIGS[providerId as keyof typeof PROVIDER_CONFIGS] || null;
  }
  
  listProviders(): Array<{
    id: string;
    name: string;
    status: 'healthy' | 'degraded' | 'down';
    enabled: boolean;
  }> {
    const providers = this.router.getAvailableProviders();
    return providers.map(provider => ({
      id: provider.providerId,
      name: provider.providerName,
      status: provider.isConfigured() ? 'healthy' : 'down' as const,
      enabled: provider.isConfigured()
    }));
  }
  
  async getSystemHealth() {
    return await this.router.getSystemHealth();
  }
  
  enableEmergencyMode(): void {
    this.emergencyMode = true;
    console.log('AI Manager: Emergency mode enabled');
  }
  
  disableEmergencyMode(): void {
    this.emergencyMode = false;
    console.log('AI Manager: Emergency mode disabled');
  }
  
  isEmergencyMode(): boolean {
    return this.emergencyMode;
  }
  
  // Private helper methods
  private getCacheKey(operation: string, input: string, options?: any): string {
    const optionsStr = options ? JSON.stringify(options) : '';
    const hashInput = input + optionsStr;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    return `${operation}:${Math.abs(hash)}`;
  }
  
  private buildProfileText(profile: UserProfile): string {
    const parts = [
      `Role: ${profile.entrepreneurialInfo.role}`,
      `Stage: ${profile.entrepreneurialInfo.stage}`,
      `Industries: ${profile.entrepreneurialInfo.industry.join(', ')}`,
      `Skills: ${profile.basicInfo.skills.join(', ')}`,
      `Background: ${profile.basicInfo.background}`,
      `Time commitment: ${profile.entrepreneurialInfo.timeCommitment}`,
      `Location: ${profile.entrepreneurialInfo.location}`,
      `Remote: ${profile.entrepreneurialInfo.remoteWillingness ? 'Yes' : 'No'}`
    ];
    
    return parts.join('. ');
  }
}

// Global instance
let globalAIManager: SmartAIManager | null = null;

export function getAIManager(): SmartAIManager {
  if (!globalAIManager) {
    globalAIManager = new SmartAIManager();
  }
  return globalAIManager;
}

export async function initializeAIManager(config?: any): Promise<SmartAIManager> {
  const manager = getAIManager();
  await manager.initialize(config);
  return manager;
}