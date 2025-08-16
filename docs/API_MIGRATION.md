# 🔄 API服务层迁移指南

## 📋 迁移概览

本指南详细说明如何将现有的API调用模式迁移到新的统一API服务层，以提高代码质量、类型安全性和可维护性。

## 🚀 新API服务层架构

### 核心模块结构

```
client/src/services/
├── api/
│   ├── index.ts          # 核心API客户端
│   ├── types.ts          # TypeScript类型定义
│   ├── endpoints.ts      # 端点配置
│   └── modules/
│       ├── auth.ts       # 认证服务
│       ├── events.ts     # 事件服务
│       └── matching.ts   # 匹配服务
├── hooks/
│   ├── useAuth.ts        # 认证相关Hooks
│   ├── useEvents.ts      # 事件相关Hooks
│   └── useMatching.ts    # 匹配相关Hooks
└── utils/
    ├── queryKeys.ts      # TanStack Query键管理
    └── transformers.ts   # 数据转换器
```

## 🔧 迁移步骤

### 1. 导入新服务模块

**旧方式：**
```typescript
import { apiRequest } from "@/lib/queryClient";
```

**新方式：**
```typescript
import { apiClient } from "@/services/api";
import { useEvents } from "@/services/hooks/useEvents";
```

### 2. 替换API调用

#### 认证相关API

**旧方式：**
```typescript
// 登录
const loginUser = async (credentials: LoginData) => {
  const response = await apiRequest("POST", "/api/auth/login", credentials);
  return response.json();
};

// 获取当前用户
const getCurrentUser = async () => {
  const response = await apiRequest("GET", "/api/auth/me");
  return response.json();
};
```

**新方式：**
```typescript
import { authService } from "@/services/api/modules/auth";

// 登录
const loginUser = async (credentials: LoginData) => {
  return await authService.login(credentials);
};

// 获取当前用户
const getCurrentUser = async () => {
  return await authService.getCurrentUser();
};
```

#### 事件相关API

**旧方式：**
```typescript
// 获取事件列表
const getEvents = async () => {
  const response = await apiRequest("GET", "/api/events");
  return response.json();
};

// 创建事件
const createEvent = async (eventData: CreateEventData) => {
  const response = await apiRequest("POST", "/api/events", eventData);
  return response.json();
};
```

**新方式：**
```typescript
import { eventsService } from "@/services/api/modules/events";

// 获取事件列表
const getEvents = async (filters?: EventFilters) => {
  return await eventsService.getEvents(filters);
};

// 创建事件
const createEvent = async (eventData: CreateEventData) => {
  return await eventsService.createEvent(eventData);
};
```

### 3. 使用React Hooks

**旧方式：**
```typescript
import { useQuery, useMutation } from "@tanstack/react-query";

const EventsList = () => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/events");
      return response.json();
    }
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: CreateEventData) => {
      const response = await apiRequest("POST", "/api/events", eventData);
      return response.json();
    }
  });

  return (
    // Component JSX
  );
};
```

**新方式：**
```typescript
import { useEvents } from "@/services/hooks/useEvents";

const EventsList = () => {
  const { 
    events, 
    isLoading, 
    createEvent, 
    isCreating 
  } = useEvents();

  const handleCreateEvent = async (eventData: CreateEventData) => {
    try {
      await createEvent(eventData);
      // 成功处理
    } catch (error) {
      // 错误处理
    }
  };

  return (
    // Component JSX
  );
};
```

### 4. 查询键管理

**旧方式：**
```typescript
// 分散的查询键定义
const eventsQueryKey = ["/api/events"];
const userQueryKey = ["/api/auth/me"];
```

**新方式：**
```typescript
import { queryKeys } from "@/services/utils/queryKeys";

// 统一的查询键管理
const eventsQueryKey = queryKeys.events.list();
const userQueryKey = queryKeys.auth.currentUser();
```

## 📊 数据转换和格式化

### 使用数据转换器

**旧方式：**
```typescript
// 在组件中处理数据格式化
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString();
};

const EventCard = ({ event }: { event: Event }) => {
  return (
    <div>
      <h3>{event.title}</h3>
      <p>{formatDate(event.date)}</p>
    </div>
  );
};
```

**新方式：**
```typescript
import { formatDate, formatEventStatus } from "@/services/utils/transformers";

const EventCard = ({ event }: { event: Event }) => {
  const status = formatEventStatus(event);
  
  return (
    <div>
      <h3>{event.title}</h3>
      <p>{formatDate(event.date, 'full')}</p>
      <span className={`status-${status.color}`}>
        {status.label}
      </span>
    </div>
  );
};
```

## 🔍 错误处理改进

### 统一错误处理

**旧方式：**
```typescript
try {
  const response = await apiRequest("POST", "/api/events", eventData);
  const result = await response.json();
  return result;
} catch (error) {
  console.error("API Error:", error);
  throw error;
}
```

**新方式：**
```typescript
// 错误处理已在API客户端中统一处理
try {
  const result = await eventsService.createEvent(eventData);
  return result;
} catch (error) {
  if (error instanceof ApiError) {
    // 处理特定的API错误
    if (error.status === 400) {
      // 处理验证错误
    }
  }
  throw error;
}
```

## 🎯 类型安全改进

### 使用强类型接口

**旧方式：**
```typescript
// 缺乏类型安全
const events: any[] = await getEvents();
```

**新方式：**
```typescript
import type { EventWithStats, EventFilters } from "@/services/api/types";

// 完整的类型安全
const events: EventWithStats[] = await eventsService.getEvents();
const filters: EventFilters = {
  category: 'tech_share',
  dateRange: {
    start: new Date(),
    end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  }
};
```

## 📝 具体组件迁移示例

### 事件列表组件

**迁移前：**
```typescript
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const EventsList = () => {
  const { data: events, isLoading } = useQuery({
    queryKey: ["/api/events"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/events");
      return response.json();
    }
  });

  if (isLoading) return <div>加载中...</div>;

  return (
    <div>
      {events?.map((event: any) => (
        <div key={event.id}>
          <h3>{event.title}</h3>
          <p>{new Date(event.date).toLocaleDateString()}</p>
        </div>
      ))}
    </div>
  );
};
```

**迁移后：**
```typescript
import { useEvents } from "@/services/hooks/useEvents";
import { formatDate, formatEventStatus } from "@/services/utils/transformers";
import type { EventFilters } from "@/services/api/types";

const EventsList = () => {
  const [filters, setFilters] = useState<EventFilters>({});
  const { 
    events, 
    isLoading, 
    error,
    refetch 
  } = useEvents(filters);

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>加载失败: {error.message}</div>;

  return (
    <div>
      {events?.map((event) => {
        const status = formatEventStatus(event);
        return (
          <div key={event.id} className="event-card">
            <h3>{event.title}</h3>
            <p>{formatDate(event.date, 'full')}</p>
            <span className={`badge badge-${status.color}`}>
              {status.label}
            </span>
            <p>报名人数: {event.currentAttendees}/{event.maxAttendees}</p>
          </div>
        );
      })}
    </div>
  );
};
```

### 用户认证组件

**迁移前：**
```typescript
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

const LoginForm = () => {
  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      const response = await apiRequest("POST", "/api/auth/login", credentials);
      return response.json();
    },
    onSuccess: () => {
      // 登录成功处理
    }
  });

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      loginMutation.mutate(formData);
    }}>
      {/* 表单内容 */}
    </form>
  );
};
```

**迁移后：**
```typescript
import { useAuth } from "@/services/hooks/useAuth";
import type { LoginCredentials } from "@/services/api/types";

const LoginForm = () => {
  const { login, isLoading, error } = useAuth();
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const credentials: LoginCredentials = {
      email: formData.get('email') as string,
      password: formData.get('password') as string,
    };
    
    try {
      await login(credentials);
      // 登录成功，自动重定向由hook处理
    } catch (error) {
      // 错误已由hook处理，这里可以添加额外的UI反馈
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="email" type="email" required />
      <input name="password" type="password" required />
      <button type="submit" disabled={isLoading}>
        {isLoading ? '登录中...' : '登录'}
      </button>
      {error && <div className="error">{error.message}</div>}
    </form>
  );
};
```

## ✅ 迁移检查清单

### 组件迁移清单

- [ ] 将`apiRequest`调用替换为相应的服务方法
- [ ] 使用新的React Hooks替代直接的useQuery/useMutation
- [ ] 添加适当的TypeScript类型注解
- [ ] 使用数据转换器处理格式化需求
- [ ] 更新查询键使用`queryKeys`工具
- [ ] 测试错误处理路径
- [ ] 验证加载状态显示正确

### 类型安全清单

- [ ] 所有API调用都有正确的类型注解
- [ ] 组件props定义了具体类型
- [ ] 表单数据使用Zod验证模式
- [ ] 错误处理使用typed错误类
- [ ] 状态管理具有明确的类型定义

### 性能优化清单

- [ ] 适当的查询缓存配置
- [ ] 实现查询失效和重新获取逻辑
- [ ] 使用React.memo优化重渲染
- [ ] 实现虚拟化长列表（如果适用）
- [ ] 配置适当的staleTime和cacheTime

## 📈 迁移后的收益

### 1. 代码质量提升
- 统一的API调用模式
- 更好的错误处理
- 减少代码重复

### 2. 开发体验改进
- 完整的TypeScript支持
- 自动完成和类型检查
- 更清晰的代码结构

### 3. 维护性增强
- 集中的配置管理
- 易于测试的模块化设计
- 一致的数据处理逻辑

### 4. 性能优化
- 智能的缓存策略
- 减少不必要的网络请求
- 更好的加载状态管理

## 🧪 测试迁移

### 单元测试示例

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { useEvents } from '@/services/hooks/useEvents';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

describe('useEvents Hook', () => {
  it('should fetch events successfully', async () => {
    const queryClient = new QueryClient();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useEvents(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.events).toBeDefined();
  });
});
```

---

**迁移完成后，请确保运行完整的测试套件并验证所有功能正常工作。**