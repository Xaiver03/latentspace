// AI Router - Intelligent routing and load balancing for AI providers
import type {
  AIRouter,
  AIProviderAdapter
} from './ai-service';
import type { 
  AIRequest,
  AIResponse,
  RoutingConfig,
  ProviderHealth,
  AIServiceError,
  ProviderError
} from './types';

/**
 * Circuit breaker for provider failure management
 */
class CircuitBreaker {
  private failures = 0;
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private nextAttempt = 0;
  
  constructor(
    private providerId: string,
    private failureThreshold: number = 5,
    private resetTimeout: number = 60000 // 1 minute
  ) {}
  
  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker OPEN for ${this.providerId}`);
      }
      this.state = 'HALF_OPEN';
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  private onSuccess(): void {
    this.failures = 0;
    this.state = 'CLOSED';
  }
  
  private onFailure(): void {
    this.failures++;
    if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }
  
  get currentState(): string {
    return this.state;
  }
  
  get failureCount(): number {
    return this.failures;
  }
}

/**
 * Load balancer for distributing requests across providers
 */
class LoadBalancer {
  private roundRobinIndex = 0;
  
  /**
   * Round robin selection
   */
  roundRobin(providers: AIProviderAdapter[]): AIProviderAdapter {
    if (providers.length === 0) {
      throw new Error('No providers available for round robin selection');
    }
    
    const provider = providers[this.roundRobinIndex % providers.length];
    this.roundRobinIndex = (this.roundRobinIndex + 1) % providers.length;
    return provider;
  }
  
  /**
   * Weighted selection based on provider priorities and health
   */
  weighted(
    providers: AIProviderAdapter[], 
    weights: { [providerId: string]: number },
    healthScores: { [providerId: string]: number }
  ): AIProviderAdapter {
    if (providers.length === 0) {
      throw new Error('No providers available for weighted selection');
    }
    
    // Calculate effective weights (base weight * health score)
    const effectiveWeights = providers.map(provider => {
      const baseWeight = weights[provider.providerId] || 1;
      const healthScore = healthScores[provider.providerId] || 0.5;
      return {
        provider,
        weight: baseWeight * healthScore
      };
    });
    
    // Calculate total weight
    const totalWeight = effectiveWeights.reduce((sum, item) => sum + item.weight, 0);
    
    if (totalWeight === 0) {
      // Fallback to round robin if all weights are 0
      return this.roundRobin(providers);
    }
    
    // Random selection based on weight
    let random = Math.random() * totalWeight;
    
    for (const item of effectiveWeights) {
      random -= item.weight;
      if (random <= 0) {
        return item.provider;
      }
    }
    
    // Fallback to first provider
    return providers[0];
  }
  
  /**
   * Select provider optimized for cost
   */
  costOptimized(providers: AIProviderAdapter[], operation: 'embedding' | 'completion'): AIProviderAdapter {
    if (providers.length === 0) {
      throw new Error('No providers available for cost optimization');
    }
    
    // Sort providers by estimated cost (ascending)
    const sortedProviders = [...providers].sort((a, b) => {
      const costA = a.estimateCost(operation, 1000); // Estimate for 1000 tokens
      const costB = b.estimateCost(operation, 1000);
      return costA - costB;
    });
    
    return sortedProviders[0];
  }
  
  /**
   * Select provider optimized for quality
   */
  qualityOptimized(providers: AIProviderAdapter[]): AIProviderAdapter {
    if (providers.length === 0) {
      throw new Error('No providers available for quality optimization');
    }
    
    // Quality ranking (could be configurable)
    const qualityOrder = ['claude', 'openai', 'deepseek', 'qwen', 'kimi', 'siliconflow'];
    
    for (const providerId of qualityOrder) {
      const provider = providers.find(p => p.providerId === providerId);
      if (provider) {
        return provider;
      }
    }
    
    // Fallback to first available provider
    return providers[0];
  }
  
  /**
   * Select provider optimized for performance
   */
  performanceOptimized(
    providers: AIProviderAdapter[],
    healthScores: { [providerId: string]: number }
  ): AIProviderAdapter {
    if (providers.length === 0) {
      throw new Error('No providers available for performance optimization');
    }
    
    // Sort by health score (descending) - health score includes latency consideration
    const sortedProviders = [...providers].sort((a, b) => {
      const scoreA = healthScores[a.providerId] || 0;
      const scoreB = healthScores[b.providerId] || 0;
      return scoreB - scoreA;
    });
    
    return sortedProviders[0];
  }
}

/**
 * Main AI Router implementation
 */
export class SmartAIRouter implements AIRouter {
  private providers = new Map<string, AIProviderAdapter>();
  private circuitBreakers = new Map<string, CircuitBreaker>();
  private loadBalancer = new LoadBalancer();
  private healthScores = new Map<string, number>();
  private lastHealthCheck = new Map<string, number>();
  
  private config: RoutingConfig = {
    defaultStrategy: 'cost-optimized',
    strategies: {
      'cost-optimized': {
        providerWeights: {},
        fallbackChain: [],
        healthCheckEnabled: true,
        cacheEnabled: true
      },
      'performance-optimized': {
        providerWeights: {},
        fallbackChain: [],
        healthCheckEnabled: true,
        cacheEnabled: true
      },
      'quality-optimized': {
        providerWeights: {},
        fallbackChain: [],
        healthCheckEnabled: true,
        cacheEnabled: true
      },
      'round-robin': {
        providerWeights: {},
        fallbackChain: [],
        healthCheckEnabled: true,
        cacheEnabled: true
      }
    },
    circuitBreaker: {
      failureThreshold: 5,
      resetTimeout: 60000
    }
  };
  
  constructor(config?: Partial<RoutingConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
  }
  
  // Provider Management
  addProvider(adapter: AIProviderAdapter): void {
    this.providers.set(adapter.providerId, adapter);
    this.circuitBreakers.set(
      adapter.providerId, 
      new CircuitBreaker(
        adapter.providerId,
        this.config.circuitBreaker.failureThreshold,
        this.config.circuitBreaker.resetTimeout
      )
    );
    this.healthScores.set(adapter.providerId, 1.0); // Start with full health
  }
  
  removeProvider(providerId: string): void {
    this.providers.delete(providerId);
    this.circuitBreakers.delete(providerId);
    this.healthScores.delete(providerId);
    this.lastHealthCheck.delete(providerId);
  }
  
  getProvider(providerId: string): AIProviderAdapter | null {
    return this.providers.get(providerId) || null;
  }
  
  getAvailableProviders(): AIProviderAdapter[] {
    return Array.from(this.providers.values()).filter(provider => provider.isConfigured());
  }
  
  async getHealthyProviders(): Promise<AIProviderAdapter[]> {
    const providers = this.getAvailableProviders();
    const healthyProviders: AIProviderAdapter[] = [];
    
    for (const provider of providers) {
      const circuitBreaker = this.circuitBreakers.get(provider.providerId);
      if (circuitBreaker?.currentState !== 'OPEN') {
        // Check if we need to update health status
        await this.updateHealthScore(provider);
        healthyProviders.push(provider);
      }
    }
    
    return healthyProviders;
  }
  
  // Routing Operations
  async route(request: AIRequest): Promise<AIProviderAdapter> {
    const strategy = request.routingStrategy || this.config.defaultStrategy;
    
    if (request.preferredProvider) {
      const provider = this.getProvider(request.preferredProvider);
      if (provider && provider.isConfigured()) {
        const circuitBreaker = this.circuitBreakers.get(request.preferredProvider);
        if (circuitBreaker?.currentState !== 'OPEN') {
          return provider;
        }
      }
    }
    
    const healthyProviders = await this.getHealthyProviders();
    
    if (healthyProviders.length === 0) {
      throw new Error('No healthy providers available');
    }
    
    return this.selectProvider(healthyProviders, strategy, request);
  }
  
  async executeRequest(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    // Try primary provider
    try {
      const provider = await this.route(request);
      const result = await this.executeWithProvider(provider, request);
      
      return {
        success: true,
        data: result,
        metadata: {
          provider: provider.providerId,
          model: result.model,
          latency: Date.now() - startTime,
          cost: this.calculateCost(provider, request, result),
          cached: false,
          timestamp: new Date()
        }
      };
    } catch (error) {
      lastError = error as Error;
    }
    
    // Try fallback providers
    const fallbackProviders = request.fallbackProviders || this.getFallbackChain(request);
    
    for (const providerId of fallbackProviders) {
      try {
        const provider = this.getProvider(providerId);
        if (provider && provider.isConfigured()) {
          const circuitBreaker = this.circuitBreakers.get(providerId);
          if (circuitBreaker?.currentState !== 'OPEN') {
            const result = await this.executeWithProvider(provider, request);
            
            return {
              success: true,
              data: result,
              metadata: {
                provider: provider.providerId,
                model: result.model,
                latency: Date.now() - startTime,
                cost: this.calculateCost(provider, request, result),
                cached: false,
                timestamp: new Date()
              }
            };
          }
        }
      } catch (error) {
        lastError = error as Error;
        continue;
      }
    }
    
    // All providers failed
    return {
      success: false,
      error: {
        code: 'ALL_PROVIDERS_FAILED',
        message: `All providers failed. Last error: ${lastError?.message}`,
        retryable: true
      },
      metadata: {
        provider: 'none',
        model: 'none',
        latency: Date.now() - startTime,
        cached: false,
        timestamp: new Date()
      }
    };
  }
  
  // Strategy Management
  setRoutingStrategy(strategy: string): void {
    if (this.config.strategies[strategy]) {
      this.config.defaultStrategy = strategy as any;
    } else {
      throw new Error(`Unknown routing strategy: ${strategy}`);
    }
  }
  
  getRoutingStrategy(): string {
    return this.config.defaultStrategy;
  }
  
  // Private Methods
  private selectProvider(
    providers: AIProviderAdapter[], 
    strategy: string, 
    request: AIRequest
  ): AIProviderAdapter {
    const healthScores = Object.fromEntries(this.healthScores.entries());
    
    switch (strategy) {
      case 'cost-optimized':
        return this.loadBalancer.costOptimized(providers, request.type);
      
      case 'quality-optimized':
        return this.loadBalancer.qualityOptimized(providers);
      
      case 'performance-optimized':
        return this.loadBalancer.performanceOptimized(providers, healthScores);
      
      case 'round-robin':
        return this.loadBalancer.roundRobin(providers);
      
      default:
        return this.loadBalancer.costOptimized(providers, request.type);
    }
  }
  
  private async executeWithProvider(
    provider: AIProviderAdapter, 
    request: AIRequest
  ): Promise<any> {
    const circuitBreaker = this.circuitBreakers.get(provider.providerId)!;
    
    return circuitBreaker.execute(async () => {
      if (request.type === 'embedding') {
        return await provider.generateEmbedding(request.input, request.options);
      } else if (request.type === 'completion') {
        return await provider.generateCompletion(request.input, request.options);
      } else {
        throw new Error(`Unsupported request type: ${request.type}`);
      }
    });
  }
  
  private async updateHealthScore(provider: AIProviderAdapter): Promise<void> {
    const now = Date.now();
    const lastCheck = this.lastHealthCheck.get(provider.providerId) || 0;
    
    // Only check health every 30 seconds
    if (now - lastCheck < 30000) {
      return;
    }
    
    try {
      const startTime = Date.now();
      const isHealthy = await provider.checkHealth();
      const latency = Date.now() - startTime;
      
      // Calculate health score based on availability and latency
      let healthScore = isHealthy ? 1.0 : 0.0;
      
      if (isHealthy) {
        // Penalize high latency (>5s = 0.5 score, >10s = 0.1 score)
        if (latency > 10000) {
          healthScore = 0.1;
        } else if (latency > 5000) {
          healthScore = 0.5;
        } else if (latency > 2000) {
          healthScore = 0.8;
        }
      }
      
      this.healthScores.set(provider.providerId, healthScore);
      this.lastHealthCheck.set(provider.providerId, now);
    } catch (error) {
      this.healthScores.set(provider.providerId, 0.0);
      this.lastHealthCheck.set(provider.providerId, now);
    }
  }
  
  private getFallbackChain(request: AIRequest): string[] {
    const strategy = request.routingStrategy || this.config.defaultStrategy;
    const strategyConfig = this.config.strategies[strategy];
    
    if (strategyConfig?.fallbackChain?.length > 0) {
      return strategyConfig.fallbackChain;
    }
    
    // Default fallback chain based on cost and reliability
    return ['openai', 'deepseek', 'claude', 'qwen', 'kimi', 'siliconflow'];
  }
  
  private calculateCost(
    provider: AIProviderAdapter,
    request: AIRequest,
    result: any
  ): number {
    if (!result.tokens) return 0;
    
    const tokens = typeof result.tokens === 'number' ? result.tokens : result.tokens.total;
    return provider.estimateCost(request.type, tokens);
  }
  
  // Health monitoring
  async getSystemHealth(): Promise<{
    overall: 'healthy' | 'degraded' | 'down';
    providers: Array<{
      id: string;
      status: 'healthy' | 'degraded' | 'down';
      latency?: number;
      errorRate: number;
    }>;
  }> {
    const providers = this.getAvailableProviders();
    const providerHealth: Array<{
      id: string;
      status: 'healthy' | 'degraded' | 'down';
      latency?: number;
      errorRate: number;
    }> = [];
    
    for (const provider of providers) {
      await this.updateHealthScore(provider);
      const healthScore = this.healthScores.get(provider.providerId) || 0;
      const circuitBreaker = this.circuitBreakers.get(provider.providerId);
      
      let status: 'healthy' | 'degraded' | 'down';
      if (circuitBreaker?.currentState === 'OPEN') {
        status = 'down';
      } else if (healthScore < 0.7) {
        status = 'degraded';
      } else {
        status = 'healthy';
      }
      
      providerHealth.push({
        id: provider.providerId,
        status,
        errorRate: circuitBreaker?.failureCount || 0
      });
    }
    
    // Determine overall health
    const healthyCount = providerHealth.filter(p => p.status === 'healthy').length;
    const totalCount = providerHealth.length;
    
    let overall: 'healthy' | 'degraded' | 'down';
    if (healthyCount === 0) {
      overall = 'down';
    } else if (healthyCount < totalCount * 0.5) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }
    
    return {
      overall,
      providers: providerHealth
    };
  }
}