import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index, uniqueIndex, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  researchField: text("research_field"),
  affiliation: text("affiliation"),
  bio: text("bio"),
  avatarUrl: text("avatar_url"),
  role: text("role").notNull().default("user"), // user, admin
  isApproved: boolean("is_approved").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  location: text("location"),
  category: text("category").notNull(), // tech_share, startup_share, networking
  maxAttendees: integer("max_attendees"),
  currentAttendees: integer("current_attendees").default(0),
  imageUrl: text("image_url"),
  createdBy: integer("created_by").references(() => users.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  categoryIdx: index("events_category_idx").on(table.category),
  dateIdx: index("events_date_idx").on(table.date),
  createdByIdx: index("events_created_by_idx").on(table.createdBy),
  categoryDateIdx: index("events_category_date_idx").on(table.category, table.date),
}));

export const eventRegistrations = pgTable("event_registrations", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  registeredAt: timestamp("registered_at").defaultNow().notNull(),
}, (table) => ({
  userEventIdx: uniqueIndex("event_reg_user_event_idx").on(table.userId, table.eventId),
  eventIdx: index("event_reg_event_idx").on(table.eventId),
  userIdx: index("event_reg_user_idx").on(table.userId),
}));

export const agentProducts = pgTable("agent_products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("development"), // development, testing, published
  creatorId: integer("creator_id").references(() => users.id).notNull(),
  usageCount: integer("usage_count").default(0),
  demoUrl: text("demo_url"),
  githubUrl: text("github_url"),
  tags: jsonb("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cofounderApplications = pgTable("cofounder_applications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  researchField: text("research_field").notNull(),
  startupDirection: text("startup_direction").notNull(),
  experience: text("experience"),
  lookingFor: text("looking_for"),
  
  // Enhanced profile fields
  linkedinUrl: text("linkedin_url"),
  videoIntroUrl: text("video_intro_url"),
  schedulingUrl: text("scheduling_url"),
  twitterUrl: text("twitter_url"),
  instagramUrl: text("instagram_url"),
  
  // Detailed information
  accomplishments: text("accomplishments"),
  education: jsonb("education"), // Array of {school, degree, year}
  employment: jsonb("employment"), // Array of {company, position, duration}
  
  // Preferences
  isTechnical: boolean("is_technical").default(false),
  preferredLocation: text("preferred_location"),
  timeCommitment: text("time_commitment"), // full-time, part-time, weekends
  startupStage: text("startup_stage"), // idea, prototype, mvp, scaling
  
  // Internal fields
  isVerified: boolean("is_verified").default(false),
  verificationNotes: text("verification_notes"),
  matchingScore: numeric("matching_score"), // Calculated matching quality score
  
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: uniqueIndex("cofounder_apps_user_idx").on(table.userId),
  statusIdx: index("cofounder_apps_status_idx").on(table.status),
  verifiedIdx: index("cofounder_apps_verified_idx").on(table.isVerified),
}));

export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  user1Id: integer("user1_id").references(() => users.id).notNull(),
  user2Id: integer("user2_id").references(() => users.id).notNull(),
  matchScore: integer("match_score"),
  status: text("status").notNull().default("pending"), // pending, accepted, rejected
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  user1Idx: index("matches_user1_idx").on(table.user1Id),
  user2Idx: index("matches_user2_idx").on(table.user2Id),
  scoreIdx: index("matches_score_idx").on(table.matchScore),
  statusIdx: index("matches_status_idx").on(table.status),
  user1User2Idx: uniqueIndex("matches_user1_user2_idx").on(table.user1Id, table.user2Id),
}));

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").references(() => users.id).notNull(),
  receiverId: integer("receiver_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  senderIdx: index("messages_sender_idx").on(table.senderId),
  receiverIdx: index("messages_receiver_idx").on(table.receiverId),
  conversationIdx: index("messages_conversation_idx").on(table.senderId, table.receiverId),
  createdAtIdx: index("messages_created_at_idx").on(table.createdAt),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  createdEvents: many(events),
  eventRegistrations: many(eventRegistrations),
  agentProducts: many(agentProducts),
  cofounderApplications: many(cofounderApplications),
  sentMessages: many(messages, { relationName: "sender" }),
  receivedMessages: many(messages, { relationName: "receiver" }),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  creator: one(users, {
    fields: [events.createdBy],
    references: [users.id],
  }),
  registrations: many(eventRegistrations),
}));

export const eventRegistrationsRelations = relations(eventRegistrations, ({ one }) => ({
  event: one(events, {
    fields: [eventRegistrations.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventRegistrations.userId],
    references: [users.id],
  }),
}));

export const agentProductsRelations = relations(agentProducts, ({ one }) => ({
  creator: one(users, {
    fields: [agentProducts.creatorId],
    references: [users.id],
  }),
}));

export const cofounderApplicationsRelations = relations(cofounderApplications, ({ one }) => ({
  user: one(users, {
    fields: [cofounderApplications.userId],
    references: [users.id],
  }),
  reviewer: one(users, {
    fields: [cofounderApplications.reviewedBy],
    references: [users.id],
  }),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
    relationName: "sender",
  }),
  receiver: one(users, {
    fields: [messages.receiverId],
    references: [users.id],
    relationName: "receiver",
  }),
}));

// Matching interactions tracking
export const matchingInteractions = pgTable("matching_interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  targetUserId: integer("target_user_id").references(() => users.id).notNull(),
  action: text("action").notNull(), // viewed, liked, passed, messaged
  metadata: jsonb("metadata"), // Additional context like time spent viewing
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userTargetIdx: index("interactions_user_target_idx").on(table.userId, table.targetUserId),
  actionIdx: index("interactions_action_idx").on(table.action),
}));

// Structured ice-breaking questions
export const iceBreakingQuestions = pgTable("ice_breaking_questions", {
  id: serial("id").primaryKey(),
  question: text("question").notNull(),
  category: text("category"), // values, experience, vision
  isActive: boolean("is_active").default(true),
  usageCount: integer("usage_count").default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Match feedback for improving algorithm
export const matchFeedback = pgTable("match_feedback", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1-5 scale
  didMeet: boolean("did_meet").default(false),
  didContinue: boolean("did_continue").default(false),
  feedbackText: text("feedback_text"),
  notMatchReasons: jsonb("not_match_reasons"), // Array of reasons
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  matchUserIdx: uniqueIndex("feedback_match_user_idx").on(table.matchId, table.userId),
}));

// Collaboration spaces for matched pairs
export const collaborationSpaces = pgTable("collaboration_spaces", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matches.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  tasks: jsonb("tasks"), // Array of task objects
  meetingNotes: jsonb("meeting_notes"), // Array of meeting notes
  sharedDocs: jsonb("shared_docs"), // Links to shared documents
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  matchIdx: uniqueIndex("collab_match_idx").on(table.matchId),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
  currentAttendees: true,
});

export const insertAgentProductSchema = createInsertSchema(agentProducts).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});

export const insertCofounderApplicationSchema = createInsertSchema(cofounderApplications).omit({
  id: true,
  createdAt: true,
  status: true,
  reviewedBy: true,
  reviewedAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

// Event content management
export const eventContents = pgTable("event_contents", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // slide, recording, summary, material
  title: text("title").notNull(),
  description: text("description"),
  url: text("url").notNull(), // File URL or external link
  metadata: jsonb("metadata"), // Additional metadata like duration, size, format
  uploadedBy: integer("uploaded_by").references(() => users.id).notNull(),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  viewCount: integer("view_count").default(0),
  downloadCount: integer("download_count").default(0),
}, (table) => ({
  eventIdx: index("event_contents_event_idx").on(table.eventId),
  typeIdx: index("event_contents_type_idx").on(table.type),
  uploadedByIdx: index("event_contents_uploaded_by_idx").on(table.uploadedBy),
}));

// Event feedback
export const eventFeedback = pgTable("event_feedback", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  content: text("content"),
  isAnonymous: boolean("is_anonymous").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  eventUserIdx: uniqueIndex("event_feedback_event_user_idx").on(table.eventId, table.userId),
  eventIdx: index("event_feedback_event_idx").on(table.eventId),
  userIdx: index("event_feedback_user_idx").on(table.userId),
}));

// Event tags for better categorization
export const eventTags = pgTable("event_tags", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => events.id, { onDelete: "cascade" }).notNull(),
  tag: text("tag").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  eventIdx: index("event_tags_event_idx").on(table.eventId),
  tagIdx: index("event_tags_tag_idx").on(table.tag),
  eventTagIdx: uniqueIndex("event_tags_event_tag_idx").on(table.eventId, table.tag),
}));

export const insertEventContentSchema = createInsertSchema(eventContents).omit({
  id: true,
  uploadedAt: true,
  viewCount: true,
  downloadCount: true,
});

export const insertEventFeedbackSchema = createInsertSchema(eventFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertEventTagSchema = createInsertSchema(eventTags).omit({
  id: true,
  createdAt: true,
});

export const insertMatchingInteractionSchema = createInsertSchema(matchingInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertIceBreakingQuestionSchema = createInsertSchema(iceBreakingQuestions).omit({
  id: true,
  createdAt: true,
  usageCount: true,
});

export const insertMatchFeedbackSchema = createInsertSchema(matchFeedback).omit({
  id: true,
  createdAt: true,
});

export const insertCollaborationSpaceSchema = createInsertSchema(collaborationSpaces).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Algorithm Performance Tracking
export const algorithmPerformance = pgTable("algorithm_performance", {
  id: serial("id").primaryKey(),
  algorithmVersion: text("algorithm_version").notNull(),
  matchId: integer("match_id").references(() => matches.id, { onDelete: "cascade" }).notNull(),
  outcome: text("outcome").notNull(), // 'positive', 'negative', 'neutral'
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});

// Content Interactions for Recommendation Learning
export const contentInteractions = pgTable("content_interactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  contentType: text("content_type").notNull(), // 'event', 'agent_product', 'event_content'
  contentId: integer("content_id").notNull(),
  action: text("action").notNull(), // 'view', 'register', 'like', 'share'
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userContentIdx: index("idx_content_interactions_user_content").on(table.userId, table.contentType, table.contentId),
  actionIdx: index("idx_content_interactions_action").on(table.action),
  createdAtIdx: index("idx_content_interactions_created_at").on(table.createdAt),
}));

// User Matching Insights Cache (for performance optimization)
export const userMatchingInsights = pgTable("user_matching_insights", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  profileCompleteness: integer("profile_completeness").notNull().default(0),
  matchingActivity: jsonb("matching_activity").notNull(), // { views, likes, passes, messagesInitiated }
  successMetrics: jsonb("success_metrics").notNull(), // { matchRate, responseRate, conversationRate }
  recommendations: jsonb("recommendations").notNull().default([]), // Array of recommendation strings
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const insertAlgorithmPerformanceSchema = createInsertSchema(algorithmPerformance).omit({
  id: true,
  recordedAt: true,
});

export const insertContentInteractionSchema = createInsertSchema(contentInteractions).omit({
  id: true,
  createdAt: true,
});

export const insertUserMatchingInsightsSchema = createInsertSchema(userMatchingInsights).omit({
  id: true,
  lastUpdated: true,
});

// Notification System Tables
export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  type: text("type").notNull(), // NotificationType
  title: text("title").notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  targetUserId: integer("target_user_id").references(() => users.id, { onDelete: "cascade" }),
  isRead: boolean("is_read").notNull().default(false),
  readAt: timestamp("read_at"),
  actionUrl: text("action_url"),
  imageUrl: text("image_url"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("idx_notifications_user").on(table.targetUserId),
  typeIdx: index("idx_notifications_type").on(table.type),
  createdAtIdx: index("idx_notifications_created_at").on(table.createdAt),
  priorityIdx: index("idx_notifications_priority").on(table.priority),
}));

// User Notification Settings
export const notificationSettings = pgTable("notification_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }).notNull().unique(),
  preferences: jsonb("preferences").notNull(), // NotificationSettings['preferences']
  quietHours: jsonb("quiet_hours").notNull(), // NotificationSettings['quietHours']
  frequency: text("frequency").notNull().default("realtime"), // realtime, batched, daily_digest
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Notification Delivery Log (for analytics and debugging)
export const notificationDeliveryLog = pgTable("notification_delivery_log", {
  id: serial("id").primaryKey(),
  notificationId: text("notification_id").references(() => notifications.id, { onDelete: "cascade" }).notNull(),
  channel: text("channel").notNull(), // DeliveryChannel
  status: text("status").notNull(), // sent, failed, pending
  error: text("error"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  notificationIdx: index("idx_delivery_log_notification").on(table.notificationId),
  channelIdx: index("idx_delivery_log_channel").on(table.channel),
  statusIdx: index("idx_delivery_log_status").on(table.status),
}));

// Notification Templates (for customizable messaging)
export const notificationTemplates = pgTable("notification_templates", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().unique(), // NotificationType
  titleTemplate: text("title_template").notNull(),
  messageTemplate: text("message_template").notNull(),
  actionUrlTemplate: text("action_url_template"),
  priority: text("priority").notNull().default("medium"),
  defaultChannels: jsonb("default_channels").notNull(), // DeliveryChannel[]
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertNotificationSchema = createInsertSchema(notifications);
export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  updatedAt: true,
});
export const insertNotificationDeliveryLogSchema = createInsertSchema(notificationDeliveryLog).omit({
  id: true,
  createdAt: true,
});
export const insertNotificationTemplateSchema = createInsertSchema(notificationTemplates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type EventRegistration = typeof eventRegistrations.$inferSelect;
export type AgentProduct = typeof agentProducts.$inferSelect;
export type InsertAgentProduct = z.infer<typeof insertAgentProductSchema>;
export type CofounderApplication = typeof cofounderApplications.$inferSelect;
export type InsertCofounderApplication = z.infer<typeof insertCofounderApplicationSchema>;
export type Match = typeof matches.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type EventContent = typeof eventContents.$inferSelect;
export type InsertEventContent = z.infer<typeof insertEventContentSchema>;
export type EventFeedback = typeof eventFeedback.$inferSelect;
export type InsertEventFeedback = z.infer<typeof insertEventFeedbackSchema>;
export type EventTag = typeof eventTags.$inferSelect;
export type InsertEventTag = z.infer<typeof insertEventTagSchema>;
export type MatchingInteraction = typeof matchingInteractions.$inferSelect;
export type InsertMatchingInteraction = z.infer<typeof insertMatchingInteractionSchema>;
export type IceBreakingQuestion = typeof iceBreakingQuestions.$inferSelect;
export type InsertIceBreakingQuestion = z.infer<typeof insertIceBreakingQuestionSchema>;
export type MatchFeedback = typeof matchFeedback.$inferSelect;
export type InsertMatchFeedback = z.infer<typeof insertMatchFeedbackSchema>;
export type CollaborationSpace = typeof collaborationSpaces.$inferSelect;
export type InsertCollaborationSpace = z.infer<typeof insertCollaborationSpaceSchema>;
export type AlgorithmPerformance = typeof algorithmPerformance.$inferSelect;
export type InsertAlgorithmPerformance = z.infer<typeof insertAlgorithmPerformanceSchema>;
export type ContentInteraction = typeof contentInteractions.$inferSelect;
export type InsertContentInteraction = z.infer<typeof insertContentInteractionSchema>;
export type UserMatchingInsights = typeof userMatchingInsights.$inferSelect;
export type InsertUserMatchingInsights = z.infer<typeof insertUserMatchingInsightsSchema>;
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;
export type NotificationDeliveryLog = typeof notificationDeliveryLog.$inferSelect;
export type InsertNotificationDeliveryLog = z.infer<typeof insertNotificationDeliveryLogSchema>;
export type NotificationTemplate = typeof notificationTemplates.$inferSelect;
export type InsertNotificationTemplate = z.infer<typeof insertNotificationTemplateSchema>;
