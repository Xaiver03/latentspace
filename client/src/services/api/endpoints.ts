// ================================
// API 端点配置 - 统一的端点管理
// ================================

// ================================
// 基础配置
// ================================

export const API_BASE_URL = import.meta.env.VITE_API_URL || '';

// ================================
// 认证端点
// ================================

export const AUTH_ENDPOINTS = {
  login: '/api/login',
  register: '/api/register',
  logout: '/api/logout',
  profile: '/api/users/profile',
  checkAuth: '/api/auth/check',
} as const;

// ================================
// 事件端点
// ================================

export const EVENT_ENDPOINTS = {
  list: '/api/events',
  detail: (id: number) => `/api/events/${id}`,
  create: '/api/events',
  register: (id: number) => `/api/events/${id}/register`,
  unregister: (id: number) => `/api/events/${id}/register`,
  
  // 事件内容
  contents: (id: number) => `/api/events/${id}/contents`,
  contentDetail: (id: number) => `/api/events/contents/${id}`,
  
  // 事件反馈
  feedback: (id: number) => `/api/events/${id}/feedback`,
  
  // 事件标签
  tags: (id: number) => `/api/events/${id}/tags`,
  removeTag: (eventId: number, tag: string) => `/api/events/${eventId}/tags/${tag}`,
  popularTags: '/api/tags/popular',
} as const;

// ================================
// 匹配端点
// ================================

export const MATCHING_ENDPOINTS = {
  list: '/api/matches',
  recommendations: '/api/matches/recommendations',
  expressInterest: (userId: number) => `/api/matches/${userId}/interest`,
  startConversation: (userId: number) => `/api/matches/${userId}/start-conversation`,
  recordInteraction: (userId: number) => `/api/matches/${userId}/interaction`,
  feedback: (matchId: number) => `/api/matches/${matchId}/feedback`,
  
  // 增强匹配
  enhanced: '/api/matches/enhanced',
  dailyRecommendation: '/api/matches/daily-recommendation',
  
  // 协作空间
  createCollaboration: (matchId: number) => `/api/matches/${matchId}/collaboration`,
  
  // 破冰问题
  iceBreakers: '/api/ice-breaking-questions',
} as const;

// ================================
// AI匹配端点
// ================================

export const AI_MATCHING_ENDPOINTS = {
  profile: '/api/matching/profile',
  preferences: '/api/matching/preferences',
  matches: '/api/matching/matches',
  analytics: '/api/matching/analytics',
  feedback: '/api/matching/feedback',
} as const;

// ================================
// 消息端点
// ================================

export const MESSAGE_ENDPOINTS = {
  list: '/api/messages',
  conversation: (userId: number) => `/api/messages/${userId}`,
  send: '/api/messages',
  markRead: (messageId: number) => `/api/messages/${messageId}/read`,
  conversations: '/api/messages/conversations',
} as const;

// ================================
// 社区端点
// ================================

export const COMMUNITY_ENDPOINTS = {
  // Agent产品
  agents: '/api/agent-products',
  agentDetail: (id: number) => `/api/agent-products/${id}`,
  createAgent: '/api/agent-products',
  
  // AI市场
  marketplace: '/api/marketplace/agents',
  reviews: (agentId: number) => `/api/marketplace/agents/${agentId}/reviews`,
  collections: '/api/marketplace/collections',
  bookmarks: '/api/marketplace/bookmarks',
  recommendations: '/api/marketplace/recommendations',
} as const;

// ================================
// 协作端点
// ================================

export const COLLABORATION_ENDPOINTS = {
  workspaces: '/api/collaboration/workspaces',
  workspace: (id: number) => `/api/collaboration/workspaces/${id}`,
  tasks: (workspaceId: number) => `/api/collaboration/workspaces/${workspaceId}/tasks`,
  documents: (workspaceId: number) => `/api/collaboration/workspaces/${workspaceId}/documents`,
  meetings: (workspaceId: number) => `/api/collaboration/workspaces/${workspaceId}/meetings`,
} as const;

// ================================
// 搜索端点
// ================================

export const SEARCH_ENDPOINTS = {
  search: '/api/search',
  suggestions: '/api/search/suggestions',
  history: '/api/search/history',
} as const;

// ================================
// 通知端点
// ================================

export const NOTIFICATION_ENDPOINTS = {
  list: '/api/notifications',
  markRead: (id: number) => `/api/notifications/${id}/read`,
  markAllRead: '/api/notifications/mark-all-read',
  settings: '/api/notifications/settings',
  unreadCount: '/api/notifications/unread-count',
} as const;

// ================================
// 用户端点
// ================================

export const USER_ENDPOINTS = {
  profile: '/api/users/profile',
  updateProfile: '/api/users/profile',
  avatar: '/api/users/avatar',
  publicProfile: (id: number) => `/api/users/${id}`,
  search: '/api/users/search',
  
  // 用户匹配资料
  matchingProfile: '/api/users/matching-profile',
  preferences: '/api/users/preferences',
} as const;

// ================================
// 声誉端点
// ================================

export const REPUTATION_ENDPOINTS = {
  score: '/api/reputation/score',
  transactions: '/api/reputation/transactions',
  achievements: '/api/reputation/achievements',
  endorsements: '/api/reputation/endorsements',
  governance: '/api/reputation/governance',
  leaderboard: '/api/reputation/leaderboard',
} as const;

// ================================
// 管理端点
// ================================

export const ADMIN_ENDPOINTS = {
  users: '/api/admin/users',
  userDetail: (id: number) => `/api/admin/users/${id}`,
  stats: '/api/admin/stats',
  moderation: '/api/admin/content/moderation',
  moderateApplication: (id: number) => `/api/admin/moderate/application/${id}`,
  moderateUser: (id: number) => `/api/admin/moderate/user/${id}`,
  alerts: '/api/admin/alerts',
  announcements: '/api/admin/announcement',
  moderationLog: '/api/admin/moderation-log',
  export: (type: string) => `/api/admin/export/${type}`,
} as const;

// ================================
// 申请端点
// ================================

export const APPLICATION_ENDPOINTS = {
  cofounder: '/api/cofounder-applications',
  detail: (id: number) => `/api/cofounder-applications/${id}`,
  myApplications: '/api/cofounder-applications/my-applications',
} as const;

// ================================
// WebSocket端点
// ================================

export const WEBSOCKET_ENDPOINTS = {
  status: '/api/websocket/status',
  connect: '/ws',
} as const;

// ================================
// 分析端点
// ================================

export const ANALYTICS_ENDPOINTS = {
  user: '/api/analytics/user',
  matching: '/api/analytics/matching',
  content: '/api/analytics/content',
  platform: '/api/analytics/platform',
} as const;

// ================================
// 端点工具函数
// ================================

/**
 * 构建完整的API URL
 */
export function buildApiUrl(endpoint: string, params?: Record<string, string | number>): string {
  let url = `${API_BASE_URL}${endpoint}`;
  
  if (params) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }
  
  return url;
}

/**
 * 获取所有端点的扁平化列表
 */
export function getAllEndpoints(): Record<string, string | ((id: any) => string)> {
  return {
    ...AUTH_ENDPOINTS,
    ...EVENT_ENDPOINTS,
    ...MATCHING_ENDPOINTS,
    ...AI_MATCHING_ENDPOINTS,
    ...MESSAGE_ENDPOINTS,
    ...COMMUNITY_ENDPOINTS,
    ...COLLABORATION_ENDPOINTS,
    ...SEARCH_ENDPOINTS,
    ...NOTIFICATION_ENDPOINTS,
    ...USER_ENDPOINTS,
    ...REPUTATION_ENDPOINTS,
    ...ADMIN_ENDPOINTS,
    ...APPLICATION_ENDPOINTS,
    ...WEBSOCKET_ENDPOINTS,
    ...ANALYTICS_ENDPOINTS,
  };
}