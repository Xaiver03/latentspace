// ================================
// API 类型定义 - 统一的请求响应类型
// ================================

import type { 
  User, Event, Message, Match, CofounderApplication,
  EventContent, EventFeedback, EventTag, EventRegistration,
  AgentProduct, Notification, NotificationSettings,
  UserProfile, AiAgent, CollaborationWorkspace
} from "@shared/index";

// ================================
// 基础API类型
// ================================

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  success?: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ApiError {
  message: string;
  details?: any;
  status?: number;
  timestamp?: string;
}

// ================================
// HTTP方法类型
// ================================

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface RequestConfig {
  method: HttpMethod;
  headers?: Record<string, string>;
  body?: any;
  signal?: AbortSignal;
}

// ================================
// 认证相关类型
// ================================

export interface LoginRequest {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  fullName?: string;
}

export interface AuthResponse {
  user: User;
  message: string;
}

// ================================
// 事件相关类型
// ================================

export interface EventFilters {
  search?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  status?: 'upcoming' | 'ongoing' | 'completed';
}

export interface EventForm {
  title: string;
  description: string;
  date: string;
  location: string;
  category: 'tech_share' | 'startup_share' | 'networking';
  maxAttendees?: number;
  tags?: string[];
}

export interface EventWithStats extends Event {
  currentAttendees: number;
  avgRating?: number;
  totalReviews: number;
  isRegistered?: boolean;
}

// ================================
// 匹配相关类型
// ================================

export interface MatchFilters {
  roleIntent?: string;
  seniority?: string;
  location?: string;
  remotePref?: string;
}

export interface MatchRecommendation {
  user: User & { profile?: UserProfile };
  score: number;
  reasons: string[];
  compatibility: {
    role: number;
    location: number;
    experience: number;
    interests: number;
  };
}

export interface MatchInteraction {
  targetUserId: number;
  action: 'viewed' | 'liked' | 'passed' | 'messaged';
  metadata?: Record<string, any>;
}

// ================================
// 消息相关类型
// ================================

export interface MessageForm {
  receiverId: number;
  content: string;
  type?: 'text' | 'system' | 'ice_breaker';
}

export interface ConversationPreview {
  user: User;
  lastMessage: Message;
  unreadCount: number;
}

// ================================
// 社区相关类型
// ================================

export interface AgentProductFilters {
  category?: string;
  status?: 'development' | 'testing' | 'published';
  tags?: string[];
  search?: string;
}

export interface AgentProductForm {
  name: string;
  description: string;
  category: string;
  status: 'development' | 'testing' | 'published';
  tags?: string[];
  repositoryUrl?: string;
  demoUrl?: string;
}

// ================================
// 用户资料相关类型
// ================================

export interface ProfileUpdateForm {
  fullName?: string;
  email?: string;
  bio?: string;
  location?: string;
  company?: string;
  website?: string;
  githubUrl?: string;
  linkedinUrl?: string;
}

export interface UserProfileForm {
  roleIntent: string;
  seniority: string;
  timezone: string;
  weeklyHours: number;
  locationCity: string;
  remotePref: string;
  skillsOffered: string[];
  skillsNeeded: string[];
  industryExperience: string[];
  startupStage: string;
  commitmentLevel: string;
}

// ================================
// 通知相关类型
// ================================

export interface NotificationFilters {
  type?: string;
  isRead?: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface NotificationSettingsForm {
  emailNotifications: boolean;
  pushNotifications: boolean;
  matchNotifications: boolean;
  eventNotifications: boolean;
  messageNotifications: boolean;
}

// ================================
// 搜索相关类型
// ================================

export interface SearchRequest {
  query: string;
  filters?: {
    type?: 'users' | 'events' | 'content' | 'agents';
    category?: string;
    location?: string;
    dateRange?: {
      from: string;
      to: string;
    };
  };
  pagination?: {
    page: number;
    limit: number;
  };
}

export interface SearchResult {
  type: 'user' | 'event' | 'content' | 'agent';
  id: number;
  title: string;
  description: string;
  relevanceScore: number;
  metadata?: Record<string, any>;
}

// ================================
// 分析相关类型
// ================================

export interface UserAnalytics {
  profileViews: number;
  matchesReceived: number;
  matchesInitiated: number;
  eventsAttended: number;
  messagesExchanged: number;
  weeklyActivity: Array<{
    week: string;
    interactions: number;
    matches: number;
    events: number;
  }>;
}

export interface PlatformStats {
  totalUsers: number;
  activeUsers: number;
  totalMatches: number;
  successfulMatches: number;
  totalEvents: number;
  upcomingEvents: number;
  totalAgents: number;
  publishedAgents: number;
}

// ================================
// WebSocket相关类型
// ================================

export interface WebSocketMessage {
  type: 'message' | 'notification' | 'match' | 'system';
  data: any;
  timestamp: string;
  userId?: number;
}

export interface WebSocketConnectionState {
  isConnected: boolean;
  lastPing?: number;
  reconnectAttempts: number;
}