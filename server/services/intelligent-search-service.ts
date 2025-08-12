import { db } from "../db";
import { embeddingService, EmbeddingService } from "./embedding-service";
import { 
  userProfiles, 
  aiMatches,
  aiMatchingInteractions,
} from "@shared/ai-matching-schema";
import { 
  users, 
  events, 
  agentProducts, 
  cofounderApplications,
  eventContents,
  contentInteractions,
} from "@shared/schema";
import { eq, and, or, not, like, ilike, desc, sql, gte, lte, inArray } from "drizzle-orm";

export interface SearchRequest {
  query: string;
  filters?: {
    type?: ('users' | 'events' | 'products' | 'content')[];
    roleIntent?: string[];
    industries?: string[];
    skills?: string[];
    location?: string;
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  userId?: number; // For personalization
  limit?: number;
  semanticSearch?: boolean;
}

export interface SearchResult {
  type: 'user' | 'event' | 'product' | 'content';
  id: number;
  title: string;
  description: string;
  relevanceScore: number;
  semanticScore?: number;
  data: any;
  reasons?: string[];
}

export interface PersonalizedRecommendation {
  type: 'similar_users' | 'relevant_events' | 'interesting_products' | 'trending_content';
  title: string;
  description: string;
  items: SearchResult[];
  reason: string;
}

export class IntelligentSearchService {
  
  async search(request: SearchRequest): Promise<{
    results: SearchResult[];
    totalCount: number;
    searchTime: number;
  }> {
    const startTime = Date.now();
    const limit = request.limit || 50;
    
    let results: SearchResult[] = [];
    
    // If semantic search is enabled and query is substantial
    if (request.semanticSearch && request.query.length > 10) {
      results = await this.performSemanticSearch(request, limit);
    } else {
      results = await this.performKeywordSearch(request, limit);
    }
    
    // Apply personalization if user is specified
    if (request.userId) {
      results = await this.personalizeResults(results, request.userId);
    }
    
    // Sort by relevance score
    results.sort((a, b) => b.relevanceScore - a.relevanceScore);
    
    const searchTime = Date.now() - startTime;
    
    return {
      results: results.slice(0, limit),
      totalCount: results.length,
      searchTime,
    };
  }

  async getPersonalizedRecommendations(userId: number): Promise<PersonalizedRecommendation[]> {
    const recommendations: PersonalizedRecommendation[] = [];
    
    // Get user profile for personalization
    const [userProfile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    
    if (!userProfile) {
      return this.getGenericRecommendations();
    }

    // 1. Similar Users based on profile vector
    if (userProfile.profileVector) {
      const similarUsers = await this.findSimilarUsers(userProfile, 10);
      if (similarUsers.length > 0) {
        recommendations.push({
          type: 'similar_users',
          title: '相似的创业者',
          description: '基于您的技能和背景推荐的潜在合作伙伴',
          items: similarUsers,
          reason: '基于AI向量相似度分析',
        });
      }
    }

    // 2. Relevant Events based on interests
    const relevantEvents = await this.findRelevantEvents(userProfile, 8);
    if (relevantEvents.length > 0) {
      recommendations.push({
        type: 'relevant_events',
        title: '推荐活动',
        description: '基于您的兴趣领域推荐的活动',
        items: relevantEvents,
        reason: '匹配您的行业和技能标签',
      });
    }

    // 3. Interesting Products
    const interestingProducts = await this.findInterestingProducts(userProfile, 6);
    if (interestingProducts.length > 0) {
      recommendations.push({
        type: 'interesting_products',
        title: '感兴趣的产品',
        description: '可能对您有用的AI工具和产品',
        items: interestingProducts,
        reason: '基于您的技术栈和项目需求',
      });
    }

    // 4. Trending Content based on recent interactions
    const trendingContent = await this.findTrendingContent(userProfile, 8);
    if (trendingContent.length > 0) {
      recommendations.push({
        type: 'trending_content',
        title: '热门内容',
        description: '社区中受欢迎的分享和讨论',
        items: trendingContent,
        reason: '基于社区互动和您的兴趣',
      });
    }

    return recommendations;
  }

  async findSimilarUsers(userProfile: any, limit: number): Promise<SearchResult[]> {
    if (!userProfile.profileVector) {
      return [];
    }

    const similarProfiles = await db
      .select({
        profile: userProfiles,
        user: users,
      })
      .from(userProfiles)
      .innerJoin(users, eq(userProfiles.userId, users.id))
      .where(and(
        not(eq(userProfiles.userId, userProfile.userId)),
        sql`profile_vector IS NOT NULL`
      ))
      .orderBy(sql`profile_vector <-> ${userProfile.profileVector}`)
      .limit(limit * 2); // Get extra for filtering

    const results: SearchResult[] = [];
    
    for (const { profile, user } of similarProfiles) {
      if (results.length >= limit) break;
      
      // Calculate semantic similarity
      const semanticScore = profile.profileVector ? 
        EmbeddingService.cosineSimilarity(userProfile.profileVector, profile.profileVector) : 0;

      // Skip very low similarity
      if (semanticScore < 0.3) continue;

      const commonSkills = this.findCommonElements(
        userProfile.skills || [], 
        profile.skills || []
      );
      
      const commonIndustries = this.findCommonElements(
        userProfile.industries || [], 
        profile.industries || []
      );

      const reasons = [];
      if (commonSkills.length > 0) {
        reasons.push(`共同技能: ${commonSkills.slice(0, 3).join(', ')}`);
      }
      if (commonIndustries.length > 0) {
        reasons.push(`共同兴趣: ${commonIndustries.slice(0, 2).join(', ')}`);
      }
      if (profile.roleIntent !== userProfile.roleIntent) {
        reasons.push(`互补角色: ${profile.roleIntent}`);
      }

      results.push({
        type: 'user',
        id: user.id,
        title: user.fullName,
        description: `${profile.roleIntent} · ${profile.seniority} · ${profile.locationCity}`,
        relevanceScore: semanticScore * 100,
        semanticScore,
        data: { user, profile },
        reasons,
      });
    }

    return results;
  }

  async findRelevantEvents(userProfile: any, limit: number): Promise<SearchResult[]> {
    const userIndustries = userProfile.industries || [];
    const userSkills = userProfile.skills || [];
    
    const relevantEvents = await db
      .select()
      .from(events)
      .where(
        and(
          gte(events.date, new Date()),
          or(
            // Match by category
            userIndustries.length > 0 ? 
              or(...userIndustries.map((industry: string) => 
                ilike(events.description, `%${industry}%`)
              )) : undefined,
            // Match by skills in description
            userSkills.length > 0 ? 
              or(...userSkills.map((skill: string) => 
                ilike(events.description, `%${skill}%`)
              )) : undefined,
            // Technical events for technical people
            userProfile.roleIntent.includes('Technical') || userProfile.roleIntent === 'CTO' ?
              or(
                ilike(events.category, '%tech%'),
                ilike(events.title, '%技术%'),
                ilike(events.title, '%AI%'),
                ilike(events.title, '%开发%')
              ) : undefined
          )
        )
      )
      .orderBy(desc(events.date))
      .limit(limit);

    return relevantEvents.map(event => {
      const reasons = [];
      
      // Check relevance reasons
      if (userIndustries.some((industry: string) => 
        event.description.toLowerCase().includes(industry.toLowerCase())
      )) {
        reasons.push('匹配您的行业兴趣');
      }
      
      if (userSkills.some((skill: string) => 
        event.description.toLowerCase().includes(skill.toLowerCase())
      )) {
        reasons.push('相关技能主题');
      }

      const relevanceScore = reasons.length * 20 + 
        ((event.currentAttendees || 0) / (event.maxAttendees || 100)) * 30 + 
        Math.max(0, 50 - Math.floor((Date.now() - event.date.getTime()) / (1000 * 60 * 60 * 24)));

      return {
        type: 'event' as const,
        id: event.id,
        title: event.title,
        description: event.description,
        relevanceScore,
        data: event,
        reasons,
      };
    });
  }

  async findInterestingProducts(userProfile: any, limit: number): Promise<SearchResult[]> {
    const userTechStack = userProfile.techStack || [];
    const userSkills = userProfile.skills || [];
    
    const products = await db
      .select()
      .from(agentProducts)
      .where(eq(agentProducts.status, 'published'))
      .orderBy(desc(agentProducts.usageCount))
      .limit(limit * 2);

    const results: SearchResult[] = [];
    
    for (const product of products) {
      if (results.length >= limit) break;
      
      const reasons = [];
      let relevanceScore = 10;

      // Check tech stack relevance
      const productTags = product.tags || [];
      const commonTech = this.findCommonElements(userTechStack, productTags);
      if (commonTech.length > 0) {
        reasons.push(`相关技术: ${commonTech.slice(0, 2).join(', ')}`);
        relevanceScore += commonTech.length * 15;
      }

      // Check skill relevance
      const commonSkills = this.findCommonElements(userSkills, productTags);
      if (commonSkills.length > 0) {
        reasons.push(`相关技能: ${commonSkills.slice(0, 2).join(', ')}`);
        relevanceScore += commonSkills.length * 10;
      }

      // Role-specific relevance
      if (userProfile.roleIntent === 'CTO' || userProfile.roleIntent === 'Technical') {
        if (productTags.some((tag: string) => 
          ['api', 'sdk', 'framework', 'tool', 'development'].includes(tag.toLowerCase())
        )) {
          reasons.push('适合技术人员');
          relevanceScore += 20;
        }
      }

      // Popularity boost
      relevanceScore += Math.min(product.usageCount * 0.1, 20);

      if (relevanceScore > 15) { // Only include if reasonably relevant
        results.push({
          type: 'product',
          id: product.id,
          title: product.name,
          description: product.description,
          relevanceScore,
          data: product,
          reasons,
        });
      }
    }

    return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  async findTrendingContent(userProfile: any, limit: number): Promise<SearchResult[]> {
    // Get event contents that are trending (high view/download counts)
    const trendingContents = await db
      .select({
        content: eventContents,
        event: events,
      })
      .from(eventContents)
      .innerJoin(events, eq(eventContents.eventId, events.id))
      .orderBy(desc(sql`(${eventContents.viewCount} + ${eventContents.downloadCount} * 2)`))
      .limit(limit);

    return trendingContents.map(({ content, event }) => {
      const relevanceScore = content.viewCount + content.downloadCount * 2;
      
      const reasons = ['高社区关注度'];
      
      // Add specific relevance
      const userIndustries = userProfile.industries || [];
      if (userIndustries.some((industry: string) => 
        event.description.toLowerCase().includes(industry.toLowerCase())
      )) {
        reasons.push('相关行业内容');
      }

      return {
        type: 'content' as const,
        id: content.id,
        title: content.title,
        description: `${event.title} - ${content.description || content.type}`,
        relevanceScore,
        data: { content, event },
        reasons,
      };
    });
  }

  private async performSemanticSearch(request: SearchRequest, limit: number): Promise<SearchResult[]> {
    // Generate query embedding
    const queryEmbedding = await embeddingService.generateSearchEmbedding(request.query);
    const results: SearchResult[] = [];

    // Search users by profile similarity
    if (!request.filters?.type || request.filters.type.includes('users')) {
      const userResults = await this.semanticSearchUsers(queryEmbedding, request, limit / 4);
      results.push(...userResults);
    }

    // Search other content types...
    if (!request.filters?.type || request.filters.type.includes('events')) {
      const eventResults = await this.semanticSearchEvents(request.query, request, limit / 4);
      results.push(...eventResults);
    }

    return results;
  }

  private async semanticSearchUsers(queryEmbedding: number[], request: SearchRequest, limit: number): Promise<SearchResult[]> {
    const userProfiles = await db
      .select({
        profile: userProfiles,
        user: users,
      })
      .from(userProfiles)
      .innerJoin(users, eq(userProfiles.userId, users.id))
      .where(sql`profile_vector IS NOT NULL`)
      .orderBy(sql`profile_vector <-> ${queryEmbedding}`)
      .limit(limit);

    return userProfiles.map(({ profile, user }) => {
      const semanticScore = EmbeddingService.cosineSimilarity(queryEmbedding, profile.profileVector);
      
      return {
        type: 'user' as const,
        id: user.id,
        title: user.fullName,
        description: `${profile.roleIntent} · ${profile.seniority} · ${profile.locationCity}`,
        relevanceScore: semanticScore * 100,
        semanticScore,
        data: { user, profile },
        reasons: ['语义相似度匹配'],
      };
    });
  }

  private async semanticSearchEvents(query: string, request: SearchRequest, limit: number): Promise<SearchResult[]> {
    // For events, use keyword matching for now
    const events = await db
      .select()
      .from(db.select().from(events))
      .where(
        or(
          ilike(events.title, `%${query}%`),
          ilike(events.description, `%${query}%`)
        )
      )
      .limit(limit);

    return events.map(event => ({
      type: 'event' as const,
      id: event.id,
      title: event.title,
      description: event.description,
      relevanceScore: this.calculateTextRelevance(query, event.title + ' ' + event.description),
      data: event,
      reasons: ['关键词匹配'],
    }));
  }

  private async performKeywordSearch(request: SearchRequest, limit: number): Promise<SearchResult[]> {
    const results: SearchResult[] = [];
    const query = request.query;

    // Search users
    if (!request.filters?.type || request.filters.type.includes('users')) {
      const userResults = await this.keywordSearchUsers(query, request, limit / 4);
      results.push(...userResults);
    }

    // Search events
    if (!request.filters?.type || request.filters.type.includes('events')) {
      const eventResults = await this.keywordSearchEvents(query, request, limit / 4);
      results.push(...eventResults);
    }

    // Search products
    if (!request.filters?.type || request.filters.type.includes('products')) {
      const productResults = await this.keywordSearchProducts(query, request, limit / 4);
      results.push(...productResults);
    }

    return results;
  }

  private async keywordSearchUsers(query: string, request: SearchRequest, limit: number): Promise<SearchResult[]> {
    let whereClause = or(
      ilike(users.fullName, `%${query}%`),
      ilike(users.researchField, `%${query}%`),
      ilike(users.affiliation, `%${query}%`)
    );

    // Apply filters
    if (request.filters?.roleIntent) {
      whereClause = and(
        whereClause,
        inArray(userProfiles.roleIntent, request.filters.roleIntent)
      );
    }

    const userResults = await db
      .select({
        user: users,
        profile: userProfiles,
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.id, userProfiles.userId))
      .where(whereClause)
      .limit(limit);

    return userResults.map(({ user, profile }) => ({
      type: 'user' as const,
      id: user.id,
      title: user.fullName,
      description: `${user.researchField} · ${user.affiliation}`,
      relevanceScore: this.calculateTextRelevance(query, user.fullName + ' ' + (user.researchField || '') + ' ' + (user.affiliation || '')),
      data: { user, profile },
      reasons: ['关键词匹配'],
    }));
  }

  private async keywordSearchEvents(query: string, request: SearchRequest, limit: number): Promise<SearchResult[]> {
    let whereClause = or(
      ilike(events.title, `%${query}%`),
      ilike(events.description, `%${query}%`),
      ilike(events.category, `%${query}%`)
    );

    // Apply date filter
    if (request.filters?.dateRange) {
      whereClause = and(
        whereClause,
        gte(events.date, request.filters.dateRange.start),
        lte(events.date, request.filters.dateRange.end)
      );
    }

    const eventResults = await db
      .select()
      .from(events)
      .where(whereClause)
      .orderBy(desc(events.date))
      .limit(limit);

    return eventResults.map(event => ({
      type: 'event' as const,
      id: event.id,
      title: event.title,
      description: event.description,
      relevanceScore: this.calculateTextRelevance(query, event.title + ' ' + event.description),
      data: event,
      reasons: ['关键词匹配'],
    }));
  }

  private async keywordSearchProducts(query: string, request: SearchRequest, limit: number): Promise<SearchResult[]> {
    const productResults = await db
      .select()
      .from(agentProducts)
      .where(
        and(
          or(
            ilike(agentProducts.name, `%${query}%`),
            ilike(agentProducts.description, `%${query}%`),
            ilike(agentProducts.category, `%${query}%`)
          ),
          eq(agentProducts.status, 'published')
        )
      )
      .orderBy(desc(agentProducts.usageCount))
      .limit(limit);

    return productResults.map(product => ({
      type: 'product' as const,
      id: product.id,
      title: product.name,
      description: product.description,
      relevanceScore: this.calculateTextRelevance(query, product.name + ' ' + product.description),
      data: product,
      reasons: ['关键词匹配'],
    }));
  }

  private async personalizeResults(results: SearchResult[], userId: number): Promise<SearchResult[]> {
    // Get user's interaction history
    const interactions = await db
      .select()
      .from(aiMatchingInteractions)
      .where(eq(aiMatchingInteractions.userId, userId))
      .limit(100);

    // Get user preferences
    const userProfile = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);

    if (userProfile.length === 0) return results;

    const profile = userProfile[0];

    // Boost relevance based on user preferences
    return results.map(result => {
      let boost = 0;

      if (result.type === 'user' && result.data.profile) {
        const candidateProfile = result.data.profile;
        
        // Boost for complementary roles
        if (this.areRolesComplementary(profile.roleIntent, candidateProfile.roleIntent)) {
          boost += 20;
        }

        // Boost for common interests
        const commonIndustries = this.findCommonElements(
          profile.industries || [],
          candidateProfile.industries || []
        );
        boost += commonIndustries.length * 10;

        // Boost for location similarity
        if (profile.locationCity === candidateProfile.locationCity) {
          boost += 15;
        }
      }

      // Apply personalization boost
      return {
        ...result,
        relevanceScore: result.relevanceScore + boost,
      };
    });
  }

  private async getGenericRecommendations(): Promise<PersonalizedRecommendation[]> {
    // Return generic recommendations for users without profiles
    const recentEvents = await db
      .select()
      .from(events)
      .where(gte(events.date, new Date()))
      .orderBy(desc(events.date))
      .limit(5);

    const popularProducts = await db
      .select()
      .from(agentProducts)
      .where(eq(agentProducts.status, 'published'))
      .orderBy(desc(agentProducts.usageCount))
      .limit(5);

    const recommendations: PersonalizedRecommendation[] = [];

    if (recentEvents.length > 0) {
      recommendations.push({
        type: 'relevant_events',
        title: '即将举行的活动',
        description: '不要错过这些精彩活动',
        items: recentEvents.map(event => ({
          type: 'event' as const,
          id: event.id,
          title: event.title,
          description: event.description,
          relevanceScore: 50,
          data: event,
        })),
        reason: '最新活动',
      });
    }

    if (popularProducts.length > 0) {
      recommendations.push({
        type: 'interesting_products',
        title: '热门产品',
        description: '社区中最受欢迎的工具',
        items: popularProducts.map(product => ({
          type: 'product' as const,
          id: product.id,
          title: product.name,
          description: product.description,
          relevanceScore: 50,
          data: product,
        })),
        reason: '社区热门',
      });
    }

    return recommendations;
  }

  private findCommonElements(arr1: string[], arr2: string[]): string[] {
    const set1 = new Set(arr1.map(item => item.toLowerCase()));
    return arr2.filter(item => set1.has(item.toLowerCase()));
  }

  private areRolesComplementary(role1: string, role2: string): boolean {
    const complementaryPairs = [
      ['CEO', 'CTO'],
      ['CEO', 'CPO'],
      ['CTO', 'Business'],
      ['Technical', 'Business'],
    ];

    return complementaryPairs.some(([r1, r2]) => 
      (role1 === r1 && role2 === r2) || (role1 === r2 && role2 === r1)
    );
  }

  private calculateTextRelevance(query: string, text: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const textWords = text.toLowerCase().split(/\s+/);
    
    let score = 0;
    for (const queryWord of queryWords) {
      for (const textWord of textWords) {
        if (textWord.includes(queryWord)) {
          score += queryWord.length === textWord.length ? 10 : 5;
        }
      }
    }
    
    return score;
  }
}

export const intelligentSearchService = new IntelligentSearchService();