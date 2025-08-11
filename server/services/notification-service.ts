import { db } from "../db";
import { eq, and, desc, count, gte, lte, inArray, sql } from "drizzle-orm";
import { users, matches, messages, events, eventRegistrations, cofounderApplications } from "@shared/schema";
import { getWebSocketService } from "./websocket-service";

export interface NotificationPayload {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: DeliveryChannel[];
  targetUserId?: number;
  targetUserIds?: number[];
  createdAt: Date;
  expiresAt?: Date;
  actionUrl?: string;
  imageUrl?: string;
}

export type NotificationType = 
  | 'match_found'
  | 'message_received'
  | 'event_reminder'
  | 'application_status'
  | 'system_announcement'
  | 'collaboration_invite'
  | 'content_recommendation'
  | 'achievement_unlocked';

export type DeliveryChannel = 
  | 'websocket'
  | 'email'
  | 'push'
  | 'in_app';

export interface NotificationSettings {
  userId: number;
  preferences: {
    [key in NotificationType]: {
      enabled: boolean;
      channels: DeliveryChannel[];
      priority: 'low' | 'medium' | 'high';
    };
  };
  quietHours: {
    enabled: boolean;
    start: string; // "22:00"
    end: string;   // "08:00"
    timezone: string;
  };
  frequency: 'realtime' | 'batched' | 'daily_digest';
}

export interface NotificationTemplate {
  type: NotificationType;
  title: (data: any) => string;
  message: (data: any) => string;
  actionUrl?: (data: any) => string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  defaultChannels: DeliveryChannel[];
}

export class NotificationService {
  private templates: Map<NotificationType, NotificationTemplate> = new Map();
  
  constructor() {
    this.initializeTemplates();
  }

  /**
   * Send notification to specific user(s)
   */
  async sendNotification(payload: Omit<NotificationPayload, 'id' | 'createdAt'>): Promise<void> {
    const notification: NotificationPayload = {
      ...payload,
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date(),
    };

    const targetUserIds = payload.targetUserIds || (payload.targetUserId ? [payload.targetUserId] : []);
    
    if (targetUserIds.length === 0) {
      throw new Error('No target users specified');
    }

    // Get user preferences and filter channels
    const deliveryPromises = targetUserIds.map(async (userId) => {
      const settings = await this.getUserSettings(userId);
      const filteredChannels = this.filterChannelsByPreferences(notification, settings);
      
      if (filteredChannels.length === 0) return;

      await this.deliverNotification({
        ...notification,
        targetUserId: userId,
        channels: filteredChannels
      });
    });

    await Promise.all(deliveryPromises);
  }

  /**
   * Send templated notification using predefined templates
   */
  async sendTemplatedNotification(
    type: NotificationType,
    data: any,
    targetUserIds: number[]
  ): Promise<void> {
    const template = this.templates.get(type);
    if (!template) {
      throw new Error(`No template found for notification type: ${type}`);
    }

    const payload: Omit<NotificationPayload, 'id' | 'createdAt'> = {
      type,
      title: template.title(data),
      message: template.message(data),
      data,
      priority: template.priority,
      channels: template.defaultChannels,
      targetUserIds,
      actionUrl: template.actionUrl?.(data),
    };

    await this.sendNotification(payload);
  }

  /**
   * Send system-wide announcement
   */
  async sendSystemAnnouncement(
    title: string,
    message: string,
    priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium',
    targetRole?: string
  ): Promise<void> {
    // Get all users or users with specific role
    const targetUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(targetRole ? eq(users.role, targetRole) : undefined);

    const targetUserIds = targetUsers.map(u => u.id);

    await this.sendNotification({
      type: 'system_announcement',
      title,
      message,
      priority,
      channels: ['websocket', 'in_app', 'email'],
      targetUserIds,
    });
  }

  /**
   * Smart notification triggers based on platform events
   */
  async triggerMatchFoundNotification(matchId: number): Promise<void> {
    const match = await db
      .select({
        id: matches.id,
        user1Id: matches.user1Id,
        user2Id: matches.user2Id,
        matchScore: matches.matchScore,
      })
      .from(matches)
      .where(eq(matches.id, matchId))
      .limit(1);

    if (!match[0]) return;

    const { user1Id, user2Id, matchScore } = match[0];
    
    // Get user details for personalization
    const matchedUsers = await db
      .select()
      .from(users)
      .where(inArray(users.id, [user1Id, user2Id]));

    // Send notification to both users
    await Promise.all([
      this.sendTemplatedNotification('match_found', {
        matchId,
        matchScore,
        otherUser: matchedUsers.find(u => u.id === user2Id),
      }, [user1Id]),
      
      this.sendTemplatedNotification('match_found', {
        matchId,
        matchScore,
        otherUser: matchedUsers.find(u => u.id === user1Id),
      }, [user2Id]),
    ]);
  }

  /**
   * Event reminder notifications
   */
  async scheduleEventReminders(): Promise<void> {
    const now = new Date();
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

    // Find events happening in 24 hours
    const upcomingEvents24h = await db
      .select({
        eventId: events.id,
        title: events.title,
        date: events.date,
        userId: eventRegistrations.userId,
      })
      .from(events)
      .innerJoin(eventRegistrations, eq(events.id, eventRegistrations.eventId))
      .where(
        and(
          gte(events.date, now),
          lte(events.date, oneDayFromNow)
        )
      );

    // Find events happening in 1 hour
    const upcomingEvents1h = await db
      .select({
        eventId: events.id,
        title: events.title,
        date: events.date,
        userId: eventRegistrations.userId,
      })
      .from(events)
      .innerJoin(eventRegistrations, eq(events.id, eventRegistrations.eventId))
      .where(
        and(
          gte(events.date, now),
          lte(events.date, oneHourFromNow)
        )
      );

    // Send 24-hour reminders
    const eventGroups24h = this.groupByEvent(upcomingEvents24h);
    await Promise.all(
      Object.entries(eventGroups24h).map(([eventId, registrations]) =>
        this.sendTemplatedNotification('event_reminder', {
          eventId: parseInt(eventId),
          eventTitle: registrations[0].title,
          eventDate: registrations[0].date,
          reminderType: '24h',
        }, registrations.map(r => r.userId))
      )
    );

    // Send 1-hour reminders
    const eventGroups1h = this.groupByEvent(upcomingEvents1h);
    await Promise.all(
      Object.entries(eventGroups1h).map(([eventId, registrations]) =>
        this.sendTemplatedNotification('event_reminder', {
          eventId: parseInt(eventId),
          eventTitle: registrations[0].title,
          eventDate: registrations[0].date,
          reminderType: '1h',
        }, registrations.map(r => r.userId))
      )
    );
  }

  /**
   * Get user notification settings
   */
  async getUserSettings(userId: number): Promise<NotificationSettings> {
    // For now, return default settings
    // In production, this would fetch from database
    return {
      userId,
      preferences: {
        match_found: { enabled: true, channels: ['websocket', 'in_app', 'push'], priority: 'high' },
        message_received: { enabled: true, channels: ['websocket', 'push'], priority: 'medium' },
        event_reminder: { enabled: true, channels: ['in_app', 'email'], priority: 'medium' },
        application_status: { enabled: true, channels: ['websocket', 'in_app', 'email'], priority: 'high' },
        system_announcement: { enabled: true, channels: ['in_app'], priority: 'medium' },
        collaboration_invite: { enabled: true, channels: ['websocket', 'in_app', 'email'], priority: 'high' },
        content_recommendation: { enabled: true, channels: ['in_app'], priority: 'low' },
        achievement_unlocked: { enabled: true, channels: ['websocket', 'in_app'], priority: 'medium' },
      },
      quietHours: {
        enabled: true,
        start: "22:00",
        end: "08:00",
        timezone: "Asia/Shanghai"
      },
      frequency: 'realtime'
    };
  }

  /**
   * Update user notification settings
   */
  async updateUserSettings(userId: number, settings: Partial<NotificationSettings>): Promise<void> {
    // TODO: Implement database storage for user settings
    // For now, this is a placeholder
  }

  /**
   * Mark notifications as read
   */
  async markAsRead(userId: number, notificationIds: string[]): Promise<void> {
    // TODO: Implement database storage for notification read status
  }

  /**
   * Get user's notification history
   */
  async getNotificationHistory(userId: number, limit: number = 50): Promise<NotificationPayload[]> {
    // TODO: Implement database storage for notification history
    return [];
  }

  private async deliverNotification(notification: NotificationPayload): Promise<void> {
    const deliveryPromises = notification.channels.map(async (channel) => {
      switch (channel) {
        case 'websocket':
          await this.deliverViaWebSocket(notification);
          break;
        case 'in_app':
          await this.deliverInApp(notification);
          break;
        case 'email':
          await this.deliverViaEmail(notification);
          break;
        case 'push':
          await this.deliverViaPush(notification);
          break;
      }
    });

    await Promise.all(deliveryPromises);
  }

  private async deliverViaWebSocket(notification: NotificationPayload): Promise<void> {
    const wsService = getWebSocketService();
    if (wsService && notification.targetUserId) {
      wsService.sendMessageToUser(notification.targetUserId, {
        type: 'notification',
        data: notification
      } as any);
    }
  }

  private async deliverInApp(notification: NotificationPayload): Promise<void> {
    // Store in database for in-app notification center
    // TODO: Implement database storage
  }

  private async deliverViaEmail(notification: NotificationPayload): Promise<void> {
    // TODO: Implement email delivery (SendGrid, AWS SES, etc.)
    console.log(`📧 Email notification: ${notification.title} to user ${notification.targetUserId}`);
  }

  private async deliverViaPush(notification: NotificationPayload): Promise<void> {
    // TODO: Implement push notification delivery (FCM, APNS, etc.)
    console.log(`📱 Push notification: ${notification.title} to user ${notification.targetUserId}`);
  }

  private filterChannelsByPreferences(
    notification: NotificationPayload, 
    settings: NotificationSettings
  ): DeliveryChannel[] {
    const typePrefs = settings.preferences[notification.type];
    if (!typePrefs.enabled) return [];

    // Check quiet hours
    if (this.isInQuietHours(settings.quietHours) && notification.priority !== 'urgent') {
      return typePrefs.channels.filter(c => c === 'in_app' || c === 'email');
    }

    return typePrefs.channels;
  }

  private isInQuietHours(quietHours: NotificationSettings['quietHours']): boolean {
    if (!quietHours.enabled) return false;
    
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      timeZone: quietHours.timezone 
    }).slice(0, 5);
    
    return currentTime >= quietHours.start || currentTime <= quietHours.end;
  }

  private groupByEvent(events: any[]): Record<string, any[]> {
    return events.reduce((groups, event) => {
      const key = event.eventId.toString();
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
      return groups;
    }, {});
  }

  private initializeTemplates(): void {
    this.templates.set('match_found', {
      type: 'match_found',
      title: (data) => `🎯 发现新的匹配！`,
      message: (data) => `您与 ${data.otherUser?.fullName || '另一位研究者'} 的匹配度达到 ${Math.round(data.matchScore * 100)}%`,
      actionUrl: (data) => `/platform/matching`,
      priority: 'high',
      defaultChannels: ['websocket', 'in_app', 'push'],
    });

    this.templates.set('message_received', {
      type: 'message_received',
      title: (data) => `💬 新消息`,
      message: (data) => `${data.senderName} 给您发送了一条消息`,
      actionUrl: (data) => `/platform/messages`,
      priority: 'medium',
      defaultChannels: ['websocket', 'push'],
    });

    this.templates.set('event_reminder', {
      type: 'event_reminder',
      title: (data) => `⏰ 活动提醒`,
      message: (data) => {
        const timeLabel = data.reminderType === '24h' ? '明天' : '1小时后';
        return `您报名的活动"${data.eventTitle}"将在${timeLabel}开始`;
      },
      actionUrl: (data) => `/platform/events/${data.eventId}`,
      priority: 'medium',
      defaultChannels: ['in_app', 'email'],
    });

    this.templates.set('application_status', {
      type: 'application_status',
      title: (data) => `📋 申请状态更新`,
      message: (data) => `您的创始人申请状态已更新为：${data.status}`,
      actionUrl: (data) => `/platform/matching`,
      priority: 'high',
      defaultChannels: ['websocket', 'in_app', 'email'],
    });

    this.templates.set('collaboration_invite', {
      type: 'collaboration_invite',
      title: (data) => `🤝 协作邀请`,
      message: (data) => `${data.inviterName} 邀请您参与项目协作`,
      actionUrl: (data) => `/platform/collaboration/${data.spaceId}`,
      priority: 'high',
      defaultChannels: ['websocket', 'in_app', 'email'],
    });

    this.templates.set('achievement_unlocked', {
      type: 'achievement_unlocked',
      title: (data) => `🏆 解锁成就`,
      message: (data) => `恭喜！您解锁了新成就：${data.achievementName}`,
      priority: 'medium',
      defaultChannels: ['websocket', 'in_app'],
    });
  }
}

export const notificationService = new NotificationService();