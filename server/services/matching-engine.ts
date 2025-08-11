import { db } from "../db";
import { users, cofounderApplications, matches } from "@shared/schema";
import { eq, and, ne, notInArray, sql } from "drizzle-orm";

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
}

export interface MatchResult {
  candidate: MatchCandidate;
  score: number;
  explanation: string[];
}

export class MatchingEngine {
  /**
   * Calculate similarity between two research fields
   */
  private calculateFieldSimilarity(field1: string, field2: string): number {
    if (!field1 || !field2) return 0;
    
    // Exact match
    if (field1.toLowerCase() === field2.toLowerCase()) return 1.0;
    
    // Define field relationships
    const fieldGroups = {
      'ai': ['人工智能', '机器学习', '深度学习', '自然语言处理', '计算机视觉'],
      'biotech': ['生物技术', '生物信息学', '医疗科技'],
      'quantum': ['量子计算', '量子通信', '量子物理'],
      'blockchain': ['区块链', '加密货币', '分布式系统'],
      'data': ['数据科学', '大数据', '数据分析', '统计学'],
    };
    
    // Check if fields are in same group
    for (const group of Object.values(fieldGroups)) {
      if (group.includes(field1) && group.includes(field2)) {
        return 0.8;
      }
    }
    
    // Partial text similarity
    const commonWords = field1.split('').filter(char => field2.includes(char));
    return commonWords.length / Math.max(field1.length, field2.length) * 0.3;
  }

  /**
   * Calculate complementarity score between two users' skills/roles
   */
  private calculateComplementarity(user1: any, user2: any): number {
    let score = 0;
    const reasons: string[] = [];

    // Technical vs Business complementarity
    const user1LookingFor = user1.application.lookingFor?.toLowerCase() || '';
    const user2LookingFor = user2.application.lookingFor?.toLowerCase() || '';
    const user1Experience = user1.application.experience?.toLowerCase() || '';
    const user2Experience = user2.application.experience?.toLowerCase() || '';

    // Technical + Business combination
    const technicalKeywords = ['技术', '开发', '工程师', '算法', '编程', 'cto', '技术总监'];
    const businessKeywords = ['商业', '市场', '运营', '产品', '销售', 'ceo', '商务'];
    const designKeywords = ['设计', '用户体验', 'ui', 'ux', '产品设计'];

    const user1IsTech = technicalKeywords.some(k => user1Experience.includes(k) || user1LookingFor.includes(k));
    const user1IsBiz = businessKeywords.some(k => user1Experience.includes(k) || user1LookingFor.includes(k));
    const user1IsDesign = designKeywords.some(k => user1Experience.includes(k) || user1LookingFor.includes(k));

    const user2IsTech = technicalKeywords.some(k => user2Experience.includes(k) || user2LookingFor.includes(k));
    const user2IsBiz = businessKeywords.some(k => user2Experience.includes(k) || user2LookingFor.includes(k));
    const user2IsDesign = designKeywords.some(k => user2Experience.includes(k) || user2LookingFor.includes(k));

    // Perfect complementarity: Tech + Business
    if ((user1IsTech && user2IsBiz) || (user1IsBiz && user2IsTech)) {
      score += 0.4;
      reasons.push('技术与商业背景互补');
    }

    // Good complementarity: Adding design
    if ((user1IsDesign && (user2IsTech || user2IsBiz)) || (user2IsDesign && (user1IsTech || user1IsBiz))) {
      score += 0.2;
      reasons.push('设计与技术/商业背景互补');
    }

    // Experience level complementarity
    const seniorKeywords = ['创始人', '总监', 'director', 'founder', '十年', '资深'];
    const juniorKeywords = ['应届', '新手', '学生', '实习'];

    const user1IsSenior = seniorKeywords.some(k => user1Experience.includes(k));
    const user2IsSenior = seniorKeywords.some(k => user2Experience.includes(k));
    const user1IsJunior = juniorKeywords.some(k => user1Experience.includes(k));
    const user2IsJunior = juniorKeywords.some(k => user2Experience.includes(k));

    if ((user1IsSenior && user2IsJunior) || (user1IsJunior && user2IsSenior)) {
      score += 0.15;
      reasons.push('经验层次互补');
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate startup stage compatibility
   */
  private calculateStageCompatibility(stage1: string, stage2: string): number {
    const stageOrder = {
      'idea': 1,
      'prototype': 2, 
      'mvp': 3,
      'scaling': 4
    };

    const s1 = stageOrder[stage1 as keyof typeof stageOrder] || 1;
    const s2 = stageOrder[stage2 as keyof typeof stageOrder] || 1;

    // Same stage is perfect
    if (s1 === s2) return 1.0;
    
    // Adjacent stages are good
    if (Math.abs(s1 - s2) === 1) return 0.8;
    
    // Far apart stages are less compatible
    if (Math.abs(s1 - s2) === 2) return 0.4;
    
    return 0.1;
  }

  /**
   * Calculate location bonus (for now, just check if both have location data)
   */
  private calculateLocationBonus(user1: any, user2: any): number {
    // Simple implementation - just check if both have affiliation
    if (user1.affiliation && user2.affiliation) {
      // Same city/region gets bonus
      if (user1.affiliation.includes('北京') && user2.affiliation.includes('北京')) return 0.8;
      if (user1.affiliation.includes('上海') && user2.affiliation.includes('上海')) return 0.8;
      if (user1.affiliation.includes('深圳') && user2.affiliation.includes('深圳')) return 0.8;
      if (user1.affiliation.includes('杭州') && user2.affiliation.includes('杭州')) return 0.8;
      
      // Same type of institution
      if ((user1.affiliation.includes('大学') || user1.affiliation.includes('学院')) && 
          (user2.affiliation.includes('大学') || user2.affiliation.includes('学院'))) {
        return 0.4;
      }
      
      return 0.2; // Both have location info
    }
    
    return 0;
  }

  /**
   * Calculate overall match score between two users
   */
  public calculateMatchScore(user1: any, user2: any): { score: number; reasons: string[] } {
    const reasons: string[] = [];
    let totalScore = 0;

    // 1. Research field similarity (25%)
    const fieldSimilarity = this.calculateFieldSimilarity(
      user1.application.researchField,
      user2.application.researchField
    );
    totalScore += fieldSimilarity * 0.25;
    
    if (fieldSimilarity > 0.7) {
      reasons.push(`研究领域高度匹配 (${user1.application.researchField})`);
    } else if (fieldSimilarity > 0.4) {
      reasons.push('研究领域相关');
    }

    // 2. Skills complementarity (40%)
    const complementarity = this.calculateComplementarity(user1, user2);
    totalScore += complementarity * 0.40;
    
    if (complementarity > 0.3) {
      reasons.push('技能背景互补性强');
    }

    // 3. Startup stage compatibility (20%)
    const stageCompat = this.calculateStageCompatibility(
      user1.application.startupStage || 'idea',
      user2.application.startupStage || 'idea'
    );
    totalScore += stageCompat * 0.20;
    
    if (stageCompat > 0.8) {
      reasons.push('创业阶段匹配');
    }

    // 4. Location bonus (10%)
    const locationBonus = this.calculateLocationBonus(user1, user2);
    totalScore += locationBonus * 0.10;
    
    if (locationBonus > 0.5) {
      reasons.push('地理位置接近');
    }

    // 5. Bio/description similarity bonus (5%)
    if (user1.bio && user2.bio) {
      const bioKeywords1 = user1.bio.toLowerCase().split(/\s+/);
      const bioKeywords2 = user2.bio.toLowerCase().split(/\s+/);
      const commonKeywords = bioKeywords1.filter(word => 
        bioKeywords2.some(w2 => w2.includes(word) || word.includes(w2))
      );
      
      if (commonKeywords.length > 2) {
        totalScore += 0.05;
        reasons.push('相似的兴趣领域');
      }
    }

    return {
      score: Math.min(Math.max(totalScore, 0), 1),
      reasons
    };
  }

  /**
   * Generate match recommendations for a user
   */
  public async generateRecommendations(userId: number, limit: number = 10): Promise<MatchResult[]> {
    // Get user's application
    const [userApplication] = await db
      .select()
      .from(cofounderApplications)
      .innerJoin(users, eq(cofounderApplications.userId, users.id))
      .where(and(
        eq(cofounderApplications.userId, userId),
        eq(cofounderApplications.status, 'approved')
      ));

    if (!userApplication) {
      throw new Error('User application not found or not approved');
    }

    // Get existing matches to avoid duplicates
    const existingMatches = await db
      .select({ matchedUserId: matches.user2Id })
      .from(matches)
      .where(eq(matches.user1Id, userId));

    const existingMatchIds = existingMatches.map(m => m.matchedUserId);

    // Get potential matches (approved applications, excluding self and existing matches)
    const potentialMatches = await db
      .select()
      .from(cofounderApplications)
      .innerJoin(users, eq(cofounderApplications.userId, users.id))
      .where(and(
        eq(cofounderApplications.status, 'approved'),
        ne(cofounderApplications.userId, userId),
        existingMatchIds.length > 0 
          ? notInArray(cofounderApplications.userId, existingMatchIds)
          : sql`true`
      ));

    // Calculate scores for each potential match
    const scoredMatches: MatchResult[] = [];
    
    for (const match of potentialMatches) {
      const { score, reasons } = this.calculateMatchScore(
        {
          ...userApplication.users,
          application: userApplication.cofounderApplications
        },
        {
          ...match.users,
          application: match.cofounderApplications
        }
      );

      if (score > 0.1) { // Only include matches with meaningful scores
        scoredMatches.push({
          candidate: {
            id: match.users.id,
            fullName: match.users.fullName,
            username: match.users.username,
            avatarUrl: match.users.avatarUrl,
            researchField: match.users.researchField,
            affiliation: match.users.affiliation,
            bio: match.users.bio,
            application: {
              id: match.cofounderApplications.id,
              researchField: match.cofounderApplications.researchField,
              startupDirection: match.cofounderApplications.startupDirection,
              experience: match.cofounderApplications.experience,
              lookingFor: match.cofounderApplications.lookingFor,
              status: match.cofounderApplications.status,
            },
            matchScore: score,
            matchReasons: reasons,
          },
          score,
          explanation: reasons,
        });
      }
    }

    // Sort by score and return top matches
    return scoredMatches
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Create a match between two users
   */
  public async createMatch(user1Id: number, user2Id: number): Promise<void> {
    // Calculate match score for storage
    const [user1Data] = await db
      .select()
      .from(cofounderApplications)
      .innerJoin(users, eq(cofounderApplications.userId, users.id))
      .where(eq(cofounderApplications.userId, user1Id));

    const [user2Data] = await db
      .select()
      .from(cofounderApplications)
      .innerJoin(users, eq(cofounderApplications.userId, users.id))
      .where(eq(cofounderApplications.userId, user2Id));

    if (!user1Data || !user2Data) {
      throw new Error('User application data not found');
    }

    const { score } = this.calculateMatchScore(
      { ...user1Data.users, application: user1Data.cofounderApplications },
      { ...user2Data.users, application: user2Data.cofounderApplications }
    );

    // Store the match
    await db.insert(matches).values({
      user1Id,
      user2Id,
      matchScore: Math.round(score * 100), // Store as percentage
      status: 'pending'
    });
  }

  /**
   * Get breaking ice questions for matched users
   */
  public getBreakingIceQuestions(): string[] {
    const questions = [
      "你觉得合伙人之间最重要的是什么？",
      "过去做项目时最骄傲的一次决策是？", 
      "对未来创业方向有明确预期吗？",
      "你认为什么样的团队文化最有助于创新？",
      "在技术选择上，你更倾向于稳定还是前沿？",
      "你如何平衡产品完美主义和快速迭代？",
      "创业过程中遇到分歧时，你倾向于如何解决？",
      "你认为最重要的创业品质是什么？",
      "对于股权分配，你有什么想法？",
      "你希望创业团队的工作节奏是怎样的？"
    ];

    // Return 3 random questions
    const shuffled = questions.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
  }
}

export const matchingEngine = new MatchingEngine();