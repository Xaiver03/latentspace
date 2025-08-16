import { db } from "../db";
import { users, cofounderApplications, matches } from "@shared/schema";
import { eq, and, ne, notInArray, sql } from "drizzle-orm";
import { getAIManager } from './ai/index.js';
import { enhancedEmbeddingService } from './enhanced-embedding-service.js';
import { abTestingService } from './ab-testing-service.js';
import type { UserProfile, CompatibilityScore, MatchResult as AIMatchResult } from './ai/types.js';

export interface MatchCandidate {
  id: number;
  fullName: string;
  username: string;
  avatarUrl?: string;
  researchField?: string;
  affiliation?: string;
  bio?: string;
  application: {
    id: number;
    researchField: string;
    startupDirection: string;
    experience?: string;
    lookingFor?: string;
    status: string;
  };
  matchScore: number;
  matchReasons: string[];
  aiInsights?: {
    compatibilityScore: CompatibilityScore;
    recommendedActions: string[];
  };
}

export interface MatchResult {
  candidate: MatchCandidate;
  score: number;
  explanation: string[];
}

/**
 * AI-Enhanced Matching Engine using multi-provider AI architecture
 * 使用多提供商AI架构的增强版匹配引擎
 */
export class AIEnhancedMatchingEngine {
  private aiManager = getAIManager();

  /**
   * Generate AI-enhanced recommendations for a user
   * 为用户生成AI增强的推荐
   */
  async generateRecommendations(userId: number, limit: number = 10): Promise<MatchCandidate[]> {
    // 获取用户申请信息
    const userApplication = await this.getUserApplication(userId);
    if (!userApplication) {
      throw new Error('User application not found or not approved');
    }

    // Check for A/B test assignment
    const testId = 'ai_model_comparison_' + Math.floor(Date.now() / (1000 * 60 * 60 * 24)); // Daily test ID
    let aiVariant = abTestingService.getUserVariant(userId, testId);
    if (!aiVariant) {
      aiVariant = abTestingService.assignUserToVariant(userId, testId);
    }

    // Track matching request event
    if (aiVariant) {
      await abTestingService.trackEvent(userId, testId, aiVariant, 'matching_request', {
        limit,
        timestamp: new Date()
      });
    }

    // 获取候选人
    const candidates = await this.getCandidates(userId);
    if (candidates.length === 0) {
      return [];
    }

    // 使用AI增强匹配
    const matchResults = await Promise.all(
      candidates.map(async (candidate) => {
        const matchResult = await this.calculateAIEnhancedMatch(userApplication, candidate);
        return {
          ...candidate,
          ...matchResult
        };
      })
    );

    // 按分数排序并返回
    return matchResults
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);
  }

  /**
   * Calculate AI-enhanced match between two users
   * 计算两个用户之间的AI增强匹配度
   */
  private async calculateAIEnhancedMatch(
    user: any,
    candidate: any
  ): Promise<{ matchScore: number; matchReasons: string[]; aiInsights: any }> {
    try {
      // 构建用户画像
      const userProfile = this.buildUserProfile(user);
      const candidateProfile = this.buildUserProfile(candidate);

      // 使用AI分析兼容性
      const compatibilityScore = await this.aiManager.analyzeCompatibility(
        userProfile,
        candidateProfile
      );

      // 提取匹配原因
      const matchReasons = this.extractMatchReasons(compatibilityScore);

      // 计算综合分数
      const matchScore = this.calculateOverallScore(compatibilityScore);

      return {
        matchScore,
        matchReasons,
        aiInsights: {
          compatibilityScore,
          recommendedActions: compatibilityScore.recommendedActions || []
        }
      };
    } catch (error) {
      console.error('AI matching failed, falling back to basic matching:', error);
      // 降级到基础匹配
      return this.calculateBasicMatch(user, candidate);
    }
  }

  /**
   * Build user profile for AI analysis
   * 构建用于AI分析的用户画像
   */
  private buildUserProfile(user: any): UserProfile {
    const application = user.application || user;
    
    return {
      basicInfo: {
        id: user.id?.toString() || 'unknown',
        name: user.fullName || user.username || 'Unknown',
        email: user.email || '',
        phone: user.phone || '',
        location: application.location || '未指定',
        skills: this.extractSkills(application),
        background: application.experience || ''
      },
      entrepreneurialInfo: {
        role: this.extractRole(application),
        stage: this.extractStage(application),
        industry: this.extractIndustries(application),
        timeCommitment: application.timeCommitment || '全职',
        location: application.location || '未指定',
        remoteWillingness: application.remoteWillingness || false
      }
    };
  }

  /**
   * Extract skills from application
   * 从申请信息中提取技能
   */
  private extractSkills(application: any): string[] {
    const skills: string[] = [];
    
    // 从经验中提取技能关键词
    if (application.experience) {
      const techKeywords = [
        'python', 'javascript', 'react', 'node', 'ai', 'ml',
        'backend', 'frontend', 'fullstack', 'mobile', 'web',
        'data', 'cloud', 'devops', '产品', '设计', '运营'
      ];
      
      techKeywords.forEach(keyword => {
        if (application.experience.toLowerCase().includes(keyword)) {
          skills.push(keyword);
        }
      });
    }
    
    return skills;
  }

  /**
   * Extract role from application
   * 从申请信息中提取角色
   */
  private extractRole(application: any): string {
    const lookingFor = (application.lookingFor || '').toLowerCase();
    const experience = (application.experience || '').toLowerCase();
    
    if (lookingFor.includes('cto') || experience.includes('技术')) {
      return 'CTO';
    } else if (lookingFor.includes('ceo') || experience.includes('商业')) {
      return 'CEO';
    } else if (lookingFor.includes('cpo') || experience.includes('产品')) {
      return 'CPO';
    }
    
    return '联合创始人';
  }

  /**
   * Extract stage from application
   * 从申请信息中提取创业阶段
   */
  private extractStage(application: any): string {
    const direction = (application.startupDirection || '').toLowerCase();
    
    if (direction.includes('idea') || direction.includes('想法')) {
      return 'idea';
    } else if (direction.includes('mvp') || direction.includes('原型')) {
      return 'prototype';
    } else if (direction.includes('产品') || direction.includes('product')) {
      return 'mvp';
    }
    
    return 'idea';
  }

  /**
   * Extract industries from application
   * 从申请信息中提取行业
   */
  private extractIndustries(application: any): string[] {
    const industries: string[] = [];
    const text = `${application.researchField} ${application.startupDirection}`.toLowerCase();
    
    const industryKeywords = {
      'AI/ML': ['ai', 'ml', '人工智能', '机器学习'],
      'Fintech': ['fintech', '金融', 'finance'],
      'Healthcare': ['health', '医疗', 'medical'],
      'Education': ['education', '教育', 'edtech'],
      'E-commerce': ['ecommerce', '电商', 'marketplace'],
      'SaaS': ['saas', 'b2b', 'enterprise']
    };
    
    Object.entries(industryKeywords).forEach(([industry, keywords]) => {
      if (keywords.some(keyword => text.includes(keyword))) {
        industries.push(industry);
      }
    });
    
    return industries.length > 0 ? industries : ['其他'];
  }

  /**
   * Extract match reasons from compatibility score
   * 从兼容性分数中提取匹配原因
   */
  private extractMatchReasons(score: CompatibilityScore): string[] {
    const reasons: string[] = [];
    
    // 基于各维度分数生成原因
    if (score.dimensions.roleCompatibility >= 80) {
      reasons.push('角色高度互补');
    }
    if (score.dimensions.skillComplementarity >= 80) {
      reasons.push('技能组合理想');
    }
    if (score.dimensions.valueAlignment >= 80) {
      reasons.push('价值观高度一致');
    }
    if (score.dimensions.workStyleMatch >= 80) {
      reasons.push('工作风格匹配');
    }
    if (score.dimensions.goalAlignment >= 80) {
      reasons.push('目标方向一致');
    }
    
    // 添加AI推理的原因
    if (score.reasoning) {
      reasons.push(score.reasoning.substring(0, 50) + '...');
    }
    
    return reasons;
  }

  /**
   * Calculate overall score from compatibility dimensions
   * 从兼容性各维度计算总分
   */
  private calculateOverallScore(score: CompatibilityScore): number {
    const weights = {
      roleCompatibility: 0.25,
      skillComplementarity: 0.25,
      valueAlignment: 0.20,
      workStyleMatch: 0.15,
      goalAlignment: 0.15
    };
    
    let weightedSum = 0;
    Object.entries(weights).forEach(([dimension, weight]) => {
      weightedSum += (score.dimensions[dimension as keyof typeof score.dimensions] || 0) * weight;
    });
    
    return Math.round(weightedSum);
  }

  /**
   * Basic matching fallback when AI is unavailable
   * AI不可用时的基础匹配降级方案
   */
  private calculateBasicMatch(user: any, candidate: any): {
    matchScore: number;
    matchReasons: string[];
    aiInsights: any;
  } {
    const matchReasons: string[] = [];
    let score = 50; // 基础分数

    // 研究领域匹配
    if (user.researchField === candidate.application.researchField) {
      score += 20;
      matchReasons.push('研究领域相同');
    }

    // 技术与商业互补
    const userIstech = this.isTehnical(user);
    const candidateIsTech = this.isTehnical(candidate.application);
    
    if ((userIstech && !candidateIsTech) || (!userIstech && candidateIsTech)) {
      score += 15;
      matchReasons.push('技术与商业背景互补');
    }

    // 创业方向相关性
    if (this.hasCommonKeywords(
      user.startupDirection || '',
      candidate.application.startupDirection || ''
    )) {
      score += 15;
      matchReasons.push('创业方向有交集');
    }

    return {
      matchScore: Math.min(score, 95),
      matchReasons,
      aiInsights: {
        compatibilityScore: {
          overallScore: score,
          dimensions: {
            roleCompatibility: 70,
            skillComplementarity: 70,
            valueAlignment: 70,
            workStyleMatch: 70,
            goalAlignment: 70
          },
          reasoning: '基础算法匹配（AI服务暂时不可用）',
          recommendedActions: ['建议进行深入交流了解']
        },
        recommendedActions: []
      }
    };
  }

  /**
   * Check if user has technical background
   * 检查用户是否有技术背景
   */
  private isTehnical(application: any): boolean {
    const technicalKeywords = ['技术', '开发', '工程师', '算法', 'cto', '技术总监'];
    const text = `${application.experience || ''} ${application.lookingFor || ''}`.toLowerCase();
    
    return technicalKeywords.some(keyword => text.includes(keyword));
  }

  /**
   * Check if two texts have common keywords
   * 检查两个文本是否有共同关键词
   */
  private hasCommonKeywords(text1: string, text2: string): boolean {
    const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
    
    let commonCount = 0;
    words1.forEach(word => {
      if (words2.has(word)) {
        commonCount++;
      }
    });
    
    return commonCount >= 2;
  }

  /**
   * Get user application
   * 获取用户申请信息
   */
  private async getUserApplication(userId: number): Promise<any> {
    const result = await db
      .select({
        user: users,
        application: cofounderApplications
      })
      .from(users)
      .leftJoin(cofounderApplications, eq(cofounderApplications.userId, users.id))
      .where(
        and(
          eq(users.id, userId),
          eq(cofounderApplications.status, 'approved')
        )
      )
      .limit(1);

    if (!result.length || !result[0].application) {
      return null;
    }

    return {
      ...result[0].user,
      application: result[0].application
    };
  }

  /**
   * Get matching candidates
   * 获取匹配候选人
   */
  private async getCandidates(userId: number): Promise<MatchCandidate[]> {
    // 获取已有的匹配记录
    const existingMatches = await db
      .select({ otherUserId: matches.user2Id })
      .from(matches)
      .where(eq(matches.user1Id, userId));

    const excludeIds = [userId, ...existingMatches.map(m => m.otherUserId)];

    // 获取候选人
    const candidates = await db
      .select({
        user: users,
        application: cofounderApplications
      })
      .from(users)
      .innerJoin(cofounderApplications, eq(cofounderApplications.userId, users.id))
      .where(
        and(
          eq(cofounderApplications.status, 'approved'),
          notInArray(users.id, excludeIds)
        )
      )
      .limit(50);

    return candidates.map(({ user, application }) => ({
      id: user.id,
      fullName: user.fullName || '',
      username: user.username,
      avatarUrl: user.avatarUrl,
      researchField: user.researchField,
      affiliation: user.affiliation,
      bio: user.bio,
      application: {
        id: application.id,
        researchField: application.researchField,
        startupDirection: application.startupDirection,
        experience: application.experience,
        lookingFor: application.lookingFor,
        status: application.status
      },
      matchScore: 0,
      matchReasons: []
    }));
  }

  /**
   * Generate match reason using AI
   * 使用AI生成匹配原因
   */
  async generateMatchReason(matchResult: AIMatchResult): Promise<string> {
    try {
      return await this.aiManager.generateMatchReason(matchResult);
    } catch (error) {
      console.error('Failed to generate AI match reason:', error);
      // 降级方案：使用预定义的原因
      return matchResult.compatibilityScore.recommendedActions.join('，') || 
             '系统推荐的高质量匹配';
    }
  }

  /**
   * Get breaking ice questions
   * 获取破冰问题
   */
  getBreakingIceQuestions(): string[] {
    return [
      "🚀 你最想解决的行业痛点是什么？",
      "💡 分享一个你最自豪的项目或研究成果？",
      "🤝 理想的联合创始人应该具备哪些特质？"
    ];
  }
}

// 导出AI增强版匹配引擎实例
export const aiEnhancedMatchingEngine = new AIEnhancedMatchingEngine();