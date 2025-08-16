# 潜空间 (Latent Space) - 研究者与联合创始人匹配平台

## 技术栈
### 前端技术栈
- **React 18** with TypeScript 5.3, using Vite as build tool
- **Wouter** for routing (lightweight alternative to React Router)
- **Shadcn/ui** components built on Radix UI primitives
- **TanStack Query** for server state management
- **React Hook Form** with Zod validation
- **Tailwind CSS 3.4** with custom animations and typography plugin
- **Icon Libraries**: `lucide-react` (primary), `react-icons` (additional)
- **UI Enhancement**: `recharts`, `cmdk`, `embla-carousel-react`, `framer-motion`, `input-otp`, `vaul`, `next-themes`
- **Date Handling**: `date-fns` for manipulation and formatting
- **Animation Utilities**: `tailwindcss-animate`, `tw-animate-css`

### 后端技术栈
- **Node.js 20** with **Express.js 4.18** server using TypeScript and ESM modules
- **PostgreSQL 15** database (Neon serverless)
- **Drizzle ORM** for type-safe database operations with multiple schema files
- **Passport.js** with session-based authentication
- **Session Storage**: `memorystore` with fallback to `connect-pg-simple`
- **WebSocket Support** via `ws` package for real-time features
- **AI Integration**: OpenAI API integration for intelligent features
- **Enhanced Error Handling**: `zod-validation-error` for better validation errors

### 测试框架
- **Jest 29** for unit testing
- **React Testing Library 13** for component testing

## 常用命令
```bash
# 启动开发服务器
npm run dev

# 构建生产版本 (frontend + backend)
npm run build

# 启动生产服务器
npm run start

# 运行类型检查
npm run check

# 推送数据库架构变更
npm run db:push

# 运行单个测试（推荐）
npm run test:single

# 运行完整测试套件
npm test
```

## 编码规范
- **模块系统**: 使用ES modules (import/export)，不使用CommonJS
- **导入语法**: 解构导入 `import { foo } from 'bar'`
- **TypeScript**: 严格模式配置，增强类型安全
- **代码风格**: 遵循项目现有约定，使用现有库和工具
- **安全规范**: 遵循安全最佳实践，禁止暴露或记录密钥和秘密
- **API架构**: RESTful endpoints at `/api/*`，结构化错误处理
- **路由规范**: 所有应用路由以 `/platform` 为前缀
- **类型安全**: 前后端共享类型，Zod schemas验证

## 工作流程
- **开发流程**: 每次修改后运行 `npm run check` 进行类型检查
- **测试策略**: 优先运行 `npm run test:single`，避免全量测试
- **PR检查**: 提交前确保所有类型检查和测试通过
- **版本管理**: 遵循git版本管理和SOTA原则
- **环境变量**: 生产环境需要 `DATABASE_URL`、`SESSION_SECRET`、`OPENAI_API_KEY`

## 架构概览
### 核心架构模式
1. **认证系统**: 基于Session的Passport本地策略，中间件保护路由
2. **数据库架构**: 多文件schema架构使用Drizzle ORM:
   - `shared/schema.ts` - 核心用户和事件schemas
   - `shared/ai-matching-schema.ts` - AI驱动的匹配系统
   - `shared/collaboration-schema.ts` - 工作空间和协作功能
   - `shared/ai-marketplace-schema.ts` - AI工具市场
   - `shared/reputation-schema.ts` - 用户声誉和评级系统
3. **构建输出**: Frontend → `dist/public`, Backend → `dist/index.js`
4. **落地页**: 独立的动画落地页，在根路径(`/`)提供3D效果

### 核心功能特性
- **动画落地页**: 3D粒子效果的交互式入口
- **事件管理系统**: 技术分享和网络活动，RSVP功能
- **AI驱动匹配系统**: 高级联合创始人匹配，机器学习算法
- **智能搜索**: AI驱动的内容和用户发现
- **协作工作空间**: 团队实时协作空间
- **AI市场**: 发现和分享AI/ML工具和服务的平台
- **声誉系统**: 社区驱动的评级和声誉跟踪
- **管理仪表板**: 高级内容审核和平台管理
- **实时功能**: WebSocket驱动的实时消息和通知
- **用户档案**: 全面的研究领域、隶属关系和协作兴趣

### 高级服务架构
- **增强匹配引擎**: AI驱动的联合创始人推荐算法
- **匹配分析**: 匹配成功率的数据驱动洞察
- **内容推荐**: 个性化内容发现系统
- **通知服务**: 多渠道通知管理
- **WebSocket服务**: 实时通信基础设施
- **嵌入服务**: 语义搜索和匹配的AI嵌入

### 项目结构
- `/client` - React前端应用，完整页面结构
- `/server` - Express后端服务器，模块化路由架构
- `/shared` - 共享类型和多文件数据库schemas
- `/attached_assets` - 项目资产、计划和文档
- `/reference` - 技术文档和PRD文件
- `landing.html` - 动画落地页（在根路径提供）
- `dist/` - 生产构建输出目录

## 核心理念
**Think before action, SOTA原则，谨慎删除，持续优化用户体验，禁止简化问题和跳过问题，禁止硬编码数据。**