import { pgTable, serial, text, integer, timestamp, boolean, jsonb, decimal, vector } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

export const aiAgents = pgTable("ai_agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(), // "productivity", "research", "design", "development", "analytics", "communication"
  subcategory: text("subcategory"), // "data-analysis", "writing", "image-generation", etc.
  
  // Product Details
  logo: text("logo"), // URL to logo/icon
  screenshots: text("screenshots").array(), // Array of screenshot URLs
  website: text("website"),
  pricingModel: text("pricing_model").notNull(), // "free", "freemium", "subscription", "one-time", "usage-based"
  priceRange: text("price_range"), // "$0", "$1-10/mo", "$10-50/mo", "$50+/mo"
  
  // Features and Capabilities
  keyFeatures: text("key_features").array(),
  useCases: text("use_cases").array(),
  integrations: text("integrations").array(), // APIs, platforms it integrates with
  
  // Technical Details
  apiAvailable: boolean("api_available").default(false),
  platforms: text("platforms").array(), // "web", "desktop", "mobile", "api"
  languages: text("languages").array(), // Programming languages supported
  
  // AI/ML Specific
  aiModel: text("ai_model"), // GPT-4, Claude, custom, etc.
  capabilities: text("capabilities").array(), // "text-generation", "image-recognition", etc.
  
  // Quality Metrics
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0.00"),
  reviewCount: integer("review_count").default(0),
  usageCount: integer("usage_count").default(0),
  popularityScore: integer("popularity_score").default(0),
  
  // Content
  tags: text("tags").array(),
  embedding: vector("embedding", { dimensions: 768 }), // For semantic search
  
  // Metadata
  createdById: integer("created_by_id").notNull(),
  featured: boolean("featured").default(false),
  verified: boolean("verified").default(false),
  status: text("status").notNull().default("active"), // "active", "inactive", "pending_review"
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentReviews = pgTable("agent_reviews", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => aiAgents.id).notNull(),
  userId: integer("user_id").notNull(),
  
  rating: integer("rating").notNull(), // 1-5 stars
  title: text("title"),
  content: text("content"),
  pros: text("pros").array(),
  cons: text("cons").array(),
  
  // Context
  useCase: text("use_case"), // How they used the tool
  experienceLevel: text("experience_level"), // "beginner", "intermediate", "expert"
  usageDuration: text("usage_duration"), // "< 1 week", "1-4 weeks", "1-6 months", "6+ months"
  
  // Helpfulness
  helpfulCount: integer("helpful_count").default(0),
  reportedCount: integer("reported_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentCollections = pgTable("agent_collections", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdById: integer("created_by_id").notNull(),
  
  agentIds: integer("agent_ids").array(),
  tags: text("tags").array(),
  isPublic: boolean("is_public").default(true),
  
  viewCount: integer("view_count").default(0),
  likeCount: integer("like_count").default(0),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentUsageAnalytics = pgTable("agent_usage_analytics", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => aiAgents.id).notNull(),
  userId: integer("user_id").notNull(),
  
  action: text("action").notNull(), // "view", "click", "bookmark", "share", "review"
  metadata: jsonb("metadata"), // Additional context data
  
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const agentBookmarks = pgTable("agent_bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  agentId: integer("agent_id").references(() => aiAgents.id).notNull(),
  
  collectionId: integer("collection_id").references(() => agentCollections.id),
  notes: text("notes"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const agentRecommendations = pgTable("agent_recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  agentId: integer("agent_id").references(() => aiAgents.id).notNull(),
  
  reason: text("reason").notNull(), // "similar_tools", "popular_in_category", "matches_interests"
  confidence: decimal("confidence", { precision: 3, scale: 2 }), // 0.00-1.00
  metadata: jsonb("metadata"),
  
  shown: boolean("shown").default(false),
  clicked: boolean("clicked").default(false),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Zod schemas for validation
export const insertAiAgentSchema = createInsertSchema(aiAgents, {
  name: z.string().min(1, "Agent name is required").max(100),
  description: z.string().min(10, "Description must be at least 10 characters").max(1000),
  category: z.enum(["productivity", "research", "design", "development", "analytics", "communication", "other"]),
  pricingModel: z.enum(["free", "freemium", "subscription", "one-time", "usage-based"]),
  rating: z.string().regex(/^\d+\.\d{2}$/).optional(),
  keyFeatures: z.array(z.string()).min(1, "At least one key feature is required"),
  platforms: z.array(z.string()).min(1, "At least one platform is required"),
});

export const insertAgentReviewSchema = createInsertSchema(agentReviews, {
  rating: z.number().min(1).max(5),
  title: z.string().min(5, "Review title must be at least 5 characters").max(100).optional(),
  content: z.string().min(10, "Review content must be at least 10 characters").max(2000).optional(),
  experienceLevel: z.enum(["beginner", "intermediate", "expert"]).optional(),
  usageDuration: z.enum(["< 1 week", "1-4 weeks", "1-6 months", "6+ months"]).optional(),
});

export const insertAgentCollectionSchema = createInsertSchema(agentCollections, {
  name: z.string().min(1, "Collection name is required").max(100),
  description: z.string().max(500).optional(),
  agentIds: z.array(z.number()).min(1, "At least one agent is required"),
});

export const insertAgentBookmarkSchema = createInsertSchema(agentBookmarks, {
  notes: z.string().max(500).optional(),
});

export const insertUsageAnalyticsSchema = createInsertSchema(agentUsageAnalytics, {
  action: z.enum(["view", "click", "bookmark", "share", "review", "visit_website"]),
  metadata: z.object({}).optional(),
});

// Type exports
export type AiAgent = typeof aiAgents.$inferSelect;
export type InsertAiAgent = z.infer<typeof insertAiAgentSchema>;
export type AgentReview = typeof agentReviews.$inferSelect;
export type InsertAgentReview = z.infer<typeof insertAgentReviewSchema>;
export type AgentCollection = typeof agentCollections.$inferSelect;
export type InsertAgentCollection = z.infer<typeof insertAgentCollectionSchema>;
export type AgentBookmark = typeof agentBookmarks.$inferSelect;
export type InsertAgentBookmark = z.infer<typeof insertAgentBookmarkSchema>;
export type AgentUsageAnalytics = typeof agentUsageAnalytics.$inferSelect;
export type InsertUsageAnalytics = z.infer<typeof insertUsageAnalyticsSchema>;
export type AgentRecommendation = typeof agentRecommendations.$inferSelect;