// ================================
// 事件相关业务Hooks
// ================================

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { eventsService } from "../api/modules/events";
import { eventKeys, queryOptions } from "../utils/queryKeys";
import type { EventFilters, EventForm, EventWithStats } from "../api/types";
import type { Event, EventContent, EventFeedback } from "@shared/index";

// ================================
// 事件列表和详情
// ================================

/**
 * 获取事件列表
 */
export function useEvents(
  filters: EventFilters = {},
  pagination: { page?: number; limit?: number } = {}
) {
  return useQuery({
    queryKey: eventKeys.list({ ...filters, ...pagination }),
    queryFn: () => eventsService.getEvents(filters, pagination),
    ...queryOptions.lists,
  });
}

/**
 * 获取事件详情
 */
export function useEvent(id: number, enabled = true) {
  return useQuery({
    queryKey: eventKeys.detail(id),
    queryFn: () => eventsService.getEvent(id),
    enabled: enabled && !!id,
    ...queryOptions.details,
  });
}

/**
 * 获取推荐事件
 */
export function useRecommendedEvents(limit = 5) {
  return useQuery({
    queryKey: eventKeys.recommendations(),
    queryFn: () => eventsService.getRecommendedEvents(limit),
    ...queryOptions.lists,
  });
}

/**
 * 获取即将到来的事件
 */
export function useUpcomingEvents(limit = 10) {
  return useQuery({
    queryKey: eventKeys.upcoming(),
    queryFn: () => eventsService.getUpcomingEvents(limit),
    ...queryOptions.lists,
  });
}

/**
 * 获取热门事件
 */
export function usePopularEvents(limit = 10) {
  return useQuery({
    queryKey: eventKeys.popular(),
    queryFn: () => eventsService.getPopularEvents(limit),
    ...queryOptions.lists,
  });
}

// ================================
// 事件变更操作
// ================================

/**
 * 创建事件
 */
export function useCreateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventData: EventForm) => eventsService.createEvent(eventData),
    onSuccess: (newEvent) => {
      // 更新事件列表缓存
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      toast.success('事件创建成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '创建事件失败');
    },
  });
}

/**
 * 更新事件
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EventForm> }) =>
      eventsService.updateEvent(id, data),
    onSuccess: (updatedEvent, { id }) => {
      // 更新特定事件缓存
      queryClient.setQueryData(eventKeys.detail(id), updatedEvent);
      // 更新列表缓存
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      toast.success('事件更新成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '更新事件失败');
    },
  });
}

/**
 * 删除事件
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => eventsService.deleteEvent(id),
    onSuccess: (_, id) => {
      // 移除特定事件缓存
      queryClient.removeQueries({ queryKey: eventKeys.detail(id) });
      // 更新列表缓存
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() });
      toast.success('事件删除成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '删除事件失败');
    },
  });
}

// ================================
// 事件报名相关
// ================================

/**
 * 获取用户报名的事件
 */
export function useUserRegistrations() {
  return useQuery({
    queryKey: eventKeys.userRegistrations(),
    queryFn: () => eventsService.getUserRegistrations(),
    ...queryOptions.user,
  });
}

/**
 * 报名事件
 */
export function useRegisterEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: number) => eventsService.registerForEvent(eventId),
    onSuccess: (_, eventId) => {
      // 更新事件详情
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      // 更新用户报名列表
      queryClient.invalidateQueries({ queryKey: eventKeys.userRegistrations() });
      toast.success('报名成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '报名失败');
    },
  });
}

/**
 * 取消报名
 */
export function useUnregisterEvent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (eventId: number) => eventsService.unregisterFromEvent(eventId),
    onSuccess: (_, eventId) => {
      // 更新事件详情
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      // 更新用户报名列表
      queryClient.invalidateQueries({ queryKey: eventKeys.userRegistrations() });
      toast.success('取消报名成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '取消报名失败');
    },
  });
}

// ================================
// 事件内容相关
// ================================

/**
 * 获取事件内容
 */
export function useEventContents(eventId: number, enabled = true) {
  return useQuery({
    queryKey: eventKeys.contents(eventId),
    queryFn: () => eventsService.getEventContents(eventId),
    enabled: enabled && !!eventId,
    ...queryOptions.details,
  });
}

/**
 * 上传事件内容
 */
export function useUploadEventContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, data }: {
      eventId: number;
      data: {
        title: string;
        description?: string;
        type: 'presentation' | 'document' | 'video' | 'link';
        url?: string;
        file?: File;
      };
    }) => eventsService.uploadEventContent(eventId, data),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.contents(eventId) });
      toast.success('内容上传成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '上传内容失败');
    },
  });
}

/**
 * 删除事件内容
 */
export function useDeleteEventContent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ contentId, eventId }: { contentId: number; eventId: number }) =>
      eventsService.deleteEventContent(contentId),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.contents(eventId) });
      toast.success('内容删除成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '删除内容失败');
    },
  });
}

// ================================
// 事件反馈相关
// ================================

/**
 * 获取事件反馈
 */
export function useEventFeedback(eventId: number, enabled = true) {
  return useQuery({
    queryKey: eventKeys.feedback(eventId),
    queryFn: () => eventsService.getEventFeedback(eventId),
    enabled: enabled && !!eventId,
    ...queryOptions.details,
  });
}

/**
 * 提交事件反馈
 */
export function useSubmitEventFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, feedback }: {
      eventId: number;
      feedback: {
        rating: number;
        comment?: string;
        suggestions?: string;
      };
    }) => eventsService.submitEventFeedback(eventId, feedback),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.feedback(eventId) });
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(eventId) });
      toast.success('反馈提交成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '提交反馈失败');
    },
  });
}

// ================================
// 事件标签相关
// ================================

/**
 * 获取热门标签
 */
export function usePopularTags(limit = 10) {
  return useQuery({
    queryKey: ['tags', 'popular', limit],
    queryFn: () => eventsService.getPopularTags(limit),
    ...queryOptions.lists,
  });
}

/**
 * 添加事件标签
 */
export function useAddEventTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, tag }: { eventId: number; tag: string }) =>
      eventsService.addEventTag(eventId, tag),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.tags(eventId) });
      queryClient.invalidateQueries({ queryKey: ['tags', 'popular'] });
      toast.success('标签添加成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '添加标签失败');
    },
  });
}

/**
 * 删除事件标签
 */
export function useRemoveEventTag() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ eventId, tag }: { eventId: number; tag: string }) =>
      eventsService.removeEventTag(eventId, tag),
    onSuccess: (_, { eventId }) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.tags(eventId) });
      toast.success('标签删除成功！');
    },
    onError: (error: any) => {
      toast.error(error.message || '删除标签失败');
    },
  });
}

// ================================
// 事件统计和分析
// ================================

/**
 * 获取事件统计
 */
export function useEventStats(eventId: number, enabled = true) {
  return useQuery({
    queryKey: eventKeys.stats(eventId),
    queryFn: () => eventsService.getEventStats(eventId),
    enabled: enabled && !!eventId,
    ...queryOptions.details,
  });
}

/**
 * 获取事件分析数据
 */
export function useEventAnalytics(eventId: number, enabled = true) {
  return useQuery({
    queryKey: eventKeys.analytics(eventId),
    queryFn: () => eventsService.getEventAnalytics(eventId),
    enabled: enabled && !!eventId,
    ...queryOptions.details,
  });
}

// ================================
// 搜索事件
// ================================

/**
 * 搜索事件
 */
export function useSearchEvents(query: string, filters: EventFilters = {}) {
  return useQuery({
    queryKey: ['events', 'search', query, filters],
    queryFn: () => eventsService.searchEvents(query, filters),
    enabled: !!query.trim(),
    ...queryOptions.lists,
  });
}