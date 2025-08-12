import { Router } from "express";
import { z } from "zod";
import { reputationService } from "../services/reputation-service";
import { 
  insertReputationTransactionSchema,
  insertEndorsementSchema,
  insertStakeSchema,
  insertGovernanceProposalSchema,
} from "@shared/reputation-schema";

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// ===== REPUTATION SCORE ROUTES =====

// Get user's reputation stats
router.get("/users/:userId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const stats = await reputationService.getUserReputation(userId);
    res.json(stats);
  } catch (error) {
    console.error("Get reputation stats error:", error);
    res.status(500).json({ error: "Failed to get reputation stats" });
  }
});

// Get my reputation stats
router.get("/my", requireAuth, async (req, res) => {
  try {
    const stats = await reputationService.getUserReputation(req.user!.id);
    res.json(stats);
  } catch (error) {
    console.error("Get my reputation error:", error);
    res.status(500).json({ error: "Failed to get reputation stats" });
  }
});

// Initialize reputation for new user
router.post("/initialize", requireAuth, async (req, res) => {
  try {
    const score = await reputationService.initializeUserReputation(req.user!.id);
    res.json(score);
  } catch (error) {
    console.error("Initialize reputation error:", error);
    res.status(500).json({ error: "Failed to initialize reputation" });
  }
});

// ===== TRANSACTION ROUTES =====

// Record reputation change (admin only)
router.post("/transactions", requireAuth, async (req, res) => {
  if (req.user!.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const data = insertReputationTransactionSchema.parse(req.body);
    const transaction = await reputationService.recordReputationChange({
      userId: data.toUserId,
      type: data.type,
      category: data.category,
      amount: parseFloat(data.amount),
      reason: data.reason,
      metadata: data.metadata,
      fromUserId: data.fromUserId,
    });
    res.json(transaction);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid transaction data", details: error.errors });
    }
    console.error("Record transaction error:", error);
    res.status(500).json({ error: "Failed to record transaction" });
  }
});

// Get user's transaction history
router.get("/users/:userId/transactions", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    // This would need to be implemented in the service
    res.json({ 
      transactions: [], 
      totalCount: 0,
      page,
      limit 
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ error: "Failed to get transactions" });
  }
});

// ===== ENDORSEMENT ROUTES =====

// Create endorsement
router.post("/endorsements", requireAuth, async (req, res) => {
  try {
    const data = insertEndorsementSchema.parse(req.body);
    
    if (data.endorsedId === req.user!.id) {
      return res.status(400).json({ error: "Cannot endorse yourself" });
    }

    await reputationService.createEndorsement({
      ...data,
      endorserId: req.user!.id,
    });
    
    res.json({ message: "Endorsement created successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid endorsement data", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("already endorsed")) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Create endorsement error:", error);
    res.status(500).json({ error: "Failed to create endorsement" });
  }
});

// Get user's endorsements
router.get("/users/:userId/endorsements", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const stats = await reputationService.getUserReputation(userId);
    res.json({ endorsements: stats.endorsements });
  } catch (error) {
    console.error("Get endorsements error:", error);
    res.status(500).json({ error: "Failed to get endorsements" });
  }
});

// ===== STAKING ROUTES =====

// Create stake
router.post("/stakes", requireAuth, async (req, res) => {
  try {
    const data = insertStakeSchema.parse(req.body);
    await reputationService.createStake({
      ...data,
      userId: req.user!.id,
    });
    res.json({ message: "Stake created successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid stake data", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("Cannot stake")) {
      return res.status(400).json({ error: error.message });
    }
    console.error("Create stake error:", error);
    res.status(500).json({ error: "Failed to create stake" });
  }
});

// Release or slash stake (admin or stake owner)
router.post("/stakes/:stakeId/release", requireAuth, async (req, res) => {
  try {
    const stakeId = parseInt(req.params.stakeId);
    const { success } = z.object({ success: z.boolean() }).parse(req.body);
    
    // In production, verify user has permission to release this stake
    await reputationService.releaseStake(stakeId, success);
    
    res.json({ 
      message: success ? "Stake released successfully" : "Stake slashed",
      success 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request data", details: error.errors });
    }
    console.error("Release stake error:", error);
    res.status(500).json({ error: "Failed to release stake" });
  }
});

// Get user's active stakes
router.get("/my/stakes", requireAuth, async (req, res) => {
  try {
    const stats = await reputationService.getUserReputation(req.user!.id);
    res.json({ stakes: stats.activeStakes });
  } catch (error) {
    console.error("Get stakes error:", error);
    res.status(500).json({ error: "Failed to get stakes" });
  }
});

// ===== ACHIEVEMENT ROUTES =====

// Get user's achievements
router.get("/users/:userId/achievements", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const stats = await reputationService.getUserReputation(userId);
    res.json({ achievements: stats.achievements });
  } catch (error) {
    console.error("Get achievements error:", error);
    res.status(500).json({ error: "Failed to get achievements" });
  }
});

// Get all available achievements
router.get("/achievements/catalog", async (req, res) => {
  try {
    // This would return all possible achievements and their requirements
    const catalog = [
      {
        type: "first_match",
        title: "First Match",
        description: "Successfully completed your first co-founder match",
        rarity: "common",
        requirements: "Complete 1 successful match",
      },
      {
        type: "match_master",
        title: "Match Master",
        description: "Successfully completed 10 co-founder matches",
        rarity: "rare",
        requirements: "Complete 10 successful matches",
      },
      {
        type: "trusted_member",
        title: "Trusted Member",
        description: "Reached trust score of 0.8 or higher",
        rarity: "epic",
        requirements: "Maintain high-quality interactions",
      },
      {
        type: "community_leader",
        title: "Community Leader",
        description: "Reached Leader rank",
        rarity: "legendary",
        requirements: "Accumulate 2500+ reputation points",
      },
    ];
    res.json({ catalog });
  } catch (error) {
    console.error("Get achievement catalog error:", error);
    res.status(500).json({ error: "Failed to get achievement catalog" });
  }
});

// ===== GOVERNANCE ROUTES =====

// Create governance proposal
router.post("/governance/proposals", requireAuth, async (req, res) => {
  try {
    const data = insertGovernanceProposalSchema.parse(req.body);
    await reputationService.createGovernanceProposal({
      ...data,
      proposerUserId: req.user!.id,
    });
    res.json({ message: "Proposal created successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid proposal data", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("Minimum 500 reputation")) {
      return res.status(403).json({ error: error.message });
    }
    console.error("Create proposal error:", error);
    res.status(500).json({ error: "Failed to create proposal" });
  }
});

// Vote on proposal
router.post("/governance/proposals/:proposalId/vote", requireAuth, async (req, res) => {
  try {
    const proposalId = req.params.proposalId;
    const { vote, reason } = z.object({
      vote: z.boolean(),
      reason: z.string().optional(),
    }).parse(req.body);
    
    await reputationService.voteOnProposal(proposalId, req.user!.id, vote, reason);
    res.json({ message: "Vote recorded successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid vote data", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("Already voted")) {
      return res.status(409).json({ error: error.message });
    }
    console.error("Vote error:", error);
    res.status(500).json({ error: "Failed to record vote" });
  }
});

// ===== LEADERBOARD ROUTES =====

// Get reputation leaderboard
router.get("/leaderboard", async (req, res) => {
  try {
    const category = req.query.category as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500);
    
    const leaderboard = await reputationService.getLeaderboard(category, limit);
    res.json({ leaderboard });
  } catch (error) {
    console.error("Get leaderboard error:", error);
    res.status(500).json({ error: "Failed to get leaderboard" });
  }
});

// ===== TRUST SCORE ROUTES =====

// Calculate and update trust score
router.post("/users/:userId/trust-score", requireAuth, async (req, res) => {
  if (req.user!.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const userId = parseInt(req.params.userId);
    const trustScore = await reputationService.calculateTrustScore(userId);
    res.json({ trustScore });
  } catch (error) {
    console.error("Calculate trust score error:", error);
    res.status(500).json({ error: "Failed to calculate trust score" });
  }
});

// ===== SYSTEM ROUTES =====

// Apply reputation decay (scheduled job endpoint)
router.post("/system/decay", requireAuth, async (req, res) => {
  if (req.user!.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    await reputationService.applyReputationDecay();
    res.json({ message: "Reputation decay applied successfully" });
  } catch (error) {
    console.error("Apply decay error:", error);
    res.status(500).json({ error: "Failed to apply reputation decay" });
  }
});

// ===== BLOCKCHAIN SYNC ROUTES =====

// Sync reputation data with blockchain
router.post("/sync/blockchain", requireAuth, async (req, res) => {
  if (req.user!.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    // This would sync pending transactions to blockchain
    res.json({ 
      message: "Blockchain sync initiated",
      pendingTransactions: 0,
      syncedTransactions: 0,
    });
  } catch (error) {
    console.error("Blockchain sync error:", error);
    res.status(500).json({ error: "Failed to sync with blockchain" });
  }
});

export default router;