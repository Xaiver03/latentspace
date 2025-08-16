// ================================
// 业务Hooks统一导出
// ================================

// 导出事件相关hooks
export {
  useEvents,
  useEvent,
  useRecommendedEvents,
  useUpcomingEvents,
  usePopularEvents,
  useCreateEvent,
  useUpdateEvent,
  useDeleteEvent,
  useUserRegistrations,
  useRegisterEvent,
  useUnregisterEvent,
  useEventContents,
  useUploadEventContent,
  useDeleteEventContent,
  useEventFeedback,
  useSubmitEventFeedback,
  usePopularTags,
  useAddEventTag,
  useRemoveEventTag,
  useEventStats,
  useEventAnalytics,
  useSearchEvents,
} from './useEvents';

// 导出认证相关hooks (从现有的hooks目录)
export { useAuth } from '../../hooks/use-auth';

// 导出WebSocket hooks (从现有的hooks目录)
export { useWebSocket } from '../../hooks/use-websocket';

// 导出工具hooks (从现有的hooks目录)
export { useDebounce } from '../../hooks/use-debounce';
export { useMobile } from '../../hooks/use-mobile';

// 重新导出toast hooks
export { useToast } from '../../hooks/use-toast';