# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
Follow git version managament and sota principle.

## Development Commands

```bash
# Start development server with hot reload
npm run dev

# Build for production (frontend + backend)
npm run build

# Start production server
npm run start

# Type checking
npm run check

# Push database schema changes
npm run db:push
```

## Architecture Overview

This is a full-stack TypeScript application for "潜空间" (Latent Space), a platform connecting researchers with potential co-founders in the GenAI era.

### Frontend Stack
- **React 18** with TypeScript, using Vite as build tool
- **Wouter** for routing (lightweight alternative to React Router)
- **Shadcn/ui** components built on Radix UI primitives
- **TanStack Query** for server state management
- **React Hook Form** with Zod validation
- **Tailwind CSS** with custom animations and typography plugin
- **Icon Libraries**:
  - `lucide-react` for primary icon components
  - `react-icons` for additional icon components
- **UI Enhancement Libraries**:
  - `recharts` for data visualization
  - `cmdk` for command menu functionality
  - `embla-carousel-react` for carousel components
  - `framer-motion` for advanced animations
  - `input-otp` for OTP input components
  - `vaul` for drawer components
  - `next-themes` for theme management
  - Animation utilities: `tailwindcss-animate`, `tw-animate-css`
- **Date Handling**: `date-fns` for date manipulation and formatting

### Backend Stack
- **Express.js** server with TypeScript and ESM modules
- **Passport.js** with session-based authentication
- **Session Storage**: `memorystore` with fallback to `connect-pg-simple` for PostgreSQL
- **Drizzle ORM** for type-safe database operations with multiple schema files
- **PostgreSQL** database (Neon serverless)
- **WebSocket Support** via `ws` package for real-time features
- **AI Integration**: OpenAI API integration for intelligent features
- **Enhanced Error Handling**: `zod-validation-error` for better validation errors

### Key Architectural Patterns

1. **API Structure**: RESTful endpoints at `/api/*` with structured error handling and modular route files
2. **Routing**: All application routes are prefixed with `/platform` (e.g., `/platform/events`, `/platform/admin`)
3. **Authentication**: Session-based with Passport local strategy, protected routes via middleware
4. **Database Schema**: Multi-file schema architecture using Drizzle ORM:
   - `shared/schema.ts` - Core user and event schemas
   - `shared/ai-matching-schema.ts` - AI-powered matching system
   - `shared/collaboration-schema.ts` - Workspace and collaboration features
   - `shared/ai-marketplace-schema.ts` - AI tool marketplace
   - `shared/reputation-schema.ts` - User reputation and rating system
5. **Type Safety**: Shared types between frontend/backend, Zod schemas for validation
6. **Build Output**: Frontend → `dist/public`, Backend → `dist/index.js`
7. **Landing Page**: Separate animated landing page served at root (`/`) with 3D effects

### Core Features
- **Animated Landing Page**: Interactive entry point with 3D particle effects showcasing platform concept
- **Event Management System**: Tech sharing and networking events with RSVP functionality
- **AI-Powered Matching System**: Advanced co-founder matching with machine learning algorithms
- **Intelligent Search**: AI-driven content and user discovery
- **Collaboration Workspaces**: Real-time collaborative spaces for teams
- **AI Marketplace**: Platform for discovering and sharing AI/ML tools and services
- **Reputation System**: Community-driven rating and reputation tracking
- **Admin Dashboard**: Advanced content moderation and platform management
- **Real-time Features**: WebSocket-powered live messaging and notifications
- **User Profiles**: Comprehensive research fields, affiliations, and collaboration interests

### Advanced Service Architecture
- **Enhanced Matching Engine**: AI-powered algorithm for co-founder recommendations
- **Matching Analytics**: Data-driven insights on matching success rates
- **Content Recommendation**: Personalized content discovery system
- **Notification Service**: Multi-channel notification management
- **WebSocket Service**: Real-time communication infrastructure
- **Embedding Service**: AI embeddings for semantic search and matching

### Development Notes
- Environment variables required for database connection (`DATABASE_URL`)
- Session secret required for production (`SESSION_SECRET`)
- OpenAI API key required for AI features (`OPENAI_API_KEY`)
- Development uses Vite dev server with proxy to backend
- Production serves static files through Express
- TypeScript configured with strict mode for enhanced type safety
- Replit-specific Vite plugins included for development environment
- ESM modules used throughout for modern JavaScript support

### Project Structure
- `/client` - React frontend application with comprehensive page structure
- `/server` - Express backend server with modular route architecture
- `/shared` - Shared types and multi-file database schemas
- `/attached_assets` - Project assets, plans, and documentation
- `/reference` - Technical documentation and PRD files
- `landing.html` - Animated landing page (served at root)
- `dist/` - Production build output directory