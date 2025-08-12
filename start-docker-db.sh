#\!/bin/bash

echo "🐳 Starting PostgreSQL with Docker..."

# Check if Docker is running
if \! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker Desktop first."
    exit 1
fi

# Start PostgreSQL container
docker-compose up -d

# Wait for database to be ready
echo "⏳ Waiting for database to start..."
sleep 3

# Update .env file
echo "📝 Updating .env file..."
cat > .env << 'ENVEOF'
# Database Configuration (Docker)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/research_founder_network

# Session Configuration
SESSION_SECRET=dev-secret-change-in-production-abc123xyz789

# Server Configuration
PORT=5001
NODE_ENV=development
ENVEOF

echo "✅ Database is running\!"
echo "📌 Next steps:"
echo "   1. Run 'npm run db:push' to create tables"
echo "   2. Run 'npm run dev' to start the server"
echo ""
echo "To stop the database: docker-compose down"
echo "To view logs: docker-compose logs -f"
