// Kimi (Moonshot) Provider Adapter
import { BaseProviderAdapter } from '../base-provider-adapter';
import type {
  EmbeddingOptions,
  CompletionOptions,
  EmbeddingResult,
  CompletionResult,
  ProviderConfig
} from '../types';
import { ProviderError } from '../types';

interface KimiCompletionResponse {
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

export class KimiAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }
  
  get providerId(): string {
    return 'kimi';
  }
  
  get providerName(): string {
    return 'Moonshot AI';
  }
  
  get displayName(): string {
    return 'Kimi (月之暗面)';
  }
  
  protected async doGenerateEmbedding(
    text: string, 
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult> {
    // Kimi doesn't have native embedding API, generate synthetic embedding
    return this.generateSyntheticEmbedding(text);
  }
  
  protected async doGenerateCompletion(
    prompt: string,
    options?: CompletionOptions
  ): Promise<CompletionResult> {
    try {
      const model = options?.model || 'moonshot-v1-8k';
      const temperature = options?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens ?? 1000;
      const topP = options?.topP;
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
        stop: Array.isArray(stop) ? stop : stop ? [stop] : undefined
      };
      
      const response = await this.makeRequest<KimiCompletionResponse>('/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: requestBody
      });
      
      if (!response.choices || response.choices.length === 0) {
        throw new Error('No completion choices returned from Kimi');
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
        `Kimi completion generation failed: ${error.message}`,
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
      return response.text.includes('正常') || response.text.includes('好') || response.text.includes('OK');
    } catch (error: any) {
      console.warn(`Kimi health check failed: ${error.message}`);
      return false;
    }
  }
  
  protected getSupportedEmbeddingModels(): string[] {
    return [
      'kimi-synthetic-embedding' // Synthetic embedding
    ];
  }
  
  protected getSupportedCompletionModels(): string[] {
    return [
      'moonshot-v1-8k',
      'moonshot-v1-32k',
      'moonshot-v1-128k'
    ];
  }
  
  estimateCost(operation: 'embedding' | 'completion', tokens: number): number {
    // Kimi pricing (estimated, as of 2024, in USD per 1K tokens)
    const pricing = {
      embedding: 0.0001, // Synthetic embedding cost
      completion: {
        'moonshot-v1-8k': 0.012,
        'moonshot-v1-32k': 0.024,
        'moonshot-v1-128k': 0.060
      }
    };
    
    if (operation === 'embedding') {
      return (tokens / 1000) * pricing.embedding;
    } else {
      const cost = pricing.completion['moonshot-v1-8k'];
      return (tokens / 1000) * cost;
    }
  }
  
  private generateSyntheticEmbedding(text: string): EmbeddingResult {
    // Generate synthetic embedding using text analysis
    const dimensions = 1536;
    const embedding = new Array(dimensions).fill(0);
    
    // Extract features from text
    const features = this.extractTextFeatures(text.toLowerCase());
    
    // Map features to dimensions
    features.forEach((value, feature) => {
      const hash = this.hashString(feature);
      const startDim = hash % (dimensions - 10);
      
      // Distribute feature across multiple dimensions
      for (let i = 0; i < 10; i++) {
        const dim = (startDim + i) % dimensions;
        const decay = Math.exp(-i * 0.2);
        embedding[dim] += value * decay;
      }
    });
    
    // Add noise based on text hash
    const textHash = this.hashString(text);
    for (let i = 0; i < dimensions; i++) {
      if (embedding[i] === 0) {
        const noise = ((textHash + i) % 1000) / 10000;
        embedding[i] = noise;
      }
    }
    
    // Normalize
    this.normalizeVector(embedding);
    
    return {
      embedding,
      tokens: Math.ceil(text.length / 4),
      model: 'kimi-synthetic',
      provider: this.providerId
    };
  }
  
  private extractTextFeatures(text: string): Map<string, number> {
    const features = new Map<string, number>();
    
    // Common technical and business terms
    const keywords = {
      // Roles
      'ceo': 0.8, 'cto': 0.8, 'cpo': 0.8, 'founder': 0.9,
      'technical': 0.7, 'business': 0.7, 'product': 0.7,
      
      // Skills
      'python': 0.6, 'javascript': 0.6, 'react': 0.6, 'ai': 0.8,
      'machine learning': 0.8, 'data': 0.6, 'backend': 0.6, 'frontend': 0.6,
      
      // Industries  
      'fintech': 0.7, 'healthcare': 0.7, 'education': 0.7, 'ecommerce': 0.7,
      'saas': 0.8, 'blockchain': 0.8, 'startup': 0.9,
      
      // Personality
      'innovative': 0.7, 'creative': 0.7, 'passionate': 0.6, 'driven': 0.6,
      'collaborative': 0.7, 'leadership': 0.8
    };
    
    Object.entries(keywords).forEach(([keyword, weight]) => {
      if (text.includes(keyword)) {
        features.set(keyword, weight);
      }
    });
    
    // Character-based features
    features.set('text_length', Math.min(text.length / 1000, 1));
    features.set('word_count', Math.min(text.split(/\s+/).length / 100, 1));
    
    return features;
  }
  
  private normalizeVector(vector: number[]): void {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
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
      case 'content_filter': return 'content_filter';
      default: return undefined;
    }
  }
}

// Factory function
export function createKimiAdapter(apiKey?: string): KimiAdapter {
  const config: ProviderConfig = {
    id: 'kimi',
    name: 'Moonshot AI',
    displayName: 'Kimi (月之暗面)',
    apiKey: apiKey || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY || '',
    baseUrl: 'https://api.moonshot.cn/v1',
    isEnabled: !!(apiKey || process.env.KIMI_API_KEY || process.env.MOONSHOT_API_KEY),
    priority: 5,
    rateLimit: {
      requestsPerMinute: 60,
      requestsPerDay: 5000
    },
    pricing: {
      embeddingCostPer1K: 0.0001,
      completionCostPer1K: 0.012,
      currency: 'USD'
    },
    capabilities: {
      supportsEmbedding: true, // Via synthetic
      supportsCompletion: true,
      maxInputLength: 128000, // Large context for moonshot-v1-128k
      embeddingDimensions: 1536
    }
  };
  
  return new KimiAdapter(config);
}