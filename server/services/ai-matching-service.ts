import { db } from "../db";
import { 
  userProfiles, 
  matchingPreferences, 
  aiMatches, 
  aiMatchingInteractions,
  meetingSchedules,
  matchingFeatureWeights,
  batchMatchingRuns,
  type UserProfile,
  type MatchingPreference,
  type AiMatch,
  type MeetingSchedule,
  type BatchMatchingRun,
  type InsertUserProfile,
  type InsertMatchingPreference,
  type InsertAiMatchingInteraction,
} from "@shared/ai-matching-schema";
import { users } from "@shared/schema";
import { eq, and, or, not, inArray, desc, sql, gte, lte } from "drizzle-orm";
import { cosineDistance } from "drizzle-orm";
import { embeddingService, EmbeddingService } from "./embedding-service";

export interface MatchingConstraints {
  mustHave?: {
    timezone?: string;
    weeklyHours?: { min: number; max: number };
    remotePref?: string[];
    roleIntent?: string[];
  };
  niceToHave?: {
    industries?: string[];
    techStack?: string[];
    seniority?: string[];
    equityBand?: { min: number; max: number };
  };
  dealBreakers?: {
    noVisa?: boolean;
    minWeeklyHours?: number;
    excludeRoles?: string[];
  };
}

export interface MatchReason {
  type: string;
  detail: string;
  score: number;
}

export interface MatchCandidate {
  userId: number;
  score: number;
  hardScore: number;
  semanticScore: number;
  behaviorScore: number;
  reasons: MatchReason[];
  riskHints: string[];
  profile: UserProfile;
  user: typeof users.$inferSelect;
}

export class AiMatchingService {
  async getProfile(userId: number): Promise<UserProfile | null> {
    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.userId, userId))
      .limit(1);
    return profile || null;
  }

  async getPreferences(userId: number): Promise<MatchingPreference | null> {
    const [prefs] = await db
      .select()
      .from(matchingPreferences)
      .where(eq(matchingPreferences.userId, userId))
      .limit(1);
    return prefs || null;
  }

  async getActiveMatches(userId: number): Promise<AiMatch[]> {
    const matches = await db
      .select()
      .from(aiMatches)
      .where(
        and(
          or(
            eq(aiMatches.userId, userId),
            eq(aiMatches.targetUserId, userId)
          ),
          not(eq(aiMatches.stage, "dropped")),
          or(
            sql`${aiMatches.expiresAt} IS NULL`,
            gte(aiMatches.expiresAt, new Date())
          )
        )
      )
      .orderBy(desc(aiMatches.score));
    
    return matches;
  }

  async updateMeetingSchedule(
    scheduleId: number,
    userId: number,
    data: { action: "accept" | "decline" | "reschedule"; selectedSlot?: any }
  ): Promise<MeetingSchedule> {
    const [schedule] = await db
      .select()
      .from(meetingSchedules)
      .where(eq(meetingSchedules.id, scheduleId))
      .limit(1);

    if (!schedule) {
      throw new Error("Schedule not found");
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    switch (data.action) {
      case "accept":
        updates.status = "accepted";
        updates.selectedSlot = data.selectedSlot;
        break;
      case "decline":
        updates.status = "cancelled";
        break;
      case "reschedule":
        updates.status = "rescheduled";
        break;
    }

    const [updated] = await db
      .update(meetingSchedules)
      .set(updates)
      .where(eq(meetingSchedules.id, scheduleId))
      .returning();

    return updated;
  }

  async getUserInsights(userId: number): Promise<any> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      return {
        profileCompleteness: 0,
        matchingActivity: { views: 0, likes: 0, passes: 0, messagesInitiated: 0 },
        successMetrics: { matchRate: 0, responseRate: 0, conversationRate: 0 },
        recommendations: ["Complete your profile to get better matches"],
      };
    }

    // Calculate profile completeness
    const requiredFields = ['roleIntent', 'seniority', 'timezone', 'weeklyHours', 'locationCity', 'remotePref'];
    const optionalFields = ['skills', 'industries', 'techStack', 'bio', 'equityExpectation', 'salaryExpectation'];
    
    let completeness = 0;
    requiredFields.forEach(field => {
      if ((profile as any)[field]) completeness += 10;
    });
    optionalFields.forEach(field => {
      if ((profile as any)[field]) completeness += 5;
    });

    // Get interaction stats
    const interactions = await db
      .select({
        action: aiMatchingInteractions.action,
        count: sql<number>`count(*)::int`,
      })
      .from(aiMatchingInteractions)
      .where(eq(aiMatchingInteractions.userId, userId))
      .groupBy(aiMatchingInteractions.action);

    const activity = {
      views: 0,
      likes: 0,
      passes: 0,
      messagesInitiated: 0,
    };

    interactions.forEach(({ action, count }) => {
      switch (action) {
        case "view":
          activity.views = count;
          break;
        case "like":
          activity.likes = count;
          break;
        case "skip":
          activity.passes = count;
          break;
        case "connect":
          activity.messagesInitiated = count;
          break;
      }
    });

    // Calculate success metrics
    const totalInteractions = activity.likes + activity.passes;
    const matchRate = totalInteractions > 0 ? activity.likes / totalInteractions : 0;
    const responseRate = activity.messagesInitiated > 0 ? 0.7 : 0; // Placeholder
    const conversationRate = activity.messagesInitiated > 0 ? 0.5 : 0; // Placeholder

    // Generate recommendations
    const recommendations = [];
    if (!profile.bio) recommendations.push("Add a bio to help others understand your vision");
    if (!profile.skills || profile.skills.length === 0) recommendations.push("Add your skills to improve matching");
    if (!profile.industries || profile.industries.length === 0) recommendations.push("Select industries you're interested in");
    if (completeness < 70) recommendations.push("Complete more profile fields for better matches");

    return {
      profileCompleteness: Math.min(100, completeness),
      matchingActivity: activity,
      successMetrics: {
        matchRate: Math.round(matchRate * 100),
        responseRate: Math.round(responseRate * 100),
        conversationRate: Math.round(conversationRate * 100),
      },
      recommendations,
    };
  }
  private activeWeights: any = {
    roleComplement: 0.22,
    valueMatch: 0.18,
    timezoneOverlap: 0.16,
    industryAlign: 0.14,
    techStackCompat: 0.12,
    riskTolerance: 0.10,
    equityExpectBand: 0.08,
  };

  private roleComplementMap: Record<string, string[]> = {
    CEO: ["CTO", "CPO", "CMO", "COO"],
    CTO: ["CEO", "CPO", "Business"],
    CPO: ["CEO", "CTO", "Technical"],
    CMO: ["CEO", "CTO", "Business"],
    Technical: ["Business", "CEO", "CPO"],
    Business: ["Technical", "CTO", "CPO"],
  };

  async createOrUpdateProfile(userId: number, data: InsertUserProfile): Promise<UserProfile> {
    // Generate embedding using the embedding service
    const embeddingResult = await embeddingService.generateProfileEmbedding({
      roleIntent: data.roleIntent,
      seniority: data.seniority,
      skills: data.skills,
      industries: data.industries,
      techStack: data.techStack,
      bio: data.bio,
      workStyle: data.workStyle,
      values: data.values,
    });

    const [profile] = await db
      .insert(userProfiles)
      .values({
        ...data,
        userId,
        profileVector: sql`${embeddingResult.embedding}::vector`,
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          ...data,
          profileVector: sql`${embeddingResult.embedding}::vector`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return profile;
  }

  async updatePreferences(userId: number, data: InsertMatchingPreference): Promise<MatchingPreference> {
    const [preference] = await db
      .insert(matchingPreferences)
      .values({
        ...data,
        userId,
      })
      .onConflictDoUpdate({
        target: matchingPreferences.userId,
        set: {
          ...data,
          updatedAt: new Date(),
        },
      })
      .returning();

    return preference;
  }

  async getRecommendations(userId: number, limit: number = 20): Promise<MatchCandidate[]> {
    // Get user's profile and preferences
    const userProfile = await this.getProfile(userId);

    if (!userProfile) {
      throw new Error("User profile not found");
    }

    const userPrefs = await this.getPreferences(userId);

    // Get candidates with vector similarity if embedding exists
    let candidates: UserProfile[];
    
    if (userProfile.profileVector) {
      // Use vector similarity for initial recall with cosine distance
      candidates = await db
        .select()
        .from(userProfiles)
        .where(and(
          not(eq(userProfiles.userId, userId)),
          sql`profile_vector IS NOT NULL`
        ))
        .orderBy(sql`profile_vector <-> ${userProfile.profileVector}`)
        .limit(200);
    } else {
      // Fallback to getting all profiles for scoring
      candidates = await db
        .select()
        .from(userProfiles)
        .where(not(eq(userProfiles.userId, userId)))
        .limit(200);
    }

    // Apply hard constraints and score candidates
    const scoredCandidates = await Promise.all(
      candidates.map(async (candidate) => {
        const scores = await this.scoreCandidate(userProfile, candidate, userPrefs || undefined);
        if (scores.hardScore === 0) return null; // Failed hard constraints
        
        // Get user details
        const [candidateUser] = await db
          .select()
          .from(users)
          .where(eq(users.id, candidate.userId))
          .limit(1);

        if (!candidateUser) return null;

        return {
          userId: candidate.userId,
          ...scores,
          profile: candidate,
          user: candidateUser,
        };
      })
    );

    // Filter out nulls and sort by score
    const validCandidates = scoredCandidates
      .filter((c): c is MatchCandidate => c !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    // Record impressions
    await this.recordImpressions(userId, validCandidates.map(c => c.userId));

    return validCandidates;
  }

  private async scoreCandidate(
    userProfile: UserProfile, 
    candidateProfile: UserProfile,
    userPrefs: MatchingPreference | undefined
  ): Promise<Omit<MatchCandidate, 'userId' | 'profile' | 'user'>> {
    const reasons: MatchReason[] = [];
    const riskHints: string[] = [];
    
    // Check hard constraints
    const hardScore = this.checkHardConstraints(
      userProfile, 
      candidateProfile, 
      userPrefs?.mustHave as MatchingConstraints['mustHave']
    );
    
    if (hardScore === 0) {
      return {
        score: 0,
        hardScore: 0,
        semanticScore: 0,
        behaviorScore: 0,
        reasons: [],
        riskHints: ["Does not meet required criteria"],
      };
    }

    // Calculate semantic score
    const semanticScore = this.calculateSemanticScore(
      userProfile, 
      candidateProfile, 
      reasons,
      riskHints
    );

    // Calculate behavior score based on past interactions
    const behaviorScore = await this.calculateBehaviorScore(
      userProfile.userId,
      candidateProfile.userId
    );

    // Combine scores
    const score = 0.6 * hardScore + 0.3 * semanticScore + 0.1 * behaviorScore;

    return {
      score,
      hardScore,
      semanticScore,
      behaviorScore,
      reasons: reasons.sort((a, b) => b.score - a.score).slice(0, 3),
      riskHints: riskHints.slice(0, 1),
    };
  }

  private checkHardConstraints(
    userProfile: UserProfile,
    candidateProfile: UserProfile,
    mustHave?: MatchingConstraints['mustHave']
  ): number {
    if (!mustHave) return 1;

    // Check timezone overlap
    if (mustHave.timezone) {
      // TODO: Implement timezone overlap logic
      // For now, simple check
      if (userProfile.timezone !== candidateProfile.timezone) {
        return 0;
      }
    }

    // Check weekly hours
    if (mustHave.weeklyHours) {
      if (candidateProfile.weeklyHours < mustHave.weeklyHours.min ||
          candidateProfile.weeklyHours > mustHave.weeklyHours.max) {
        return 0;
      }
    }

    // Check remote preference
    if (mustHave.remotePref && !mustHave.remotePref.includes(candidateProfile.remotePref)) {
      return 0;
    }

    // Check role intent
    if (mustHave.roleIntent && !mustHave.roleIntent.includes(candidateProfile.roleIntent)) {
      return 0;
    }

    return 1;
  }

  private calculateSemanticScore(
    userProfile: UserProfile,
    candidateProfile: UserProfile,
    reasons: MatchReason[],
    riskHints: string[]
  ): number {
    let score = 0;

    // Role complementarity
    const complementaryRoles = this.roleComplementMap[userProfile.roleIntent] || [];
    if (complementaryRoles.includes(candidateProfile.roleIntent)) {
      const roleScore = this.activeWeights.roleComplement;
      score += roleScore;
      reasons.push({
        type: "role_complement",
        detail: `You're looking for ${userProfile.roleIntent}, they're ${candidateProfile.roleIntent}`,
        score: roleScore,
      });
    }

    // Timezone overlap
    const timezoneScore = this.calculateTimezoneOverlap(userProfile.timezone, candidateProfile.timezone);
    if (timezoneScore > 0) {
      score += timezoneScore * this.activeWeights.timezoneOverlap;
      reasons.push({
        type: "timezone_overlap",
        detail: `${Math.round(timezoneScore * 8)} hours of daily overlap`,
        score: timezoneScore * this.activeWeights.timezoneOverlap,
      });
    }

    // Industry alignment
    const industryOverlap = this.calculateArrayOverlap(
      userProfile.industries || [],
      candidateProfile.industries || []
    );
    if (industryOverlap > 0) {
      const industryScore = industryOverlap * this.activeWeights.industryAlign;
      score += industryScore;
      reasons.push({
        type: "industry_align",
        detail: `Shared interest in ${(userProfile.industries || []).filter(i => 
          (candidateProfile.industries || []).includes(i)
        ).join(", ")}`,
        score: industryScore,
      });
    }

    // Tech stack compatibility
    const techOverlap = this.calculateArrayOverlap(
      userProfile.techStack || [],
      candidateProfile.techStack || []
    );
    if (techOverlap > 0) {
      const techScore = techOverlap * this.activeWeights.techStackCompat;
      score += techScore;
      reasons.push({
        type: "tech_stack",
        detail: `Common skills in ${(userProfile.techStack || []).filter(t => 
          (candidateProfile.techStack || []).includes(t)
        ).slice(0, 3).join(", ")}`,
        score: techScore,
      });
    }

    // Equity expectation alignment
    if (userProfile.equityExpectation && candidateProfile.equityExpectation) {
      const equityDiff = Math.abs(userProfile.equityExpectation - candidateProfile.equityExpectation);
      if (equityDiff < 2) {
        const equityScore = (1 - equityDiff / 10) * this.activeWeights.equityExpectBand;
        score += equityScore;
        reasons.push({
          type: "equity_align",
          detail: `Similar equity expectations (${candidateProfile.equityExpectation}%)`,
          score: equityScore,
        });
      } else if (equityDiff > 5) {
        riskHints.push(`Large equity expectation gap (${equityDiff}% difference)`);
      }
    }

    // Risk tolerance alignment
    if (userProfile.riskTolerance && candidateProfile.riskTolerance) {
      const riskDiff = Math.abs(userProfile.riskTolerance - candidateProfile.riskTolerance);
      if (riskDiff <= 2) {
        const riskScore = (1 - riskDiff / 10) * this.activeWeights.riskTolerance;
        score += riskScore;
        reasons.push({
          type: "risk_align",
          detail: `Compatible risk tolerance levels`,
          score: riskScore,
        });
      }
    }

    // Add risk hints for potential mismatches
    if (userProfile.remotePref !== candidateProfile.remotePref) {
      riskHints.push(`Different work location preferences`);
    }

    if (Math.abs(userProfile.weeklyHours - candidateProfile.weeklyHours) > 20) {
      riskHints.push(`Significant time commitment difference`);
    }

    return Math.min(score, 1); // Cap at 1
  }

  private calculateTimezoneOverlap(tz1: string, tz2: string): number {
    // TODO: Implement proper timezone overlap calculation
    // For now, return 1 if same timezone, 0.5 if close, 0 otherwise
    if (tz1 === tz2) return 1;
    return 0.5; // Placeholder
  }

  private calculateArrayOverlap(arr1: string[], arr2: string[]): number {
    if (arr1.length === 0 || arr2.length === 0) return 0;
    const set1 = new Set(arr1);
    const overlap = arr2.filter(item => set1.has(item)).length;
    return overlap / Math.min(arr1.length, arr2.length);
  }

  private async calculateBehaviorScore(userId: number, targetUserId: number): Promise<number> {
    // Get historical interactions
    const interactions = await db
      .select()
      .from(aiMatchingInteractions)
      .where(
        and(
          eq(aiMatchingInteractions.userId, userId),
          eq(aiMatchingInteractions.targetUserId, targetUserId)
        )
      );

    if (interactions.length === 0) return 0.5; // Neutral score

    // Calculate score based on past actions
    let score = 0.5;
    for (const interaction of interactions) {
      switch (interaction.action) {
        case "like":
          score += 0.1;
          break;
        case "skip":
          score -= 0.2;
          break;
        case "connect":
          score += 0.2;
          break;
        case "meet":
          score += 0.3;
          if (interaction.qualityScore) {
            score += (interaction.qualityScore - 3) * 0.1;
          }
          break;
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  async recordInteraction(data: InsertAiMatchingInteraction): Promise<void> {
    await db.insert(aiMatchingInteractions).values(data);

    // Update match stage if applicable
    if (data.action === "connect" || data.action === "meet") {
      const stageMap = {
        connect: "contacted",
        meet: "meeting",
      };

      await db
        .update(aiMatches)
        .set({
          stage: stageMap[data.action],
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(aiMatches.userId, data.userId),
            eq(aiMatches.targetUserId, data.targetUserId)
          )
        );
    }
  }

  private async recordImpressions(userId: number, targetUserIds: number[]): Promise<void> {
    // Record that these profiles were shown to the user
    const impressions = targetUserIds.map(targetUserId => ({
      userId,
      targetUserId,
      action: "view" as const,
      createdAt: new Date(),
    }));

    if (impressions.length > 0) {
      await db.insert(aiMatchingInteractions).values(impressions);
    }
  }

  async createMatches(candidates: MatchCandidate[], userId: number): Promise<AiMatch[]> {
    const matches = candidates.map(candidate => ({
      userId,
      targetUserId: candidate.userId,
      score: candidate.score,
      hardScore: candidate.hardScore,
      semanticScore: candidate.semanticScore,
      behaviorScore: candidate.behaviorScore,
      reasons: candidate.reasons,
      riskHints: candidate.riskHints.length > 0 ? candidate.riskHints : null,
      algorithmVersion: "v1",
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
    }));

    const inserted = await db
      .insert(aiMatches)
      .values(matches)
      .onConflictDoNothing()
      .returning();

    return inserted;
  }

  async proposeMeeting(
    matchId: number, 
    proposerUserId: number,
    slots: Array<{ start: string; end: string; timezone: string }>
  ): Promise<MeetingSchedule> {
    const [schedule] = await db
      .insert(meetingSchedules)
      .values({
        matchId,
        proposerUserId,
        proposedSlots: slots,
      })
      .returning();

    // Update match stage
    await db
      .update(aiMatches)
      .set({
        stage: "meeting",
        updatedAt: new Date(),
      })
      .where(eq(aiMatches.id, matchId));

    return schedule;
  }

  async runBatchMatching(eventId?: number): Promise<BatchMatchingRun> {
    const startTime = new Date();

    // Create batch run record
    const [run] = await db
      .insert(batchMatchingRuns)
      .values({
        eventId,
        runType: eventId ? "event" : "daily",
        totalUsers: 0,
        matchesGenerated: 0,
        algorithmVersion: "v1",
        startedAt: startTime,
        status: "running",
      })
      .returning();

    try {
      // Get all active users with profiles
      const activeUsers = await db
        .select({ userId: userProfiles.userId })
        .from(userProfiles);

      let totalMatches = 0;

      // Generate matches for each user
      for (const { userId } of activeUsers) {
        const recommendations = await this.getRecommendations(userId, 5);
        const matches = await this.createMatches(recommendations, userId);
        totalMatches += matches.length;
      }

      // Update run status
      await db
        .update(batchMatchingRuns)
        .set({
          totalUsers: activeUsers.length,
          matchesGenerated: totalMatches,
          completedAt: new Date(),
          status: "completed",
          runMetrics: {
            avgScore: 0.75, // TODO: Calculate actual average
            processingTime: Date.now() - startTime.getTime(),
          },
        })
        .where(eq(batchMatchingRuns.id, run.id));

      return run;
    } catch (error) {
      // Update run status to failed
      await db
        .update(batchMatchingRuns)
        .set({
          status: "failed",
          completedAt: new Date(),
        })
        .where(eq(batchMatchingRuns.id, run.id));

      throw error;
    }
  }

}

export const aiMatchingService = new AiMatchingService();