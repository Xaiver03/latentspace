import { createLegacyEmbeddingService } from './ai/index.js';
import type { UserProfile } from './ai/types.js';

interface ProfileData {
  roleIntent: string;
  seniority: string;
  skills?: string[];
  industries?: string[];
  techStack?: string[];
  bio?: string;
  workStyle?: any;
  values?: any;
}

/**
 * Enhanced Embedding Service using multi-provider AI architecture
 * 增强版嵌入服务，使用多提供商AI架构
 */
export class EnhancedEmbeddingService {
  private aiService: ReturnType<typeof createLegacyEmbeddingService>;

  constructor() {
    // 使用向后兼容的AI服务
    this.aiService = createLegacyEmbeddingService();
  }

  /**
   * Generate embedding for user profile using multi-provider AI
   * 使用多提供商AI为用户画像生成嵌入向量
   */
  async generateProfileEmbedding(profile: ProfileData): Promise<{
    embedding: number[];
    tokens: number;
    provider?: string;
  }> {
    try {
      const result = await this.aiService.generateProfileEmbedding(profile);
      
      // 添加提供商信息（如果可用）
      return {
        ...result,
        provider: (result as any).provider || 'unknown'
      };
    } catch (error) {
      console.error('Failed to generate profile embedding:', error);
      // 降级到本地计算
      return this.generateLocalEmbedding(profile);
    }
  }

  /**
   * Generate embedding for search query using multi-provider AI
   * 使用多提供商AI为搜索查询生成嵌入向量
   */
  async generateSearchEmbedding(query: string): Promise<number[]> {
    try {
      return await this.aiService.generateSearchEmbedding(query);
    } catch (error) {
      console.error('Failed to generate search embedding:', error);
      // 降级到本地计算
      const result = await this.generateLocalEmbedding({ bio: query });
      return result.embedding;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * 计算两个嵌入向量之间的余弦相似度
   */
  cosineSimilarity(a: number[], b: number[]): number {
    return this.aiService.cosineSimilarity(a, b);
  }

  /**
   * Find similar profiles using embeddings
   * 使用嵌入向量查找相似的用户画像
   */
  findSimilarProfiles(
    queryEmbedding: number[],
    profileEmbeddings: Array<{ id: number; embedding: number[] }>,
    topK: number = 10
  ): Array<{ id: number; similarity: number }> {
    return this.aiService.findSimilarProfiles(queryEmbedding, profileEmbeddings, topK);
  }

  /**
   * Generate embedding locally as fallback
   * 本地生成嵌入向量作为降级方案
   */
  private async generateLocalEmbedding(profile: ProfileData): Promise<{
    embedding: number[];
    tokens: number;
    provider: string;
  }> {
    const dimensions = 1536;
    const embedding = new Array(dimensions).fill(0);
    
    // 构建用户画像文本
    const profileText = this.buildProfileText(profile);
    
    // 提取特征并映射到嵌入向量
    const features = this.extractFeatures(profileText.toLowerCase());
    this.mapFeaturesToEmbedding(features, embedding, profileText);
    
    // 归一化嵌入向量
    this.normalizeVector(embedding);
    
    return {
      embedding,
      tokens: Math.ceil(profileText.length / 4),
      provider: 'local-fallback'
    };
  }

  /**
   * Build text representation of profile
   * 构建用户画像的文本表示
   */
  private buildProfileText(profile: ProfileData): string {
    const parts: string[] = [];

    // 角色和经验
    parts.push(`角色: ${profile.roleIntent} 经验级别: ${profile.seniority}`);

    // 技能
    if (profile.skills && profile.skills.length > 0) {
      parts.push(`核心技能: ${profile.skills.join(', ')}`);
    }

    // 行业
    if (profile.industries && profile.industries.length > 0) {
      parts.push(`行业聚焦: ${profile.industries.join(', ')}`);
    }

    // 技术栈
    if (profile.techStack && profile.techStack.length > 0) {
      parts.push(`技术栈: ${profile.techStack.join(', ')}`);
    }

    // 工作风格
    if (profile.workStyle) {
      const workStyleText = Object.entries(profile.workStyle)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      parts.push(`工作风格: ${workStyleText}`);
    }

    // 价值观
    if (profile.values) {
      const valuesText = Object.entries(profile.values)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      parts.push(`价值观: ${valuesText}`);
    }

    // 个人简介（最重要的部分）
    if (profile.bio) {
      parts.push(`个人简介: ${profile.bio}`);
    }

    return parts.join('. ');
  }

  /**
   * Extract features from text
   * 从文本中提取特征
   */
  private extractFeatures(text: string): Map<string, number> {
    const features = new Map<string, number>();
    
    // 技术相关关键词
    const techKeywords = {
      // 编程语言
      'python': 0.8, 'javascript': 0.8, 'typescript': 0.8, 'java': 0.7,
      'golang': 0.7, 'rust': 0.7, 'c++': 0.7, 'swift': 0.7,
      
      // 框架和工具
      'react': 0.7, 'vue': 0.7, 'angular': 0.7, 'node': 0.7,
      'django': 0.7, 'spring': 0.7, 'kubernetes': 0.8, 'docker': 0.8,
      
      // AI/ML
      'ai': 0.9, '人工智能': 0.9, 'ml': 0.8, '机器学习': 0.8,
      'deep learning': 0.8, '深度学习': 0.8, 'nlp': 0.7, '自然语言处理': 0.7,
      
      // 角色
      'ceo': 0.9, 'cto': 0.9, 'cpo': 0.9, '创始人': 0.9,
      'founder': 0.9, 'technical': 0.7, '技术': 0.7, 'business': 0.7,
      
      // 行业
      'fintech': 0.8, '金融科技': 0.8, 'healthcare': 0.8, '医疗': 0.8,
      'education': 0.7, '教育': 0.7, 'ecommerce': 0.7, '电商': 0.7,
      'saas': 0.8, 'blockchain': 0.8, '区块链': 0.8
    };
    
    // 检查关键词出现
    Object.entries(techKeywords).forEach(([keyword, weight]) => {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex);
      if (matches) {
        features.set(keyword, Math.min(matches.length * weight, 1));
      }
    });
    
    // 文本统计特征
    const words = text.split(/\s+/);
    features.set('text_length', Math.min(text.length / 1000, 1));
    features.set('word_count', Math.min(words.length / 100, 1));
    
    return features;
  }

  /**
   * Map features to embedding dimensions
   * 将特征映射到嵌入向量维度
   */
  private mapFeaturesToEmbedding(
    features: Map<string, number>,
    embedding: number[],
    originalText: string
  ): void {
    // 为每个特征分配一定范围的维度
    let dimensionOffset = 0;
    const dimensionsPerFeature = Math.floor(1000 / Math.max(features.size, 1));
    
    features.forEach((value, feature) => {
      const startDim = dimensionOffset;
      const endDim = Math.min(startDim + dimensionsPerFeature, 1000);
      
      // 在指定范围内分布特征值
      for (let i = startDim; i < endDim; i++) {
        const decay = Math.exp(-(i - startDim) * 0.1);
        embedding[i] = value * decay * (0.8 + Math.random() * 0.4);
      }
      
      dimensionOffset = endDim;
    });
    
    // 为剩余维度添加基于文本哈希的噪声
    const textHash = this.hashString(originalText);
    for (let i = 1000; i < embedding.length; i++) {
      if (embedding[i] === 0) {
        const noise = ((textHash + i * 31) % 2000 - 1000) / 10000;
        embedding[i] = noise;
      }
    }
  }

  /**
   * Normalize vector to unit length
   * 将向量归一化为单位长度
   */
  private normalizeVector(vector: number[]): void {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < vector.length; i++) {
        vector[i] /= magnitude;
      }
    }
  }

  /**
   * Simple hash function for text
   * 简单的文本哈希函数
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }
}

// 导出增强版嵌入服务实例
export const enhancedEmbeddingService = new EnhancedEmbeddingService();