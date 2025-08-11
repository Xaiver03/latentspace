import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
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
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  reviewedBy: integer("reviewed_by").references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
