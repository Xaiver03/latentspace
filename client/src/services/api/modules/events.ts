// ================================
// 事件服务模块
// ================================

import { apiClient } from "../index";
import { EVENT_ENDPOINTS } from "../endpoints";
import type { 
  EventFilters, 
  EventForm, 
  EventWithStats,
  PaginatedResponse 
} from "../types";
import type { 
  Event, 
  EventContent, 
  EventFeedback, 
  EventTag, 
  EventRegistration 
} from "@shared/index";

// ================================
// 事件服务类
// ================================

class EventsService {
  /**
   * 获取事件列表（带分页和筛选）
   */
  async getEvents(
    filters: EventFilters = {},
    pagination: { page?: number; limit?: number } = {}
  ): Promise<PaginatedResponse<EventWithStats>> {
    const params = {
      ...filters,
      page: pagination.page || 1,
      limit: pagination.limit || 10,
    };
    
    return apiClient.get<PaginatedResponse<EventWithStats>>(
      EVENT_ENDPOINTS.list,
      params
    );
  }

  /**
   * 获取单个事件详情
   */
  async getEvent(id: number): Promise<EventWithStats> {
    return apiClient.get<EventWithStats>(EVENT_ENDPOINTS.detail(id));
  }

  /**
   * 创建新事件
   */
  async createEvent(eventData: EventForm): Promise<Event> {
    return apiClient.post<Event>(EVENT_ENDPOINTS.create, eventData);
  }

  /**
   * 更新事件信息
   */
  async updateEvent(id: number, eventData: Partial<EventForm>): Promise<Event> {
    return apiClient.put<Event>(EVENT_ENDPOINTS.detail(id), eventData);
  }

  /**
   * 删除事件
   */
  async deleteEvent(id: number): Promise<{ message: string }> {
    return apiClient.delete(EVENT_ENDPOINTS.detail(id));
  }

  /**
   * 报名参加事件
   */
  async registerForEvent(eventId: number): Promise<EventRegistration> {
    return apiClient.post<EventRegistration>(EVENT_ENDPOINTS.register(eventId));
  }

  /**
   * 取消事件报名
   */
  async unregisterFromEvent(eventId: number): Promise<{ message: string }> {
    return apiClient.delete(EVENT_ENDPOINTS.unregister(eventId));
  }

  /**
   * 获取事件报名列表
   */
  async getEventRegistrations(eventId: number): Promise<EventRegistration[]> {
    return apiClient.get<EventRegistration[]>(
      `${EVENT_ENDPOINTS.detail(eventId)}/registrations`
    );
  }

  /**
   * 获取用户的报名事件
   */
  async getUserRegistrations(): Promise<EventRegistration[]> {
    return apiClient.get<EventRegistration[]>('/api/users/registrations');
  }

  // ================================
  // 事件内容管理
  // ================================

  /**
   * 获取事件内容列表
   */
  async getEventContents(eventId: number): Promise<EventContent[]> {
    return apiClient.get<EventContent[]>(EVENT_ENDPOINTS.contents(eventId));
  }

  /**
   * 获取单个事件内容
   */
  async getEventContent(contentId: number): Promise<EventContent> {
    return apiClient.get<EventContent>(EVENT_ENDPOINTS.contentDetail(contentId));
  }

  /**
   * 上传事件内容
   */
  async uploadEventContent(
    eventId: number,
    data: {
      title: string;
      description?: string;
      type: 'presentation' | 'document' | 'video' | 'link';
      url?: string;
      file?: File;
    }
  ): Promise<EventContent> {
    if (data.file) {
      return apiClient.upload(EVENT_ENDPOINTS.contents(eventId), data.file, {
        title: data.title,
        description: data.description,
        type: data.type,
      });
    }
    
    return apiClient.post<EventContent>(EVENT_ENDPOINTS.contents(eventId), data);
  }

  /**
   * 删除事件内容
   */
  async deleteEventContent(contentId: number): Promise<{ message: string }> {
    return apiClient.delete(EVENT_ENDPOINTS.contentDetail(contentId));
  }

  // ================================
  // 事件反馈管理
  // ================================

  /**
   * 获取事件反馈
   */
  async getEventFeedback(eventId: number): Promise<{
    feedback: EventFeedback[];
    averageRating: number;
    totalReviews: number;
  }> {
    return apiClient.get(EVENT_ENDPOINTS.feedback(eventId));
  }

  /**
   * 提交事件反馈
   */
  async submitEventFeedback(
    eventId: number,
    feedback: {
      rating: number;
      comment?: string;
      suggestions?: string;
    }
  ): Promise<EventFeedback> {
    return apiClient.post<EventFeedback>(
      EVENT_ENDPOINTS.feedback(eventId),
      feedback
    );
  }

  // ================================
  // 事件标签管理
  // ================================

  /**
   * 获取事件标签
   */
  async getEventTags(eventId: number): Promise<EventTag[]> {
    return apiClient.get<EventTag[]>(EVENT_ENDPOINTS.tags(eventId));
  }

  /**
   * 添加事件标签
   */
  async addEventTag(eventId: number, tag: string): Promise<EventTag> {
    return apiClient.post<EventTag>(EVENT_ENDPOINTS.tags(eventId), { tag });
  }

  /**
   * 删除事件标签
   */
  async removeEventTag(eventId: number, tag: string): Promise<{ message: string }> {
    return apiClient.delete(EVENT_ENDPOINTS.removeTag(eventId, tag));
  }

  /**
   * 获取热门标签
   */
  async getPopularTags(limit = 10): Promise<Array<{ tag: string; count: number }>> {
    return apiClient.get(EVENT_ENDPOINTS.popularTags, { limit });
  }

  // ================================
  // 事件搜索和筛选
  // ================================

  /**
   * 搜索事件
   */
  async searchEvents(
    query: string,
    filters: EventFilters = {}
  ): Promise<EventWithStats[]> {
    return apiClient.get<EventWithStats[]>(EVENT_ENDPOINTS.list, {
      q: query,
      ...filters,
    });
  }

  /**
   * 获取推荐事件
   */
  async getRecommendedEvents(limit = 5): Promise<EventWithStats[]> {
    return apiClient.get<EventWithStats[]>('/api/events/recommendations', { limit });
  }

  /**
   * 获取即将到来的事件
   */
  async getUpcomingEvents(limit = 10): Promise<EventWithStats[]> {
    return apiClient.get<EventWithStats[]>('/api/events/upcoming', { limit });
  }

  /**
   * 获取热门事件
   */
  async getPopularEvents(limit = 10): Promise<EventWithStats[]> {
    return apiClient.get<EventWithStats[]>('/api/events/popular', { limit });
  }

  // ================================
  // 事件统计
  // ================================

  /**
   * 获取事件统计信息
   */
  async getEventStats(eventId: number): Promise<{
    totalRegistrations: number;
    actualAttendees: number;
    averageRating: number;
    totalFeedback: number;
    engagementRate: number;
  }> {
    return apiClient.get(`${EVENT_ENDPOINTS.detail(eventId)}/stats`);
  }

  /**
   * 获取事件分析数据
   */
  async getEventAnalytics(eventId: number): Promise<{
    registrationTrend: Array<{ date: string; count: number }>;
    attendeeBreakdown: Record<string, number>;
    feedbackDistribution: Record<number, number>;
    contentEngagement: Array<{ contentId: number; views: number; downloads: number }>;
  }> {
    return apiClient.get(`${EVENT_ENDPOINTS.detail(eventId)}/analytics`);
  }
}

// ================================
// 导出服务实例
// ================================

export const eventsService = new EventsService();
export default eventsService;