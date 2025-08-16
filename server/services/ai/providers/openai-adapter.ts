// OpenAI Provider Adapter
import { OpenAI } from 'openai';
import { BaseProviderAdapter } from '../base-provider-adapter';
import type {
  EmbeddingOptions,
  CompletionOptions,
  EmbeddingResult,
  CompletionResult,
  ProviderConfig
} from '../types';
import { ProviderError } from '../types';

export class OpenAIAdapter extends BaseProviderAdapter {
  private client: OpenAI;
  
  constructor(config: ProviderConfig) {
    super(config);
    
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || 'https://api.openai.com/v1'
    });
  }
  
  get providerId(): string {
    return 'openai';
  }
  
  get providerName(): string {
    return 'OpenAI';
  }
  
  get displayName(): string {
    return 'OpenAI (GPT & Embeddings)';
  }
  
  protected async doGenerateEmbedding(
    text: string, 
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult> {
    try {
      const model = options?.model || 'text-embedding-3-small';
      const dimensions = options?.dimensions;
      const encodingFormat = options?.encodingFormat || 'float';
      const user = options?.user;
      
      const response = await this.client.embeddings.create({
        model,
        input: text,
        encoding_format: encodingFormat,
        dimensions,
        user
      });
      
      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from OpenAI');
      }
      
      return {
        embedding: response.data[0].embedding,
        tokens: response.usage?.total_tokens || 0,
        model: model,
        provider: this.providerId
      };
    } catch (error: any) {
      throw new ProviderError(
        `OpenAI embedding generation failed: ${error.message}`,
        this.providerId,
        this.mapErrorCode(error),
        this.isRetryableError(error),
        error
      );
    }
  }
  
  protected async doGenerateCompletion(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    try {
      const model = options?.model || 'gpt-4o-mini';
      const temperature = options?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens ?? 1000;
      const topP = options?.topP;
      const frequencyPenalty = options?.frequencyPenalty;
      const presencePenalty = options?.presencePenalty;
      const stop = options?.stop;
      const user = options?.user;
      
      const response = await this.client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stop,
        user
      });
      
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No completion choices returned from OpenAI');
      }
      
      const choice = response.choices[0];
      const content = choice.message?.content || '';
      
      return {
        text: content,
        tokens: {
          prompt: response.usage?.prompt_tokens || 0,
          completion: response.usage?.completion_tokens || 0,
          total: response.usage?.total_tokens || 0
        },
        model: model,
        provider: this.providerId,
        finishReason: this.mapFinishReason(choice.finish_reason)
      };
    } catch (error: any) {
      throw new ProviderError(
        `OpenAI completion generation failed: ${error.message}`,
        this.providerId,
        this.mapErrorCode(error),
        this.isRetryableError(error),
        error
      );
    }
  }
  
  protected async doHealthCheck(): Promise<boolean> {
    try {
      // Use a minimal embedding request for health check
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'health check'
      });
      
      return !!(response.data && response.data.length > 0);
    } catch (error: any) {
      console.warn(`OpenAI health check failed: ${error.message}`);
      return false;
    }
  }
  
  protected getSupportedEmbeddingModels(): string[] {
    return [
      'text-embedding-3-small',
      'text-embedding-3-large',
      'text-embedding-ada-002'
    ];
  }
  
  protected getSupportedCompletionModels(): string[] {
    return [
      'gpt-4o',
      'gpt-4o-mini',
      'gpt-4-turbo',
      'gpt-4',
      'gpt-3.5-turbo'
    ];
  }
  
  async getRemainingQuota() {
    // OpenAI doesn't provide quota information via API
    // Return the rate limiter stats instead
    const stats = this.rateLimiter.getStats();
    return {
      requests: stats.remainingDayQuota,
      tokens: -1, // Not available from OpenAI API
      resetTime: stats.remainingDayQuota === 0 ? 
        new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined
    };
  }
  
  estimateCost(operation: 'embedding' | 'completion', tokens: number): number {
    // OpenAI pricing as of 2024 (in USD per 1K tokens)
    const pricing = {
      embedding: {
        'text-embedding-3-small': 0.00002,
        'text-embedding-3-large': 0.00013,
        'text-embedding-ada-002': 0.0001
      },
      completion: {
        'gpt-4o': { prompt: 0.005, completion: 0.015 },
        'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
        'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
        'gpt-4': { prompt: 0.03, completion: 0.06 },
        'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 }
      }
    };
    
    if (operation === 'embedding') {
      // Use the default embedding model pricing
      const costPer1K = pricing.embedding['text-embedding-3-small'];
      return (tokens / 1000) * costPer1K;
    } else {
      // Use the default completion model pricing (average of prompt and completion)
      const modelPricing = pricing.completion['gpt-4o-mini'];
      const averageCost = (modelPricing.prompt + modelPricing.completion) / 2;
      return (tokens / 1000) * averageCost;
    }
  }
  
  private mapErrorCode(error: any): string {
    if (error.code) return error.code;
    if (error.status === 429) return 'RATE_LIMIT_EXCEEDED';
    if (error.status === 401) return 'INVALID_API_KEY';
    if (error.status === 403) return 'FORBIDDEN';
    if (error.status === 404) return 'MODEL_NOT_FOUND';
    if (error.status >= 500) return 'SERVER_ERROR';
    return 'UNKNOWN_ERROR';
  }
  
  private mapFinishReason(reason: string | null): CompletionResult['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'content_filter': return 'content_filter';
      case 'function_call': return 'function_call';
      default: return undefined;
    }
  }
  
  protected isRetryableError(error: any): boolean {
    // OpenAI specific retryable errors
    const retryableStatuses = [429, 500, 502, 503, 504];
    const retryableErrors = [
      'rate_limit_exceeded',
      'server_error',
      'timeout',
      'connection_error',
      'service_unavailable'
    ];
    
    if (retryableStatuses.includes(error.status)) {
      return true;
    }
    
    const errorCode = (error.code || '').toLowerCase();
    const errorMessage = (error.message || '').toLowerCase();
    
    return retryableErrors.some(pattern => 
      errorCode.includes(pattern) || errorMessage.includes(pattern)
    );
  }
}

// Factory function to create OpenAI adapter with default configuration
export function createOpenAIAdapter(apiKey?: string): OpenAIAdapter {
  const config: ProviderConfig = {
    id: 'openai',
    name: 'OpenAI',
    displayName: 'OpenAI (GPT & Embeddings)',
    apiKey: apiKey || process.env.OPENAI_API_KEY || '',
    baseUrl: 'https://api.openai.com/v1',
    isEnabled: !!(apiKey || process.env.OPENAI_API_KEY),
    priority: 1,
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerDay: 10000
    },
    pricing: {
      embeddingCostPer1K: 0.00002, // text-embedding-3-small
      completionCostPer1K: 0.0006,  // gpt-4o-mini average
      currency: 'USD'
    },
    capabilities: {
      supportsEmbedding: true,
      supportsCompletion: true,
      maxInputLength: 8000,
      embeddingDimensions: 1536
    }
  };
  
  return new OpenAIAdapter(config);
}