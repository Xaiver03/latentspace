// ================================
// 统一API客户端 - 核心服务层
// ================================

import { toast } from "sonner";
import type { HttpMethod, RequestConfig, ApiResponse, ApiError } from "./types";
import { buildApiUrl } from "./endpoints";

// ================================
// API客户端配置
// ================================

interface ApiClientConfig {
  baseURL?: string;
  timeout?: number;
  defaultHeaders?: Record<string, string>;
  retryAttempts?: number;
  retryDelay?: number;
}

const DEFAULT_CONFIG: Required<ApiClientConfig> = {
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 10000,
  defaultHeaders: {
    'Content-Type': 'application/json',
  },
  retryAttempts: 2,
  retryDelay: 1000,
};

// ================================
// 错误处理类
// ================================

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status?: number,
    public details?: any,
    public endpoint?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

// ================================
// API客户端类
// ================================

class ApiClient {
  private config: Required<ApiClientConfig>;
  private abortControllers = new Map<string, AbortController>();

  constructor(config: ApiClientConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 通用请求方法
   */
  async request<T = any>(
    method: HttpMethod,
    endpoint: string,
    data?: any,
    options: Partial<RequestConfig> = {}
  ): Promise<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.config.baseURL}${endpoint}`;
    const requestId = `${method}:${endpoint}`;
    
    // 取消之前的相同请求
    this.cancelRequest(requestId);
    
    // 创建新的AbortController
    const controller = new AbortController();
    this.abortControllers.set(requestId, controller);

    const requestConfig: RequestInit = {
      method,
      headers: {
        ...this.config.defaultHeaders,
        ...options.headers,
      },
      credentials: 'include',
      signal: options.signal || controller.signal,
    };

    // 添加请求体
    if (data && method !== 'GET') {
      if (data instanceof FormData) {
        // FormData - 移除Content-Type让浏览器自动设置
        delete (requestConfig.headers as Record<string, any>)['Content-Type'];
        requestConfig.body = data;
      } else {
        requestConfig.body = JSON.stringify(data);
      }
    }

    try {
      const response = await this.fetchWithRetry(url, requestConfig);
      
      // 清理请求控制器
      this.abortControllers.delete(requestId);
      
      // 处理响应
      return await this.handleResponse<T>(response, endpoint);
    } catch (error) {
      this.abortControllers.delete(requestId);
      throw this.handleError(error, endpoint);
    }
  }

  /**
   * 带重试的fetch请求
   */
  private async fetchWithRetry(
    url: string,
    config: RequestInit,
    attempt = 1
  ): Promise<Response> {
    try {
      const timeoutId = setTimeout(() => {
        if (config.signal && !config.signal.aborted) {
          (config.signal as any).abort();
        }
      }, this.config.timeout);

      const response = await fetch(url, config);
      clearTimeout(timeoutId);
      
      return response;
    } catch (error) {
      if (attempt < this.config.retryAttempts && this.shouldRetry(error)) {
        await this.delay(this.config.retryDelay * attempt);
        return this.fetchWithRetry(url, config, attempt + 1);
      }
      throw error;
    }
  }

  /**
   * 处理响应
   */
  private async handleResponse<T>(response: Response, endpoint: string): Promise<T> {
    const contentType = response.headers.get('content-type');
    
    // 处理不同的响应类型
    let data: any;
    if (contentType?.includes('application/json')) {
      data = await response.json();
    } else if (contentType?.includes('text/')) {
      data = await response.text();
    } else {
      data = await response.blob();
    }

    if (!response.ok) {
      throw new ApiClientError(
        data?.error || data?.message || `HTTP ${response.status}`,
        response.status,
        data,
        endpoint
      );
    }

    return data;
  }

  /**
   * 错误处理
   */
  private handleError(error: any, endpoint: string): ApiClientError {
    if (error instanceof ApiClientError) {
      this.showErrorToast(error);
      return error;
    }

    if (error.name === 'AbortError') {
      return new ApiClientError('请求已取消', 0, null, endpoint);
    }

    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      const networkError = new ApiClientError(
        '网络连接失败，请检查网络设置',
        0,
        error,
        endpoint
      );
      this.showErrorToast(networkError);
      return networkError;
    }

    const unknownError = new ApiClientError(
      error.message || '未知错误',
      error.status,
      error,
      endpoint
    );
    this.showErrorToast(unknownError);
    return unknownError;
  }

  /**
   * 显示错误提示
   */
  private showErrorToast(error: ApiClientError) {
    // 根据错误状态显示不同的提示
    if (error.status === 401) {
      toast.error('登录已过期，请重新登录');
      // 可以在这里触发登出逻辑
      window.location.href = '/platform/auth';
    } else if (error.status === 403) {
      toast.error('没有权限执行此操作');
    } else if (error.status === 404) {
      toast.error('请求的资源不存在');
    } else if (error.status === 429) {
      toast.error('请求过于频繁，请稍后再试');
    } else if (error.status && error.status >= 500) {
      toast.error('服务器错误，请稍后再试');
    } else if (error.status === 0) {
      // 网络错误或请求取消，不显示toast
      return;
    } else {
      toast.error(error.message || '操作失败');
    }
  }

  /**
   * 判断是否应该重试
   */
  private shouldRetry(error: any): boolean {
    // 网络错误或5xx错误可以重试
    return (
      error.name === 'TypeError' ||
      (error.status && error.status >= 500)
    );
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 取消特定请求
   */
  cancelRequest(requestId: string): void {
    const controller = this.abortControllers.get(requestId);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(requestId);
    }
  }

  /**
   * 取消所有请求
   */
  cancelAllRequests(): void {
    this.abortControllers.forEach(controller => controller.abort());
    this.abortControllers.clear();
  }

  // ================================
  // 便捷方法
  // ================================

  get<T = any>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = params ? buildApiUrl(endpoint, params) : endpoint;
    return this.request<T>('GET', url);
  }

  post<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('POST', endpoint, data);
  }

  put<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PUT', endpoint, data);
  }

  patch<T = any>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>('PATCH', endpoint, data);
  }

  delete<T = any>(endpoint: string): Promise<T> {
    return this.request<T>('DELETE', endpoint);
  }

  // ================================
  // 文件上传方法
  // ================================

  upload<T = any>(endpoint: string, file: File, additionalData?: Record<string, any>): Promise<T> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    return this.request<T>('POST', endpoint, formData);
  }
}

// ================================
// 导出单例实例
// ================================

export const apiClient = new ApiClient();

// ================================
// 兼容性方法 - 保持向后兼容
// ================================

/**
 * @deprecated 使用 apiClient.request 替代
 */
export async function apiRequest<T = any>(
  method: HttpMethod,
  endpoint: string,
  data?: any
): Promise<T> {
  console.warn('apiRequest is deprecated, use apiClient.request instead');
  return apiClient.request<T>(method, endpoint, data);
}

// 导出类型
export type { ApiResponse, ApiError, HttpMethod, RequestConfig } from "./types";