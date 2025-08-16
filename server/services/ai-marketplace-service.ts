import { db } from "../db";
import { 
  aiAgents,
  agentReviews,
  agentCollections,
  agentUsageAnalytics,
  agentBookmarks,
  agentRecommendations,
  type AiAgent,
  type InsertAiAgent,
  type AgentReview,
  type InsertAgentReview,
  type AgentCollection,
  type InsertAgentCollection,
  type InsertUsageAnalytics,
  type InsertAgentBookmark,
} from "@shared/ai-marketplace-schema";
import { users } from "@shared/schema";
import { eq, and, or, desc, asc, sql, inArray, gte, lte, ilike, count } from "drizzle-orm";
import { embeddingService } from "./embedding-service";

export interface AgentWithDetails extends AiAgent {
  creator: {
    id: number;
    fullName: string;
    avatarUrl?: string;
  };
  reviewStats: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  };
  isBookmarked?: boolean;
  similarAgents?: AiAgent[];
}

export interface AgentSearchFilters {
  category?: string;
  subcategory?: string;
  pricingModel?: string[];
  priceRange?: string[];
  platforms?: string[];
  rating?: number; // minimum rating
  features?: string[];
  verified?: boolean;
  sortBy?: 'popularity' | 'rating' | 'newest' | 'name';
  semanticSearch?: boolean;
}

export interface MarketplaceStats {
  totalAgents: number;
  totalReviews: number;
  averageRating: number;
  categoryStats: { category: string; count: number }[];
  popularAgents: AiAgent[];
  trendingAgents: AiAgent[];
  recentlyAdded: AiAgent[];
}

export class AiMarketplaceService {

  // ===== AGENT MANAGEMENT =====

  async createAgent(data: InsertAiAgent, createdById: number): Promise<AgentWithDetails> {
    // Generate embedding for the agent
    const textForEmbedding = `${data.name} ${data.description} ${data.keyFeatures?.join(' ')} ${data.useCases?.join(' ')} ${data.tags?.join(' ')}`;
    const embeddingResult = await embeddingService.generateSearchEmbedding(textForEmbedding);
    
    const [agent] = await db
      .insert(aiAgents)
      .values({
        ...data,
        createdById,
        embedding: embeddingResult,
        status: 'pending_review', // New agents need review
      })
      .returning();

    return this.getAgentWithDetails(agent.id);
  }

  async getAgentWithDetails(agentId: number, userId?: number): Promise<AgentWithDetails> {
    const [agent] = await db
      .select()
      .from(aiAgents)
      .where(eq(aiAgents.id, agentId))
      .limit(1);

    if (!agent) {
      throw new Error("Agent not found");
    }

    // Get creator details
    const [creator] = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, agent.createdById))
      .limit(1);

    // Convert null to undefined for type consistency
    const creatorWithCorrectTypes = creator ? {
      ...creator,
      avatarUrl: creator.avatarUrl || undefined
    } : null;

    // Get review statistics
    const reviewStats = await this.getAgentReviewStats(agentId);

    // Check if bookmarked (if user provided)
    let isBookmarked = false;
    if (userId) {
      const [bookmark] = await db
        .select()
        .from(agentBookmarks)
        .where(and(
          eq(agentBookmarks.userId, userId),
          eq(agentBookmarks.agentId, agentId)
        ))
        .limit(1);
      isBookmarked = !!bookmark;
    }

    // Get similar agents
    const similarAgents = await this.getSimilarAgents(agentId, 5);

    if (!creatorWithCorrectTypes) {
      throw new Error("Creator not found");
    }

    return {
      ...agent,
      creator: creatorWithCorrectTypes,
      reviewStats,
      isBookmarked,
      similarAgents,
    };
  }

  async searchAgents(
    query: string,
    filters: AgentSearchFilters = {},
    page: number = 1,
    limit: number = 20,
    userId?: number
  ): Promise<{ agents: AgentWithDetails[]; totalCount: number }> {
    let dbQuery = db.select().from(aiAgents);
    
    const conditions = [eq(aiAgents.status, 'active')];

    // Text search
    if (query.trim()) {
      if (filters.semanticSearch) {
        // Semantic search using embeddings
        const embeddingResult = await embeddingService.generateSearchEmbedding(query);
        conditions.push(
          sql`${aiAgents.embedding} <-> ${embeddingResult} < 0.8`
        );
      } else {
        // Traditional text search
        conditions.push(
          or(
            ilike(aiAgents.name, `%${query}%`),
            ilike(aiAgents.description, `%${query}%`),
            sql`${query} = ANY(${aiAgents.tags})`
          )!
        );
      }
    }

    // Apply filters
    if (filters.category) {
      conditions.push(eq(aiAgents.category, filters.category));
    }

    if (filters.subcategory) {
      conditions.push(eq(aiAgents.subcategory, filters.subcategory));
    }

    if (filters.pricingModel?.length) {
      conditions.push(inArray(aiAgents.pricingModel, filters.pricingModel));
    }

    if (filters.verified !== undefined) {
      conditions.push(eq(aiAgents.verified, filters.verified));
    }

    if (filters.rating) {
      conditions.push(gte(aiAgents.rating, filters.rating.toString()));
    }

    if (filters.platforms?.length) {
      conditions.push(
        sql`${aiAgents.platforms} && ${filters.platforms}`
      );
    }

    // Apply conditions
    dbQuery = dbQuery.where(and(...conditions));

    // Sorting
    switch (filters.sortBy) {
      case 'popularity':
        dbQuery = dbQuery.orderBy(desc(aiAgents.popularityScore), desc(aiAgents.usageCount));
        break;
      case 'rating':
        dbQuery = dbQuery.orderBy(desc(aiAgents.rating), desc(aiAgents.reviewCount));
        break;
      case 'newest':
        dbQuery = dbQuery.orderBy(desc(aiAgents.createdAt));
        break;
      case 'name':
        dbQuery = dbQuery.orderBy(asc(aiAgents.name));
        break;
      default:
        // Default: featured first, then by popularity
        dbQuery = dbQuery.orderBy(desc(aiAgents.featured), desc(aiAgents.popularityScore));
    }

    // Get total count
    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(aiAgents)
      .where(and(...conditions));

    // Apply pagination
    const agents = await dbQuery
      .limit(limit)
      .offset((page - 1) * limit);

    // Get detailed information for each agent
    const agentsWithDetails = await Promise.all(
      agents.map(agent => this.getAgentWithDetails(agent.id, userId))
    );

    return {
      agents: agentsWithDetails,
      totalCount: totalCount || 0,
    };
  }

  async getAgentsByCategory(category: string, limit: number = 10): Promise<AiAgent[]> {
    return db
      .select()
      .from(aiAgents)
      .where(and(
        eq(aiAgents.category, category),
        eq(aiAgents.status, 'active')
      ))
      .orderBy(desc(aiAgents.popularityScore))
      .limit(limit);
  }

  async getFeaturedAgents(limit: number = 10): Promise<AiAgent[]> {
    return db
      .select()
      .from(aiAgents)
      .where(and(
        eq(aiAgents.featured, true),
        eq(aiAgents.status, 'active')
      ))
      .orderBy(desc(aiAgents.popularityScore))
      .limit(limit);
  }

  async getTrendingAgents(limit: number = 10): Promise<AiAgent[]> {
    // Calculate trending based on recent usage and popularity
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const trendingQuery = await db
      .select({
        agent: aiAgents,
        recentUsage: count(agentUsageAnalytics.id),
      })
      .from(aiAgents)
      .leftJoin(agentUsageAnalytics, eq(aiAgents.id, agentUsageAnalytics.agentId))
      .where(and(
        eq(aiAgents.status, 'active'),
        gte(agentUsageAnalytics.timestamp, sevenDaysAgo)
      ))
      .groupBy(aiAgents.id)
      .orderBy(desc(sql`count(${agentUsageAnalytics.id})`), desc(aiAgents.popularityScore))
      .limit(limit);

    return trendingQuery.map(item => item.agent);
  }

  async getSimilarAgents(agentId: number, limit: number = 5): Promise<AiAgent[]> {
    const [targetAgent] = await db
      .select()
      .from(aiAgents)
      .where(eq(aiAgents.id, agentId))
      .limit(1);

    if (!targetAgent || !targetAgent.embedding) {
      return [];
    }

    // Find similar agents using vector similarity
    const similarAgents = await db
      .select()
      .from(aiAgents)
      .where(and(
        sql`${aiAgents.id} != ${agentId}`,
        eq(aiAgents.status, 'active'),
        sql`${aiAgents.embedding} <-> ${targetAgent.embedding} < 0.5`
      ))
      .orderBy(sql`${aiAgents.embedding} <-> ${targetAgent.embedding}`)
      .limit(limit);

    return similarAgents;
  }

  // ===== REVIEWS =====

  async createReview(data: InsertAgentReview): Promise<AgentReview> {
    // Check if user already reviewed this agent
    const [existingReview] = await db
      .select()
      .from(agentReviews)
      .where(and(
        eq(agentReviews.agentId, data.agentId),
        eq(agentReviews.userId, data.userId)
      ))
      .limit(1);

    if (existingReview) {
      throw new Error("You have already reviewed this agent");
    }

    const [review] = await db
      .insert(agentReviews)
      .values(data)
      .returning();

    // Update agent rating
    await this.updateAgentRating(data.agentId);

    return review;
  }

  async getAgentReviews(agentId: number, page: number = 1, limit: number = 10): Promise<{
    reviews: Array<AgentReview & { author: { fullName: string; avatarUrl?: string } }>;
    totalCount: number;
  }> {
    const reviews = await db
      .select({
        review: agentReviews,
        author: {
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(agentReviews)
      .innerJoin(users, eq(agentReviews.userId, users.id))
      .where(eq(agentReviews.agentId, agentId))
      .orderBy(desc(agentReviews.createdAt))
      .limit(limit)
      .offset((page - 1) * limit);

    const [{ totalCount }] = await db
      .select({ totalCount: count() })
      .from(agentReviews)
      .where(eq(agentReviews.agentId, agentId));

    return {
      reviews: reviews.map(({ review, author }) => ({ ...review, author })),
      totalCount: totalCount || 0,
    };
  }

  private async getAgentReviewStats(agentId: number): Promise<{
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  }> {
    const reviewStats = await db
      .select({
        rating: agentReviews.rating,
        count: count(),
      })
      .from(agentReviews)
      .where(eq(agentReviews.agentId, agentId))
      .groupBy(agentReviews.rating);

    const ratingDistribution: { [key: number]: number } = {};
    let totalReviews = 0;
    let totalRating = 0;

    for (let i = 1; i <= 5; i++) {
      ratingDistribution[i] = 0;
    }

    for (const stat of reviewStats) {
      const ratingCount = stat.count || 0;
      ratingDistribution[stat.rating] = ratingCount;
      totalReviews += ratingCount;
      totalRating += stat.rating * ratingCount;
    }

    const averageRating = totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(2)) : 0;

    return {
      averageRating,
      totalReviews,
      ratingDistribution,
    };
  }

  private async updateAgentRating(agentId: number): Promise<void> {
    const stats = await this.getAgentReviewStats(agentId);
    
    await db
      .update(aiAgents)
      .set({
        rating: stats.averageRating.toString(),
        reviewCount: stats.totalReviews,
        updatedAt: new Date(),
      })
      .where(eq(aiAgents.id, agentId));
  }

  // ===== COLLECTIONS =====

  async createCollection(data: InsertAgentCollection, createdById: number): Promise<AgentCollection> {
    const [collection] = await db
      .insert(agentCollections)
      .values({
        ...data,
        createdById,
      })
      .returning();

    return collection;
  }

  async getUserCollections(userId: number): Promise<AgentCollection[]> {
    return db
      .select()
      .from(agentCollections)
      .where(eq(agentCollections.createdById, userId))
      .orderBy(desc(agentCollections.updatedAt));
  }

  async getPublicCollections(limit: number = 20): Promise<Array<AgentCollection & { 
    creator: { fullName: string; avatarUrl?: string };
    agentCount: number;
  }>> {
    const collections = await db
      .select({
        collection: agentCollections,
        creator: {
          fullName: users.fullName,
          avatarUrl: users.avatarUrl,
        },
      })
      .from(agentCollections)
      .innerJoin(users, eq(agentCollections.createdById, users.id))
      .where(eq(agentCollections.isPublic, true))
      .orderBy(desc(agentCollections.likeCount), desc(agentCollections.viewCount))
      .limit(limit);

    return collections.map(({ collection, creator }) => ({
      ...collection,
      creator,
      agentCount: collection.agentIds?.length || 0,
    }));
  }

  // ===== BOOKMARKS =====

  async bookmarkAgent(data: InsertAgentBookmark): Promise<void> {
    // Check if already bookmarked
    const [existing] = await db
      .select()
      .from(agentBookmarks)
      .where(and(
        eq(agentBookmarks.userId, data.userId),
        eq(agentBookmarks.agentId, data.agentId)
      ))
      .limit(1);

    if (existing) {
      throw new Error("Agent already bookmarked");
    }

    await db.insert(agentBookmarks).values(data);
  }

  async removeBookmark(userId: number, agentId: number): Promise<void> {
    await db
      .delete(agentBookmarks)
      .where(and(
        eq(agentBookmarks.userId, userId),
        eq(agentBookmarks.agentId, agentId)
      ));
  }

  async getUserBookmarks(userId: number): Promise<Array<AgentWithDetails>> {
    const bookmarks = await db
      .select({ agentId: agentBookmarks.agentId })
      .from(agentBookmarks)
      .where(eq(agentBookmarks.userId, userId))
      .orderBy(desc(agentBookmarks.createdAt));

    const agents = await Promise.all(
      bookmarks.map(bookmark => this.getAgentWithDetails(bookmark.agentId, userId))
    );

    return agents;
  }

  // ===== ANALYTICS =====

  async trackUsage(data: InsertUsageAnalytics): Promise<void> {
    await db.insert(agentUsageAnalytics).values(data);

    // Update agent usage count
    if (data.action === 'view') {
      await db
        .update(aiAgents)
        .set({
          usageCount: sql`${aiAgents.usageCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(aiAgents.id, data.agentId));
    }
  }

  async getMarketplaceStats(): Promise<MarketplaceStats> {
    // Total counts
    const [totals] = await db
      .select({
        totalAgents: count(aiAgents.id),
        totalReviews: count(agentReviews.id),
      })
      .from(aiAgents)
      .leftJoin(agentReviews, eq(aiAgents.id, agentReviews.agentId))
      .where(eq(aiAgents.status, 'active'));

    // Average rating
    const [{ averageRating }] = await db
      .select({
        averageRating: sql<number>`COALESCE(AVG(CAST(${aiAgents.rating} AS DECIMAL)), 0)`,
      })
      .from(aiAgents)
      .where(eq(aiAgents.status, 'active'));

    // Category stats
    const categoryStats = await db
      .select({
        category: aiAgents.category,
        count: count(),
      })
      .from(aiAgents)
      .where(eq(aiAgents.status, 'active'))
      .groupBy(aiAgents.category)
      .orderBy(desc(count()));

    // Popular, trending, and recent agents
    const [popularAgents, trendingAgents, recentlyAdded] = await Promise.all([
      this.getAgentsByCategory('', 5), // Get top 5 by popularity
      this.getTrendingAgents(5),
      db.select().from(aiAgents)
        .where(eq(aiAgents.status, 'active'))
        .orderBy(desc(aiAgents.createdAt))
        .limit(5),
    ]);

    return {
      totalAgents: totals.totalAgents || 0,
      totalReviews: totals.totalReviews || 0,
      averageRating: Number(averageRating.toFixed(2)),
      categoryStats: categoryStats.map(stat => ({
        category: stat.category,
        count: stat.count || 0,
      })),
      popularAgents,
      trendingAgents,
      recentlyAdded,
    };
  }

  // ===== PERSONALIZED RECOMMENDATIONS =====

  async getPersonalizedRecommendations(userId: number, limit: number = 10): Promise<AiAgent[]> {
    // This would typically use ML algorithms, but for now we'll use simple heuristics
    
    // Get user's bookmarked agents to understand preferences
    const userBookmarks = await db
      .select({ agentId: agentBookmarks.agentId })
      .from(agentBookmarks)
      .where(eq(agentBookmarks.userId, userId));

    if (userBookmarks.length === 0) {
      // New user - return popular agents
      return this.getFeaturedAgents(limit);
    }

    // Get categories of bookmarked agents
    const bookmarkedAgentIds = userBookmarks.map(b => b.agentId);
    const bookmarkedAgents = await db
      .select({ category: aiAgents.category })
      .from(aiAgents)
      .where(inArray(aiAgents.id, bookmarkedAgentIds));

    const preferredCategories = [...new Set(bookmarkedAgents.map(a => a.category))];

    // Find agents in preferred categories that user hasn't bookmarked
    const recommendations = await db
      .select()
      .from(aiAgents)
      .where(and(
        inArray(aiAgents.category, preferredCategories),
        sql`${aiAgents.id} NOT IN (${sql.join(bookmarkedAgentIds, sql`, `)})`,
        eq(aiAgents.status, 'active')
      ))
      .orderBy(desc(aiAgents.popularityScore), desc(aiAgents.rating))
      .limit(limit);

    return recommendations;
  }
}

export const aiMarketplaceService = new AiMarketplaceService();