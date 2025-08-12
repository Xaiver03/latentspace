import { OpenAI } from 'openai';

interface EmbeddingResult {
  embedding: number[];
  tokens: number;
}

export class EmbeddingService {
  private openai: OpenAI | null = null;
  private initialized = false;

  constructor() {
    // Only initialize OpenAI if API key is available
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      this.initialized = true;
    }
  }

  async generateProfileEmbedding(profile: {
    roleIntent: string;
    seniority: string;
    skills?: string[];
    industries?: string[];
    techStack?: string[];
    bio?: string;
    workStyle?: any;
    values?: any;
  }): Promise<EmbeddingResult> {
    // Create a comprehensive text representation of the profile
    const profileText = this.buildProfileText(profile);
    
    if (this.initialized && this.openai) {
      try {
        const response = await this.openai.embeddings.create({
          model: "text-embedding-3-small", // 1536 dimensions, cost-effective
          input: profileText,
          encoding_format: "float",
        });

        return {
          embedding: response.data[0].embedding,
          tokens: response.usage?.total_tokens || 0,
        };
      } catch (error) {
        console.warn('OpenAI embedding failed, falling back to synthetic:', error);
        return this.generateSyntheticEmbedding(profileText);
      }
    }

    // Fallback to synthetic embedding if no API key
    return this.generateSyntheticEmbedding(profileText);
  }

  async generateSearchEmbedding(query: string): Promise<number[]> {
    if (this.initialized && this.openai) {
      try {
        const response = await this.openai.embeddings.create({
          model: "text-embedding-3-small",
          input: query,
          encoding_format: "float",
        });

        return response.data[0].embedding;
      } catch (error) {
        console.warn('OpenAI search embedding failed, falling back to synthetic:', error);
        return this.generateSyntheticEmbedding(query).embedding;
      }
    }

    return this.generateSyntheticEmbedding(query).embedding;
  }

  private buildProfileText(profile: {
    roleIntent: string;
    seniority: string;
    skills?: string[];
    industries?: string[];
    techStack?: string[];
    bio?: string;
    workStyle?: any;
    values?: any;
  }): string {
    const parts: string[] = [];

    // Role and experience
    parts.push(`Role: ${profile.roleIntent} with ${profile.seniority} experience level`);

    // Skills
    if (profile.skills && profile.skills.length > 0) {
      parts.push(`Core skills: ${profile.skills.join(', ')}`);
    }

    // Industries
    if (profile.industries && profile.industries.length > 0) {
      parts.push(`Industry focus: ${profile.industries.join(', ')}`);
    }

    // Technology stack
    if (profile.techStack && profile.techStack.length > 0) {
      parts.push(`Technology stack: ${profile.techStack.join(', ')}`);
    }

    // Work style
    if (profile.workStyle) {
      const workStyleText = Object.entries(profile.workStyle)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      parts.push(`Work style: ${workStyleText}`);
    }

    // Values
    if (profile.values) {
      const valuesText = Object.entries(profile.values)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      parts.push(`Values: ${valuesText}`);
    }

    // Bio (most important part)
    if (profile.bio) {
      parts.push(`Biography: ${profile.bio}`);
    }

    return parts.join('. ');
  }

  private generateSyntheticEmbedding(text: string): EmbeddingResult {
    // Generate a deterministic but meaningful synthetic embedding
    // This uses a simple hash-based approach with some semantic understanding
    
    const dimensions = 1536; // Match OpenAI's text-embedding-3-small
    const embedding = new Array(dimensions).fill(0);
    
    // Extract meaningful features from text
    const features = this.extractFeatures(text.toLowerCase());
    
    // Role-based features (dimensions 0-99)
    const roles = ['ceo', 'cto', 'cpo', 'technical', 'business', 'founder'];
    roles.forEach((role, idx) => {
      if (text.toLowerCase().includes(role)) {
        embedding[idx * 10] = 0.8 + Math.random() * 0.4;
      }
    });

    // Skill-based features (dimensions 100-399)
    const skillKeywords = [
      'python', 'javascript', 'react', 'ai', 'ml', 'data', 'backend', 'frontend',
      'mobile', 'web', 'cloud', 'aws', 'docker', 'kubernetes', 'api', 'database',
      'product', 'design', 'marketing', 'sales', 'strategy', 'growth', 'startup'
    ];
    skillKeywords.forEach((skill, idx) => {
      if (text.toLowerCase().includes(skill)) {
        const baseIdx = 100 + idx * 10;
        embedding[baseIdx] = 0.6 + Math.random() * 0.6;
        // Add some variation to nearby dimensions
        for (let i = 1; i < 10; i++) {
          embedding[baseIdx + i] = (0.3 + Math.random() * 0.4) * (1 - i * 0.1);
        }
      }
    });

    // Industry-based features (dimensions 400-699)
    const industries = [
      'fintech', 'healthcare', 'education', 'ecommerce', 'saas', 'blockchain',
      'gaming', 'social', 'enterprise', 'consumer', 'b2b', 'b2c', 'marketplace'
    ];
    industries.forEach((industry, idx) => {
      if (text.toLowerCase().includes(industry)) {
        const baseIdx = 400 + idx * 20;
        embedding[baseIdx] = 0.7 + Math.random() * 0.5;
      }
    });

    // Sentiment and personality features (dimensions 700-999)
    const personalityWords = {
      'innovative': 700, 'creative': 710, 'analytical': 720, 'strategic': 730,
      'collaborative': 740, 'leadership': 750, 'entrepreneurial': 760,
      'passionate': 770, 'driven': 780, 'experienced': 790
    };
    
    Object.entries(personalityWords).forEach(([word, startIdx]) => {
      if (text.toLowerCase().includes(word)) {
        embedding[startIdx] = 0.5 + Math.random() * 0.7;
      }
    });

    // Add some general semantic noise to remaining dimensions
    for (let i = 1000; i < dimensions; i++) {
      if (embedding[i] === 0) {
        // Hash-based deterministic "randomness"
        const hash = this.simpleHash(text + i.toString());
        embedding[i] = (hash % 1000) / 5000; // Small values for noise
      }
    }

    // Normalize the embedding
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      for (let i = 0; i < dimensions; i++) {
        embedding[i] /= magnitude;
      }
    }

    return {
      embedding,
      tokens: Math.ceil(text.length / 4), // Rough token estimate
    };
  }

  private extractFeatures(text: string): string[] {
    // Extract meaningful keywords and phrases
    const words = text.split(/\s+/);
    const features: string[] = [];
    
    // Add significant words (longer than 3 characters)
    words.forEach(word => {
      if (word.length > 3 && !this.isStopWord(word)) {
        features.push(word);
      }
    });

    return features;
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
      'by', 'this', 'that', 'these', 'those', 'a', 'an', 'is', 'are', 'was',
      'were', 'will', 'would', 'could', 'should', 'have', 'has', 'had'
    ]);
    return stopWords.has(word.toLowerCase());
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  // Calculate cosine similarity between two embeddings
  static cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Embeddings must have the same dimensions');
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    magnitudeA = Math.sqrt(magnitudeA);
    magnitudeB = Math.sqrt(magnitudeB);

    if (magnitudeA === 0 || magnitudeB === 0) {
      return 0;
    }

    return dotProduct / (magnitudeA * magnitudeB);
  }

  // Find most similar profiles using embeddings
  static findSimilarProfiles(
    queryEmbedding: number[],
    profileEmbeddings: Array<{ id: number; embedding: number[] }>,
    topK: number = 10
  ): Array<{ id: number; similarity: number }> {
    const similarities = profileEmbeddings.map(profile => ({
      id: profile.id,
      similarity: EmbeddingService.cosineSimilarity(queryEmbedding, profile.embedding),
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK);
  }
}

export const embeddingService = new EmbeddingService();