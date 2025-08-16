// ================================
// 匹配服务模块
// ================================

import { apiClient } from "../index";
import { MATCHING_ENDPOINTS, AI_MATCHING_ENDPOINTS } from "../endpoints";
import type { 
  MatchFilters, 
  MatchRecommendation, 
  MatchInteraction,
  UserProfileForm 
} from "../types";
import type { 
  Match, 
  UserProfile, 
  AiMatch,
  CofounderApplication 
} from "@shared/index";

// ================================
// 匹配服务类
// ================================

class MatchingService {
  // ================================
  // 基础匹配功能
  // ================================

  /**
   * 获取用户匹配列表
   */
  async getMatches(): Promise<Match[]> {
    return apiClient.get<Match[]>(MATCHING_ENDPOINTS.list);
  }

  /**
   * 获取匹配推荐
   */
  async getRecommendations(limit = 10): Promise<MatchRecommendation[]> {
    return apiClient.get<MatchRecommendation[]>(
      MATCHING_ENDPOINTS.recommendations,
      { limit }
    );
  }

  /**
   * 表达兴趣
   */
  async expressInterest(userId: number): Promise<{ message: string }> {
    return apiClient.post(MATCHING_ENDPOINTS.expressInterest(userId));
  }

  /**
   * 记录交互行为
   */
  async recordInteraction(interaction: MatchInteraction): Promise<{ message: string }> {
    return apiClient.post(
      MATCHING_ENDPOINTS.recordInteraction(interaction.targetUserId),
      {
        action: interaction.action,
        metadata: interaction.metadata,
      }
    );
  }

  /**
   * 提交匹配反馈
   */
  async submitMatchFeedback(
    matchId: number,
    feedback: {
      rating: number;
      didMeet: boolean;
      didContinue: boolean;
      feedbackText?: string;
      notMatchReasons?: string[];
    }
  ): Promise<{ message: string }> {
    return apiClient.post(MATCHING_ENDPOINTS.feedback(matchId), feedback);
  }

  // ================================
  // 增强AI匹配功能
  // ================================

  /**
   * 获取AI增强匹配结果
   */
  async getEnhancedMatches(limit = 10): Promise<AiMatch[]> {
    return apiClient.get<AiMatch[]>(MATCHING_ENDPOINTS.enhanced, { limit });
  }

  /**
   * 获取每日推荐
   */
  async getDailyRecommendation(): Promise<MatchRecommendation | null> {
    const result = await apiClient.get<{ recommendation: MatchRecommendation | null }>(
      MATCHING_ENDPOINTS.dailyRecommendation
    );
    return result.recommendation;
  }

  /**
   * 获取用户匹配档案
   */
  async getUserProfile(): Promise<UserProfile | null> {
    try {
      return await apiClient.get<UserProfile>(AI_MATCHING_ENDPOINTS.profile);
    } catch (error) {
      // 用户可能还没有创建档案
      return null;
    }
  }

  /**
   * 创建或更新用户匹配档案
   */
  async updateUserProfile(profileData: UserProfileForm): Promise<UserProfile> {
    return apiClient.post<UserProfile>(
      AI_MATCHING_ENDPOINTS.profile,
      profileData
    );
  }

  /**
   * 获取匹配偏好设置
   */
  async getMatchingPreferences(): Promise<any> {
    return apiClient.get(AI_MATCHING_ENDPOINTS.preferences);
  }

  /**
   * 更新匹配偏好设置
   */
  async updateMatchingPreferences(preferences: {
    ageRange?: [number, number];
    locationRadius?: number;
    rolePreferences?: string[];
    industryPreferences?: string[];
    experienceLevel?: string[];
    remoteWorkPreference?: string;
    equityExpectationRange?: [number, number];
    weeklyHoursRange?: [number, number];
  }): Promise<{ message: string }> {
    return apiClient.put(AI_MATCHING_ENDPOINTS.preferences, preferences);
  }

  // ================================
  // 破冰和对话功能
  // ================================

  /**
   * 获取破冰问题
   */
  async getIceBreakingQuestions(limit = 3): Promise<{
    questions: Array<{ id: number; question: string; category: string }>;
  }> {
    return apiClient.get(MATCHING_ENDPOINTS.iceBreakers, { limit });
  }

  /**
   * 开始对话（使用破冰问题）
   */
  async startConversation(
    userId: number,
    answers: string[]
  ): Promise<{ message: string; messageId: number }> {
    return apiClient.post(MATCHING_ENDPOINTS.startConversation(userId), {
      answers,
    });
  }

  // ================================
  // 协作空间功能
  // ================================

  /**
   * 创建协作空间
   */
  async createCollaborationSpace(
    matchId: number,
    data: {
      name?: string;
      description?: string;
    }
  ): Promise<any> {
    return apiClient.post(MATCHING_ENDPOINTS.createCollaboration(matchId), data);
  }

  // ================================
  // 联合创始人申请
  // ================================

  /**
   * 提交联合创始人申请
   */
  async submitCofounderApplication(applicationData: {
    roleIntent: string;
    experienceLevel: string;
    skillsOffered: string[];
    skillsNeeded: string[];
    industryExperience: string[];
    startupStage: string;
    commitmentLevel: string;
    equityExpectation?: number;
    workingHours: number;
    locationPreference: string;
    remoteWorkPreference: string;
    previousStartupExperience?: string;
    motivationStatement: string;
    linkedinProfile?: string;
    githubProfile?: string;
    portfolioUrl?: string;
  }): Promise<CofounderApplication> {
    return apiClient.post<CofounderApplication>(
      '/api/cofounder-applications',
      applicationData
    );
  }

  /**
   * 获取我的申请状态
   */
  async getMyApplication(): Promise<CofounderApplication | null> {
    try {
      const applications = await apiClient.get<CofounderApplication[]>(
        '/api/cofounder-applications/my-applications'
      );
      return applications[0] || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * 更新申请信息
   */
  async updateApplication(
    applicationId: number,
    data: Partial<CofounderApplication>
  ): Promise<CofounderApplication> {
    return apiClient.put<CofounderApplication>(
      `/api/cofounder-applications/${applicationId}`,
      data
    );
  }

  // ================================
  // 匹配分析和统计
  // ================================

  /**
   * 获取匹配分析数据
   */
  async getMatchingAnalytics(): Promise<{
    totalMatches: number;
    successfulMatches: number;
    averageResponseTime: number;
    topMatchingFactors: Array<{ factor: string; weight: number }>;
    monthlyMatchTrend: Array<{ month: string; matches: number; success: number }>;
    compatibilityDistribution: Record<string, number>;
  }> {
    return apiClient.get(AI_MATCHING_ENDPOINTS.analytics);
  }

  /**
   * 获取匹配成功率统计
   */
  async getMatchingStats(): Promise<{
    profileCompleteness: number;
    matchSuccessRate: number;
    averageMatchQuality: number;
    responseRate: number;
    recommendations: string[];
  }> {
    return apiClient.get('/api/matching/stats');
  }

  // ================================
  // 搜索和筛选
  // ================================

  /**
   * 搜索潜在匹配用户
   */
  async searchUsers(
    query: string,
    filters: MatchFilters = {}
  ): Promise<MatchRecommendation[]> {
    return apiClient.get<MatchRecommendation[]>('/api/users/search', {
      q: query,
      ...filters,
    });
  }

  /**
   * 按筛选条件获取用户
   */
  async getUsersByFilters(filters: MatchFilters): Promise<MatchRecommendation[]> {
    return apiClient.get<MatchRecommendation[]>('/api/matching/filter', filters);
  }

  // ================================
  // 匹配质量和优化
  // ================================

  /**
   * 获取匹配质量评分
   */
  async getMatchQuality(userId: number): Promise<{
    score: number;
    breakdown: {
      role: number;
      skills: number;
      experience: number;
      location: number;
      commitment: number;
    };
    improvements: string[];
  }> {
    return apiClient.get(`/api/matching/quality/${userId}`);
  }

  /**
   * 提交匹配算法反馈
   */
  async submitAlgorithmFeedback(feedback: {
    matchId: number;
    accuracy: number;
    relevance: number;
    suggestions: string;
  }): Promise<{ message: string }> {
    return apiClient.post('/api/matching/algorithm-feedback', feedback);
  }
}

// ================================
// 导出服务实例
// ================================

export const matchingService = new MatchingService();
export default matchingService;