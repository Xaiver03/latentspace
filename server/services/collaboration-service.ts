import { db } from "../db";
import { 
  collaborationWorkspaces,
  workspaceTasks,
  taskComments,
  workspaceDocuments,
  documentComments,
  workspaceMeetings,
  workspaceAnalytics,
  type CollaborationWorkspace,
  type WorkspaceTask,
  type WorkspaceDocument,
  type WorkspaceMeeting,
  type InsertCollaborationWorkspace,
  type InsertWorkspaceTask,
  type InsertTaskComment,
  type InsertWorkspaceDocument,
  type InsertWorkspaceMeeting,
} from "@shared/collaboration-schema";
import { users } from "@shared/schema";
import { eq, and, or, desc, asc, sql, inArray, gte, lte, isNull } from "drizzle-orm";

export interface WorkspaceWithMembers extends CollaborationWorkspace {
  founder: typeof users.$inferSelect;
  coFounders: Array<typeof users.$inferSelect>;
  memberCount: number;
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
}

export interface TaskWithDetails extends WorkspaceTask {
  assignee?: typeof users.$inferSelect;
  creator: typeof users.$inferSelect;
  subtasks?: WorkspaceTask[];
  commentsCount: number;
  isOverdue: boolean;
}

export interface DocumentWithDetails extends WorkspaceDocument {
  owner: typeof users.$inferSelect;
  lastEditor?: typeof users.$inferSelect;
  commentsCount: number;
  collaborators: Array<typeof users.$inferSelect>;
}

export class CollaborationService {
  
  // ===== WORKSPACE MANAGEMENT =====
  
  async createWorkspace(data: InsertCollaborationWorkspace, founderId: number): Promise<WorkspaceWithMembers> {
    const [workspace] = await db
      .insert(collaborationWorkspaces)
      .values({
        ...data,
        founderId,
      })
      .returning();

    return this.getWorkspaceWithDetails(workspace.id);
  }

  async getWorkspaceWithDetails(workspaceId: number): Promise<WorkspaceWithMembers> {
    const [workspace] = await db
      .select()
      .from(collaborationWorkspaces)
      .where(eq(collaborationWorkspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    // Get founder details
    const [founder] = await db
      .select()
      .from(users)
      .where(eq(users.id, workspace.founderId))
      .limit(1);

    // Get co-founders details
    const coFounders = workspace.coFounderIds && workspace.coFounderIds.length > 0 
      ? await db
          .select()
          .from(users)
          .where(inArray(users.id, workspace.coFounderIds))
      : [];

    // Get task statistics
    const taskStats = await this.getWorkspaceTaskStats(workspaceId);

    return {
      ...workspace,
      founder,
      coFounders,
      memberCount: 1 + coFounders.length,
      taskStats,
    };
  }

  async getUserWorkspaces(userId: number): Promise<WorkspaceWithMembers[]> {
    const workspaces = await db
      .select()
      .from(collaborationWorkspaces)
      .where(
        or(
          eq(collaborationWorkspaces.founderId, userId),
          sql`${userId} = ANY(${collaborationWorkspaces.coFounderIds})`
        )
      )
      .orderBy(desc(collaborationWorkspaces.lastActivity));

    const workspacesWithDetails = await Promise.all(
      workspaces.map(workspace => this.getWorkspaceWithDetails(workspace.id))
    );

    return workspacesWithDetails;
  }

  async updateWorkspace(workspaceId: number, userId: number, updates: Partial<InsertCollaborationWorkspace>): Promise<CollaborationWorkspace> {
    // Verify user has permission to update
    await this.verifyWorkspaceAccess(workspaceId, userId, 'admin');

    const [workspace] = await db
      .update(collaborationWorkspaces)
      .set({
        ...updates,
        updatedAt: new Date(),
        lastActivity: new Date(),
      })
      .where(eq(collaborationWorkspaces.id, workspaceId))
      .returning();

    return workspace;
  }

  async addCoFounder(workspaceId: number, requesterId: number, newCoFounderId: number): Promise<void> {
    await this.verifyWorkspaceAccess(workspaceId, requesterId, 'admin');

    const [workspace] = await db
      .select()
      .from(collaborationWorkspaces)
      .where(eq(collaborationWorkspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const currentCoFounders = workspace.coFounderIds || [];
    if (!currentCoFounders.includes(newCoFounderId)) {
      await db
        .update(collaborationWorkspaces)
        .set({
          coFounderIds: [...currentCoFounders, newCoFounderId],
          updatedAt: new Date(),
          lastActivity: new Date(),
        })
        .where(eq(collaborationWorkspaces.id, workspaceId));
    }
  }

  // ===== TASK MANAGEMENT =====

  async createTask(data: InsertWorkspaceTask): Promise<TaskWithDetails> {
    const [task] = await db
      .insert(workspaceTasks)
      .values(data)
      .returning();

    // Update workspace activity
    await this.updateWorkspaceActivity(data.workspaceId);

    return this.getTaskWithDetails(task.id);
  }

  async getTaskWithDetails(taskId: number): Promise<TaskWithDetails> {
    const [task] = await db
      .select()
      .from(workspaceTasks)
      .where(eq(workspaceTasks.id, taskId))
      .limit(1);

    if (!task) {
      throw new Error("Task not found");
    }

    // Get assignee and creator details
    const [assignee] = task.assignedToId 
      ? await db.select().from(users).where(eq(users.id, task.assignedToId)).limit(1)
      : [undefined];

    const [creator] = await db
      .select()
      .from(users)
      .where(eq(users.id, task.createdById))
      .limit(1);

    // Get subtasks
    const subtasks = await db
      .select()
      .from(workspaceTasks)
      .where(eq(workspaceTasks.parentTaskId, taskId))
      .orderBy(asc(workspaceTasks.createdAt));

    // Get comments count
    const [commentsCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(taskComments)
      .where(eq(taskComments.taskId, taskId));

    const commentsCount = commentsCountResult?.count || 0;

    // Check if overdue
    const isOverdue = task.dueDate ? new Date() > task.dueDate && task.status !== 'done' : false;

    return {
      ...task,
      assignee,
      creator,
      subtasks,
      commentsCount,
      isOverdue,
    };
  }

  async getWorkspaceTasks(workspaceId: number, filters?: {
    status?: string;
    assignedTo?: number;
    priority?: string;
    overdue?: boolean;
  }): Promise<TaskWithDetails[]> {
    let query = db
      .select()
      .from(workspaceTasks)
      .where(eq(workspaceTasks.workspaceId, workspaceId));

    // Apply filters
    if (filters) {
      const conditions = [eq(workspaceTasks.workspaceId, workspaceId)];
      
      if (filters.status) {
        conditions.push(eq(workspaceTasks.status, filters.status));
      }
      
      if (filters.assignedTo) {
        conditions.push(eq(workspaceTasks.assignedToId, filters.assignedTo));
      }
      
      if (filters.priority) {
        conditions.push(eq(workspaceTasks.priority, filters.priority));
      }
      
      if (filters.overdue) {
        conditions.push(
          and(
            sql`${workspaceTasks.dueDate} < NOW()`,
            sql`${workspaceTasks.status} != 'done'`
          )!
        );
      }

      query = query.where(and(...conditions));
    }

    const tasks = await query.orderBy(desc(workspaceTasks.createdAt));

    const tasksWithDetails = await Promise.all(
      tasks.map(task => this.getTaskWithDetails(task.id))
    );

    return tasksWithDetails;
  }

  async updateTask(taskId: number, userId: number, updates: Partial<InsertWorkspaceTask>): Promise<TaskWithDetails> {
    const task = await this.getTaskWithDetails(taskId);
    await this.verifyWorkspaceAccess(task.workspaceId, userId, 'member');

    // Handle status changes
    const statusChanged = updates.status && updates.status !== task.status;
    const currentTime = new Date();
    
    const updateData: any = { ...updates, updatedAt: currentTime };
    
    if (statusChanged) {
      if (updates.status === 'in_progress' && !task.startedAt) {
        updateData.startedAt = currentTime;
      } else if (updates.status === 'done' && !task.completedAt) {
        updateData.completedAt = currentTime;
      }
    }

    const [updatedTask] = await db
      .update(workspaceTasks)
      .set(updateData)
      .where(eq(workspaceTasks.id, taskId))
      .returning();

    // Log status change if applicable
    if (statusChanged) {
      await this.addTaskComment({
        taskId,
        authorId: userId,
        content: `Status changed from ${task.status} to ${updates.status}`,
        type: 'status_change',
        oldValue: task.status,
        newValue: updates.status,
      });
    }

    await this.updateWorkspaceActivity(task.workspaceId);

    return this.getTaskWithDetails(taskId);
  }

  async addTaskComment(data: InsertTaskComment): Promise<typeof taskComments.$inferSelect> {
    const [comment] = await db
      .insert(taskComments)
      .values(data)
      .returning();

    // Update task activity
    await db
      .update(workspaceTasks)
      .set({ updatedAt: new Date() })
      .where(eq(workspaceTasks.id, data.taskId));

    return comment;
  }

  async getTaskComments(taskId: number): Promise<Array<typeof taskComments.$inferSelect & { author: typeof users.$inferSelect }>> {
    const comments = await db
      .select({
        comment: taskComments,
        author: users,
      })
      .from(taskComments)
      .innerJoin(users, eq(taskComments.authorId, users.id))
      .where(eq(taskComments.taskId, taskId))
      .orderBy(asc(taskComments.createdAt));

    return comments.map(({ comment, author }) => ({ ...comment, author }));
  }

  // ===== DOCUMENT MANAGEMENT =====

  async createDocument(data: InsertWorkspaceDocument): Promise<DocumentWithDetails> {
    const [document] = await db
      .insert(workspaceDocuments)
      .values(data)
      .returning();

    await this.updateWorkspaceActivity(data.workspaceId);

    return this.getDocumentWithDetails(document.id);
  }

  async getDocumentWithDetails(documentId: number): Promise<DocumentWithDetails> {
    const [document] = await db
      .select()
      .from(workspaceDocuments)
      .where(eq(workspaceDocuments.id, documentId))
      .limit(1);

    if (!document) {
      throw new Error("Document not found");
    }

    // Get owner details
    const [owner] = await db
      .select()
      .from(users)
      .where(eq(users.id, document.ownerId))
      .limit(1);

    // Get last editor details
    const [lastEditor] = document.lastEditedById
      ? await db.select().from(users).where(eq(users.id, document.lastEditedById)).limit(1)
      : [undefined];

    // Get comments count
    const [commentsCountResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documentComments)
      .where(eq(documentComments.documentId, documentId));

    const commentsCount = commentsCountResult?.count || 0;

    // Get workspace members as potential collaborators
    const [workspace] = await db
      .select()
      .from(collaborationWorkspaces)
      .where(eq(collaborationWorkspaces.id, document.workspaceId))
      .limit(1);

    const collaboratorIds = [workspace.founderId, ...(workspace.coFounderIds || [])];
    const collaborators = await db
      .select()
      .from(users)
      .where(inArray(users.id, collaboratorIds));

    return {
      ...document,
      owner,
      lastEditor,
      commentsCount,
      collaborators,
    };
  }

  async getWorkspaceDocuments(workspaceId: number, filters?: {
    type?: string;
    category?: string;
    ownerId?: number;
  }): Promise<DocumentWithDetails[]> {
    let query = db
      .select()
      .from(workspaceDocuments)
      .where(eq(workspaceDocuments.workspaceId, workspaceId));

    if (filters) {
      const conditions = [eq(workspaceDocuments.workspaceId, workspaceId)];
      
      if (filters.type) {
        conditions.push(eq(workspaceDocuments.type, filters.type));
      }
      
      if (filters.category) {
        conditions.push(eq(workspaceDocuments.category, filters.category));
      }
      
      if (filters.ownerId) {
        conditions.push(eq(workspaceDocuments.ownerId, filters.ownerId));
      }

      query = query.where(and(...conditions));
    }

    const documents = await query.orderBy(desc(workspaceDocuments.updatedAt));

    const documentsWithDetails = await Promise.all(
      documents.map(doc => this.getDocumentWithDetails(doc.id))
    );

    return documentsWithDetails;
  }

  async updateDocument(documentId: number, userId: number, updates: Partial<InsertWorkspaceDocument>): Promise<DocumentWithDetails> {
    const document = await this.getDocumentWithDetails(documentId);
    await this.verifyWorkspaceAccess(document.workspaceId, userId, 'member');

    const [updatedDocument] = await db
      .update(workspaceDocuments)
      .set({
        ...updates,
        lastEditedById: userId,
        lastEditedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(workspaceDocuments.id, documentId))
      .returning();

    await this.updateWorkspaceActivity(document.workspaceId);

    return this.getDocumentWithDetails(documentId);
  }

  // ===== MEETING MANAGEMENT =====

  async createMeeting(data: InsertWorkspaceMeeting): Promise<WorkspaceMeeting> {
    const [meeting] = await db
      .insert(workspaceMeetings)
      .values(data)
      .returning();

    await this.updateWorkspaceActivity(data.workspaceId);

    return meeting;
  }

  async getWorkspaceMeetings(workspaceId: number, upcoming: boolean = false): Promise<WorkspaceMeeting[]> {
    let query = db
      .select()
      .from(workspaceMeetings)
      .where(eq(workspaceMeetings.workspaceId, workspaceId));

    if (upcoming) {
      query = query.where(
        and(
          eq(workspaceMeetings.workspaceId, workspaceId),
          gte(workspaceMeetings.scheduledAt, new Date()),
          sql`${workspaceMeetings.status} != 'cancelled'`
        )
      );
    }

    return query.orderBy(desc(workspaceMeetings.scheduledAt));
  }

  async updateMeeting(meetingId: number, userId: number, updates: Partial<InsertWorkspaceMeeting>): Promise<WorkspaceMeeting> {
    const [meeting] = await db
      .select()
      .from(workspaceMeetings)
      .where(eq(workspaceMeetings.id, meetingId))
      .limit(1);

    if (!meeting) {
      throw new Error("Meeting not found");
    }

    await this.verifyWorkspaceAccess(meeting.workspaceId, userId, 'member');

    const [updatedMeeting] = await db
      .update(workspaceMeetings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(workspaceMeetings.id, meetingId))
      .returning();

    return updatedMeeting;
  }

  // ===== ANALYTICS =====

  async getWorkspaceAnalytics(workspaceId: number, days: number = 30): Promise<{
    productivity: any;
    collaboration: any;
    progress: any;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Task completion trends
    const taskTrends = await db
      .select({
        date: sql<string>`DATE(${workspaceTasks.completedAt})`,
        completed: sql<number>`count(*)::int`,
      })
      .from(workspaceTasks)
      .where(
        and(
          eq(workspaceTasks.workspaceId, workspaceId),
          gte(workspaceTasks.completedAt, startDate),
          eq(workspaceTasks.status, 'done')
        )
      )
      .groupBy(sql`DATE(${workspaceTasks.completedAt})`)
      .orderBy(sql`DATE(${workspaceTasks.completedAt})`);

    // Member activity
    const memberActivity = await db
      .select({
        userId: taskComments.authorId,
        userName: users.fullName,
        comments: sql<number>`count(*)::int`,
      })
      .from(taskComments)
      .innerJoin(users, eq(taskComments.authorId, users.id))
      .innerJoin(workspaceTasks, eq(taskComments.taskId, workspaceTasks.id))
      .where(
        and(
          eq(workspaceTasks.workspaceId, workspaceId),
          gte(taskComments.createdAt, startDate)
        )
      )
      .groupBy(taskComments.authorId, users.fullName)
      .orderBy(desc(sql`count(*)`));

    // Current progress
    const progressStats = await this.getWorkspaceTaskStats(workspaceId);

    return {
      productivity: {
        taskCompletionTrend: taskTrends,
        averageCompletionTime: 2.5, // TODO: Calculate actual average
        velocityPoints: 42, // TODO: Calculate actual velocity
      },
      collaboration: {
        memberActivity,
        documentsShared: 15, // TODO: Calculate actual count
        meetingsHeld: 8, // TODO: Calculate actual count
      },
      progress: progressStats,
    };
  }

  // ===== HELPER METHODS =====

  private async verifyWorkspaceAccess(workspaceId: number, userId: number, level: 'member' | 'admin'): Promise<void> {
    const [workspace] = await db
      .select()
      .from(collaborationWorkspaces)
      .where(eq(collaborationWorkspaces.id, workspaceId))
      .limit(1);

    if (!workspace) {
      throw new Error("Workspace not found");
    }

    const isFounder = workspace.founderId === userId;
    const isCoFounder = workspace.coFounderIds?.includes(userId) || false;
    const isMember = isFounder || isCoFounder;

    if (!isMember) {
      throw new Error("Access denied: Not a workspace member");
    }

    if (level === 'admin' && !isFounder) {
      throw new Error("Access denied: Admin privileges required");
    }
  }

  private async updateWorkspaceActivity(workspaceId: number): Promise<void> {
    await db
      .update(collaborationWorkspaces)
      .set({ lastActivity: new Date() })
      .where(eq(collaborationWorkspaces.id, workspaceId));
  }

  private async getWorkspaceTaskStats(workspaceId: number): Promise<{
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  }> {
    const [stats] = await db
      .select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) FILTER (WHERE status = 'done')::int`,
        inProgress: sql<number>`count(*) FILTER (WHERE status = 'in_progress')::int`,
        overdue: sql<number>`count(*) FILTER (WHERE due_date < NOW() AND status != 'done')::int`,
      })
      .from(workspaceTasks)
      .where(eq(workspaceTasks.workspaceId, workspaceId));

    return stats || { total: 0, completed: 0, inProgress: 0, overdue: 0 };
  }
}

export const collaborationService = new CollaborationService();