# 后台管理系统API文档

> 本文档详细说明了ResearchFounderNetwork平台的后台管理系统业务逻辑和API接口定义。

## 目录

1. [概述](#概述)
2. [认证与权限](#认证与权限)
3. [平台统计API](#平台统计api)
4. [用户管理API](#用户管理api)
5. [内容审核API](#内容审核api)
6. [AI系统管理API](#ai系统管理api)
7. [系统监控API](#系统监控api)
8. [通知管理API](#通知管理api)
9. [数据导出API](#数据导出api)
10. [成功案例管理API](#成功案例管理api)

## 概述

### 系统架构

后台管理系统采用以下技术架构：

- **前端**: React + TypeScript + TanStack Query + Shadcn UI
- **后端**: Node.js + Express + Drizzle ORM
- **数据库**: PostgreSQL
- **认证**: Passport.js 基于会话的认证
- **权限**: 基于角色的访问控制（RBAC）

### 角色定义

- `user`: 普通用户
- `admin`: 管理员
- `superadmin`: 超级管理员

### API响应格式

成功响应：
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

错误响应：
```json
{
  "error": "错误信息",
  "code": "ERROR_CODE",
  "details": {}
}
```

## 认证与权限

所有管理API都需要管理员权限认证。

### 权限检查

```typescript
// 所有管理API都包含此检查
if (!req.isAuthenticated() || req.user.role !== "admin") {
  return res.status(403).json({ error: "Admin access required" });
}
```

## 平台统计API

### GET /api/admin/stats

获取平台综合统计数据。

**请求参数**:
- `timeRange` (query): 'week' | 'month' | 'quarter' (默认: 'month')

**响应数据**:
```typescript
interface PlatformStats {
  users: {
    total: number;          // 总用户数
    active: number;         // 活跃用户数
    pending: number;        // 待审核用户数
    approved: number;       // 已认证用户数
    newThisWeek: number;    // 本周新增用户数
  };
  content: {
    events: number;         // 活动总数
    products: number;       // AI产品总数
    applications: number;   // 申请总数
    pendingReview: number;  // 待审核内容数
  };
  engagement: {
    matches: number;        // 匹配总数
    messages: number;       // 消息总数
    eventRegistrations: number;  // 活动报名总数
    averageSessionTime: number;  // 平均会话时长
  };
  systemHealth: {
    activeConnections: number;   // 活跃连接数
    notificationsSent: number;   // 已发送通知数
    errorRate: number;          // 错误率
    performanceScore: number;   // 性能评分
  };
}
```

**业务逻辑**:
1. 根据时间范围计算统计周期
2. 并行查询各项统计数据
3. 聚合返回综合统计信息

## 用户管理API

### GET /api/admin/users

获取用户列表，支持分页和筛选。

**请求参数**:
- `page` (query): 页码，默认1
- `limit` (query): 每页数量，默认50
- `search` (query): 搜索关键词（用户名、邮箱、姓名）
- `role` (query): 用户角色筛选
- `status` (query): 用户状态筛选

**响应数据**:
```typescript
{
  users: UserDetails[],
  total: number,
  pages: number
}

interface UserDetails {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isApproved: boolean;
  createdAt: Date;
  lastActive?: Date;
  application?: any;  // 申请信息
  stats: {
    matches: number;
    messages: number;
    events: number;
    contentInteractions: number;
  };
  flags: {
    reported: boolean;
    suspended: boolean;
    warnings: number;
  };
}
```

### GET /api/admin/users/:userId

获取单个用户详细信息。

**响应数据**: 同上述 `UserDetails`

### POST /api/admin/moderate/user/:id

对用户进行管理操作。

**请求体**:
```json
{
  "action": "suspend" | "unsuspend" | "warn",
  "reason": "操作原因"
}
```

**业务逻辑**:
1. 验证操作类型和原因
2. 记录管理操作日志
3. 发送通知给用户
4. 更新用户状态

## 内容审核API

### GET /api/admin/content/moderation

获取待审核的内容列表。

**请求参数**:
- `type` (query): 'event' | 'product' | 'application'

**响应数据**:
```typescript
interface ContentItem {
  id: number;
  type: 'event' | 'product' | 'application';
  title: string;
  description: string;
  creator: string;      // 创建者姓名
  status: string;
  createdAt: Date;
  flags: number;        // 举报次数
  engagement: number;   // 参与度
}
```

### POST /api/admin/moderate/application/:id

审核创始人申请。

**请求体**:
```json
{
  "action": "approve" | "reject",
  "notes": "审核备注（可选）"
}
```

**业务逻辑**:
1. 更新申请状态
2. 如果通过，更新用户认证状态
3. 发送通知给申请者
4. 记录审核日志

## AI系统管理API

### GET /api/admin/ai/providers

获取AI提供商列表和状态。

**响应数据**:
```typescript
interface AIProvider {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  status: 'healthy' | 'degraded' | 'down';
  config: {
    apiKey: string;     // 脱敏显示
    baseUrl: string;
    priority: number;
  };
  metrics: {
    requestCount: number;      // 请求总数
    successRate: number;       // 成功率
    averageLatency: number;    // 平均延迟(ms)
    totalCost: number;         // 总成本
  };
}
```

### GET /api/admin/ai/stats

获取AI系统统计信息。

**响应数据**:
```typescript
interface AISystemStats {
  totalRequests: number;      // 总请求数
  averageLatency: number;     // 平均延迟
  totalCost: number;          // 总成本
  cacheHitRate: number;       // 缓存命中率
  activeProviders: number;    // 活跃提供商数
  emergencyMode: boolean;     // 紧急模式状态
  routingStrategy: string;    // 路由策略
}
```

### PUT /api/admin/ai/providers/:providerId

更新AI提供商配置。

**请求体**:
```json
{
  "enabled": true,
  "config": {
    "apiKey": "新的API密钥",
    "priority": 1
  }
}
```

### PUT /api/admin/ai/routing

更新AI路由策略。

**请求体**:
```json
{
  "strategy": "cost-optimized" | "performance-optimized" | "quality-optimized" | "round-robin"
}
```

### POST /api/admin/ai/providers/:providerId/test

测试AI提供商连接。

**响应数据**:
```json
{
  "success": true,
  "message": "连接测试成功",
  "providerId": "openai",
  "timestamp": "2024-08-18T10:30:00Z"
}
```

## 系统监控API

### GET /api/admin/alerts

获取系统警报列表。

**响应数据**:
```typescript
interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  component: string;     // 组件名称
  timestamp: Date;
  resolved: boolean;
}
```

### GET /api/admin/moderation-log

获取管理操作日志。

**请求参数**:
- `limit` (query): 返回记录数，默认100

**响应数据**:
```typescript
interface ModerationAction {
  id: string;
  type: 'approve' | 'reject' | 'suspend' | 'warn' | 'delete';
  targetType: 'user' | 'content';
  targetId: number;
  reason: string;
  adminId: number;
  timestamp: Date;
}
```

## 通知管理API

### POST /api/admin/announcement

发送系统公告。

**请求体**:
```json
{
  "title": "公告标题",
  "message": "公告内容",
  "priority": "low" | "medium" | "high" | "urgent",
  "targetRole": "user" | "admin" (可选，不填则发送给所有用户)
}
```

**业务逻辑**:
1. 验证公告内容
2. 根据目标角色筛选接收者
3. 批量创建通知
4. 记录发送日志

## 数据导出API

### GET /api/admin/export/:type

导出平台数据。

**路径参数**:
- `type`: 'users' | 'events' | 'applications' | 'analytics'

**响应**:
- Content-Type: application/json
- Content-Disposition: attachment
- 文件名格式: `{type}-export-{date}.json`

**业务逻辑**:
1. 根据类型查询相应数据
2. 格式化为JSON
3. 设置下载响应头
4. 记录导出操作日志

## 成功案例管理API

### GET /api/success-stories/admin/pending

获取待审核的成功案例。

**请求参数**:
- `page` (query): 页码
- `limit` (query): 每页数量

**响应数据**:
```typescript
interface PendingStoriesResponse {
  stories: PendingStory[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
```

### POST /api/success-stories/admin/:id/approve

审核通过成功案例。

### POST /api/success-stories/admin/:id/reject

拒绝成功案例。

**请求体**:
```json
{
  "reason": "拒绝原因"
}
```

## 数据权限说明

### 管理员可访问的数据

1. **用户数据**: 基本信息、申请信息、活动参与、匹配记录
2. **内容数据**: 活动、产品、申请、成功案例
3. **系统数据**: 性能指标、错误日志、操作日志
4. **AI数据**: 提供商状态、使用统计、成本分析

### 数据脱敏规则

1. **API密钥**: 只显示后4位
2. **用户密码**: 不返回
3. **敏感配置**: 根据权限级别脱敏

## 错误码说明

- `403`: 权限不足
- `404`: 资源不存在  
- `400`: 请求参数错误
- `500`: 服务器内部错误

## 性能优化建议

1. **数据查询优化**:
   - 使用分页避免大量数据传输
   - 并行查询提高响应速度
   - 适当使用缓存

2. **权限检查优化**:
   - 统一的中间件处理
   - 缓存用户权限信息

3. **日志记录**:
   - 异步记录避免阻塞主流程
   - 定期清理历史日志

## 安全注意事项

1. **权限验证**: 所有API必须验证管理员权限
2. **输入验证**: 严格验证所有输入参数
3. **操作审计**: 记录所有管理操作
4. **敏感数据**: 适当脱敏和加密
5. **速率限制**: 防止API滥用