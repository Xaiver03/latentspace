# CMS内容管理系统文档

> 本文档详细说明了ResearchFounderNetwork平台的CMS（内容管理系统）功能，包括完整的CRUD操作和批量管理功能。

## 目录

1. [系统概述](#系统概述)
2. [功能模块](#功能模块)
3. [API接口文档](#api接口文档)
4. [前端组件](#前端组件)
5. [权限控制](#权限控制)
6. [使用指南](#使用指南)

## 系统概述

### CMS特性

- **完整CRUD操作**: 支持创建、读取、更新、删除所有内容类型
- **批量操作**: 支持批量删除和批量恢复
- **搜索过滤**: 支持关键词搜索和多维度筛选
- **分页加载**: 高效的分页数据加载
- **软删除**: 支持数据恢复，避免误删
- **实时统计**: 实时展示内容统计信息

### 管理内容类型

1. **活动管理**: 技术分享、创业分享、社交活动
2. **AI产品管理**: AI工具和服务的管理
3. **社区话题管理**: 社区讨论话题的管理

## 功能模块

### 1. 活动管理

#### 功能说明
- 创建新活动（标题、描述、类别、时间、地点等）
- 编辑现有活动信息
- 删除活动（物理删除）
- 批量删除多个活动
- 搜索和筛选活动

#### 数据字段
```typescript
{
  title: string;           // 活动标题
  description: string;     // 活动描述
  category: string;        // 活动类别
  date: Date;             // 活动时间
  location?: string;       // 活动地点
  maxAttendees?: number;   // 最大参与人数
  imageUrl?: string;       // 活动图片
}
```

### 2. AI产品管理

#### 功能说明
- 添加新的AI产品
- 编辑产品信息
- 软删除产品（设置状态为inactive）
- 验证/取消验证产品
- 批量删除和恢复产品

#### 数据字段
```typescript
{
  name: string;                 // 产品名称
  description: string;          // 产品描述
  category: string;             // 产品类别
  subcategory?: string;         // 子类别
  website?: string;             // 官网链接
  pricingModel: string;         // 定价模式
  keyFeatures?: string[];       // 主要功能
  tags?: string[];              // 标签
  logo?: string;                // Logo URL
  screenshots?: string[];       // 截图URLs
  verified: boolean;            // 是否已验证
}
```

### 3. 社区话题管理

#### 功能说明
- 创建新话题
- 编辑话题内容
- 软删除话题（设置isDeleted为true）
- 设置/取消精选话题
- 批量删除和恢复话题

#### 数据字段
```typescript
{
  title: string;              // 话题标题
  content: string;            // 话题内容
  category: string;           // 话题类别
  tags?: string[];            // 标签
  isFeatured: boolean;        // 是否精选
  isDeleted: boolean;         // 是否已删除
}
```

## API接口文档

### 基础路径
所有CMS API的基础路径为: `/api/admin/cms`

### 1. 活动管理API

#### 获取活动列表
```http
GET /api/admin/cms/events
```

**查询参数**:
- `page`: 页码（默认1）
- `limit`: 每页数量（默认10）
- `search`: 搜索关键词
- `category`: 类别筛选

**响应示例**:
```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "limit": 10
}
```

#### 创建活动
```http
POST /api/admin/cms/events
```

**请求体**:
```json
{
  "title": "AI技术分享会",
  "description": "探讨最新AI技术趋势",
  "category": "tech_share",
  "date": "2024-03-20T14:00:00Z",
  "location": "线上",
  "maxAttendees": 100
}
```

#### 更新活动
```http
PUT /api/admin/cms/events/:id
```

#### 删除活动
```http
DELETE /api/admin/cms/events/:id
```

### 2. AI产品管理API

#### 获取产品列表
```http
GET /api/admin/cms/products
```

**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `search`: 搜索关键词
- `category`: 类别筛选
- `verified`: 是否已验证

#### 创建产品
```http
POST /api/admin/cms/products
```

#### 更新产品
```http
PUT /api/admin/cms/products/:id
```

#### 删除产品（软删除）
```http
DELETE /api/admin/cms/products/:id
```

#### 切换验证状态
```http
POST /api/admin/cms/products/:id/toggle-verified
```

### 3. 社区话题管理API

#### 获取话题列表
```http
GET /api/admin/cms/topics
```

**查询参数**:
- `page`: 页码
- `limit`: 每页数量
- `search`: 搜索关键词
- `category`: 类别筛选
- `featured`: 是否精选

#### 创建话题
```http
POST /api/admin/cms/topics
```

#### 更新话题
```http
PUT /api/admin/cms/topics/:id
```

#### 删除话题（软删除）
```http
DELETE /api/admin/cms/topics/:id
```

#### 切换精选状态
```http
POST /api/admin/cms/topics/:id/toggle-featured
```

### 4. 批量操作API

#### 批量删除
```http
POST /api/admin/cms/batch-delete
```

**请求体**:
```json
{
  "type": "events|products|topics",
  "ids": [1, 2, 3]
}
```

#### 批量恢复
```http
POST /api/admin/cms/batch-restore
```

**请求体**:
```json
{
  "type": "products|topics",
  "ids": [1, 2, 3]
}
```

### 5. 统计信息API

#### 获取CMS统计
```http
GET /api/admin/cms/statistics
```

**响应示例**:
```json
{
  "events": {
    "total": 156
  },
  "products": {
    "total": 342,
    "verified": 289
  },
  "topics": {
    "total": 1024,
    "featured": 87
  },
  "users": {
    "total": 5678,
    "active": 4321
  }
}
```

## 前端组件

### CMS管理页面组件
位置: `/client/src/pages/cms-management-page.tsx`

#### 主要功能组件

1. **内容表格组件**
   - 支持排序、筛选、搜索
   - 复选框批量选择
   - 行内操作按钮

2. **编辑对话框组件**
   - 表单验证
   - 实时预览
   - 文件上传

3. **批量操作工具栏**
   - 批量删除
   - 批量恢复
   - 导出数据

4. **统计卡片组件**
   - 实时数据统计
   - 趋势图表
   - 快速筛选

### 集成到管理后台
CMS功能已集成到高级管理后台页面，通过独立标签页访问。

## 权限控制

### 访问权限
- 所有CMS功能需要管理员权限（admin或superadmin）
- 使用`requireAdmin`中间件进行权限验证

### 操作权限
- 创建内容: admin, superadmin
- 编辑内容: admin, superadmin
- 删除内容: admin, superadmin
- 批量操作: admin, superadmin
- 查看统计: admin, superadmin

## 使用指南

### 1. 访问CMS管理
1. 登录管理员账号
2. 进入管理后台（/platform/admin）
3. 点击"内容管理"标签页
4. 或直接访问CMS管理页面（/platform/admin/cms）

### 2. 管理活动
1. 在CMS页面选择"活动管理"标签
2. 点击"新建活动"按钮创建新活动
3. 使用搜索框查找特定活动
4. 点击编辑按钮修改活动信息
5. 选择多个活动进行批量删除

### 3. 管理AI产品
1. 选择"AI产品"标签
2. 添加新产品或编辑现有产品
3. 使用验证功能标记可信产品
4. 软删除的产品可以恢复

### 4. 管理社区话题
1. 选择"社区话题"标签
2. 创建新话题或编辑现有话题
3. 设置精选话题提高曝光度
4. 软删除的话题可以恢复

### 5. 批量操作
1. 使用复选框选择多个项目
2. 点击"批量操作"下拉菜单
3. 选择删除或恢复操作
4. 确认操作

### 6. 数据筛选和搜索
1. 使用搜索框进行关键词搜索
2. 使用筛选器按类别、状态等筛选
3. 调整每页显示数量
4. 使用分页导航查看更多数据

## 最佳实践

1. **定期审核内容**: 定期检查和更新内容，确保信息准确性
2. **使用软删除**: 对于重要内容使用软删除，保留恢复可能
3. **批量操作谨慎**: 批量删除前仔细确认选中项目
4. **保持分类清晰**: 合理使用类别和标签，便于管理和查找
5. **及时验证产品**: 对优质AI产品及时进行验证标记

## 故障排除

### 常见问题

1. **无法访问CMS页面**
   - 检查是否具有管理员权限
   - 确认登录状态有效

2. **数据加载失败**
   - 检查网络连接
   - 查看浏览器控制台错误信息
   - 联系技术支持

3. **批量操作无响应**
   - 确认选中了项目
   - 检查操作权限
   - 刷新页面重试

4. **搜索无结果**
   - 检查搜索关键词拼写
   - 清除筛选条件重试
   - 确认数据存在

## 更新日志

### v1.0.0 (2024-01-20)
- 初始版本发布
- 完整CRUD功能
- 批量操作支持
- 统计信息展示
- 集成到管理后台