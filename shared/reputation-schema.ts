import { pgTable, serial, text, integer, timestamp, boolean, jsonb, decimal, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// Core reputation tracking
export const reputationScores = pgTable("reputation_scores", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  
  // Overall reputation
  totalScore: decimal("total_score", { precision: 10, scale: 2 }).default("100.00"),
  level: integer("level").default(1),
  rank: text("rank").default("newcomer"), // newcomer, contributor, expert, leader, visionary
  
  // Category-specific scores
  matchingScore: decimal("matching_score", { precision: 10, scale: 2 }).default("0.00"),
  contributionScore: decimal("contribution_score", { precision: 10, scale: 2 }).default("0.00"),
  collaborationScore: decimal("collaboration_score", { precision: 10, scale: 2 }).default("0.00"),
  communityScore: decimal("community_score", { precision: 10, scale: 2 }).default("0.00"),
  
  // Trust factors
  verificationLevel: integer("verification_level").default(0), // 0-5 levels
  trustScore: decimal("trust_score", { precision: 3, scale: 2 }).default("0.50"), // 0.00-1.00
  
  // Stats
  totalTransactions: integer("total_transactions").default(0),
  successfulMatches: integer("successful_matches").default(0),
  failedMatches: integer("failed_matches").default(0),
  
  // Blockchain reference
  walletAddress: text("wallet_address"),
  blockchainId: text("blockchain_id"), // On-chain reference
  lastSyncedAt: timestamp("last_synced_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reputation transactions (recorded on-chain)
export const reputationTransactions = pgTable("reputation_transactions", {
  id: serial("id").primaryKey(),
  transactionId: uuid("transaction_id").defaultRandom().notNull().unique(),
  
  fromUserId: integer("from_user_id"),
  toUserId: integer("to_user_id").notNull(),
  
  type: text("type").notNull(), // "match_success", "contribution", "peer_review", "community_vote", "penalty"
  category: text("category").notNull(), // "matching", "contribution", "collaboration", "community"
  
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  metadata: jsonb("metadata"), // Additional context
  
  // Blockchain data
  txHash: text("tx_hash"), // Blockchain transaction hash
  blockNumber: integer("block_number"),
  status: text("status").default("pending"), // "pending", "confirmed", "failed"
  
  // Verification
  verified: boolean("verified").default(false),
  verifiedBy: integer("verified_by"),
  verifiedAt: timestamp("verified_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Achievement NFTs
export const reputationAchievements = pgTable("reputation_achievements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  
  type: text("type").notNull(), // "first_match", "10_matches", "top_contributor", etc.
  title: text("title").notNull(),
  description: text("description").notNull(),
  
  // NFT metadata
  tokenId: text("token_id"),
  tokenUri: text("token_uri"),
  imageUrl: text("image_url"),
  rarity: text("rarity"), // "common", "rare", "epic", "legendary"
  
  // Progress tracking
  currentProgress: integer("current_progress").default(0),
  maxProgress: integer("max_progress").notNull(),
  
  unlockedAt: timestamp("unlocked_at"),
  mintedAt: timestamp("minted_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Peer endorsements
export const reputationEndorsements = pgTable("reputation_endorsements", {
  id: serial("id").primaryKey(),
  endorserId: integer("endorser_id").notNull(),
  endorsedId: integer("endorsed_id").notNull(),
  
  skill: text("skill").notNull(), // "leadership", "technical", "communication", etc.
  level: integer("level").notNull(), // 1-5
  comment: text("comment"),
  
  // Weight based on endorser's reputation
  weight: decimal("weight", { precision: 3, scale: 2 }).default("1.00"),
  
  // Blockchain proof
  signatureHash: text("signature_hash"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Staking mechanism
export const reputationStakes = pgTable("reputation_stakes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  
  stakeType: text("stake_type").notNull(), // "match_guarantee", "project_commitment", "quality_pledge"
  relatedId: integer("related_id"), // matchId, projectId, etc.
  
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  lockedUntil: timestamp("locked_until").notNull(),
  
  status: text("status").default("active"), // "active", "released", "slashed"
  slashReason: text("slash_reason"),
  slashAmount: decimal("slash_amount", { precision: 10, scale: 2 }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reputation governance votes
export const reputationGovernance = pgTable("reputation_governance", {
  id: serial("id").primaryKey(),
  proposalId: uuid("proposal_id").defaultRandom().notNull().unique(),
  
  proposerUserId: integer("proposer_user_id").notNull(),
  type: text("type").notNull(), // "rule_change", "dispute_resolution", "penalty_vote"
  
  title: text("title").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata"),
  
  // Voting
  votesFor: integer("votes_for").default(0),
  votesAgainst: integer("votes_against").default(0),
  quorumRequired: integer("quorum_required").notNull(),
  
  status: text("status").default("active"), // "active", "passed", "rejected", "executed"
  
  votingStartAt: timestamp("voting_start_at").notNull(),
  votingEndAt: timestamp("voting_end_at").notNull(),
  executedAt: timestamp("executed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Individual votes
export const governanceVotes = pgTable("governance_votes", {
  id: serial("id").primaryKey(),
  proposalId: uuid("proposal_id").references(() => reputationGovernance.proposalId).notNull(),
  userId: integer("user_id").notNull(),
  
  vote: boolean("vote").notNull(), // true = for, false = against
  weight: decimal("weight", { precision: 10, scale: 2 }).notNull(), // Based on reputation
  reason: text("reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reputation decay/growth rules
export const reputationRules = pgTable("reputation_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  
  type: text("type").notNull(), // "decay", "growth", "penalty", "bonus"
  category: text("category").notNull(),
  
  // Rule parameters
  formula: jsonb("formula").notNull(), // Mathematical formula/algorithm
  parameters: jsonb("parameters"),
  
  // Conditions
  conditions: jsonb("conditions"),
  frequency: text("frequency"), // "daily", "weekly", "monthly", "on_event"
  
  active: boolean("active").default(true),
  priority: integer("priority").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Zod schemas
export const insertReputationTransactionSchema = createInsertSchema(reputationTransactions, {
  toUserId: z.number().positive(),
  type: z.enum(["match_success", "contribution", "peer_review", "community_vote", "penalty"]),
  category: z.enum(["matching", "contribution", "collaboration", "community"]),
  amount: z.string().regex(/^\d+\.\d{2}$/),
  reason: z.string().min(1, "Reason is required"),
});

export const insertEndorsementSchema = createInsertSchema(reputationEndorsements, {
  endorsedId: z.number().positive(),
  skill: z.string().min(1, "Skill is required"),
  level: z.number().min(1).max(5),
  comment: z.string().max(500).optional(),
});

export const insertStakeSchema = createInsertSchema(reputationStakes, {
  stakeType: z.enum(["match_guarantee", "project_commitment", "quality_pledge"]),
  amount: z.string().regex(/^\d+\.\d{2}$/),
  lockedUntil: z.date(),
});

export const insertGovernanceProposalSchema = createInsertSchema(reputationGovernance, {
  type: z.enum(["rule_change", "dispute_resolution", "penalty_vote"]),
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  quorumRequired: z.number().positive(),
  votingStartAt: z.date(),
  votingEndAt: z.date(),
});

// Type exports
export type ReputationScore = typeof reputationScores.$inferSelect;
export type ReputationTransaction = typeof reputationTransactions.$inferSelect;
export type ReputationAchievement = typeof reputationAchievements.$inferSelect;
export type ReputationEndorsement = typeof reputationEndorsements.$inferSelect;
export type ReputationStake = typeof reputationStakes.$inferSelect;
export type ReputationGovernance = typeof reputationGovernance.$inferSelect;
export type GovernanceVote = typeof governanceVotes.$inferSelect;