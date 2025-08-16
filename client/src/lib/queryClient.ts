import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { toast } from "sonner";

// ================================
// 旧版API请求函数 - 保持向后兼容
// ================================

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * @deprecated 使用新的 apiClient 替代此函数
 * 保留此函数以保持向后兼容性
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  console.warn('apiRequest is deprecated. Please use apiClient from @/services instead.');
  
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// ================================
// 增强的查询函数
// ================================

type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const url = queryKey[0] as string;
    
    try {
      const res = await fetch(url, {
        credentials: "include",
        signal, // 支持查询取消
      });

      // 处理401未授权情况
      if (res.status === 401) {
        if (unauthorizedBehavior === "returnNull") {
          return null;
        }
        
        // 显示登录过期提示
        toast.error("登录已过期，请重新登录");
        
        // 可以在这里触发登出逻辑
        setTimeout(() => {
          window.location.href = '/platform/auth';
        }, 1500);
        
        throw new Error('Unauthorized');
      }

      await throwIfResNotOk(res);
      
      const contentType = res.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await res.json();
      }
      
      return await res.text();
    } catch (error) {
      // 网络错误或其他错误处理
      if (error instanceof Error && error.name === 'AbortError') {
        throw error; // 查询取消不需要特殊处理
      }
      
      console.error('Query function error:', error);
      throw error;
    }
  };

// ================================
// 查询客户端配置
// ================================

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 5 * 60 * 1000, // 5分钟过期时间
      retry: (failureCount, error) => {
        // 不重试401错误
        if (error instanceof Error && error.message === 'Unauthorized') {
          return false;
        }
        // 最多重试2次
        return failureCount < 2;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: (failureCount, error) => {
        // 不重试客户端错误
        if (error instanceof Error && error.message.includes('4')) {
          return false;
        }
        return failureCount < 1;
      },
      onError: (error) => {
        console.error('Mutation error:', error);
        // 统一的mutation错误处理可以在这里添加
      },
    },
  },
});

// ================================
// 查询客户端工具函数
// ================================

/**
 * 清除所有查询缓存
 */
export function clearAllQueries() {
  queryClient.clear();
}

/**
 * 预取查询数据
 */
export function prefetchQuery<T>(
  queryKey: string[],
  queryFn: () => Promise<T>,
  staleTime = 5 * 60 * 1000
) {
  return queryClient.prefetchQuery({
    queryKey,
    queryFn,
    staleTime,
  });
}

/**
 * 设置查询数据
 */
export function setQueryData<T>(queryKey: string[], data: T) {
  queryClient.setQueryData(queryKey, data);
}

/**
 * 使查询失效
 */
export function invalidateQueries(queryKey: string[]) {
  queryClient.invalidateQueries({ queryKey });
}
