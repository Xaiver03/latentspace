// Qwen (阿里云) Provider Adapter
import { BaseProviderAdapter } from '../base-provider-adapter';
import type {
  EmbeddingOptions,
  CompletionOptions,
  EmbeddingResult,
  CompletionResult,
  ProviderConfig
} from '../types';
import { ProviderError } from '../types';

interface QwenCompletionResponse {
  output: {
    text: string;
    finish_reason: string;
  };
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  request_id: string;
}

export class QwenAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }
  
  get providerId(): string {
    return 'qwen';
  }
  
  get providerName(): string {
    return 'Alibaba Cloud';
  }
  
  get displayName(): string {
    return 'Qwen (阿里云)';
  }
  
  protected async doGenerateEmbedding(
    text: string, 
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult> {
    try {
      const model = options?.model || 'text-embedding-v1';
      
      const requestBody = {
        model,
        input: {
          texts: [text]
        }
      };
      
      const response = await this.makeRequest('/services/embeddings/text-embedding/text-embedding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
          'X-DashScope-Async': 'enable'
        },
        body: requestBody
      });
      
      if (!response.output?.embeddings || response.output.embeddings.length === 0) {
        throw new Error('No embedding data returned from Qwen');
      }
      
      return {
        embedding: response.output.embeddings[0].embedding,
        tokens: response.usage?.total_tokens || Math.ceil(text.length / 4),
        model: model,
        provider: this.providerId
      };
    } catch (error: any) {
      // Fallback to synthetic embedding if Qwen embedding fails
      return this.generateSyntheticEmbedding(text);
    }
  }
  
  protected async doGenerateCompletion(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    try {
      const model = options?.model || 'qwen-turbo';
      const temperature = options?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens ?? 1000;
      const topP = options?.topP;
      const stop = options?.stop;
      
      const requestBody = {
        model,
        input: {
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        parameters: {
          temperature,
          max_tokens: maxTokens,
          top_p: topP,
          stop: Array.isArray(stop) ? stop : stop ? [stop] : undefined
        }
      };
      
      const response = await this.makeRequest<QwenCompletionResponse>('/services/aigc/text-generation/generation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: requestBody
      });
      
      if (!response.output?.text) {
        throw new Error('No completion text returned from Qwen');
      }
      
      return {
        text: response.output.text,
        tokens: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.total_tokens
        },
        model: model,
        provider: this.providerId,
        finishReason: this.mapFinishReason(response.output.finish_reason)
      };
    } catch (error: any) {
      throw new ProviderError(
        `Qwen completion generation failed: ${error.message}`,
        this.providerId,
        this.mapErrorCode(error),
        this.isRetryableError(error),
        error
      );
    }
  }
  
  protected async doHealthCheck(): Promise<boolean> {
    try {
      const response = await this.doGenerateCompletion('你好，请回复"正常"', {
        maxTokens: 10,
        temperature: 0
      });
      return response.text.includes('正常') || response.text.includes('好');
    } catch (error: any) {
      console.warn(`Qwen health check failed: ${error.message}`);
      return false;
    }
  }
  
  protected getSupportedEmbeddingModels(): string[] {
    return [
      'text-embedding-v1',
      'text-embedding-v2'
    ];
  }
  
  protected getSupportedCompletionModels(): string[] {
    return [
      'qwen-turbo',
      'qwen-plus',
      'qwen-max',
      'qwen-max-longcontext'
    ];
  }
  
  estimateCost(operation: 'embedding' | 'completion', tokens: number): number {
    // Qwen pricing (estimated, as of 2024, in USD per 1K tokens)
    const pricing = {
      embedding: 0.00007,  // Competitive pricing
      completion: {
        'qwen-turbo': 0.003,
        'qwen-plus': 0.004,
        'qwen-max': 0.02,
        'qwen-max-longcontext': 0.02
      }
    };
    
    if (operation === 'embedding') {
      return (tokens / 1000) * pricing.embedding;
    } else {
      const cost = pricing.completion['qwen-turbo'];
      return (tokens / 1000) * cost;
    }
  }
  
  private generateSyntheticEmbedding(text: string): EmbeddingResult {
    // Simple synthetic embedding generation as fallback
    const dimensions = 1536;
    const embedding = new Array(dimensions).fill(0);
    
    // Generate hash-based features
    for (let i = 0; i < dimensions; i++) {
      const hash = this.hashString(text + i.toString());
      embedding[i] = ((hash % 2000) - 1000) / 1000; // Values between -1 and 1
    }
    
    // Normalize
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i] /= magnitude;
      }
    }
    
    return {
      embedding,
      tokens: Math.ceil(text.length / 4),
      model: 'qwen-synthetic',
      provider: this.providerId
    };
  }
  
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
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
  
  private mapFinishReason(reason: string): CompletionResult['finishReason'] {
    switch (reason) {
      case 'stop': return 'stop';
      case 'length': return 'length';
      case 'null': return 'stop';
      default: return undefined;
    }
  }
}

// Factory function
export function createQwenAdapter(apiKey?: string): QwenAdapter {
  const config: ProviderConfig = {
    id: 'qwen',
    name: 'Alibaba Cloud',
    displayName: 'Qwen (阿里云)',
    apiKey: apiKey || process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '',
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    isEnabled: !!(apiKey || process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY),
    priority: 4,
    rateLimit: {
      requestsPerMinute: 100,
      requestsPerDay: 10000
    },
    pricing: {
      embeddingCostPer1K: 0.00007,
      completionCostPer1K: 0.003,
      currency: 'USD'
    },
    capabilities: {
      supportsEmbedding: true,
      supportsCompletion: true,
      maxInputLength: 30000,
      embeddingDimensions: 1536
    }
  };
  
  return new QwenAdapter(config);
}