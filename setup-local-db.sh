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

# Update .env file
echo "📝 Updating .env file..."
cat > .env << 'ENVEOF'
# Database Configuration
DATABASE_URL=postgresql://localhost:5432/research_founder_network

# Session Configuration
SESSION_SECRET=dev-secret-change-in-production-abc123xyz789

# Server Configuration
PORT=5001
NODE_ENV=development
ENVEOF

echo "✅ Database setup complete\!"
echo "📌 Next steps:"
echo "   1. Run 'npm run db:push' to create tables"
echo "   2. Run 'npm run dev' to start the server"
