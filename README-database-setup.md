# Database Setup Guide

This platform requires a PostgreSQL database. Choose one of the following options:

## Option 1: Local PostgreSQL

If you have PostgreSQL installed:

```bash
# Create the database
createdb research_founder_network

# Update .env file
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/research_founder_network
```

## Option 2: Docker (Easiest for Local Development)

```bash
# Start PostgreSQL with Docker Compose
docker-compose up -d

# Your database will be available at:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5432/research_founder_network
```

## Option 3: Cloud Database (Free Options)

### Neon (Recommended)
1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project
3. Copy connection string to `.env`

### Supabase
1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Get connection string from Settings > Database

### Railway
1. Sign up at [railway.app](https://railway.app)
2. Create PostgreSQL service
3. Copy connection string

## After Database Setup

1. Update your `.env` file with the correct DATABASE_URL
2. Run database migrations:
   ```bash
   npm run db:push
   ```
3. (Optional) Seed sample data:
   ```bash
   npm run db:seed
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

## Example .env Configuration

```env
# For local PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/research_founder_network

# For Neon (cloud)
DATABASE_URL=postgresql://username:password@host.region.aws.neon.tech/database?sslmode=require

# For Docker
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/research_founder_network

SESSION_SECRET=your-secret-key-here
PORT=5001
NODE_ENV=development
```

## Troubleshooting

- **Connection refused**: Make sure PostgreSQL is running
- **Database does not exist**: Create it with `createdb research_founder_network`
- **Authentication failed**: Check username/password in connection string
- **SSL required**: Add `?sslmode=require` to cloud database URLs