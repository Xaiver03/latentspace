import { pgTable, text, serial, integer, boolean, timestamp, jsonb, index, uniqueIndex, real } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./schema";

// Collaboration workspaces for matched teams
export const collaborationWorkspaces = pgTable("collaboration_workspaces", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  
  // Team composition
  founderId: integer("founder_id").references(() => users.id).notNull(),
  coFounderIds: integer("co_founder_ids").array(), // Array of user IDs
  
  // Workspace settings
  visibility: text("visibility").notNull().default("private"), // private, team, public
  allowGuests: boolean("allow_guests").default(false),
  
  // Project information
  projectType: text("project_type"), // startup, research, product, etc.
  industry: text("industry"),
  stage: text("stage").notNull().default("ideation"), // ideation, planning, development, testing, launch
  
  // Workspace data
  goals: jsonb("goals"), // Array of workspace goals
  milestones: jsonb("milestones"), // Array of project milestones
  resources: jsonb("resources"), // Links, documents, tools
  
  // Status and metadata
  isActive: boolean("is_active").default(true),
  lastActivity: timestamp("last_activity").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  founderIdx: index("workspaces_founder_idx").on(table.founderId),
  stageIdx: index("workspaces_stage_idx").on(table.stage),
  activeIdx: index("workspaces_active_idx").on(table.isActive),
}));

// Tasks within workspaces
export const workspaceTasks: any = pgTable("workspace_tasks", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => collaborationWorkspaces.id, { onDelete: "cascade" }).notNull(),
  
  // Task details
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("task"), // task, milestone, bug, feature, research
  priority: text("priority").notNull().default("medium"), // low, medium, high, urgent
  status: text("status").notNull().default("todo"), // todo, in_progress, review, done, cancelled
  
  // Assignment and ownership
  assignedToId: integer("assigned_to_id").references(() => users.id),
  createdById: integer("created_by_id").references(() => users.id).notNull(),
  
  // Time tracking
  estimatedHours: real("estimated_hours"),
  actualHours: real("actual_hours"),
  dueDate: timestamp("due_date"),
  
  // Dependencies and relationships
  parentTaskId: integer("parent_task_id").references(() => workspaceTasks.id),
  dependencies: integer("dependencies").array(), // Array of task IDs
  
  // Metadata
  tags: text("tags").array(),
  attachments: jsonb("attachments"), // File attachments
  
  // Timestamps
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  workspaceIdx: index("tasks_workspace_idx").on(table.workspaceId),
  assigneeIdx: index("tasks_assignee_idx").on(table.assignedToId),
  statusIdx: index("tasks_status_idx").on(table.status),
  priorityIdx: index("tasks_priority_idx").on(table.priority),
  dueDateIdx: index("tasks_due_date_idx").on(table.dueDate),
}));

// Task comments and updates
export const taskComments = pgTable("task_comments", {
  id: serial("id").primaryKey(),
  taskId: integer("task_id").references(() => workspaceTasks.id, { onDelete: "cascade" }).notNull(),
  authorId: integer("author_id").references(() => users.id).notNull(),
  
  content: text("content").notNull(),
  type: text("type").notNull().default("comment"), // comment, status_change, assignment, time_log
  
  // For status changes and updates
  oldValue: text("old_value"),
  newValue: text("new_value"),
  
  // For time logging
  hoursLogged: real("hours_logged"),
  
  // Metadata
  attachments: jsonb("attachments"),
  mentions: integer("mentions").array(), // Array of user IDs mentioned
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  taskIdx: index("comments_task_idx").on(table.taskId),
  authorIdx: index("comments_author_idx").on(table.authorId),
  createdAtIdx: index("comments_created_at_idx").on(table.createdAt),
}));

// Shared documents in workspace
export const workspaceDocuments: any = pgTable("workspace_documents", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => collaborationWorkspaces.id, { onDelete: "cascade" }).notNull(),
  
  // Document details
  title: text("title").notNull(),
  type: text("type").notNull(), // document, spreadsheet, presentation, whiteboard, code
  content: text("content"), // For simple documents
  fileUrl: text("file_url"), // For uploaded files
  
  // Collaboration features
  isCollaborative: boolean("is_collaborative").default(true),
  allowComments: boolean("allow_comments").default(true),
  
  // Access control
  visibility: text("visibility").notNull().default("team"), // team, workspace, public
  editPermissions: text("edit_permissions").notNull().default("team"), // owner, team, everyone
  
  // Version control
  version: integer("version").default(1),
  parentDocumentId: integer("parent_document_id").references(() => workspaceDocuments.id),
  
  // Metadata
  tags: text("tags").array(),
  category: text("category"), // planning, research, design, technical, business
  
  // Ownership and tracking
  ownerId: integer("owner_id").references(() => users.id).notNull(),
  lastEditedById: integer("last_edited_by_id").references(() => users.id),
  lastEditedAt: timestamp("last_edited_at"),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  workspaceIdx: index("documents_workspace_idx").on(table.workspaceId),
  ownerIdx: index("documents_owner_idx").on(table.ownerId),
  categoryIdx: index("documents_category_idx").on(table.category),
  typeIdx: index("documents_type_idx").on(table.type),
}));

// Document comments and feedback
export const documentComments: any = pgTable("document_comments", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").references(() => workspaceDocuments.id, { onDelete: "cascade" }).notNull(),
  authorId: integer("author_id").references(() => users.id).notNull(),
  
  content: text("content").notNull(),
  
  // For inline comments
  selectionStart: integer("selection_start"),
  selectionEnd: integer("selection_end"),
  selectionText: text("selection_text"),
  
  // Comment state
  isResolved: boolean("is_resolved").default(false),
  resolvedById: integer("resolved_by_id").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),
  
  // Threading
  parentCommentId: integer("parent_comment_id").references(() => documentComments.id),
  
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  documentIdx: index("doc_comments_document_idx").on(table.documentId),
  authorIdx: index("doc_comments_author_idx").on(table.authorId),
  parentIdx: index("doc_comments_parent_idx").on(table.parentCommentId),
}));

// Meeting records and notes
export const workspaceMeetings = pgTable("workspace_meetings", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => collaborationWorkspaces.id, { onDelete: "cascade" }).notNull(),
  
  // Meeting details
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").notNull().default("general"), // standup, planning, review, brainstorm, demo
  
  // Scheduling
  scheduledAt: timestamp("scheduled_at").notNull(),
  duration: integer("duration"), // minutes
  location: text("location"), // physical location or video link
  
  // Participants
  organizerId: integer("organizer_id").references(() => users.id).notNull(),
  attendeeIds: integer("attendee_ids").array(), // Array of user IDs
  
  // Meeting content
  agenda: jsonb("agenda"), // Array of agenda items
  notes: text("notes"),
  decisions: jsonb("decisions"), // Array of decisions made
  actionItems: jsonb("action_items"), // Array of action items
  
  // Status and recording
  status: text("status").notNull().default("scheduled"), // scheduled, in_progress, completed, cancelled
  recordingUrl: text("recording_url"),
  
  // Timestamps
  startedAt: timestamp("started_at"),
  endedAt: timestamp("ended_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  workspaceIdx: index("meetings_workspace_idx").on(table.workspaceId),
  organizerIdx: index("meetings_organizer_idx").on(table.organizerId),
  scheduledAtIdx: index("meetings_scheduled_at_idx").on(table.scheduledAt),
  statusIdx: index("meetings_status_idx").on(table.status),
}));

// Workspace analytics and insights
export const workspaceAnalytics = pgTable("workspace_analytics", {
  id: serial("id").primaryKey(),
  workspaceId: integer("workspace_id").references(() => collaborationWorkspaces.id, { onDelete: "cascade" }).notNull(),
  
  // Time period
  date: timestamp("date").notNull(),
  periodType: text("period_type").notNull(), // daily, weekly, monthly
  
  // Metrics
  tasksCreated: integer("tasks_created").default(0),
  tasksCompleted: integer("tasks_completed").default(0),
  documentsCreated: integer("documents_created").default(0),
  documentsEdited: integer("documents_edited").default(0),
  meetingsHeld: integer("meetings_held").default(0),
  activeMembers: integer("active_members").default(0),
  
  // Productivity metrics
  averageTaskCompletionTime: real("avg_task_completion_time"), // hours
  velocityPoints: real("velocity_points"), // story points or equivalent
  burndownData: jsonb("burndown_data"), // For sprint tracking
  
  // Collaboration metrics
  commentsPosted: integer("comments_posted").default(0),
  documentsShared: integer("documents_shared").default(0),
  crossMemberInteractions: integer("cross_member_interactions").default(0),
  
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  workspaceDateIdx: index("analytics_workspace_date_idx").on(table.workspaceId, table.date),
  dateIdx: index("analytics_date_idx").on(table.date),
}));

// Create Zod schemas
export const insertCollaborationWorkspaceSchema = createInsertSchema(collaborationWorkspaces, {
  name: z.string().min(1, "Workspace name is required"),
  stage: z.enum(["ideation", "planning", "development", "testing", "launch"]),
  visibility: z.enum(["private", "team", "public"]),
}).omit({
  id: true,
  lastActivity: true,
  createdAt: true,
  updatedAt: true,
});

export const selectCollaborationWorkspaceSchema = createSelectSchema(collaborationWorkspaces);

export const insertWorkspaceTaskSchema = createInsertSchema(workspaceTasks, {
  title: z.string().min(1, "Task title is required"),
  type: z.enum(["task", "milestone", "bug", "feature", "research"]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  status: z.enum(["todo", "in_progress", "review", "done", "cancelled"]),
}).omit({
  id: true,
  startedAt: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const selectWorkspaceTaskSchema = createSelectSchema(workspaceTasks);

export const insertTaskCommentSchema = createInsertSchema(taskComments, {
  content: z.string().min(1, "Comment content is required"),
  type: z.enum(["comment", "status_change", "assignment", "time_log"]),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const selectTaskCommentSchema = createSelectSchema(taskComments);

export const insertWorkspaceDocumentSchema = createInsertSchema(workspaceDocuments, {
  title: z.string().min(1, "Document title is required"),
  type: z.enum(["document", "spreadsheet", "presentation", "whiteboard", "code"]),
  visibility: z.enum(["team", "workspace", "public"]),
  editPermissions: z.enum(["owner", "team", "everyone"]),
}).omit({
  id: true,
  version: true,
  lastEditedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const selectWorkspaceDocumentSchema = createSelectSchema(workspaceDocuments);

export const insertWorkspaceMeetingSchema = createInsertSchema(workspaceMeetings, {
  title: z.string().min(1, "Meeting title is required"),
  type: z.enum(["standup", "planning", "review", "brainstorm", "demo", "general"]),
  status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
}).omit({
  id: true,
  startedAt: true,
  endedAt: true,
  createdAt: true,
  updatedAt: true,
});

export const selectWorkspaceMeetingSchema = createSelectSchema(workspaceMeetings);

// Type exports
export type CollaborationWorkspace = typeof collaborationWorkspaces.$inferSelect;
export type InsertCollaborationWorkspace = z.infer<typeof insertCollaborationWorkspaceSchema>;
export type WorkspaceTask = typeof workspaceTasks.$inferSelect;
export type InsertWorkspaceTask = z.infer<typeof insertWorkspaceTaskSchema>;
export type TaskComment = typeof taskComments.$inferSelect;
export type InsertTaskComment = z.infer<typeof insertTaskCommentSchema>;
export type WorkspaceDocument = typeof workspaceDocuments.$inferSelect;
export type InsertWorkspaceDocument = z.infer<typeof insertWorkspaceDocumentSchema>;
export type DocumentComment = typeof documentComments.$inferSelect;
export type WorkspaceMeeting = typeof workspaceMeetings.$inferSelect;
export type InsertWorkspaceMeeting = z.infer<typeof insertWorkspaceMeetingSchema>;
export type WorkspaceAnalytics = typeof workspaceAnalytics.$inferSelect;