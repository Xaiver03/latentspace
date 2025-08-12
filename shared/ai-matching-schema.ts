import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index, uniqueIndex, real, vector } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

// User profiles for AI matching
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  
  // Core profile data
  roleIntent: text("role_intent").notNull(), // CEO, CTO, CPO, CMO, etc.
  seniority: text("seniority").notNull(), // student, junior, mid, senior
  timezone: text("timezone").notNull(),
  weeklyHours: integer("weekly_hours").notNull(),
  locationCity: text("location_city").notNull(),
  remotePref: text("remote_pref").notNull(), // remote_first, hybrid, onsite_first
  
  // Financial expectations
  equityExpectation: real("equity_expectation"), // percentage
  salaryExpectation: integer("salary_expectation"), // annual in USD
  
  // Constraints
  visaConstraint: boolean("visa_constraint").default(false),
  
  // Skills and experience
  skills: text("skills").array(),
  industries: text("industries").array(),
  techStack: text("tech_stack").array(),
  
  // Structured data
  languageLevel: jsonb("language_level"), // {english: "fluent", chinese: "native"}
  workStyle: jsonb("work_style"), // {pace: "fast", comm: "async", structure: "flexible"}
  values: jsonb("values"), // {innovation: 5, stability: 3, growth: 4}
  riskTolerance: integer("risk_tolerance"), // 1-10
  companyStagePrefs: jsonb("company_stage_prefs"), // {idea: true, seed: true, seriesA: false}
  
  // Bio and embedding
  bio: text("bio"),
  profileVector: vector("profile_vector", { dimensions: 768 }), // text embedding
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("user_profiles_user_id_idx").on(table.userId),
  vectorIdx: index("user_profiles_vector_idx").using("ivfflat", table.profileVector.op("vector_l2_ops")),
}));

// Matching preferences
export const matchingPreferences = pgTable("matching_preferences", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull().unique(),
  
  // Constraints
  mustHave: jsonb("must_have").notNull().default({}), // hard constraints
  niceToHave: jsonb("nice_to_have").notNull().default({}), // soft constraints
  dealBreakers: jsonb("deal_breakers").notNull().default({}), // exclusions
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("matching_preferences_user_id_idx").on(table.userId),
}));

// Matching interactions tracking
export const aiMatchingInteractions = pgTable("ai_matching_interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  targetUserId: integer("target_user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // view, like, skip, connect, meet
  latencyMs: integer("latency_ms"), // response time
  qualityScore: integer("quality_score"), // post-meeting rating 1-5
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("ai_interactions_user_id_idx").on(table.userId),
  targetUserIdIdx: index("ai_interactions_target_user_id_idx").on(table.targetUserId),
  actionIdx: index("ai_interactions_action_idx").on(table.action),
}));

// AI-generated matches
export const aiMatches = pgTable("ai_matches", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  targetUserId: integer("target_user_id").references(() => users.id).notNull(),
  
  // Scoring breakdown
  score: real("score").notNull(),
  hardScore: real("hard_score").notNull(),
  semanticScore: real("semantic_score").notNull(),
  behaviorScore: real("behavior_score").notNull(),
  
  // Explainability
  reasons: jsonb("reasons").notNull(), // [{type, detail, score}]
  riskHints: jsonb("risk_hints"), // potential concerns
  
  // Stage tracking
  stage: text("stage").notNull().default("recommended"), // recommended, contacted, meeting, success, dropped
  
  // Metadata
  algorithmVersion: text("algorithm_version").notNull().default("v1"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  userIdIdx: index("ai_matches_user_id_idx").on(table.userId),
  targetUserIdIdx: index("ai_matches_target_user_id_idx").on(table.targetUserId),
  scoreIdx: index("ai_matches_score_idx").on(table.score.desc()),
  stageIdx: index("ai_matches_stage_idx").on(table.stage),
  userTargetIdx: uniqueIndex("ai_matches_user_target_idx").on(table.userId, table.targetUserId),
}));

// Meeting schedules
export const meetingSchedules = pgTable("meeting_schedules", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => aiMatches.id).notNull(),
  proposerUserId: integer("proposer_user_id").references(() => users.id).notNull(),
  
  // Scheduling data
  proposedSlots: jsonb("proposed_slots").notNull(), // [{start, end, timezone}]
  selectedSlot: jsonb("selected_slot"),
  meetingLink: text("meeting_link"),
  
  // Status tracking
  status: text("status").notNull().default("proposed"), // proposed, accepted, rescheduled, completed, cancelled
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  matchIdIdx: index("meeting_schedules_match_id_idx").on(table.matchId),
  proposerIdx: index("meeting_schedules_proposer_idx").on(table.proposerUserId),
  statusIdx: index("meeting_schedules_status_idx").on(table.status),
}));

// Feature weights for model versioning
export const matchingFeatureWeights = pgTable("matching_feature_weights", {
  id: serial("id").primaryKey(),
  version: text("version").notNull().unique(),
  weights: jsonb("weights").notNull(), // {roleComplement: 0.22, valueMatch: 0.18, ...}
  thresholds: jsonb("thresholds").notNull(), // {minScore: 0.5, hardConstraintPenalty: -1}
  isActive: boolean("is_active").notNull().default(false),
  performance: jsonb("performance"), // {precision, recall, f1}
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  versionIdx: index("feature_weights_version_idx").on(table.version),
  activeIdx: index("feature_weights_active_idx").on(table.isActive),
}));

// Batch matching runs for events
export const batchMatchingRuns = pgTable("batch_matching_runs", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id"), // optional, for event-specific matching
  runType: text("run_type").notNull(), // daily, event, manual
  totalUsers: integer("total_users").notNull(),
  matchesGenerated: integer("matches_generated").notNull(),
  algorithmVersion: text("algorithm_version").notNull(),
  runMetrics: jsonb("run_metrics"), // {avgScore, processingTime, ...}
  startedAt: timestamp("started_at").notNull(),
  completedAt: timestamp("completed_at"),
  status: text("status").notNull().default("running"), // running, completed, failed
}, (table) => ({
  eventIdIdx: index("batch_runs_event_id_idx").on(table.eventId),
  statusIdx: index("batch_runs_status_idx").on(table.status),
  startedAtIdx: index("batch_runs_started_at_idx").on(table.startedAt),
}));

// Create Zod schemas
export const insertUserProfileSchema = createInsertSchema(userProfiles, {
  roleIntent: z.enum(["CEO", "CTO", "CPO", "CMO", "COO", "CFO", "Technical", "Business"]),
  seniority: z.enum(["student", "junior", "mid", "senior"]),
  remotePref: z.enum(["remote_first", "hybrid", "onsite_first"]),
  weeklyHours: z.number().min(5).max(80),
  equityExpectation: z.number().min(0).max(100).optional(),
  salaryExpectation: z.number().min(0).optional(),
  riskTolerance: z.number().min(1).max(10).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  profileVector: true, // Generated by embedding service
});

export const selectUserProfileSchema = createSelectSchema(userProfiles);

export const insertMatchingPreferenceSchema = createInsertSchema(matchingPreferences, {
  mustHave: z.object({
    timezone: z.string().optional(),
    weeklyHours: z.object({ min: z.number(), max: z.number() }).optional(),
    remotePref: z.array(z.string()).optional(),
    roleIntent: z.array(z.string()).optional(),
  }).optional(),
  niceToHave: z.object({
    industries: z.array(z.string()).optional(),
    techStack: z.array(z.string()).optional(),
    seniority: z.array(z.string()).optional(),
    equityBand: z.object({ min: z.number(), max: z.number() }).optional(),
  }).optional(),
  dealBreakers: z.object({
    noVisa: z.boolean().optional(),
    minWeeklyHours: z.number().optional(),
    excludeRoles: z.array(z.string()).optional(),
  }).optional(),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectMatchingPreferenceSchema = createSelectSchema(matchingPreferences);

export const insertAiMatchingInteractionSchema = createInsertSchema(aiMatchingInteractions, {
  action: z.enum(["view", "like", "skip", "connect", "meet"]),
  qualityScore: z.number().min(1).max(5).optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const selectAiMatchingInteractionSchema = createSelectSchema(aiMatchingInteractions);

export const insertAiMatchSchema = createInsertSchema(aiMatches).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  stage: true, // Use default
  algorithmVersion: true, // Use default
});

export const selectAiMatchSchema = createSelectSchema(aiMatches);

export const insertMeetingScheduleSchema = createInsertSchema(meetingSchedules, {
  proposedSlots: z.array(z.object({
    start: z.string(),
    end: z.string(),
    timezone: z.string(),
  })),
  status: z.enum(["proposed", "accepted", "rescheduled", "completed", "cancelled"]),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  status: true, // Use default
});

export const selectMeetingScheduleSchema = createSelectSchema(meetingSchedules);

// Type exports
export type UserProfile = typeof userProfiles.$inferSelect;
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type MatchingPreference = typeof matchingPreferences.$inferSelect;
export type InsertMatchingPreference = z.infer<typeof insertMatchingPreferenceSchema>;
export type AiMatchingInteraction = typeof aiMatchingInteractions.$inferSelect;
export type InsertAiMatchingInteraction = z.infer<typeof insertAiMatchingInteractionSchema>;
export type AiMatch = typeof aiMatches.$inferSelect;
export type InsertAiMatch = z.infer<typeof insertAiMatchSchema>;
export type MeetingSchedule = typeof meetingSchedules.$inferSelect;
export type InsertMeetingSchedule = z.infer<typeof insertMeetingScheduleSchema>;
export type MatchingFeatureWeights = typeof matchingFeatureWeights.$inferSelect;
export type BatchMatchingRun = typeof batchMatchingRuns.$inferSelect;