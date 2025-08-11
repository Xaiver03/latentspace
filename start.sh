#!/bin/bash

# 潜空间 (Latent Space) 启动脚本
# 用于快速启动开发环境

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 打印函数
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_title() {
    echo -e "\n${CYAN}$1${NC}\n"
}

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 主函数
main() {
    print_title "🚀 潜空间 (Latent Space) 开发环境启动器"
    
    # 检查 Node.js
    if ! command_exists node; then
        print_error "未找到 Node.js，请先安装 Node.js"
        exit 1
    fi
    
    # 检查依赖
    if [ ! -d "node_modules" ]; then
        print_warning "未找到 node_modules，正在安装依赖..."
        npm install
    fi
    
    # 检查 .env 文件
    if [ ! -f ".env" ]; then
        print_warning "未找到 .env 文件，将使用默认配置"
    fi
    
    # 运行 Node.js 启动脚本
    node start.js
}

# 运行主函数
main