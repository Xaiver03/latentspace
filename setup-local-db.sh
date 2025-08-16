#\!/bin/bash

echo "🔧 Setting up local PostgreSQL database..."

# Check if PostgreSQL is installed
if \! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed. Please install it first:"
    echo "   brew install postgresql"
    echo "   brew services start postgresql"
    exit 1
fi

# Create database
echo "📦 Creating database 'research_founder_network'..."
createdb research_founder_network 2>/dev/null || echo "Database might already exist"

# Generate secure session secret
echo "🔐 Generating secure session secret..."
RANDOM_SECRET=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))" 2>/dev/null || echo "dev-$(date +%s)-$(openssl rand -hex 32 2>/dev/null || echo "fallback-secret-change-in-production")")

# Update .env file
echo "📝 Creating .env file..."
cat > .env << ENVEOF
# ================================
# 潜空间 (Latent Space) - 本地开发环境配置
# ================================

# ================================
# Database Configuration
# ================================
DATABASE_URL=postgresql://localhost:5432/research_founder_network

# ================================
# Security Configuration  
# ================================
# 会话加密密钥 - 已自动生成安全随机密钥
# ⚠️  生产环境部署时请务必更换为新的随机密钥
SESSION_SECRET=$RANDOM_SECRET

# ================================
# Server Configuration
# ================================
PORT=5001
NODE_ENV=development

# ================================
# AI Services (Optional)
# ================================
# OpenAI API密钥 - 用于AI匹配功能 (可选)
# OPENAI_API_KEY=sk-your-openai-api-key-here

# ================================
# Cache Configuration (Optional)
# ================================
# Redis连接 - 用于性能优化 (可选)
# REDIS_URL=redis://localhost:6379
ENVEOF

echo "🔒 生成了安全的会话密钥用于本地开发"
echo "⚠️  生产环境部署时请务必更换SESSION_SECRET"

echo "✅ Database setup complete\!"
echo "📌 Next steps:"
echo "   1. Run 'npm run db:push' to create tables"
echo "   2. Run 'npm run dev' to start the server"
