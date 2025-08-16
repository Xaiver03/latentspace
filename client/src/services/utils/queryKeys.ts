// ================================
// TanStack Query 查询键管理
// ================================

// ================================
// 查询键工厂函数
// ================================

/**
 * 认证相关查询键
 */
export const authKeys = {
  all: ['auth'] as const,
  user: () => [...authKeys.all, 'user'] as const,
  profile: () => [...authKeys.all, 'profile'] as const,
} as const;

/**
 * 事件相关查询键
 */
export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (filters?: Record<string, any>) => [...eventKeys.lists(), filters] as const,
  details: () => [...eventKeys.all, 'detail'] as const,
  detail: (id: number) => [...eventKeys.details(), id] as const,
  contents: (eventId: number) => [...eventKeys.detail(eventId), 'contents'] as const,
  feedback: (eventId: number) => [...eventKeys.detail(eventId), 'feedback'] as const,
  tags: (eventId: number) => [...eventKeys.detail(eventId), 'tags'] as const,
  registrations: (eventId: number) => [...eventKeys.detail(eventId), 'registrations'] as const,
  userRegistrations: () => [...eventKeys.all, 'user-registrations'] as const,
  recommendations: () => [...eventKeys.all, 'recommendations'] as const,
  upcoming: () => [...eventKeys.all, 'upcoming'] as const,
  popular: () => [...eventKeys.all, 'popular'] as const,
  stats: (eventId: number) => [...eventKeys.detail(eventId), 'stats'] as const,
  analytics: (eventId: number) => [...eventKeys.detail(eventId), 'analytics'] as const,
} as const;

/**
 * 匹配相关查询键
 */
export const matchingKeys = {
  all: ['matching'] as const,
  matches: () => [...matchingKeys.all, 'matches'] as const,
  recommendations: () => [...matchingKeys.all, 'recommendations'] as const,
  enhanced: () => [...matchingKeys.all, 'enhanced'] as const,
  dailyRecommendation: () => [...matchingKeys.all, 'daily-recommendation'] as const,
  profile: () => [...matchingKeys.all, 'profile'] as const,
  preferences: () => [...matchingKeys.all, 'preferences'] as const,
  iceBreakers: () => [...matchingKeys.all, 'ice-breakers'] as const,
  application: () => [...matchingKeys.all, 'application'] as const,
  analytics: () => [...matchingKeys.all, 'analytics'] as const,
  stats: () => [...matchingKeys.all, 'stats'] as const,
  search: (query: string, filters?: Record<string, any>) => 
    [...matchingKeys.all, 'search', query, filters] as const,
  quality: (userId: number) => [...matchingKeys.all, 'quality', userId] as const,
} as const;

/**
 * 消息相关查询键
 */
export const messageKeys = {
  all: ['messages'] as const,
  conversations: () => [...messageKeys.all, 'conversations'] as const,
  conversation: (userId: number) => [...messageKeys.all, 'conversation', userId] as const,
  unreadCount: () => [...messageKeys.all, 'unread-count'] as const,
} as const;

/**
 * 社区相关查询键
 */
export const communityKeys = {
  all: ['community'] as const,
  agents: () => [...communityKeys.all, 'agents'] as const,
  agent: (id: number) => [...communityKeys.all, 'agent', id] as const,
  agentReviews: (agentId: number) => [...communityKeys.agent(agentId), 'reviews'] as const,
  collections: () => [...communityKeys.all, 'collections'] as const,
  bookmarks: () => [...communityKeys.all, 'bookmarks'] as const,
  recommendations: () => [...communityKeys.all, 'recommendations'] as const,
} as const;

/**
 * 协作相关查询键
 */
export const collaborationKeys = {
  all: ['collaboration'] as const,
  workspaces: () => [...collaborationKeys.all, 'workspaces'] as const,
  workspace: (id: number) => [...collaborationKeys.all, 'workspace', id] as const,
  tasks: (workspaceId: number) => [...collaborationKeys.workspace(workspaceId), 'tasks'] as const,
  documents: (workspaceId: number) => [...collaborationKeys.workspace(workspaceId), 'documents'] as const,
  meetings: (workspaceId: number) => [...collaborationKeys.workspace(workspaceId), 'meetings'] as const,
} as const;

/**
 * 搜索相关查询键
 */
export const searchKeys = {
  all: ['search'] as const,
  query: (query: string, filters?: Record<string, any>) => 
    [...searchKeys.all, 'query', query, filters] as const,
  suggestions: (query: string) => [...searchKeys.all, 'suggestions', query] as const,
  history: () => [...searchKeys.all, 'history'] as const,
} as const;

/**
 * 通知相关查询键
 */
export const notificationKeys = {
  all: ['notifications'] as const,
  list: (filters?: Record<string, any>) => [...notificationKeys.all, 'list', filters] as const,
  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,
  settings: () => [...notificationKeys.all, 'settings'] as const,
} as const;

/**
 * 用户相关查询键
 */
export const userKeys = {
  all: ['users'] as const,
  profile: (id?: number) => id ? [...userKeys.all, 'profile', id] : [...userKeys.all, 'profile'] as const,
  publicProfile: (id: number) => [...userKeys.all, 'public-profile', id] as const,
  search: (query: string, filters?: Record<string, any>) => 
    [...userKeys.all, 'search', query, filters] as const,
} as const;

/**
 * 声誉相关查询键
 */
export const reputationKeys = {
  all: ['reputation'] as const,
  score: () => [...reputationKeys.all, 'score'] as const,
  transactions: () => [...reputationKeys.all, 'transactions'] as const,
  achievements: () => [...reputationKeys.all, 'achievements'] as const,
  endorsements: () => [...reputationKeys.all, 'endorsements'] as const,
  governance: () => [...reputationKeys.all, 'governance'] as const,
  leaderboard: () => [...reputationKeys.all, 'leaderboard'] as const,
} as const;

/**
 * 管理相关查询键
 */
export const adminKeys = {
  all: ['admin'] as const,
  users: () => [...adminKeys.all, 'users'] as const,
  user: (id: number) => [...adminKeys.all, 'user', id] as const,
  stats: () => [...adminKeys.all, 'stats'] as const,
  moderation: () => [...adminKeys.all, 'moderation'] as const,
  alerts: () => [...adminKeys.all, 'alerts'] as const,
  moderationLog: () => [...adminKeys.all, 'moderation-log'] as const,
} as const;

/**
 * 分析相关查询键
 */
export const analyticsKeys = {
  all: ['analytics'] as const,
  user: () => [...analyticsKeys.all, 'user'] as const,
  matching: () => [...analyticsKeys.all, 'matching'] as const,
  content: () => [...analyticsKeys.all, 'content'] as const,
  platform: () => [...analyticsKeys.all, 'platform'] as const,
} as const;

// ================================
// 标签相关查询键
// ================================

export const tagKeys = {
  all: ['tags'] as const,
  popular: (limit?: number) => [...tagKeys.all, 'popular', limit] as const,
} as const;

// ================================
// 查询键工具函数
// ================================

/**
 * 获取所有查询键
 */
export const queryKeys = {
  auth: authKeys,
  events: eventKeys,
  matching: matchingKeys,
  messages: messageKeys,
  community: communityKeys,
  collaboration: collaborationKeys,
  search: searchKeys,
  notifications: notificationKeys,
  users: userKeys,
  reputation: reputationKeys,
  admin: adminKeys,
  analytics: analyticsKeys,
  tags: tagKeys,
} as const;

/**
 * 使查询键失效的工具函数
 */
export const invalidateQueries = {
  /**
   * 使所有相关查询失效
   */
  all: () => Object.values(queryKeys).map(keyFactory => keyFactory.all),
  
  /**
   * 使特定实体的查询失效
   */
  entity: <T extends keyof typeof queryKeys>(entity: T) => queryKeys[entity].all,
  
  /**
   * 使特定实体的列表查询失效
   */
  lists: <T extends keyof typeof queryKeys>(entity: T) => {
    const keys = queryKeys[entity] as any;
    return keys.lists ? keys.lists() : keys.all;
  },
} as const;

/**
 * 类型安全的查询键验证
 */
export type QueryKey = ReturnType<typeof queryKeys[keyof typeof queryKeys][keyof any]>;

// ================================
// 默认查询配置
// ================================

export const queryOptions = {
  /**
   * 列表查询的默认配置
   */
  lists: {
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  },
  
  /**
   * 详情查询的默认配置
   */
  details: {
    staleTime: 10 * 60 * 1000, // 10 minutes
    cacheTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false,
  },
  
  /**
   * 用户相关数据的配置
   */
  user: {
    staleTime: 2 * 60 * 1000, // 2 minutes
    cacheTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: true,
  },
  
  /**
   * 实时数据的配置
   */
  realtime: {
    staleTime: 0,
    cacheTime: 1 * 60 * 1000, // 1 minute
    refetchOnWindowFocus: true,
    refetchInterval: 30 * 1000, // 30 seconds
  },
} as const;