// Base Provider Adapter - Abstract base class for all AI provider implementations
import type {
  EmbeddingOptions,
  CompletionOptions,
  EmbeddingResult,
  CompletionResult,
  ProviderConfig
} from './types';
import { 
  AIServiceError,
  ProviderError,
  RateLimitError
} from './types';
import type { AIProviderAdapter } from './ai-service';

/**
 * Rate Limiter for API requests
 */
class RateLimiter {
  private requests: Array<{ timestamp: number; type: string }> = [];
  
  constructor(
    private requestsPerMinute: number,
    private requestsPerDay: number
  ) {}
  
  async checkAndWait(operation: string = 'default'): Promise<void> {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    // Clean old requests
    this.requests = this.requests.filter(req => req.timestamp > oneDayAgo);
    
    // Check daily limit
    const dailyCount = this.requests.length;
    if (dailyCount >= this.requestsPerDay) {
      throw new RateLimitError(
        this.constructor.name,
        new Date(this.requests[0].timestamp + 24 * 60 * 60 * 1000)
      );
    }
    
    // Check minute limit
    const minuteCount = this.requests.filter(req => req.timestamp > oneMinuteAgo).length;
    if (minuteCount >= this.requestsPerMinute) {
      const oldestInMinute = this.requests
        .filter(req => req.timestamp > oneMinuteAgo)
        .sort((a, b) => a.timestamp - b.timestamp)[0];
      
      const waitTime = (oldestInMinute.timestamp + 60 * 1000) - now;
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
    
    // Record this request
    this.requests.push({ timestamp: now, type: operation });
  }
  
  getStats(): {
    requestsInLastMinute: number;
    requestsInLastDay: number;
    remainingMinuteQuota: number;
    remainingDayQuota: number;
  } {
    const now = Date.now();
    const oneMinuteAgo = now - 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    
    const requestsInLastMinute = this.requests.filter(req => req.timestamp > oneMinuteAgo).length;
    const requestsInLastDay = this.requests.filter(req => req.timestamp > oneDayAgo).length;
    
    return {
      requestsInLastMinute,
      requestsInLastDay,
      remainingMinuteQuota: Math.max(0, this.requestsPerMinute - requestsInLastMinute),
      remainingDayQuota: Math.max(0, this.requestsPerDay - requestsInLastDay)
    };
  }
}

/**
 * Request Retry Handler with exponential backoff
 */
class RetryHandler {
  async execute<T>(
    operation: () => Promise<T>,
    options: {
      maxRetries: number;
      baseDelay: number;
      maxDelay: number;
      retryableErrors: string[];
    }
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on last attempt or non-retryable errors
        if (attempt === options.maxRetries || !this.isRetryableError(error, options.retryableErrors)) {
          break;
        }
        
        // Calculate exponential backoff delay
        const delay = Math.min(
          options.baseDelay * Math.pow(2, attempt),
          options.maxDelay
        );
        
        // Add jitter to prevent thundering herd
        const jitteredDelay = delay * (0.5 + Math.random() * 0.5);
        
        await new Promise(resolve => setTimeout(resolve, jitteredDelay));
      }
    }
    
    throw lastError!;
  }
  
  private isRetryableError(error: any, retryableErrors: string[]): boolean {
    if (!error) return false;
    
    const errorCode = error.code || error.name || error.message;
    return retryableErrors.some(pattern => 
      errorCode.toLowerCase().includes(pattern.toLowerCase())
    );
  }
}

/**
 * Abstract base class for AI provider adapters
 */
export abstract class BaseProviderAdapter implements AIProviderAdapter {
  protected rateLimiter: RateLimiter;
  protected retryHandler: RetryHandler;
  protected config: ProviderConfig;
  protected healthStatus: {
    isHealthy: boolean;
    lastCheck: Date;
    errorCount: number;
    consecutiveErrors: number;
  };
  
  constructor(config: ProviderConfig) {
    this.config = { ...config };
    this.rateLimiter = new RateLimiter(
      config.rateLimit.requestsPerMinute,
      config.rateLimit.requestsPerDay
    );
    this.retryHandler = new RetryHandler();
    this.healthStatus = {
      isHealthy: true,
      lastCheck: new Date(),
      errorCount: 0,
      consecutiveErrors: 0
    };
    
    this.validateConfiguration();
  }
  
  // Abstract methods that must be implemented by concrete providers
  abstract get providerId(): string;
  abstract get providerName(): string;
  abstract get displayName(): string;
  
  protected abstract doGenerateEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult>;
  protected abstract doGenerateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult>;
  protected abstract doHealthCheck(): Promise<boolean>;
  
  // Public interface implementation
  async generateEmbedding(text: string, options?: EmbeddingOptions): Promise<EmbeddingResult> {
    if (!this.config.capabilities.supportsEmbedding) {
      throw new ProviderError(
        `Provider ${this.providerId} does not support embedding generation`,
        this.providerId,
        'CAPABILITY_NOT_SUPPORTED',
        false
      );
    }
    
    await this.rateLimiter.checkAndWait('embedding');
    
    return this.retryHandler.execute(
      () => this.doGenerateEmbedding(text, options),
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['timeout', 'rate_limit', 'server_error', '502', '503', '504']
      }
    ).catch(error => {
      this.recordError(error);
      throw this.wrapError(error, 'embedding generation');
    });
  }
  
  async generateCompletion(prompt: string, options?: CompletionOptions): Promise<CompletionResult> {
    if (!this.config.capabilities.supportsCompletion) {
      throw new ProviderError(
        `Provider ${this.providerId} does not support completion generation`,
        this.providerId,
        'CAPABILITY_NOT_SUPPORTED',
        false
      );
    }
    
    await this.rateLimiter.checkAndWait('completion');
    
    return this.retryHandler.execute(
      () => this.doGenerateCompletion(prompt, options),
      {
        maxRetries: 3,
        baseDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['timeout', 'rate_limit', 'server_error', '502', '503', '504']
      }
    ).catch(error => {
      this.recordError(error);
      throw this.wrapError(error, 'completion generation');
    });
  }
  
  async checkHealth(): Promise<boolean> {
    try {
      const result = await this.doHealthCheck();
      
      if (result) {
        this.healthStatus.isHealthy = true;
        this.healthStatus.consecutiveErrors = 0;
      } else {
        this.recordError(new Error('Health check failed'));
      }
      
      this.healthStatus.lastCheck = new Date();
      return result;
    } catch (error) {
      this.recordError(error as Error);
      return false;
    }
  }
  
  isConfigured(): boolean {
    return !!(
      this.config.apiKey &&
      this.config.baseUrl &&
      this.config.isEnabled
    );
  }
  
  getConfiguration() {
    return {
      apiKey: this.maskApiKey(this.config.apiKey),
      baseUrl: this.config.baseUrl,
      models: {
        embedding: this.getSupportedEmbeddingModels(),
        completion: this.getSupportedCompletionModels()
      }
    };
  }
  
  async getRemainingQuota() {
    const stats = this.rateLimiter.getStats();
    return {
      requests: stats.remainingDayQuota,
      tokens: -1, // Provider-specific implementation needed
      resetTime: stats.remainingDayQuota === 0 ? 
        new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined
    };
  }
  
  estimateCost(operation: 'embedding' | 'completion', tokens: number): number {
    const costPer1K = operation === 'embedding' ? 
      this.config.pricing.embeddingCostPer1K : 
      this.config.pricing.completionCostPer1K;
    
    return (tokens / 1000) * costPer1K;
  }
  
  // Protected utility methods
  protected validateConfiguration(): void {
    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.providerId}`);
    }
    
    if (!this.config.baseUrl) {
      throw new Error(`Base URL is required for ${this.providerId}`);
    }
    
    if (this.config.rateLimit.requestsPerMinute <= 0 || this.config.rateLimit.requestsPerDay <= 0) {
      throw new Error(`Invalid rate limits for ${this.providerId}`);
    }
  }
  
  protected async makeRequest<T>(
    endpoint: string,
    options: {
      method?: string;
      headers?: Record<string, string>;
      body?: any;
      timeout?: number;
    } = {}
  ): Promise<T> {
    const {
      method = 'POST',
      headers = {},
      body,
      timeout = 30000
    } = options;
    
    const url = `${this.config.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }
  
  protected recordError(error: Error): void {
    this.healthStatus.errorCount++;
    this.healthStatus.consecutiveErrors++;
    
    // Mark as unhealthy after 3 consecutive errors
    if (this.healthStatus.consecutiveErrors >= 3) {
      this.healthStatus.isHealthy = false;
    }
  }
  
  protected wrapError(error: any, operation: string): AIServiceError {
    if (error instanceof AIServiceError) {
      return error;
    }
    
    // Check for rate limiting
    if (this.isRateLimitError(error)) {
      return new RateLimitError(this.providerId, undefined, error);
    }
    
    // Generic provider error
    return new ProviderError(
      `${operation} failed: ${error.message}`,
      this.providerId,
      'OPERATION_FAILED',
      this.isRetryableError(error),
      error
    );
  }
  
  protected isRateLimitError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    const code = error.code?.toLowerCase() || '';
    
    return message.includes('rate limit') || 
           message.includes('quota') ||
           code === '429' ||
           code === 'rate_limit_exceeded';
  }
  
  protected isRetryableError(error: any): boolean {
    const retryableCodes = ['429', '500', '502', '503', '504'];
    const retryableMessages = ['timeout', 'network', 'connection'];
    
    const code = error.code?.toString() || error.status?.toString() || '';
    const message = error.message?.toLowerCase() || '';
    
    return retryableCodes.includes(code) ||
           retryableMessages.some(msg => message.includes(msg));
  }
  
  protected maskApiKey(apiKey: string): string {
    if (!apiKey || apiKey.length < 8) return '***';
    return apiKey.slice(0, 4) + '***' + apiKey.slice(-4);
  }
  
  // Methods to be overridden by specific providers
  protected getSupportedEmbeddingModels(): string[] {
    return ['default'];
  }
  
  protected getSupportedCompletionModels(): string[] {
    return ['default'];
  }
  
  // Health status getters
  get isHealthy(): boolean {
    return this.healthStatus.isHealthy;
  }
  
  get lastHealthCheck(): Date {
    return this.healthStatus.lastCheck;
  }
  
  get errorCount(): number {
    return this.healthStatus.errorCount;
  }
}