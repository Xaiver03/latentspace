import { db } from "../db";
import { 
  reputationScores,
  reputationTransactions,
  reputationAchievements,
  reputationEndorsements,
  reputationStakes,
  reputationGovernance,
  governanceVotes,
  reputationRules,
  type ReputationScore,
  type ReputationTransaction,
  insertReputationTransactionSchema,
  insertEndorsementSchema,
  insertStakeSchema,
  insertGovernanceProposalSchema,
} from "@shared/reputation-schema";
import { users } from "@shared/schema";
import { eq, and, or, desc, asc, sql, gte, lte, between } from "drizzle-orm";
import crypto from "crypto";

// Mock blockchain integration - in production, this would connect to actual blockchain
class BlockchainConnector {
  async recordTransaction(transaction: any): Promise<{ txHash: string; blockNumber: number }> {
    // Simulate blockchain transaction
    const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
    const blockNumber = Math.floor(Math.random() * 1000000) + 1000000;
    
    // In production: await web3.eth.sendTransaction(transaction);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay
    
    return { txHash, blockNumber };
  }

  async verifyTransaction(txHash: string): Promise<boolean> {
    // In production: await web3.eth.getTransactionReceipt(txHash);
    return true;
  }

  async mintAchievementNFT(userId: number, achievementType: string): Promise<{ tokenId: string; tokenUri: string }> {
    // Simulate NFT minting
    const tokenId = `${userId}_${achievementType}_${Date.now()}`;
    const tokenUri = `ipfs://achievement/${tokenId}`;
    
    // In production: await nftContract.mint(userAddress, metadata);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return { tokenId, tokenUri };
  }
}

export interface ReputationUpdate {
  userId: number;
  type: "match_success" | "contribution" | "peer_review" | "community_vote" | "penalty";
  category: "matching" | "contribution" | "collaboration" | "community";
  amount: number;
  reason: string;
  metadata?: any;
  fromUserId?: number;
}

export interface ReputationStats {
  score: ReputationScore;
  recentTransactions: ReputationTransaction[];
  achievements: any[];
  endorsements: any[];
  activeStakes: any[];
  rank: {
    current: string;
    nextRank: string;
    progress: number;
  };
}

export class ReputationService {
  private blockchain: BlockchainConnector;

  constructor() {
    this.blockchain = new BlockchainConnector();
  }

  // ===== REPUTATION SCORE MANAGEMENT =====

  async initializeUserReputation(userId: number): Promise<ReputationScore> {
    const [existing] = await db
      .select()
      .from(reputationScores)
      .where(eq(reputationScores.userId, userId))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [score] = await db
      .insert(reputationScores)
      .values({
        userId,
        totalScore: "100.00", // Starting reputation
        level: 1,
        rank: "newcomer",
      })
      .returning();

    // Record initial transaction
    await this.recordReputationChange({
      userId,
      type: "community_vote",
      category: "community",
      amount: 100,
      reason: "Welcome bonus - initial reputation grant",
      metadata: { isInitial: true },
    });

    return score;
  }

  async getUserReputation(userId: number): Promise<ReputationStats> {
    let score = await this.getOrCreateScore(userId);

    // Get recent transactions
    const recentTransactions = await db
      .select()
      .from(reputationTransactions)
      .where(eq(reputationTransactions.toUserId, userId))
      .orderBy(desc(reputationTransactions.createdAt))
      .limit(10);

    // Get achievements
    const achievements = await db
      .select({
        achievement: reputationAchievements,
        progress: sql<number>`${reputationAchievements.currentProgress}::float / ${reputationAchievements.maxProgress}::float`,
      })
      .from(reputationAchievements)
      .where(eq(reputationAchievements.userId, userId))
      .orderBy(desc(reputationAchievements.unlockedAt));

    // Get endorsements
    const endorsements = await db
      .select({
        endorsement: reputationEndorsements,
        endorser: users,
      })
      .from(reputationEndorsements)
      .innerJoin(users, eq(reputationEndorsements.endorserId, users.id))
      .where(eq(reputationEndorsements.endorsedId, userId))
      .orderBy(desc(reputationEndorsements.createdAt))
      .limit(5);

    // Get active stakes
    const activeStakes = await db
      .select()
      .from(reputationStakes)
      .where(and(
        eq(reputationStakes.userId, userId),
        eq(reputationStakes.status, "active")
      ));

    // Calculate rank progress
    const rankInfo = this.calculateRankProgress(score);

    return {
      score,
      recentTransactions,
      achievements: achievements.map(a => ({
        ...a.achievement,
        progressPercentage: Math.round(a.progress * 100),
      })),
      endorsements: endorsements.map(e => ({
        ...e.endorsement,
        endorserName: e.endorser.fullName,
        endorserAvatar: e.endorser.avatarUrl || undefined,
      })),
      activeStakes,
      rank: rankInfo,
    };
  }

  async recordReputationChange(update: ReputationUpdate): Promise<ReputationTransaction> {
    // Create transaction record
    const [transaction] = await db
      .insert(reputationTransactions)
      .values({
        fromUserId: update.fromUserId,
        toUserId: update.userId,
        type: update.type,
        category: update.category,
        amount: update.amount.toFixed(2),
        reason: update.reason,
        metadata: update.metadata,
        status: "pending",
      })
      .returning();

    try {
      // Record on blockchain
      const { txHash, blockNumber } = await this.blockchain.recordTransaction({
        from: update.fromUserId || "system",
        to: update.userId,
        amount: update.amount,
        type: update.type,
        timestamp: new Date().toISOString(),
      });

      // Update transaction with blockchain data
      await db
        .update(reputationTransactions)
        .set({
          txHash,
          blockNumber,
          status: "confirmed",
          verified: true,
          verifiedAt: new Date(),
        })
        .where(eq(reputationTransactions.id, transaction.id));

      // Update user's reputation score
      await this.updateUserScore(update.userId, update.category, update.amount);

      // Check for achievements
      await this.checkAndUnlockAchievements(update.userId, update.type);

      return { ...transaction, txHash, blockNumber, status: "confirmed" };
    } catch (error) {
      // Mark transaction as failed
      await db
        .update(reputationTransactions)
        .set({ status: "failed" })
        .where(eq(reputationTransactions.id, transaction.id));

      throw error;
    }
  }

  private async updateUserScore(userId: number, category: string, amount: number): Promise<void> {
    const score = await this.getOrCreateScore(userId);
    
    const updates: any = {
      totalScore: sql`${reputationScores.totalScore} + ${amount}`,
      updatedAt: new Date(),
    };

    // Update category-specific scores
    switch (category) {
      case "matching":
        updates.matchingScore = sql`${reputationScores.matchingScore} + ${amount}`;
        break;
      case "contribution":
        updates.contributionScore = sql`${reputationScores.contributionScore} + ${amount}`;
        break;
      case "collaboration":
        updates.collaborationScore = sql`${reputationScores.collaborationScore} + ${amount}`;
        break;
      case "community":
        updates.communityScore = sql`${reputationScores.communityScore} + ${amount}`;
        break;
    }

    // Update level and rank based on new total score
    const newTotalScore = parseFloat(score.totalScore || "100.00") + amount;
    updates.level = Math.floor(newTotalScore / 100) + 1;
    updates.rank = this.calculateRank(newTotalScore);

    await db
      .update(reputationScores)
      .set(updates)
      .where(eq(reputationScores.userId, userId));
  }

  private calculateRank(totalScore: number): string {
    if (totalScore < 500) return "newcomer";
    if (totalScore < 1000) return "contributor";
    if (totalScore < 2500) return "expert";
    if (totalScore < 5000) return "leader";
    return "visionary";
  }

  private calculateRankProgress(score: ReputationScore): {
    current: string;
    nextRank: string;
    progress: number;
  } {
    const totalScore = parseFloat(score.totalScore || "100.00");
    const ranks = [
      { name: "newcomer", min: 0, max: 500 },
      { name: "contributor", min: 500, max: 1000 },
      { name: "expert", min: 1000, max: 2500 },
      { name: "leader", min: 2500, max: 5000 },
      { name: "visionary", min: 5000, max: Infinity },
    ];

    const currentRankIndex = ranks.findIndex(r => r.name === score.rank);
    const currentRank = ranks[currentRankIndex];
    const nextRank = ranks[currentRankIndex + 1];

    if (!nextRank) {
      return {
        current: currentRank.name,
        nextRank: "maximum",
        progress: 100,
      };
    }

    const progress = ((totalScore - currentRank.min) / (nextRank.min - currentRank.min)) * 100;

    return {
      current: currentRank.name,
      nextRank: nextRank.name,
      progress: Math.min(100, Math.max(0, progress)),
    };
  }

  // ===== ACHIEVEMENTS =====

  private async checkAndUnlockAchievements(userId: number, transactionType: string): Promise<void> {
    // Define achievement rules
    const achievementRules = [
      {
        type: "first_match",
        title: "First Match",
        description: "Successfully completed your first co-founder match",
        condition: async () => {
          const score = await this.getOrCreateScore(userId);
          return (score.successfulMatches || 0) === 1;
        },
        maxProgress: 1,
        rarity: "common",
      },
      {
        type: "match_master",
        title: "Match Master",
        description: "Successfully completed 10 co-founder matches",
        condition: async () => {
          const score = await this.getOrCreateScore(userId);
          return (score.successfulMatches || 0) >= 10;
        },
        maxProgress: 10,
        rarity: "rare",
      },
      {
        type: "trusted_member",
        title: "Trusted Member",
        description: "Reached trust score of 0.8 or higher",
        condition: async () => {
          const score = await this.getOrCreateScore(userId);
          return parseFloat(score.trustScore || "0.50") >= 0.8;
        },
        maxProgress: 1,
        rarity: "epic",
      },
      {
        type: "community_leader",
        title: "Community Leader",
        description: "Reached Leader rank",
        condition: async () => {
          const score = await this.getOrCreateScore(userId);
          return score.rank === "leader";
        },
        maxProgress: 1,
        rarity: "legendary",
      },
    ];

    for (const rule of achievementRules) {
      const [existing] = await db
        .select()
        .from(reputationAchievements)
        .where(and(
          eq(reputationAchievements.userId, userId),
          eq(reputationAchievements.type, rule.type)
        ))
        .limit(1);

      if (!existing) {
        // Create achievement tracker
        await db.insert(reputationAchievements).values({
          userId,
          type: rule.type,
          title: rule.title,
          description: rule.description,
          maxProgress: rule.maxProgress,
          rarity: rule.rarity,
        });
      }

      // Check if achievement should be unlocked
      if (!existing?.unlockedAt && await rule.condition()) {
        // Unlock achievement
        const [achievement] = await db
          .update(reputationAchievements)
          .set({
            currentProgress: rule.maxProgress,
            unlockedAt: new Date(),
          })
          .where(and(
            eq(reputationAchievements.userId, userId),
            eq(reputationAchievements.type, rule.type)
          ))
          .returning();

        // Mint NFT
        if (achievement) {
          const { tokenId, tokenUri } = await this.blockchain.mintAchievementNFT(userId, rule.type);
          
          await db
            .update(reputationAchievements)
            .set({
              tokenId,
              tokenUri,
              mintedAt: new Date(),
            })
            .where(eq(reputationAchievements.id, achievement.id));

          // Award bonus reputation
          await this.recordReputationChange({
            userId,
            type: "community_vote",
            category: "community",
            amount: rule.rarity === "legendary" ? 100 : rule.rarity === "epic" ? 50 : rule.rarity === "rare" ? 25 : 10,
            reason: `Achievement unlocked: ${rule.title}`,
            metadata: { achievementType: rule.type },
          });
        }
      }
    }
  }

  // ===== ENDORSEMENTS =====

  async createEndorsement(data: typeof insertEndorsementSchema._type & { endorserId: number }): Promise<void> {
    // Check if already endorsed this skill
    const [existing] = await db
      .select()
      .from(reputationEndorsements)
      .where(and(
        eq(reputationEndorsements.endorserId, data.endorserId),
        eq(reputationEndorsements.endorsedId, data.endorsedId),
        eq(reputationEndorsements.skill, data.skill)
      ))
      .limit(1);

    if (existing) {
      throw new Error("You have already endorsed this skill");
    }

    // Get endorser's reputation to calculate weight
    const endorserScore = await this.getOrCreateScore(data.endorserId);
    const weight = Math.min(2.0, 0.5 + (parseFloat(endorserScore.totalScore) / 5000));

    await db.insert(reputationEndorsements).values({
      ...data,
      weight: weight.toFixed(2),
      signatureHash: crypto.randomBytes(32).toString('hex'),
    });

    // Award reputation to endorsed user
    await this.recordReputationChange({
      userId: data.endorsedId,
      fromUserId: data.endorserId,
      type: "peer_review",
      category: "community",
      amount: data.level * weight * 2, // 2-20 points based on level and endorser weight
      reason: `Skill endorsement: ${data.skill}`,
      metadata: { skill: data.skill, level: data.level },
    });
  }

  // ===== STAKING =====

  async createStake(data: typeof insertStakeSchema._type & { userId: number }): Promise<void> {
    const score = await this.getOrCreateScore(data.userId);
    const availableReputation = parseFloat(score.totalScore || "100.00");
    const stakeAmount = parseFloat(data.amount);

    if (stakeAmount > availableReputation * 0.2) {
      throw new Error("Cannot stake more than 20% of total reputation");
    }

    await db.insert(reputationStakes).values(data);

    // Lock reputation
    await db
      .update(reputationScores)
      .set({
        totalScore: sql`${reputationScores.totalScore} - ${stakeAmount}`,
        updatedAt: new Date(),
      })
      .where(eq(reputationScores.userId, data.userId));
  }

  async releaseStake(stakeId: number, success: boolean): Promise<void> {
    const [stake] = await db
      .select()
      .from(reputationStakes)
      .where(eq(reputationStakes.id, stakeId))
      .limit(1);

    if (!stake || stake.status !== "active") {
      throw new Error("Invalid or inactive stake");
    }

    if (success) {
      // Release stake with bonus
      const bonus = parseFloat(stake.amount) * 0.1; // 10% bonus
      
      await db
        .update(reputationStakes)
        .set({
          status: "released",
          updatedAt: new Date(),
        })
        .where(eq(reputationStakes.id, stakeId));

      await this.recordReputationChange({
        userId: stake.userId,
        type: "community_vote",
        category: "collaboration",
        amount: parseFloat(stake.amount) + bonus,
        reason: "Stake released successfully with bonus",
        metadata: { stakeId, bonus },
      });
    } else {
      // Slash stake
      const slashAmount = parseFloat(stake.amount) * 0.5; // 50% slash
      
      await db
        .update(reputationStakes)
        .set({
          status: "slashed",
          slashReason: "Failed to meet commitment",
          slashAmount: slashAmount.toFixed(2),
          updatedAt: new Date(),
        })
        .where(eq(reputationStakes.id, stakeId));

      // Return remaining amount
      await this.recordReputationChange({
        userId: stake.userId,
        type: "penalty",
        category: "collaboration",
        amount: parseFloat(stake.amount) - slashAmount,
        reason: "Partial stake return after slash",
        metadata: { stakeId, slashAmount },
      });
    }
  }

  // ===== GOVERNANCE =====

  async createGovernanceProposal(data: typeof insertGovernanceProposalSchema._type & { proposerUserId: number }): Promise<void> {
    const proposerScore = await this.getOrCreateScore(data.proposerUserId);
    
    // Require minimum reputation to create proposals
    if (parseFloat(proposerScore.totalScore) < 500) {
      throw new Error("Minimum 500 reputation required to create proposals");
    }

    await db.insert(reputationGovernance).values(data);
  }

  async voteOnProposal(proposalId: string, userId: number, vote: boolean, reason?: string): Promise<void> {
    // Check if already voted
    const [existing] = await db
      .select()
      .from(governanceVotes)
      .where(and(
        eq(governanceVotes.proposalId, proposalId),
        eq(governanceVotes.userId, userId)
      ))
      .limit(1);

    if (existing) {
      throw new Error("Already voted on this proposal");
    }

    // Calculate vote weight based on reputation
    const score = await this.getOrCreateScore(userId);
    const weight = Math.sqrt(parseFloat(score.totalScore || "100.00")); // Square root for diminishing returns

    await db.insert(governanceVotes).values({
      proposalId,
      userId,
      vote,
      weight: weight.toFixed(2),
      reason,
    });

    // Update proposal vote counts
    await db
      .update(reputationGovernance)
      .set(vote ? {
        votesFor: sql`${reputationGovernance.votesFor} + ${weight}`,
      } : {
        votesAgainst: sql`${reputationGovernance.votesAgainst} + ${weight}`,
      })
      .where(eq(reputationGovernance.proposalId, proposalId));
  }

  // ===== REPUTATION DECAY =====

  async applyReputationDecay(): Promise<void> {
    // Apply monthly decay to inactive users
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const inactiveUsers = await db
      .select()
      .from(reputationScores)
      .where(lte(reputationScores.updatedAt, thirtyDaysAgo));

    for (const user of inactiveUsers) {
      const decayAmount = parseFloat(user.totalScore) * 0.02; // 2% decay
      
      await this.recordReputationChange({
        userId: user.userId,
        type: "penalty",
        category: "community",
        amount: -decayAmount,
        reason: "Monthly inactivity decay",
        metadata: { lastActive: user.updatedAt },
      });
    }
  }

  // ===== TRUST SCORE CALCULATION =====

  async calculateTrustScore(userId: number): Promise<number> {
    const score = await this.getOrCreateScore(userId);
    
    // Factors for trust score
    const factors = {
      successRate: (score.totalTransactions || 0) > 0 
        ? (score.successfulMatches || 0) / (score.totalTransactions || 1) 
        : 0.5,
      verificationLevel: (score.verificationLevel || 0) / 5,
      endorsementScore: await this.getEndorsementScore(userId),
      reputationNormalized: Math.min(1, parseFloat(score.totalScore || "100.00") / 5000),
      penaltyFactor: await this.getPenaltyFactor(userId),
    };

    // Weighted average
    const trustScore = 
      factors.successRate * 0.3 +
      factors.verificationLevel * 0.2 +
      factors.endorsementScore * 0.2 +
      factors.reputationNormalized * 0.2 +
      factors.penaltyFactor * 0.1;

    await db
      .update(reputationScores)
      .set({
        trustScore: trustScore.toFixed(2),
        updatedAt: new Date(),
      })
      .where(eq(reputationScores.userId, userId));

    return trustScore;
  }

  private async getEndorsementScore(userId: number): Promise<number> {
    const endorsements = await db
      .select({
        avgLevel: sql<number>`AVG(${reputationEndorsements.level} * ${reputationEndorsements.weight})`,
      })
      .from(reputationEndorsements)
      .where(eq(reputationEndorsements.endorsedId, userId));

    const avgLevel = endorsements[0]?.avgLevel || 0;
    return Math.min(1, avgLevel / 5);
  }

  private async getPenaltyFactor(userId: number): Promise<number> {
    const penalties = await db
      .select({
        count: sql<number>`COUNT(*)`,
      })
      .from(reputationTransactions)
      .where(and(
        eq(reputationTransactions.toUserId, userId),
        eq(reputationTransactions.type, "penalty")
      ));

    const penaltyCount = penalties[0]?.count || 0;
    return Math.max(0, 1 - (penaltyCount * 0.1)); // -10% per penalty
  }

  // ===== UTILITY METHODS =====

  private async getOrCreateScore(userId: number): Promise<ReputationScore> {
    const [existing] = await db
      .select()
      .from(reputationScores)
      .where(eq(reputationScores.userId, userId))
      .limit(1);

    if (existing) {
      return existing;
    }

    return this.initializeUserReputation(userId);
  }

  async getLeaderboard(category?: string, limit: number = 100): Promise<Array<{
    user: any;
    score: ReputationScore;
    rank: number;
  }>> {
    let orderByClause;
    
    switch (category) {
      case "matching":
        orderByClause = desc(reputationScores.matchingScore);
        break;
      case "contribution":
        orderByClause = desc(reputationScores.contributionScore);
        break;
      case "collaboration":
        orderByClause = desc(reputationScores.collaborationScore);
        break;
      case "community":
        orderByClause = desc(reputationScores.communityScore);
        break;
      default:
        orderByClause = desc(reputationScores.totalScore);
    }

    const leaderboard = await db
      .select({
        score: reputationScores,
        user: users,
      })
      .from(reputationScores)
      .innerJoin(users, eq(reputationScores.userId, users.id))
      .orderBy(orderByClause)
      .limit(limit);

    return leaderboard.map((entry, index) => ({
      user: entry.user,
      score: entry.score,
      rank: index + 1,
    }));
  }
}

export const reputationService = new ReputationService();