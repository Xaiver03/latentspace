// Claude (Anthropic) Provider Adapter
import { BaseProviderAdapter } from '../base-provider-adapter';
import type {
  EmbeddingOptions,
  CompletionOptions,
  EmbeddingResult,
  CompletionResult,
  ProviderConfig
} from '../types';
import { ProviderError } from '../types';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  content: Array<{
    type: 'text';
    text: string;
  }>;
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

export class ClaudeAdapter extends BaseProviderAdapter {
  constructor(config: ProviderConfig) {
    super(config);
  }
  
  get providerId(): string {
    return 'claude';
  }
  
  get providerName(): string {
    return 'Anthropic';
  }
  
  get displayName(): string {
    return 'Claude (Anthropic)';
  }
  
  protected async doGenerateEmbedding(
    text: string, 
    options?: EmbeddingOptions
  ): Promise<EmbeddingResult> {
    // Claude doesn't have native embedding API
    // We'll use Claude to analyze the text and then convert to synthetic embedding
    try {
      const analysisPrompt = this.buildEmbeddingAnalysisPrompt(text);
      const completion = await this.doGenerateCompletion(analysisPrompt, {
        model: options?.model || 'claude-3-5-haiku-20241022',
        temperature: 0.1,
        maxTokens: 1000
      });
      
      // Convert the analysis to a vector
      const embedding = this.textAnalysisToVector(completion.text, text);
      
      return {
        embedding,
        tokens: completion.tokens.total,
        model: 'claude-synthetic-embedding',
        provider: this.providerId
      };
    } catch (error: any) {
      throw new ProviderError(
        `Claude embedding generation failed: ${error.message}`,
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
      const model = options?.model || 'claude-3-5-sonnet-20241022';
      const temperature = options?.temperature ?? 0.7;
      const maxTokens = options?.maxTokens ?? 1000;
      const topP = options?.topP;
      const stop = options?.stop;
      
      const requestBody = {
        model,
        max_tokens: maxTokens,
        temperature,
        top_p: topP,
        stop_sequences: Array.isArray(stop) ? stop : stop ? [stop] : undefined,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ] as ClaudeMessage[]
      };
      
      const response = await this.makeRequest<ClaudeResponse>('/messages', {
        method: 'POST',
        headers: {
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'authorization': `Bearer ${this.config.apiKey}`,
          'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: requestBody
      });
      
      if (!response.content || response.content.length === 0) {
        throw new Error('No content returned from Claude');
      }
      
      const textContent = response.content.find(c => c.type === 'text')?.text || '';
      
      return {
        text: textContent,
        tokens: {
          prompt: response.usage.input_tokens,
          completion: response.usage.output_tokens,
          total: response.usage.input_tokens + response.usage.output_tokens
        },
        model: model,
        provider: this.providerId,
        finishReason: this.mapFinishReason(response.stop_reason)
      };
    } catch (error: any) {
      throw new ProviderError(
        `Claude completion generation failed: ${error.message}`,
        this.providerId,
        this.mapErrorCode(error),
        this.isRetryableError(error),
        error
      );
    }
  }
  
  protected async doHealthCheck(): Promise<boolean> {
    try {
      const response = await this.doGenerateCompletion('Hello, respond with just "OK"', {
        model: 'claude-3-5-haiku-20241022',
        maxTokens: 10,
        temperature: 0
      });
      
      return response.text.trim().toLowerCase().includes('ok');
    } catch (error: any) {
      console.warn(`Claude health check failed: ${error.message}`);
      return false;
    }
  }
  
  protected getSupportedEmbeddingModels(): string[] {
    return [
      'claude-synthetic-embedding' // Custom synthetic embedding based on Claude analysis
    ];
  }
  
  protected getSupportedCompletionModels(): string[] {
    return [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307'
    ];
  }
  
  estimateCost(operation: 'embedding' | 'completion', tokens: number): number {
    // Anthropic pricing as of 2024 (in USD per 1K tokens)
    const pricing = {
      embedding: 0.0001, // Synthetic embedding cost (based on completion)
      completion: {
        'claude-3-5-sonnet-20241022': { input: 0.003, output: 0.015 },
        'claude-3-5-haiku-20241022': { input: 0.00025, output: 0.00125 },
        'claude-3-opus-20240229': { input: 0.015, output: 0.075 },
        'claude-3-sonnet-20240229': { input: 0.003, output: 0.015 },
        'claude-3-haiku-20240307': { input: 0.00025, output: 0.00125 }
      }
    };
    
    if (operation === 'embedding') {
      return (tokens / 1000) * pricing.embedding;
    } else {
      // Use Claude 3.5 Sonnet pricing as default (average of input and output)
      const modelPricing = pricing.completion['claude-3-5-sonnet-20241022'];
      const averageCost = (modelPricing.input + modelPricing.output) / 2;
      return (tokens / 1000) * averageCost;
    }
  }
  
  private buildEmbeddingAnalysisPrompt(text: string): string {
    return `Analyze the following text and provide a structured analysis that captures its semantic meaning:

Text: "${text}"

Please provide a comprehensive analysis including:
1. Key themes and topics (list 5-10)
2. Emotional tone and sentiment
3. Technical skills or concepts mentioned
4. Industry or domain references
5. Role or position indicators
6. Experience level indicators
7. Collaboration style indicators
8. Values and preferences mentioned

Respond in a structured format with clear sections. Be thorough but concise.`;
  }
  
  private textAnalysisToVector(analysis: string, originalText: string): number[] {
    // Convert Claude's analysis to a 1536-dimensional vector (matching OpenAI)
    const dimensions = 1536;
    const vector = new Array(dimensions).fill(0);
    
    const combinedText = (analysis + ' ' + originalText).toLowerCase();
    
    // Extract semantic features from the analysis and original text
    const features = this.extractSemanticFeatures(combinedText);
    
    // Map features to vector dimensions
    this.mapFeaturesToVector(features, vector);
    
    // Normalize the vector
    this.normalizeVector(vector);
    
    return vector;
  }
  
  private extractSemanticFeatures(text: string): Map<string, number> {
    const features = new Map<string, number>();
    
    // Role-based features
    const roles = ['ceo', 'cto', 'cpo', 'founder', 'technical', 'business', 'product'];
    roles.forEach(role => {
      const count = (text.match(new RegExp(role, 'g')) || []).length;
      if (count > 0) features.set(`role_${role}`, Math.min(count / 10, 1));
    });
    
    // Skill-based features
    const skills = [
      'python', 'javascript', 'react', 'ai', 'ml', 'data', 'backend', 'frontend',
      'mobile', 'web', 'cloud', 'aws', 'docker', 'kubernetes', 'api', 'database'
    ];
    skills.forEach(skill => {
      const count = (text.match(new RegExp(skill, 'g')) || []).length;
      if (count > 0) features.set(`skill_${skill}`, Math.min(count / 5, 1));
    });
    
    // Industry features
    const industries = [
      'fintech', 'healthcare', 'education', 'ecommerce', 'saas', 'blockchain',
      'gaming', 'social', 'enterprise', 'startup', 'b2b', 'b2c'
    ];
    industries.forEach(industry => {
      const count = (text.match(new RegExp(industry, 'g')) || []).length;
      if (count > 0) features.set(`industry_${industry}`, Math.min(count / 3, 1));
    });
    
    // Sentiment and personality features
    const sentiments = {
      'positive': ['innovative', 'creative', 'passionate', 'driven', 'excellent'],
      'collaborative': ['team', 'collaborate', 'together', 'partnership', 'community'],
      'technical': ['development', 'engineering', 'architecture', 'system', 'code'],
      'leadership': ['lead', 'manage', 'direct', 'strategy', 'vision']
    };
    
    Object.entries(sentiments).forEach(([category, words]) => {
      let score = 0;
      words.forEach(word => {
        score += (text.match(new RegExp(word, 'g')) || []).length;
      });
      if (score > 0) features.set(`sentiment_${category}`, Math.min(score / 10, 1));
    });
    
    return features;
  }
  
  private mapFeaturesToVector(features: Map<string, number>, vector: number[]): void {
    const featureArray = Array.from(features.entries());
    
    featureArray.forEach(([feature, value], index) => {
      // Hash the feature name to get consistent dimension mapping
      const hash = this.hashString(feature);
      const startDim = hash % (vector.length - 10); // Reserve some dimensions
      
      // Spread the feature across multiple dimensions with decay
      for (let i = 0; i < 10; i++) {
        const dim = (startDim + i) % vector.length;
        const decay = Math.exp(-i * 0.3); // Exponential decay
        vector[dim] += value * decay;
      }
    });
    
    // Add some controlled randomness based on original text hash
    const textHash = this.hashString(features.toString());
    for (let i = vector.length - 100; i < vector.length; i++) {
      const noise = ((textHash + i) % 1000) / 10000; // Small noise values
      vector[i] += noise;
    }
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
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }
  
  private mapErrorCode(error: any): string {
    if (error.type === 'error') {
      if (error.error?.type === 'rate_limit_error') return 'RATE_LIMIT_EXCEEDED';
      if (error.error?.type === 'authentication_error') return 'INVALID_API_KEY';
      if (error.error?.type === 'permission_error') return 'FORBIDDEN';
      if (error.error?.type === 'not_found_error') return 'MODEL_NOT_FOUND';
    }
    if (error.status === 429) return 'RATE_LIMIT_EXCEEDED';
    if (error.status === 401) return 'INVALID_API_KEY';
    if (error.status === 403) return 'FORBIDDEN';
    if (error.status === 404) return 'MODEL_NOT_FOUND';
    if (error.status >= 500) return 'SERVER_ERROR';
    return 'UNKNOWN_ERROR';
  }
  
  private mapFinishReason(reason: string): CompletionResult['finishReason'] {
    switch (reason) {
      case 'end_turn': return 'stop';
      case 'max_tokens': return 'length';
      case 'stop_sequence': return 'stop';
      default: return undefined;
    }
  }
}

// Factory function to create Claude adapter
export function createClaudeAdapter(apiKey?: string): ClaudeAdapter {
  const config: ProviderConfig = {
    id: 'claude',
    name: 'Anthropic',
    displayName: 'Claude (Anthropic)',
    apiKey: apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY || '',
    baseUrl: 'https://api.anthropic.com/v1',
    isEnabled: !!(apiKey || process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY),
    priority: 2,
    rateLimit: {
      requestsPerMinute: 50,
      requestsPerDay: 5000
    },
    pricing: {
      embeddingCostPer1K: 0.0001,
      completionCostPer1K: 0.009, // Claude 3.5 Sonnet average
      currency: 'USD'
    },
    capabilities: {
      supportsEmbedding: true, // Via synthetic embedding
      supportsCompletion: true,
      maxInputLength: 200000, // Claude has large context window
      embeddingDimensions: 1536 // Synthetic embedding matching OpenAI
    }
  };
  
  return new ClaudeAdapter(config);
}