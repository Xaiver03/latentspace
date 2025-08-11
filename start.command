#!/bin/bash

# 潜空间 (Latent Space) macOS 启动脚本
# 双击即可运行

# 切换到脚本所在目录
cd "$(dirname "$0")"

# 检查 Node.js
if ! command -v node >/dev/null 2>&1; then
    echo "错误：未找到 Node.js，请先安装 Node.js"
    echo "访问 https://nodejs.org 下载安装"
    read -p "按任意键退出..."
    exit 1
fi

# 检查并安装依赖
if [ ! -d "node_modules" ]; then
    echo "正在安装项目依赖..."
    npm install
fi

# 运行启动脚本
node start.js