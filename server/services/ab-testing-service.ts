import { db } from "../db";
import { users, matchingInteractions } from "@shared/schema";
import { eq, and, gte, count, avg, sql } from "drizzle-orm";

export interface ABTestConfig {
  id: string;
  name: string;
  description: string;
  variants: ABTestVariant[];
  trafficSplit: number[]; // Percentage allocation for each variant
  startDate: Date;
  endDate: Date;
  status: 'draft' | 'running' | 'paused' | 'completed';
  metrics: string[]; // Metrics to track
  targetAudience?: {
    userType?: 'all' | 'new' | 'returning';
    minMatches?: number;
    maxMatches?: number;
  };
}

export interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  config: {
    aiProvider?: string;
    matchingAlgorithm?: string;
    parameters?: Record<string, any>;
  };
}

export interface ABTestResult {
  testId: string;
  variant: string;
  metrics: {
    participants: number;
    conversionRate: number;
    averageMatchScore: number;
    interactionRate: number;
    messagingRate: number;
    retentionRate: number;
    userSatisfaction: number;
  };
  significance: {
    isSignificant: boolean;
    pValue: number;
    confidenceInterval: [number, number];
  };
}

export interface ABTestParticipant {
  userId: number;
  testId: string;
  variant: string;
  assignedAt: Date;
  events: ABTestEvent[];
}

export interface ABTestEvent {
  id: string;
  userId: number;
  testId: string;
  variant: string;
  eventType: string;
  eventData: Record<string, any>;
  timestamp: Date;
}

class ABTestingService {
  private activeTests: Map<string, ABTestConfig> = new Map();
  private userAssignments: Map<number, Map<string, string>> = new Map(); // userId -> testId -> variant

  /**
   * Create a new A/B test
   */
  async createTest(config: ABTestConfig): Promise<ABTestConfig> {
    // Validate traffic split
    const totalSplit = config.trafficSplit.reduce((sum, split) => sum + split, 0);
    if (Math.abs(totalSplit - 100) > 0.1) {
      throw new Error('Traffic split must add up to 100%');
    }

    if (config.variants.length !== config.trafficSplit.length) {
      throw new Error('Number of variants must match traffic split array length');
    }

    // Store test configuration
    this.activeTests.set(config.id, config);
    
    console.log(`A/B Test created: ${config.name} (${config.id})`);
    return config;
  }

  /**
   * Assign user to test variant
   */
  assignUserToVariant(userId: number, testId: string): string | null {
    const test = this.activeTests.get(testId);
    if (!test || test.status !== 'running') {
      return null;
    }

    // Check if user already assigned
    const userTests = this.userAssignments.get(userId);
    if (userTests?.has(testId)) {
      return userTests.get(testId)!;
    }

    // Assign based on user ID hash for consistency
    const hash = this.hashUserId(userId, testId);
    const rand = hash % 100;
    
    let cumulative = 0;
    for (let i = 0; i < test.trafficSplit.length; i++) {
      cumulative += test.trafficSplit[i];
      if (rand < cumulative) {
        const variant = test.variants[i].id;
        
        // Store assignment
        if (!this.userAssignments.has(userId)) {
          this.userAssignments.set(userId, new Map());
        }
        this.userAssignments.get(userId)!.set(testId, variant);
        
        this.trackEvent(userId, testId, variant, 'assigned', {});
        return variant;
      }
    }

    return null;
  }

  /**
   * Get user's variant for a test
   */
  getUserVariant(userId: number, testId: string): string | null {
    return this.userAssignments.get(userId)?.get(testId) || null;
  }

  /**
   * Track A/B test event
   */
  async trackEvent(
    userId: number, 
    testId: string, 
    variant: string, 
    eventType: string, 
    eventData: Record<string, any>
  ): Promise<void> {
    const event: ABTestEvent = {
      id: `${testId}_${userId}_${Date.now()}`,
      userId,
      testId,
      variant,
      eventType,
      eventData,
      timestamp: new Date()
    };

    // In production, store in database
    console.log(`A/B Test Event: ${eventType} for user ${userId} in test ${testId} variant ${variant}`);
  }

  /**
   * Get test results with statistical analysis
   */
  async getTestResults(testId: string): Promise<ABTestResult[]> {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const results: ABTestResult[] = [];

    for (const variant of test.variants) {
      const metrics = await this.calculateVariantMetrics(testId, variant.id);
      const significance = await this.calculateStatisticalSignificance(testId, variant.id, test.variants[0].id);

      results.push({
        testId,
        variant: variant.id,
        metrics,
        significance
      });
    }

    return results;
  }

  /**
   * Calculate metrics for a specific variant
   */
  private async calculateVariantMetrics(testId: string, variantId: string): Promise<ABTestResult['metrics']> {
    // Get participants count (users assigned to this variant)
    const participantAssignments = Array.from(this.userAssignments.entries())
      .filter(([_, tests]) => tests.get(testId) === variantId);
    
    const participants = participantAssignments.length;
    
    if (participants === 0) {
      return {
        participants: 0,
        conversionRate: 0,
        averageMatchScore: 0,
        interactionRate: 0,
        messagingRate: 0,
        retentionRate: 0,
        userSatisfaction: 0
      };
    }

    const userIds = participantAssignments.map(([userId]) => userId);

    // Calculate metrics from database
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Interaction rate: users who had any matching interaction
    const interactingUsers = await db
      .select({ userId: matchingInteractions.userId })
      .from(matchingInteractions)
      .where(
        and(
          sql`${matchingInteractions.userId} = ANY(${userIds})`,
          gte(matchingInteractions.createdAt, oneWeekAgo)
        )
      )
      .groupBy(matchingInteractions.userId);

    const interactionRate = (interactingUsers.length / participants) * 100;

    // Average match score would require additional data
    const averageMatchScore = 75; // Placeholder

    // Conversion rate: users who expressed interest (liked someone)
    const convertedUsers = await db
      .select({ userId: matchingInteractions.userId })
      .from(matchingInteractions)
      .where(
        and(
          sql`${matchingInteractions.userId} = ANY(${userIds})`,
          eq(matchingInteractions.action, 'liked'),
          gte(matchingInteractions.createdAt, oneWeekAgo)
        )
      )
      .groupBy(matchingInteractions.userId);

    const conversionRate = (convertedUsers.length / participants) * 100;

    // Messaging rate: users who initiated conversations
    const messagingUsers = await db
      .select({ userId: matchingInteractions.userId })
      .from(matchingInteractions)
      .where(
        and(
          sql`${matchingInteractions.userId} = ANY(${userIds})`,
          eq(matchingInteractions.action, 'messaged'),
          gte(matchingInteractions.createdAt, oneWeekAgo)
        )
      )
      .groupBy(matchingInteractions.userId);

    const messagingRate = (messagingUsers.length / participants) * 100;

    // Retention rate: users who returned within a week
    const retentionRate = 70; // Placeholder - would need session tracking

    // User satisfaction: placeholder
    const userSatisfaction = 4.2; // Would come from feedback

    return {
      participants,
      conversionRate,
      averageMatchScore,
      interactionRate,
      messagingRate,
      retentionRate,
      userSatisfaction
    };
  }

  /**
   * Calculate statistical significance using Chi-square test
   */
  private async calculateStatisticalSignificance(
    testId: string, 
    variantA: string, 
    variantB: string
  ): Promise<ABTestResult['significance']> {
    // Simplified statistical significance calculation
    // In production, use proper statistical libraries
    
    const metricsA = await this.calculateVariantMetrics(testId, variantA);
    const metricsB = await this.calculateVariantMetrics(testId, variantB);

    // Simple z-test for conversion rates
    const conversionDiff = Math.abs(metricsA.conversionRate - metricsB.conversionRate);
    const pooledRate = (metricsA.conversionRate + metricsB.conversionRate) / 2;
    const standardError = Math.sqrt(pooledRate * (100 - pooledRate) * (1/metricsA.participants + 1/metricsB.participants));
    
    const zScore = conversionDiff / standardError;
    const pValue = 2 * (1 - this.normalCDF(Math.abs(zScore))); // Two-tailed test

    const isSignificant = pValue < 0.05;
    const confidenceInterval: [number, number] = [
      conversionDiff - 1.96 * standardError,
      conversionDiff + 1.96 * standardError
    ];

    return {
      isSignificant,
      pValue,
      confidenceInterval
    };
  }

  /**
   * Get AI model performance comparison
   */
  async getAIModelComparison(testId: string): Promise<{
    testName: string;
    duration: number;
    variants: Array<{
      name: string;
      aiProvider: string;
      participants: number;
      metrics: {
        matchAccuracy: number;
        responseTime: number;
        userSatisfaction: number;
        costPerMatch: number;
      };
      isWinner: boolean;
    }>;
    recommendation: string;
  }> {
    const test = this.activeTests.get(testId);
    if (!test) {
      throw new Error(`Test ${testId} not found`);
    }

    const results = await this.getTestResults(testId);
    const bestVariant = results.reduce((best, current) => 
      current.metrics.conversionRate > best.metrics.conversionRate ? current : best
    );

    const comparison = {
      testName: test.name,
      duration: Math.ceil((Date.now() - test.startDate.getTime()) / (1000 * 60 * 60 * 24)),
      variants: results.map(result => {
        const variant = test.variants.find(v => v.id === result.variant)!;
        return {
          name: variant.name,
          aiProvider: variant.config.aiProvider || 'unknown',
          participants: result.metrics.participants,
          metrics: {
            matchAccuracy: result.metrics.conversionRate,
            responseTime: Math.random() * 1000 + 500, // Placeholder
            userSatisfaction: result.metrics.userSatisfaction,
            costPerMatch: Math.random() * 0.1 + 0.05 // Placeholder
          },
          isWinner: result.variant === bestVariant.variant
        };
      }),
      recommendation: `基于 ${results.length} 个变体的测试结果，推荐使用 ${bestVariant.variant} 配置，其转化率为 ${bestVariant.metrics.conversionRate.toFixed(1)}%`
    };

    return comparison;
  }

  /**
   * Start AI model comparison test
   */
  async startAIModelComparisonTest(): Promise<string> {
    const testId = `ai_model_comparison_${Date.now()}`;
    
    const config: ABTestConfig = {
      id: testId,
      name: 'AI Model Performance Comparison',
      description: '比较不同AI提供商在Co-founder匹配中的表现',
      variants: [
        {
          id: 'openai_variant',
          name: 'OpenAI GPT-4',
          description: '使用OpenAI GPT-4进行匹配分析',
          config: {
            aiProvider: 'openai',
            matchingAlgorithm: 'enhanced',
            parameters: { model: 'gpt-4o', temperature: 0.3 }
          }
        },
        {
          id: 'claude_variant',
          name: 'Claude 3.5 Sonnet',
          description: '使用Claude 3.5进行匹配分析',
          config: {
            aiProvider: 'claude',
            matchingAlgorithm: 'enhanced',
            parameters: { model: 'claude-3-5-sonnet-20241022', temperature: 0.3 }
          }
        },
        {
          id: 'deepseek_variant',
          name: 'DeepSeek Chat',
          description: '使用DeepSeek模型进行匹配分析',
          config: {
            aiProvider: 'deepseek',
            matchingAlgorithm: 'enhanced',
            parameters: { model: 'deepseek-chat', temperature: 0.3 }
          }
        }
      ],
      trafficSplit: [40, 40, 20], // OpenAI 40%, Claude 40%, DeepSeek 20%
      startDate: new Date(),
      endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 2 weeks
      status: 'running',
      metrics: ['conversion_rate', 'match_score', 'user_satisfaction', 'interaction_rate'],
      targetAudience: {
        userType: 'all',
        minMatches: 0,
        maxMatches: 100
      }
    };

    await this.createTest(config);
    return testId;
  }

  /**
   * Hash user ID for consistent variant assignment
   */
  private hashUserId(userId: number, testId: string): number {
    const str = `${userId}_${testId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Normal cumulative distribution function approximation
   */
  private normalCDF(x: number): number {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  /**
   * Error function approximation
   */
  private erf(x: number): number {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  /**
   * Get all active tests
   */
  getActiveTests(): ABTestConfig[] {
    return Array.from(this.activeTests.values()).filter(test => test.status === 'running');
  }

  /**
   * Stop a test
   */
  stopTest(testId: string): void {
    const test = this.activeTests.get(testId);
    if (test) {
      test.status = 'completed';
      test.endDate = new Date();
      console.log(`A/B Test stopped: ${test.name} (${testId})`);
    }
  }
}

export const abTestingService = new ABTestingService();