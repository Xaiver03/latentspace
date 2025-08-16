# 潜空间 (Latent Space)

<div align="center">

**GenAI时代的研究者与联合创始人匹配平台**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20-339933.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791.svg)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

[🌟 在线体验](#) | [📖 文档](./reference/) | [🚀 快速开始](#快速开始)

</div>

## 📋 项目简介

潜空间(Latent Space)是一个专为GenAI时代打造的智能化平台，致力于连接全球研究者与潜在的联合创始人。通过AI驱动的匹配算法、智能搜索和协作工具，帮助科研人员找到志同道合的伙伴，共同推进前沿技术的产业化应用。

### ✨ 核心特性

- 🧠 **AI驱动匹配** - 基于语义向量的智能联合创始人匹配系统
- 🔍 **智能搜索** - AI增强的内容和用户发现功能  
- 📅 **事件管理** - 技术分享会和网络活动组织平台
- 💬 **实时协作** - WebSocket驱动的消息和通知系统
- 🏪 **AI工具市场** - 发现和分享AI/ML工具的生态系统
- 🏆 **声誉系统** - 基于区块链的社区驱动信誉评级
- 📊 **数据分析** - 匹配效果和平台使用情况的深度分析
- 👥 **协作空间** - 团队项目管理和文档协作工具

## 🏗️ 技术架构

### 前端技术栈
- **React 18** + **TypeScript 5.6** - 现代化前端框架
- **Vite** - 快速构建工具
- **Wouter** - 轻量级路由管理
- **Shadcn/ui** + **Radix UI** - 高质量UI组件库
- **TanStack Query** - 服务端状态管理
- **Tailwind CSS** - 原子化CSS框架
- **Framer Motion** - 流畅动画效果

### 后端技术栈  
- **Node.js 20** + **Express.js** - 服务端框架
- **TypeScript** + **ESM** - 类型安全的现代JavaScript
- **PostgreSQL 15** - 主数据库 (支持向量搜索)
- **Drizzle ORM** - 类型安全的数据库操作
- **Passport.js** - 身份认证系统
- **WebSocket (ws)** - 实时通信
- **OpenAI API** - AI功能集成

### 数据库设计
- **49张表** 分布在5个领域模块
- **向量嵌入** 支持语义搜索和AI匹配
- **多模式架构** 按业务领域组织
- **JSONB字段** 灵活存储非结构化数据

## 🚀 快速开始

### 环境要求

- **Node.js** >= 20.0.0
- **PostgreSQL** >= 15.0
- **npm** >= 9.0.0

### 1. 克隆项目

```bash
git clone <repository-url>
cd ResearchFounderNetwork
```

### 2. 安装依赖

```bash
npm install
```

### 3. 环境配置

复制环境变量模板并配置：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置以下必要变量：

```env
# 数据库连接
DATABASE_URL=postgresql://localhost:5432/research_founder_network

# 会话密钥 (生产环境必须更换)
SESSION_SECRET=your-super-secure-session-secret

# OpenAI API (AI功能必需)
OPENAI_API_KEY=sk-your-openai-api-key
```

### 4. 数据库设置

**方式一：自动设置 (推荐)**
```bash
./setup-local-db.sh
```

**方式二：手动设置**
```bash
createdb research_founder_network
npm run db:push
```

### 5. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:5001](http://localhost:5001) 查看应用。

## 📜 可用脚本

```bash
# 开发
npm run dev          # 启动开发服务器 (前端 + 后端)
npm run check        # TypeScript 类型检查

# 构建
npm run build        # 构建生产版本
npm run start        # 启动生产服务器

# 数据库
npm run db:push      # 推送数据库架构变更

# 测试  
npm run test:single  # 运行单个测试 (推荐)
npm test            # 运行完整测试套件
```

## 📁 项目结构

```
├── client/                 # React 前端应用
│   ├── src/
│   │   ├── components/     # UI 组件
│   │   ├── pages/          # 页面组件 (20个页面)
│   │   ├── hooks/          # 自定义 React Hooks
│   │   └── lib/            # 工具函数和配置
├── server/                 # Express 后端服务
│   ├── routes/             # API 路由模块
│   ├── services/           # 业务逻辑层 (15个服务)
│   ├── middleware/         # 中间件 (安全、缓存、验证)
│   └── config/             # 配置文件
├── shared/                 # 前后端共享代码
│   ├── schema.ts           # 核心数据库模式
│   ├── ai-matching-schema.ts
│   ├── collaboration-schema.ts
│   └── ...                 # 其他领域模式
├── attached_assets/        # 项目文档和资源
└── reference/              # 技术文档和PRD
```

## 🔧 开发指南

### 代码规范
- 使用 **ES Modules** (import/export)，不使用 CommonJS
- 采用 **严格的 TypeScript** 配置
- API路由以 `/api/*` 为前缀
- 应用页面路由以 `/platform/*` 为前缀
- 遵循现有的命名约定 (kebab-case)

### 安全最佳实践
- 🔒 环境变量管理敏感信息
- 🛡️ 输入验证和sanitization  
- 🔐 会话管理和CSRF保护
- 📝 结构化错误处理

### Git工作流
1. 每次提交前运行 `npm run check`
2. 确保所有测试通过
3. 遵循[约定式提交](https://www.conventionalcommits.org/)

## 📈 核心功能模块

### 🧠 AI匹配系统
- 语义向量嵌入用户画像
- 多维度匹配算法
- 实时匹配分析和优化

### 📅 事件管理
- 活动创建和报名
- 实时通知系统
- 参与者互动功能

### 💼 协作工作空间
- 项目管理工具
- 文档协作编辑
- 任务跟踪系统

### 🏪 AI工具市场
- 工具发布和发现
- 使用评价系统
- 推荐算法

## 🚀 部署

### Docker部署 (推荐)

```bash
# 启动 PostgreSQL
docker-compose up -d

# 构建和启动应用
npm run build
npm run start
```

### 生产环境检查清单

- [ ] 更新 `SESSION_SECRET` 为强随机字符串
- [ ] 配置生产数据库连接
- [ ] 设置 Redis 缓存 (可选但推荐)
- [ ] 配置 OpenAI API 限制
- [ ] 设置监控和日志
- [ ] 启用 HTTPS

## 🤝 贡献指南

我们欢迎各种形式的贡献！请阅读 [CONTRIBUTING.md](CONTRIBUTING.md) 了解详细信息。

### 开发流程
1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📚 文档

- [📖 API文档](./docs/api/) - RESTful API接口说明
- [🏗️ 架构文档](./docs/architecture/) - 系统设计和技术架构
- [🔧 开发指南](./docs/development/) - 本地开发环境配置
- [🚀 部署指南](./docs/deployment/) - 生产环境部署说明
- [📋 PRD文档](./reference/) - 产品需求文档

## 🐛 问题反馈

遇到问题？请通过以下方式反馈：

- [GitHub Issues](https://github.com/your-org/ResearchFounderNetwork/issues) - Bug报告和功能请求
- [Discussion](https://github.com/your-org/ResearchFounderNetwork/discussions) - 使用问题和讨论

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

## 🙏 致谢

感谢所有为这个项目做出贡献的开发者和研究者。

---

<div align="center">

**让AI时代的科研协作更简单** 

Made with ❤️ by the Latent Space Team

</div>