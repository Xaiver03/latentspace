import { db } from "../db";
import { storage } from "../storage";
import { users, cofounderApplications, matches, matchingInteractions } from "@shared/schema";
import { eq, and, ne, notInArray, sql, desc } from "drizzle-orm";
import type { MatchCandidate, MatchResult } from "./matching-engine";

export interface EnhancedMatchCandidate extends MatchCandidate {
  interactionScore: number;
  verificationStatus: boolean;
  detailedProfile: {
    linkedinUrl?: string;
    videoIntroUrl?: string;
    accomplishments?: string;
    education?: any[];
    employment?: any[];
    isTechnical: boolean;
    preferredLocation?: string;
    timeCommitment?: string;
  };
}

export class EnhancedMatchingEngine {
  // Enhanced field similarity with more sophisticated analysis
  private calculateFieldSimilarity(field1: string, field2: string): number {
    if (!field1 || !field2) return 0;
    
    const f1 = field1.toLowerCase();
    const f2 = field2.toLowerCase();
    
    // Exact match
    if (f1 === f2) return 1.0;
    
    // Enhanced field relationships with more categories
    const fieldGroups = {
      'ai_ml': ['人工智能', '机器学习', '深度学习', '自然语言处理', '计算机视觉', 'ai', 'ml', 'nlp', 'cv', '大模型', 'llm'],
      'biotech': ['生物技术', '生物信息学', '医疗科技', '生物医药', '基因', '制药'],
      'quantum': ['量子计算', '量子通信', '量子物理', '量子技术'],
      'blockchain': ['区块链', '加密货币', '分布式系统', 'web3', 'defi', 'crypto'],
      'data': ['数据科学', '大数据', '数据分析', '统计学', '数据挖掘'],
      'robotics': ['机器人', '自动化', '控制系统', '嵌入式系统'],
      'fintech': ['金融科技', '支付', '银行科技', '保险科技'],
      'edtech': ['教育科技', '在线教育', 'mooc', '知识付费'],
      'cleantech': ['清洁技术', '新能源', '环保科技', '碳中和'],
    };
    
    // Check if fields are in same group
    for (const group of Object.values(fieldGroups)) {
      const group1Has = group.some(keyword => f1.includes(keyword));
      const group2Has = group.some(keyword => f2.includes(keyword));
      if (group1Has && group2Has) {
        return 0.85;
      }
    }
    
    // Check for partial keyword matches
    const keywords1 = f1.split(/[,，\s]+/);
    const keywords2 = f2.split(/[,，\s]+/);
    const commonKeywords = keywords1.filter(k => keywords2.some(k2 => k2.includes(k) || k.includes(k2)));
    
    if (commonKeywords.length > 0) {
      return 0.5 + (commonKeywords.length / Math.max(keywords1.length, keywords2.length)) * 0.3;
    }
    
    return 0.1;
  }

  // Enhanced complementarity calculation with more factors
  private calculateEnhancedComplementarity(user1: any, user2: any): { score: number; reasons: string[] } {
    let score = 0;
    const reasons: string[] = [];

    // Role complementarity (enhanced)
    const technicalKeywords = ['技术', '开发', '工程师', '算法', '编程', 'cto', '技术总监', '架构师', '全栈'];
    const businessKeywords = ['商业', '市场', '运营', '产品', '销售', 'ceo', '商务', 'bd', '战略'];
    const designKeywords = ['设计', '用户体验', 'ui', 'ux', '产品设计', '交互', '视觉'];
    const dataKeywords = ['数据', '分析师', '数据科学', 'bi', '数据分析'];

    const user1Profile = `${user1.application.experience || ''} ${user1.application.lookingFor || ''}`.toLowerCase();
    const user2Profile = `${user2.application.experience || ''} ${user2.application.lookingFor || ''}`.toLowerCase();

    const roles1 = {
      tech: technicalKeywords.some(k => user1Profile.includes(k)) || user1.application.isTechnical,
      biz: businessKeywords.some(k => user1Profile.includes(k)),
      design: designKeywords.some(k => user1Profile.includes(k)),
      data: dataKeywords.some(k => user1Profile.includes(k))
    };

    const roles2 = {
      tech: technicalKeywords.some(k => user2Profile.includes(k)) || user2.application.isTechnical,
      biz: businessKeywords.some(k => user2Profile.includes(k)),
      design: designKeywords.some(k => user2Profile.includes(k)),
      data: dataKeywords.some(k => user2Profile.includes(k))
    };

    // Perfect complementarity scoring
    if (roles1.tech && roles2.biz) {
      score += 0.45;
      reasons.push('技术 + 商业背景完美互补');
    } else if (roles1.biz && roles2.tech) {
      score += 0.45;
      reasons.push('商业 + 技术背景完美互补');
    } else if ((roles1.tech && roles2.design) || (roles1.design && roles2.tech)) {
      score += 0.35;
      reasons.push('技术与设计背景互补');
    } else if ((roles1.data && (roles2.biz || roles2.tech)) || (roles2.data && (roles1.biz || roles1.tech))) {
      score += 0.3;
      reasons.push('数据分析能力补充团队');
    }

    // Time commitment compatibility
    if (user1.application.timeCommitment && user2.application.timeCommitment) {
      if (user1.application.timeCommitment === user2.application.timeCommitment) {
        score += 0.15;
        reasons.push('时间投入一致');
      } else if (
        (user1.application.timeCommitment === 'full-time' && user2.application.timeCommitment === 'part-time') ||
        (user2.application.timeCommitment === 'full-time' && user1.application.timeCommitment === 'part-time')
      ) {
        score += 0.05;
        reasons.push('时间投入可协调');
      }
    }

    return { score: Math.min(score, 1.0), reasons };
  }

  // Calculate interaction-based affinity
  private async calculateInteractionAffinity(userId: number, targetUserId: number): Promise<number> {
    const interactions = await storage.getInteractionsBetween(userId, targetUserId);
    
    let score = 0;
    for (const interaction of interactions) {
      switch (interaction.action) {
        case 'viewed':
          score += 0.05;
          break;
        case 'liked':
          score += 0.2;
          break;
        case 'messaged':
          score += 0.3;
          break;
        case 'passed':
          score -= 0.5;
          break;
      }
    }
    
    return Math.max(0, Math.min(1, score));
  }

  // Get recommended matches with enhanced algorithm
  public async getEnhancedMatches(userId: number, limit: number = 10): Promise<EnhancedMatchCandidate[]> {
    // Get user's application
    const userApp = await storage.getUserCofounderApplication(userId);
    if (!userApp || userApp.status !== 'approved') {
      return [];
    }

    // Get user details
    const user = await storage.getUser(userId);
    if (!user) return [];

    // Get all approved applications except user's own
    const candidateApps = await db
      .select({
        users: users,
        cofounder_applications: cofounderApplications
      })
      .from(cofounderApplications)
      .innerJoin(users, eq(users.id, cofounderApplications.userId))
      .where(
        and(
          eq(cofounderApplications.status, 'approved'),
          ne(cofounderApplications.userId, userId),
          eq(cofounderApplications.isVerified, true) // Only verified users
        )
      );

    // Calculate scores for each candidate
    const scoredCandidates: EnhancedMatchCandidate[] = [];
    
    for (const candidate of candidateApps) {
      const candidateUser = candidate.users;
      const candidateApp = candidate.cofounder_applications;

      // Base scoring components
      const fieldSimilarity = this.calculateFieldSimilarity(
        userApp.researchField,
        candidateApp.researchField
      );
      
      const complementarity = this.calculateEnhancedComplementarity(
        { application: userApp, ...user },
        { application: candidateApp, ...candidateUser }
      );
      
      const stageCompatibility = this.calculateStageCompatibility(
        userApp.startupStage || 'idea',
        candidateApp.startupStage || 'idea'
      );
      
      const locationBonus = this.calculateLocationBonus(
        userApp.preferredLocation || undefined,
        candidateApp.preferredLocation || undefined
      );
      
      // Get interaction-based affinity
      const interactionAffinity = await this.calculateInteractionAffinity(userId, candidateUser.id);
      
      // Calculate final score with weighted components
      const totalScore = 
        fieldSimilarity * 0.2 +
        complementarity.score * 0.35 +
        stageCompatibility * 0.15 +
        locationBonus * 0.1 +
        interactionAffinity * 0.2;

      // Build match reasons
      const matchReasons: string[] = [];
      if (fieldSimilarity > 0.7) matchReasons.push(`研究领域高度相关 (${candidateApp.researchField})`);
      matchReasons.push(...complementarity.reasons);
      if (stageCompatibility > 0.8) matchReasons.push('创业阶段一致');
      if (locationBonus > 0.5) matchReasons.push('地理位置匹配');
      if (candidateApp.isVerified) matchReasons.push('已认证用户');

      scoredCandidates.push({
        id: candidateUser.id,
        fullName: candidateUser.fullName,
        username: candidateUser.username,
        avatarUrl: candidateUser.avatarUrl || undefined,
        researchField: candidateUser.researchField || undefined,
        affiliation: candidateUser.affiliation || undefined,
        bio: candidateUser.bio || undefined,
        application: {
          id: candidateApp.id,
          researchField: candidateApp.researchField,
          startupDirection: candidateApp.startupDirection,
          experience: candidateApp.experience || undefined,
          lookingFor: candidateApp.lookingFor || undefined,
          status: candidateApp.status,
        },
        matchScore: totalScore,
        matchReasons,
        interactionScore: interactionAffinity,
        verificationStatus: candidateApp.isVerified || false,
        detailedProfile: {
          linkedinUrl: candidateApp.linkedinUrl || undefined,
          videoIntroUrl: candidateApp.videoIntroUrl || undefined,
          accomplishments: candidateApp.accomplishments || undefined,
          education: candidateApp.education as any[] || undefined,
          employment: candidateApp.employment as any[] || undefined,
          isTechnical: candidateApp.isTechnical || false,
          preferredLocation: candidateApp.preferredLocation || undefined,
          timeCommitment: candidateApp.timeCommitment || undefined,
        }
      });
    }

    // Sort by score and apply diversity
    scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);
    
    // Apply diversity: don't show only tech or only business people
    const diversifiedCandidates = this.applyDiversity(scoredCandidates);
    
    return diversifiedCandidates.slice(0, limit);
  }

  // Apply diversity to recommendations
  private applyDiversity(candidates: EnhancedMatchCandidate[]): EnhancedMatchCandidate[] {
    if (candidates.length <= 3) return candidates;
    
    const result: EnhancedMatchCandidate[] = [];
    const used = new Set<number>();
    
    // First, add top 3 by score
    for (let i = 0; i < Math.min(3, candidates.length); i++) {
      result.push(candidates[i]);
      used.add(i);
    }
    
    // Then add diverse candidates
    const remaining = candidates.filter((_, i) => !used.has(i));
    
    // Try to add someone with different field
    const differentField = remaining.find(c => 
      !result.some(r => r.application.researchField === c.application.researchField)
    );
    if (differentField) {
      result.push(differentField);
    }
    
    // Try to add someone with video intro
    const withVideo = remaining.find(c => c.detailedProfile.videoIntroUrl && !result.includes(c));
    if (withVideo) {
      result.push(withVideo);
    }
    
    // Fill remaining spots
    for (const candidate of remaining) {
      if (!result.includes(candidate) && result.length < 10) {
        result.push(candidate);
      }
    }
    
    return result;
  }

  // Calculate stage compatibility
  private calculateStageCompatibility(stage1: string, stage2: string): number {
    const stageOrder: { [key: string]: number } = {
      'idea': 1,
      'prototype': 2,
      'mvp': 3,
      'scaling': 4
    };

    const s1 = stageOrder[stage1] || 1;
    const s2 = stageOrder[stage2] || 1;

    if (s1 === s2) return 1.0;
    if (Math.abs(s1 - s2) === 1) return 0.7;
    if (Math.abs(s1 - s2) === 2) return 0.3;
    return 0.1;
  }

  // Enhanced location matching
  private calculateLocationBonus(loc1?: string, loc2?: string): number {
    if (!loc1 || !loc2) return 0;
    
    const l1 = loc1.toLowerCase();
    const l2 = loc2.toLowerCase();
    
    // Exact match
    if (l1 === l2) return 1.0;
    
    // Same city groups
    const cityGroups = {
      'beijing': ['北京', 'beijing', 'bj', '海淀', '朝阳', '中关村'],
      'shanghai': ['上海', 'shanghai', 'sh', '浦东', '徐汇'],
      'shenzhen': ['深圳', 'shenzhen', 'sz', '南山', '福田'],
      'hangzhou': ['杭州', 'hangzhou', 'hz', '西湖', '滨江'],
      'guangzhou': ['广州', 'guangzhou', 'gz', '天河', '越秀'],
    };
    
    for (const group of Object.values(cityGroups)) {
      if (group.some(g => l1.includes(g)) && group.some(g => l2.includes(g))) {
        return 0.8;
      }
    }
    
    // Same country
    if ((l1.includes('中国') || l1.includes('china')) && 
        (l2.includes('中国') || l2.includes('china'))) {
      return 0.3;
    }
    
    return 0.1;
  }

  // Get daily recommended match (random from top matches)
  public async getDailyRecommendation(userId: number): Promise<EnhancedMatchCandidate | null> {
    const topMatches = await this.getEnhancedMatches(userId, 5);
    if (topMatches.length === 0) return null;
    
    // Get today's seed based on date
    const today = new Date().toISOString().split('T')[0];
    const seed = userId + today.replace(/-/g, '');
    const index = parseInt(seed) % topMatches.length;
    
    return topMatches[index];
  }
}

export const enhancedMatchingEngine = new EnhancedMatchingEngine();