// DeepSeek Provider Adapter
import { BaseProviderAdapter } from '../base-provider-adapter';
import type {
  EmbeddingOptions,
  CompletionOptions,
  EmbeddingResult,
  CompletionResult,
  ProviderConfig
} from '../types';
import { ProviderError } from '../types';

interface DeepSeekEmbeddingResponse {
  data: Array<{
    embedding: number[];
    index: number;
    object: string;
  }>;
  model: string;
  object: string;
  usage: {
    prompt_tokens: number;
    total_tokens: number;
  };
}

interface DeepSeekCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class DeepSeekAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }
  
  get providerId(): string {
    return 'deepseek';
  }
  
  get providerName(): string {
    return 'DeepSeek';
  }
  
  get displayName(): string {
    return 'DeepSeek (中国AI)';
  }
  
  protected async doGenerateEmbedding(
    text: string, 
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult> {
    try {
      const model = options?.model || 'deepseek-embedding';
      const encodingFormat = options?.encodingFormat || 'float';
      
      const requestBody = {
        model,
        input: text,
        encoding_format: encodingFormat
      };
      
      const response = await this.makeRequest<DeepSeekEmbeddingResponse>('/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: requestBody
      });
      
      if (!response.data || response.data.length === 0) {
        throw new Error('No embedding data returned from DeepSeek');
      }
      
      return {
        embedding: response.data[0].embedding,
        tokens: response.usage?.total_tokens || 0,
        model: model,
        provider: this.providerId
      };
    } catch (error: any) {
      throw new ProviderError(
        `DeepSeek embedding generation failed: ${error.message}`,
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
      const model = options?.model || 'deepseek-chat';
      const temperature = options?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens ?? 1000;
      const topP = options?.topP;
      const frequencyPenalty = options?.frequencyPenalty;
      const presencePenalty = options?.presencePenalty;
      const stop = options?.stop;
      
      const requestBody = {
        model,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature,
        max_tokens: maxTokens,
        top_p: topP,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
        stop: Array.isArray(stop) ? stop : stop ? [stop] : undefined
      };
      
      const response = await this.makeRequest<DeepSeekCompletionResponse>('/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: requestBody
      });
      
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No completion choices returned from DeepSeek');
      }
      
      const choice = response.choices[0];
      const content = choice.message?.content || '';
      
      return {
        text: content,
        tokens: {
          prompt: response.usage.prompt_tokens,
          completion: response.usage.completion_tokens,
          total: response.usage.total_tokens
        },
        model: model,
        provider: this.providerId,
        finishReason: this.mapFinishReason(choice.finish_reason)
      };
    } catch (error: any) {
      throw new ProviderError(
        `DeepSeek completion generation failed: ${error.message}`,
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
      const response = await this.doGenerateEmbedding('健康检查');
      return !!(response.embedding && response.embedding.length > 0);
    } catch (error: any) {
      try {
        // Fallback to completion check if embedding fails
        const completionResponse = await this.doGenerateCompletion('你好，请回复"正常"', {
          maxTokens: 10,
          temperature: 0
        });
        return completionResponse.text.includes('正常') || completionResponse.text.includes('好');
      } catch (completionError: any) {
        console.warn(`DeepSeek health check failed: ${error.message}`);
        return false;
      }
    }
  }
  
  protected getSupportedEmbeddingModels(): string[] {
    return [
      'deepseek-embedding'
    ];
  }
  
  protected getSupportedCompletionModels(): string[] {
    return [
      'deepseek-chat',
      'deepseek-coder'
    ];
  }
  
  estimateCost(operation: 'embedding' | 'completion', tokens: number): number {
    // DeepSeek pricing (estimated, as of 2024, in USD per 1K tokens)
    // DeepSeek is known for competitive pricing
    const pricing = {
      embedding: 0.00002,  // Very competitive pricing
      completion: {
        'deepseek-chat': 0.0014,  // Input and output average
        'deepseek-coder': 0.0014
      }
    };
    
    if (operation === 'embedding') {
      return (tokens / 1000) * pricing.embedding;
    } else {
      // Use deepseek-chat pricing as default
      const cost = pricing.completion['deepseek-chat'];
      return (tokens / 1000) * cost;
    }
  }
  
  async getRemainingQuota() {
    // DeepSeek doesn't provide quota information via API
    // Return the rate limiter stats instead
    const stats = this.rateLimiter.getStats();
    return {
      requests: stats.remainingDayQuota,
      tokens: -1, // Not available from DeepSeek API
      resetTime: stats.remainingDayQuota === 0 ? 
        new Date(Date.now() + 24 * 60 * 60 * 1000) : undefined
    };
  }
  
  private mapErrorCode(error: any): string {
    if (error.code) return error.code;
    if (error.status === 429) return 'RATE_LIMIT_EXCEEDED';
    if (error.status === 401) return 'INVALID_API_KEY';
    if (error.status === 403) return 'FORBIDDEN';
    if (error.status === 404) return 'MODEL_NOT_FOUND';
    if (error.status >= 500) return 'SERVER_ERROR';
    if (error.message?.includes('quota')) return 'QUOTA_EXCEEDED';
    if (error.message?.includes('rate limit')) return 'RATE_LIMIT_EXCEEDED';
    return 'UNKNOWN_ERROR';
  }
  
  private mapFinishReason(reason: string): CompletionResult['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'content_filter': return 'content_filter';
      default: return undefined;
    }
  }
  
  protected isRetryableError(error: any): boolean {
    // DeepSeek specific retryable errors
    const retryableStatuses = [429, 500, 502, 503, 504];
    const retryableErrors = [
      'rate_limit',
      'server_error',
      'timeout',
      'connection',
      'service_unavailable',
      '网络错误',
      '服务器错误'
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

// Factory function to create DeepSeek adapter
export function createDeepSeekAdapter(apiKey?: string): DeepSeekAdapter {
  const config: ProviderConfig = {
    id: 'deepseek',
    name: 'DeepSeek',
    displayName: 'DeepSeek (中国AI)',
    apiKey: apiKey || process.env.DEEPSEEK_API_KEY || '',
    baseUrl: 'https://api.deepseek.com/v1',
    isEnabled: !!(apiKey || process.env.DEEPSEEK_API_KEY),
    priority: 3,
    rateLimit: {
      requestsPerMinute: 200,  // Generally more generous than international providers
      requestsPerDay: 20000
    },
    pricing: {
      embeddingCostPer1K: 0.00002,
      completionCostPer1K: 0.0014,
      currency: 'USD'
    },
    capabilities: {
      supportsEmbedding: true,
      supportsCompletion: true,
      maxInputLength: 32000,  // Good context window
      embeddingDimensions: 1536  // Standard embedding size
    }
  };
  
  return new DeepSeekAdapter(config);
}