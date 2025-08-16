// ================================
// 服务层统一入口文件
// ================================

// ================================
// API服务导出
// ================================

// 核心API客户端
export { apiClient, ApiClientError } from './api';
export type { ApiResponse, ApiError, HttpMethod } from './api';

// API服务模块
export { authService } from './api/modules/auth';
export { eventsService } from './api/modules/events';
export { matchingService } from './api/modules/matching';

// API类型定义
export type * from './api/types';

// API端点配置
export * from './api/endpoints';

// ================================
// 业务Hooks导出
// ================================

export * from './hooks';

// ================================
// 工具函数导出
// ================================

export { queryKeys, queryOptions, invalidateQueries } from './utils/queryKeys';

// ================================
// 服务配置和初始化
// ================================

/**
 * 服务层初始化配置
 */
export interface ServiceConfig {
  apiBaseUrl?: string;
  enableToast?: boolean;
  retryAttempts?: number;
  timeout?: number;
}

/**
 * 初始化服务层
 */
export function initializeServices(config: ServiceConfig = {}) {
  // 可以在这里添加全局服务配置
  console.log('Services initialized with config:', config);
}

// ================================
// 类型安全的服务接口
// ================================

/**
 * 所有服务的统一接口
 */
export const services = {
  auth: authService,
  events: eventsService,
  matching: matchingService,
} as const;

/**
 * 服务类型定义
 */
export type Services = typeof services;
export type ServiceNames = keyof Services;