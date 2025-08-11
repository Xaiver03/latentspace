import { db } from "../db";
import { eq, and, desc, count, avg, sql, gte, inArray, like, or } from "drizzle-orm";
import { 
  events, 
  agentProducts, 
  eventContents, 
  eventRegistrations,
  eventFeedback,
  eventTags,
  users,
  cofounderApplications,
  matchingInteractions
} from "@shared/schema";

export interface ContentItem {
  id: string;
  type: 'event' | 'agent_product' | 'event_content';
  title: string;
  description: string;
  category?: string;
  tags: string[];
  score: number;
  reason: string;
  metadata: Record<string, any>;
}

export interface PersonalizedFeed {
  userId: number;
  trending: ContentItem[];
  recommended: ContentItem[];
  interests: ContentItem[];
  collaborative: ContentItem[];
}

export interface ContentAnalytics {
  totalViews: number;
  engagement: number;
  topCategories: string[];
  trendingTags: string[];
  userPreferences: Record<string, number>;
}

export class ContentRecommendationService {
  
  /**
   * Generate personalized content feed for a user
   */
  async getPersonalizedFeed(userId: number, limit: number = 20): Promise<PersonalizedFeed> {
    // Get user profile and preferences
    const userProfile = await this.getUserProfile(userId);
    const userInteractions = await this.getUserInteractions(userId);
    
    // Generate different content categories
    const [trending, recommended, interests, collaborative] = await Promise.all([
      this.getTrendingContent(limit / 4),
      this.getRecommendedContent(userId, userProfile, limit / 4),
      this.getInterestBasedContent(userId, userProfile, limit / 4),
      this.getCollaborativeContent(userId, userProfile, limit / 4)
    ]);

    return {
      userId,
      trending,
      recommended,
      interests,
      collaborative
    };
  }

  /**
   * Get trending content across the platform
   */
  private async getTrendingContent(limit: number): Promise<ContentItem[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7); // Last 7 days

    // Get trending events
    const trendingEvents = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        category: events.category,
        registrationCount: count(eventRegistrations.id),
        avgRating: avg(eventFeedback.rating)
      })
      .from(events)
      .leftJoin(eventRegistrations, eq(events.id, eventRegistrations.eventId))
      .leftJoin(eventFeedback, eq(events.id, eventFeedback.eventId))
      .where(gte(events.createdAt, cutoffDate))
      .groupBy(events.id)
      .orderBy(desc(count(eventRegistrations.id)))
      .limit(Math.ceil(limit / 2));

    // Get trending agent products
    const trendingProducts = await db
      .select()
      .from(agentProducts)
      .where(gte(agentProducts.createdAt, cutoffDate))
      .orderBy(desc(agentProducts.createdAt))
      .limit(Math.ceil(limit / 2));

    const content: ContentItem[] = [];

    // Process events
    trendingEvents.forEach(event => {
      content.push({
        id: `event-${event.id}`,
        type: 'event',
        title: event.title,
        description: event.description || '',
        category: event.category,
        tags: [], // TODO: Get event tags
        score: Number(event.registrationCount || 0) * 0.7 + Number(event.avgRating || 0) * 0.3,
        reason: '📈 热门活动',
        metadata: {
          registrations: event.registrationCount,
          rating: event.avgRating
        }
      });
    });

    // Process agent products
    trendingProducts.forEach(product => {
      content.push({
        id: `product-${product.id}`,
        type: 'agent_product',
        title: product.name,
        description: product.description,
        category: product.category,
        tags: Array.isArray(product.tags) ? product.tags : [],
        score: Math.random() * 5, // TODO: Implement proper scoring
        reason: '🚀 最新产品',
        metadata: {
          status: product.status,
          demoUrl: product.demoUrl,
          githubUrl: product.githubUrl
        }
      });
    });

    return content
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Get AI-recommended content based on user behavior and profile
   */
  private async getRecommendedContent(userId: number, userProfile: any, limit: number): Promise<ContentItem[]> {
    if (!userProfile) return [];

    // Get content similar to what user has engaged with
    const similarContent = await this.findSimilarContent(userProfile, limit);
    
    return similarContent.map(item => ({
      ...item,
      reason: '🎯 为您推荐',
      score: item.score * 1.2 // Boost recommended content
    }));
  }

  /**
   * Get content based on user's research interests and co-founder application
   */
  private async getInterestBasedContent(userId: number, userProfile: any, limit: number): Promise<ContentItem[]> {
    if (!userProfile?.application) return [];

    const interests = [
      userProfile.application.researchField,
      userProfile.application.startupDirection,
      ...(userProfile.researchField ? [userProfile.researchField] : [])
    ].filter(Boolean);

    if (interests.length === 0) return [];

    // Find events and content related to user interests
    const relatedEvents = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        category: events.category
      })
      .from(events)
      .where(
        or(
          ...interests.map(interest => 
            or(
              like(events.title, `%${interest}%`),
              like(events.description, `%${interest}%`),
              eq(events.category, interest)
            )
          )
        )
      )
      .orderBy(desc(events.createdAt))
      .limit(limit);

    return relatedEvents.map(event => ({
      id: `event-${event.id}`,
      type: 'event' as const,
      title: event.title,
      description: event.description || '',
      category: event.category,
      tags: [],
      score: 4.0,
      reason: '💡 匹配您的兴趣',
      metadata: {}
    }));
  }

  /**
   * Get content from users in similar fields for collaborative discovery
   */
  private async getCollaborativeContent(userId: number, userProfile: any, limit: number): Promise<ContentItem[]> {
    if (!userProfile?.application) return [];

    // Find users with similar profiles
    const similarUsers = await db
      .select({
        userId: cofounderApplications.userId
      })
      .from(cofounderApplications)
      .where(
        and(
          eq(cofounderApplications.researchField, userProfile.application.researchField),
          sql`${cofounderApplications.userId} != ${userId}`
        )
      )
      .limit(20);

    if (similarUsers.length === 0) return [];

    const userIds = similarUsers.map(u => u.userId);

    // Find events created or registered by similar users
    const collaborativeEvents = await db
      .select({
        id: events.id,
        title: events.title,
        description: events.description,
        category: events.category,
        createdBy: events.createdBy
      })
      .from(events)
      .where(
        or(
          inArray(events.createdBy, userIds),
          // Events with registrations from similar users
          sql`EXISTS (
            SELECT 1 FROM ${eventRegistrations} 
            WHERE ${eventRegistrations.eventId} = ${events.id} 
            AND ${eventRegistrations.userId} IN (${userIds.join(',')})
          )`
        )
      )
      .orderBy(desc(events.createdAt))
      .limit(limit);

    return collaborativeEvents.map(event => ({
      id: `event-${event.id}`,
      type: 'event' as const,
      title: event.title,
      description: event.description || '',
      category: event.category,
      tags: [],
      score: 3.5,
      reason: '🤝 同行推荐',
      metadata: {
        createdBy: event.createdBy
      }
    }));
  }

  /**
   * Get content analytics for the platform
   */
  async getContentAnalytics(): Promise<ContentAnalytics> {
    const [viewStats, categoryStats, tagStats] = await Promise.all([
      this.getViewStats(),
      this.getCategoryStats(),
      this.getTagStats()
    ]);

    return {
      totalViews: viewStats.totalViews,
      engagement: viewStats.engagement,
      topCategories: categoryStats,
      trendingTags: tagStats,
      userPreferences: {} // TODO: Implement user preference analysis
    };
  }

  /**
   * Track user interaction with content for recommendation learning
   */
  async trackContentInteraction(
    userId: number, 
    contentType: 'event' | 'agent_product' | 'event_content',
    contentId: number,
    action: 'view' | 'register' | 'like' | 'share',
    metadata?: Record<string, any>
  ): Promise<void> {
    // Store interaction for learning user preferences
    await db.execute(sql`
      INSERT INTO content_interactions (
        user_id,
        content_type,
        content_id,
        action,
        metadata,
        created_at
      ) VALUES (
        ${userId},
        ${contentType},
        ${contentId},
        ${action},
        ${JSON.stringify(metadata || {})},
        NOW()
      )
      ON CONFLICT DO NOTHING
    `);
  }

  private async getUserProfile(userId: number): Promise<any> {
    const profile = await db
      .select()
      .from(users)
      .leftJoin(cofounderApplications, eq(users.id, cofounderApplications.userId))
      .where(eq(users.id, userId))
      .limit(1);

    return profile[0] ? {
      ...profile[0].users,
      application: profile[0].cofounder_applications
    } : null;
  }

  private async getUserInteractions(userId: number): Promise<any[]> {
    return await db
      .select()
      .from(matchingInteractions)
      .where(eq(matchingInteractions.userId, userId))
      .orderBy(desc(matchingInteractions.createdAt))
      .limit(100);
  }

  private async findSimilarContent(userProfile: any, limit: number): Promise<ContentItem[]> {
    // Implement content similarity based on user's past interactions
    // For now, return recent events in user's field
    if (!userProfile?.application?.researchField) return [];

    const similarEvents = await db
      .select()
      .from(events)
      .where(
        or(
          like(events.title, `%${userProfile.application.researchField}%`),
          eq(events.category, userProfile.application.researchField)
        )
      )
      .orderBy(desc(events.createdAt))
      .limit(limit);

    return similarEvents.map(event => ({
      id: `event-${event.id}`,
      type: 'event' as const,
      title: event.title,
      description: event.description || '',
      category: event.category,
      tags: [],
      score: 4.2,
      reason: '基于您的兴趣',
      metadata: {}
    }));
  }

  private async getViewStats() {
    // TODO: Implement view tracking analytics
    return {
      totalViews: 0,
      engagement: 0
    };
  }

  private async getCategoryStats(): Promise<string[]> {
    const categories = await db
      .select({
        category: events.category,
        count: count()
      })
      .from(events)
      .groupBy(events.category)
      .orderBy(desc(count()))
      .limit(10);

    return categories.map(c => c.category);
  }

  private async getTagStats(): Promise<string[]> {
    const tags = await db
      .select({
        tag: eventTags.tag,
        count: count()
      })
      .from(eventTags)
      .groupBy(eventTags.tag)
      .orderBy(desc(count()))
      .limit(15);

    return tags.map(t => t.tag);
  }
}

export const contentRecommendation = new ContentRecommendationService();