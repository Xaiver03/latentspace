import { db } from "../db";
import { eq, and, desc, count, avg, sql, gte, lte } from "drizzle-orm";
import { 
  matches, 
  matchFeedback, 
  matchingInteractions, 
  cofounderApplications, 
  users,
  messages 
} from "@shared/schema";

export interface MatchingMetrics {
  totalMatches: number;
  successfulMatches: number;
  averageSuccessRate: number;
  averageResponseTime: number;
  topMatchingFactors: string[];
  userEngagementRate: number;
  conversionToMessaging: number;
}

export interface UserMatchingInsights {
  userId: number;
  profileCompleteness: number;
  matchingActivity: {
    views: number;
    likes: number;
    passes: number;
    messagesInitiated: number;
  };
  successMetrics: {
    matchRate: number;
    responseRate: number;
    conversationRate: number;
  };
  recommendations: string[];
}

export class MatchingAnalyticsService {
  
  /**
   * Get overall matching system metrics
   */
  async getSystemMetrics(timeRange: 'week' | 'month' | 'quarter' = 'month'): Promise<MatchingMetrics> {
    const daysBack = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);

    // Total matches created
    const totalMatches = await db
      .select({ count: count() })
      .from(matches)
      .where(gte(matches.createdAt, cutoffDate));

    // Successful matches (those with positive feedback or ongoing conversations)
    const successfulMatches = await db
      .select({ count: count() })
      .from(matches)
      .innerJoin(matchFeedback, eq(matches.id, matchFeedback.matchId))
      .where(
        and(
          gte(matches.createdAt, cutoffDate),
          gte(matchFeedback.rating, 4) // Consider 4+ star ratings as successful
        )
      );

    // Average response rate to matches
    const messageStats = await db
      .select({
        totalInteractions: count(matchingInteractions.id),
        messagedInteractions: count(
          sql`CASE WHEN ${matchingInteractions.action} = 'messaged' THEN 1 END`
        )
      })
      .from(matchingInteractions)
      .where(gte(matchingInteractions.createdAt, cutoffDate));

    // Get top matching factors from successful matches
    const feedbackData = await db
      .select({
        rating: matchFeedback.rating,
        didMeet: matchFeedback.didMeet,
        didContinue: matchFeedback.didContinue,
        feedbackText: matchFeedback.feedbackText
      })
      .from(matchFeedback)
      .innerJoin(matches, eq(matchFeedback.matchId, matches.id))
      .where(gte(matches.createdAt, cutoffDate));

    const totalMatchesCount = totalMatches[0]?.count || 0;
    const successfulMatchesCount = successfulMatches[0]?.count || 0;
    const messageStatsData = messageStats[0] || { totalInteractions: 0, messagedInteractions: 0 };

    return {
      totalMatches: totalMatchesCount,
      successfulMatches: successfulMatchesCount,
      averageSuccessRate: totalMatchesCount > 0 ? (successfulMatchesCount / totalMatchesCount) * 100 : 0,
      averageResponseTime: 0, // TODO: Calculate from interaction timestamps
      topMatchingFactors: this.extractTopFactors(feedbackData),
      userEngagementRate: messageStatsData.totalInteractions > 0 ? 
        (messageStatsData.messagedInteractions / messageStatsData.totalInteractions) * 100 : 0,
      conversionToMessaging: messageStatsData.totalInteractions > 0 ? 
        (messageStatsData.messagedInteractions / messageStatsData.totalInteractions) * 100 : 0
    };
  }

  /**
   * Get detailed insights for a specific user's matching performance
   */
  async getUserInsights(userId: number): Promise<UserMatchingInsights> {
    // Get user's application for profile completeness
    const userApp = await db
      .select()
      .from(cofounderApplications)
      .where(eq(cofounderApplications.userId, userId))
      .limit(1);

    // Get user's matching activity
    const interactions = await db
      .select({
        action: matchingInteractions.action,
        count: count()
      })
      .from(matchingInteractions)
      .where(eq(matchingInteractions.userId, userId))
      .groupBy(matchingInteractions.action);

    // Get user's matches and their outcomes
    const userMatches = await db
      .select()
      .from(matches)
      .where(
        and(
          eq(matches.user1Id, userId),
          eq(matches.user2Id, userId)
        )
      );

    // Get messages initiated by user
    const messagesInitiated = await db
      .select({ count: count() })
      .from(messages)
      .where(eq(messages.senderId, userId));

    // Calculate profile completeness
    const profileCompleteness = this.calculateProfileCompleteness(userApp[0]);

    // Process interaction data
    const activityMap = interactions.reduce((acc, item) => {
      acc[item.action] = item.count;
      return acc;
    }, {} as Record<string, number>);

    const recommendations = this.generateUserRecommendations(
      profileCompleteness,
      activityMap,
      userMatches.length
    );

    return {
      userId,
      profileCompleteness,
      matchingActivity: {
        views: activityMap.viewed || 0,
        likes: activityMap.liked || 0,
        passes: activityMap.passed || 0,
        messagesInitiated: messagesInitiated[0]?.count || 0,
      },
      successMetrics: {
        matchRate: 0, // TODO: Calculate based on likes vs matches
        responseRate: 0, // TODO: Calculate response rate to messages
        conversationRate: 0, // TODO: Calculate ongoing conversation rate
      },
      recommendations
    };
  }

  /**
   * Track the success of a specific matching algorithm configuration
   */
  async trackAlgorithmPerformance(
    algorithmVersion: string, 
    matchId: number, 
    outcome: 'positive' | 'negative' | 'neutral'
  ): Promise<void> {
    // Store algorithm performance data for continuous improvement
    // This would be used to A/B test different matching algorithms
    
    await db.execute(sql`
      INSERT INTO algorithm_performance (
        algorithm_version,
        match_id,
        outcome,
        recorded_at
      ) VALUES (
        ${algorithmVersion},
        ${matchId},
        ${outcome},
        NOW()
      )
      ON CONFLICT DO NOTHING
    `);
  }

  /**
   * Get recommendations for improving matching algorithm
   */
  async getAlgorithmRecommendations(): Promise<{
    currentPerformance: number;
    recommendedAdjustments: string[];
    testSuggestions: string[];
  }> {
    // Analyze recent matching performance to suggest algorithm improvements
    const recentFeedback = await db
      .select({
        rating: avg(matchFeedback.rating),
        meetRate: avg(
          sql`CASE WHEN ${matchFeedback.didMeet} THEN 1.0 ELSE 0.0 END`
        ),
        continueRate: avg(
          sql`CASE WHEN ${matchFeedback.didContinue} THEN 1.0 ELSE 0.0 END`
        )
      })
      .from(matchFeedback)
      .innerJoin(matches, eq(matchFeedback.matchId, matches.id))
      .where(gte(matches.createdAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)));

    const performance = recentFeedback[0];
    const currentScore = performance ? 
      (Number(performance.rating) * 0.5 + Number(performance.meetRate) * 0.3 + Number(performance.continueRate) * 0.2) * 20 : 0;

    const recommendations = [];
    const testSuggestions = [];

    if (Number(performance?.rating || 0) < 3.5) {
      recommendations.push("Increase weight of complementary skills matching");
      testSuggestions.push("A/B test higher complementarity scoring vs field similarity");
    }

    if (Number(performance?.meetRate || 0) < 0.3) {
      recommendations.push("Improve geographic proximity weighting");
      testSuggestions.push("Test stricter location-based filtering");
    }

    if (Number(performance?.continueRate || 0) < 0.4) {
      recommendations.push("Enhance personality/interest compatibility detection");
      testSuggestions.push("Implement behavioral pattern matching");
    }

    return {
      currentPerformance: currentScore,
      recommendedAdjustments: recommendations,
      testSuggestions
    };
  }

  private extractTopFactors(feedbackData: any[]): string[] {
    // Analyze feedback text to identify most commonly mentioned positive factors
    const factorCounts: Record<string, number> = {};
    
    const commonFactors = [
      '研究领域匹配', '技能互补', '地理位置', '创业阶段', '沟通顺畅', 
      '经验丰富', '目标一致', '时间投入', '资源互补'
    ];

    feedbackData.forEach(feedback => {
      if (feedback.rating >= 4 && feedback.feedbackText) {
        const text = feedback.feedbackText.toLowerCase();
        commonFactors.forEach(factor => {
          if (text.includes(factor)) {
            factorCounts[factor] = (factorCounts[factor] || 0) + 1;
          }
        });
      }
    });

    return Object.entries(factorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([factor]) => factor);
  }

  private calculateProfileCompleteness(application: any): number {
    if (!application) return 0;
    
    let completeness = 0;
    const fields = [
      'researchField', 'startupDirection', 'experience', 'lookingFor', 
      'preferredRole', 'timeCommitment', 'startupStage', 'linkedinUrl', 
      'videoIntroUrl', 'keyAccomplishments'
    ];

    fields.forEach(field => {
      if (application[field] && application[field].trim().length > 0) {
        completeness += 10;
      }
    });

    return Math.min(completeness, 100);
  }

  private generateUserRecommendations(
    profileCompleteness: number, 
    activity: Record<string, number>, 
    matchCount: number
  ): string[] {
    const recommendations = [];

    if (profileCompleteness < 70) {
      recommendations.push("完善个人资料以获得更准确的匹配推荐");
    }

    if ((activity.viewed || 0) > 20 && (activity.liked || 0) < 2) {
      recommendations.push("适当降低匹配标准，增加互动机会");
    }

    if ((activity.liked || 0) > 10 && matchCount < 2) {
      recommendations.push("优化个人简介和视频介绍以提高回应率");
    }

    if ((activity.messagesInitiated || 0) < 1) {
      recommendations.push("主动发起对话，使用破冰问答功能");
    }

    return recommendations;
  }
}

export const matchingAnalytics = new MatchingAnalyticsService();