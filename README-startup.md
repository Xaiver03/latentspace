# 一键启动脚本使用指南

## 快速开始

### macOS 用户
```bash
# 方式1：双击 start.command 文件
# 方式2：终端运行
./start.sh
# 方式3：使用 node 运行
node start.js
```

### Windows 用户
```bash
# 方式1：双击 start.cmd 文件
# 方式2：命令行运行
start.cmd
# 方式3：使用 node 运行
node start.js
```

### Linux 用户
```bash
# 终端运行
./start.sh
# 或使用 node 运行
node start.js
```

## 功能特性

✨ **一键启动** - 自动启动前后端服务
🔍 **环境检查** - 自动检查依赖和配置
🌐 **自动打开浏览器** - 服务启动后自动打开平台页面
🎨 **彩色输出** - 清晰的状态显示和日志
⚡ **端口配置** - 使用5000端口，避免常见端口冲突
🛡️ **错误处理** - 完善的错误提示和处理

## 端口配置

- **主服务端口**: 5000
- **访问地址**: http://localhost:5000/platform
- **API地址**: http://localhost:5000/api

## 前置要求

1. **Node.js** - 需要安装 Node.js 环境
2. **依赖安装** - 首次运行前执行 `npm install`
3. **环境配置** - 创建 `.env` 文件并配置数据库连接

## 环境配置示例

创建 `.env` 文件：
```env
DATABASE_URL=your_database_connection_string
SESSION_SECRET=your_session_secret
NODE_ENV=development
```

## 常见问题

### 端口被占用
如果提示端口5000被占用，请先关闭占用该端口的程序，或修改 `start.js` 中的端口配置。

### 无法自动打开浏览器
某些环境下可能无法自动打开浏览器，此时请手动访问 http://localhost:5000/platform

### 数据库连接失败
请检查 `.env` 文件中的 `DATABASE_URL` 配置是否正确。本项目使用 Neon 云数据库服务。

## 停止服务

按 `Ctrl+C` 停止所有服务。

## 开发说明

该脚本会以开发模式启动服务，包括：
- Vite 开发服务器（支持热更新）
- Express 后端服务器
- 自动代理配置

数据库使用 Neon 云服务，无需本地启动。