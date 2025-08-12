import { db } from "../db";
import { eq, and, desc, count, avg, sql, gte, lte, like, inArray, or } from "drizzle-orm";
import { 
  users, 
  cofounderApplications, 
  events, 
  agentProducts, 
  matches,
  messages,
  eventRegistrations,
  notifications,
  contentInteractions,
  matchingInteractions
} from "@shared/schema";
import { notificationService } from "./notification-service";

export interface PlatformStats {
  users: {
    total: number;
    active: number;
    pending: number;
    approved: number;
    newThisWeek: number;
  };
  content: {
    events: number;
    products: number;
    applications: number;
    pendingReview: number;
  };
  engagement: {
    matches: number;
    messages: number;
    eventRegistrations: number;
    averageSessionTime: number;
  };
  systemHealth: {
    activeConnections: number;
    notificationsSent: number;
    errorRate: number;
    performanceScore: number;
  };
}

export interface UserDetails {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isApproved: boolean;
  createdAt: Date;
  lastActive?: Date;
  application?: any;
  stats: {
    matches: number;
    messages: number;
    events: number;
    contentInteractions: number;
  };
  flags: {
    reported: boolean;
    suspended: boolean;
    warnings: number;
  };
}

export interface ContentItem {
  id: number;
  type: 'event' | 'product' | 'application';
  title: string;
  description: string;
  creator: string;
  status: string;
  createdAt: Date;
  flags: number;
  engagement: number;
}

export interface ModerationAction {
  id: string;
  type: 'approve' | 'reject' | 'suspend' | 'warn' | 'delete';
  targetType: 'user' | 'content';
  targetId: number;
  reason: string;
  adminId: number;
  timestamp: Date;
}

export interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  component: string;
  timestamp: Date;
  resolved: boolean;
}

export class AdminService {
  
  /**
   * Get comprehensive platform statistics
   */
  async getPlatformStats(timeRange: 'week' | 'month' | 'quarter' = 'month'): Promise<PlatformStats> {
    const daysBack = timeRange === 'week' ? 7 : timeRange === 'month' ? 30 : 90;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // User statistics
    const [totalUsers, activeUsers, pendingUsers, approvedUsers, newUsers] = await Promise.all([
      db.select({ count: count() }).from(users),
      db.select({ count: count() }).from(users).where(gte(users.createdAt, cutoffDate)),
      db.select({ count: count() }).from(cofounderApplications).where(eq(cofounderApplications.status, 'pending')),
      db.select({ count: count() }).from(cofounderApplications).where(eq(cofounderApplications.status, 'approved')),
      db.select({ count: count() }).from(users).where(gte(users.createdAt, weekAgo)),
    ]);

    // Content statistics  
    const [totalEvents, totalProducts, totalApplications, pendingContent] = await Promise.all([
      db.select({ count: count() }).from(events),
      db.select({ count: count() }).from(agentProducts),
      db.select({ count: count() }).from(cofounderApplications),
      db.select({ count: count() }).from(cofounderApplications).where(eq(cofounderApplications.status, 'pending')),
    ]);

    // Engagement statistics
    const [totalMatches, totalMessages, totalRegistrations] = await Promise.all([
      db.select({ count: count() }).from(matches),
      db.select({ count: count() }).from(messages),
      db.select({ count: count() }).from(eventRegistrations),
    ]);

    return {
      users: {
        total: totalUsers[0]?.count || 0,
        active: activeUsers[0]?.count || 0,
        pending: pendingUsers[0]?.count || 0,
        approved: approvedUsers[0]?.count || 0,
        newThisWeek: newUsers[0]?.count || 0,
      },
      content: {
        events: totalEvents[0]?.count || 0,
        products: totalProducts[0]?.count || 0,
        applications: totalApplications[0]?.count || 0,
        pendingReview: pendingContent[0]?.count || 0,
      },
      engagement: {
        matches: totalMatches[0]?.count || 0,
        messages: totalMessages[0]?.count || 0,
        eventRegistrations: totalRegistrations[0]?.count || 0,
        averageSessionTime: 0, // TODO: Implement session tracking
      },
      systemHealth: {
        activeConnections: 0, // TODO: Get from WebSocket service
        notificationsSent: 0, // TODO: Get from notification service
        errorRate: 0, // TODO: Implement error tracking
        performanceScore: 95, // TODO: Calculate performance metrics
      },
    };
  }

  /**
   * Get detailed user information for admin review
   */
  async getUserDetails(userId: number): Promise<UserDetails | null> {
    // Get basic user info
    const userQuery = await db
      .select()
      .from(users)
      .leftJoin(cofounderApplications, eq(users.id, cofounderApplications.userId))
      .where(eq(users.id, userId))
      .limit(1);

    if (!userQuery[0]) return null;

    const user = userQuery[0].users;
    const application = userQuery[0].cofounder_applications;

    // Get user statistics
    const [matchCount, messageCount, eventCount, interactionCount] = await Promise.all([
      db.select({ count: count() }).from(matches).where(
        sql`${matches.user1Id} = ${userId} OR ${matches.user2Id} = ${userId}`
      ),
      db.select({ count: count() }).from(messages).where(eq(messages.senderId, userId)),
      db.select({ count: count() }).from(eventRegistrations).where(eq(eventRegistrations.userId, userId)),
      db.select({ count: count() }).from(contentInteractions).where(eq(contentInteractions.userId, userId)),
    ]);

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isApproved: user.isApproved || false,
      createdAt: user.createdAt,
      application,
      stats: {
        matches: matchCount[0]?.count || 0,
        messages: messageCount[0]?.count || 0,
        events: eventCount[0]?.count || 0,
        contentInteractions: interactionCount[0]?.count || 0,
      },
      flags: {
        reported: false, // TODO: Implement user reporting system
        suspended: false, // TODO: Implement user suspension
        warnings: 0, // TODO: Implement warning system
      },
    };
  }

  /**
   * Get all users with pagination and filtering
   */
  async getUsers(
    page: number = 1,
    limit: number = 50,
    filter?: {
      role?: string;
      status?: string;
      search?: string;
    }
  ): Promise<{ users: UserDetails[]; total: number; pages: number }> {
    const offset = (page - 1) * limit;
    
    // Build where conditions
    let whereCondition = undefined;
    
    if (filter?.role && filter?.search) {
      whereCondition = and(
        eq(users.role, filter.role),
        sql`LOWER(${users.fullName}) LIKE LOWER(${'%' + filter.search + '%'}) OR 
            LOWER(${users.username}) LIKE LOWER(${'%' + filter.search + '%'}) OR
            LOWER(${users.email}) LIKE LOWER(${'%' + filter.search + '%'})`
      );
    } else if (filter?.role) {
      whereCondition = eq(users.role, filter.role);
    } else if (filter?.search) {
      whereCondition = sql`LOWER(${users.fullName}) LIKE LOWER(${'%' + filter.search + '%'}) OR 
                          LOWER(${users.username}) LIKE LOWER(${'%' + filter.search + '%'}) OR
                          LOWER(${users.email}) LIKE LOWER(${'%' + filter.search + '%'})`;
    }

    const baseQuery = db
      .select()
      .from(users)
      .leftJoin(cofounderApplications, eq(users.id, cofounderApplications.userId));

    const [results, totalCount] = await Promise.all([
      whereCondition 
        ? baseQuery.where(whereCondition).limit(limit).offset(offset).orderBy(desc(users.createdAt))
        : baseQuery.limit(limit).offset(offset).orderBy(desc(users.createdAt)),
      db.select({ count: count() }).from(users)
    ]);

    const userDetails = await Promise.all(
      results.map(async (result) => {
        const userDetail = await this.getUserDetails(result.users.id);
        return userDetail!;
      })
    );

    return {
      users: userDetails,
      total: totalCount[0]?.count || 0,
      pages: Math.ceil((totalCount[0]?.count || 0) / limit),
    };
  }

  /**
   * Get content items requiring moderation
   */
  async getContentForModeration(type?: 'event' | 'product' | 'application'): Promise<ContentItem[]> {
    const items: ContentItem[] = [];

    if (!type || type === 'application') {
      const applications = await db
        .select({
          id: cofounderApplications.id,
          title: sql<string>`CONCAT('Application: ', ${cofounderApplications.researchField})`,
          description: cofounderApplications.startupDirection,
          creator: users.fullName,
          status: cofounderApplications.status,
          createdAt: cofounderApplications.createdAt,
        })
        .from(cofounderApplications)
        .innerJoin(users, eq(cofounderApplications.userId, users.id))
        .where(eq(cofounderApplications.status, 'pending'))
        .orderBy(desc(cofounderApplications.createdAt));

      items.push(...applications.map(app => ({
        ...app,
        title: app.title || '',
        description: app.description || '',
        creator: app.creator || '',
        type: 'application' as const,
        flags: 0,
        engagement: 0,
      })));
    }

    if (!type || type === 'event') {
      const eventItems = await db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          creator: users.fullName,
          status: sql<string>`'active'`,
          createdAt: events.createdAt,
        })
        .from(events)
        .innerJoin(users, eq(events.createdBy, users.id))
        .orderBy(desc(events.createdAt))
        .limit(20);

      items.push(...eventItems.map(event => ({
        ...event,
        description: event.description || '',
        creator: event.creator || '',
        type: 'event' as const,
        flags: 0,
        engagement: 0,
      })));
    }

    if (!type || type === 'product') {
      const products = await db
        .select({
          id: agentProducts.id,
          title: agentProducts.name,
          description: agentProducts.description,
          creator: users.fullName,
          status: agentProducts.status,
          createdAt: agentProducts.createdAt,
        })
        .from(agentProducts)
        .innerJoin(users, eq(agentProducts.creatorId, users.id))
        .orderBy(desc(agentProducts.createdAt))
        .limit(20);

      items.push(...products.map(product => ({
        ...product,
        title: product.title || '',
        creator: product.creator || '',
        type: 'product' as const,
        flags: 0,
        engagement: 0,
      })));
    }

    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Moderate co-founder application
   */
  async moderateApplication(
    applicationId: number,
    action: 'approve' | 'reject',
    adminId: number,
    notes?: string
  ): Promise<void> {
    // Update application status
    const [updatedApp] = await db
      .update(cofounderApplications)
      .set({
        status: action === 'approve' ? 'approved' : 'rejected',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        ...(notes && { verificationNotes: notes }),
      })
      .where(eq(cofounderApplications.id, applicationId))
      .returning();

    if (!updatedApp) {
      throw new Error('Application not found');
    }

    // Update user approval status if approved
    if (action === 'approve') {
      await db
        .update(users)
        .set({ isApproved: true })
        .where(eq(users.id, updatedApp.userId));
    }

    // Send notification to user
    await notificationService.sendTemplatedNotification(
      'application_status',
      {
        status: action === 'approve' ? '已通过' : '未通过',
        notes,
      },
      [updatedApp.userId]
    );

    // Log moderation action
    await this.logModerationAction({
      type: action,
      targetType: 'content',
      targetId: applicationId,
      reason: notes || `Application ${action}d`,
      adminId,
    });
  }

  /**
   * Suspend or unsuspend a user
   */
  async moderateUser(
    userId: number,
    action: 'suspend' | 'unsuspend' | 'warn',
    adminId: number,
    reason: string
  ): Promise<void> {
    // TODO: Implement user suspension system
    // This would involve adding suspension fields to the user table
    
    // Send notification to user
    if (action === 'suspend') {
      await notificationService.sendNotification({
        type: 'system_announcement',
        title: '⚠️ 账户暂停',
        message: `您的账户已被暂停：${reason}`,
        priority: 'urgent',
        channels: ['websocket', 'in_app', 'email'],
        targetUserId: userId,
      });
    }

    // Log moderation action
    await this.logModerationAction({
      type: action as any,
      targetType: 'user',
      targetId: userId,
      reason,
      adminId,
    });
  }

  /**
   * Get system alerts and health status
   */
  async getSystemAlerts(): Promise<SystemAlert[]> {
    // TODO: Implement system monitoring and alerting
    const alerts: SystemAlert[] = [
      {
        id: 'alert_1',
        level: 'info',
        title: 'System Performance',
        message: '系统运行正常，所有服务状态良好',
        component: 'system',
        timestamp: new Date(),
        resolved: true,
      },
      {
        id: 'alert_2', 
        level: 'warning',
        title: 'Database Connection Pool',
        message: '数据库连接池使用率较高，建议监控',
        component: 'database',
        timestamp: new Date(),
        resolved: false,
      }
    ];

    return alerts;
  }

  /**
   * Send system-wide announcement
   */
  async sendSystemAnnouncement(
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent',
    targetRole?: string,
    adminId?: number
  ): Promise<void> {
    await notificationService.sendSystemAnnouncement(title, message, priority, targetRole);
    
    // Log admin action
    if (adminId) {
      await this.logModerationAction({
        type: 'approve', // Using approve as a general admin action type
        targetType: 'content',
        targetId: 0,
        reason: `System announcement sent: ${title}`,
        adminId,
      });
    }
  }

  /**
   * Get moderation activity log
   */
  async getModerationLog(limit: number = 100): Promise<ModerationAction[]> {
    // TODO: Implement moderation log table and storage
    return [];
  }

  /**
   * Export platform data for analysis
   */
  async exportPlatformData(type: 'users' | 'events' | 'applications' | 'analytics'): Promise<any[]> {
    switch (type) {
      case 'users':
        return await db
          .select({
            id: users.id,
            username: users.username,
            email: users.email,
            fullName: users.fullName,
            role: users.role,
            createdAt: users.createdAt,
          })
          .from(users);
      
      case 'events':
        return await db.select().from(events);
      
      case 'applications':
        return await db.select().from(cofounderApplications);
      
      default:
        throw new Error('Invalid export type');
    }
  }

  private async logModerationAction(action: Omit<ModerationAction, 'id' | 'timestamp'>): Promise<void> {
    // TODO: Implement moderation action logging to database
    console.log('Moderation action:', {
      ...action,
      id: `mod_${Date.now()}`,
      timestamp: new Date(),
    });
  }
}

export const adminService = new AdminService();