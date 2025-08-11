# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **Tailwind CSS** with custom animations
- **Additional UI Libraries**:
  - `react-icons` for icon components
  - `recharts` for data visualization
  - `cmdk` for command menu functionality
  - `embla-carousel-react` for carousel components
  - `framer-motion` for advanced animations
  - Animation utilities: `tailwindcss-animate`, `tw-animate-css`

### Backend Stack
- **Express.js** server with TypeScript and ESM modules
- **Passport.js** with session-based authentication (PostgreSQL session store via `connect-pg-simple`)
- **Drizzle ORM** for type-safe database operations
- **PostgreSQL** database (Neon serverless)
- **WebSocket Support** via `ws` package for real-time features

### Key Architectural Patterns

1. **API Structure**: RESTful endpoints at `/api/*` with structured error handling
2. **Routing**: All application routes are prefixed with `/platform` (e.g., `/platform/events`, `/platform/admin`)
3. **Authentication**: Session-based with Passport local strategy, protected routes via middleware
4. **Database Schema**: Defined in `shared/schema.ts` using Drizzle ORM
5. **Type Safety**: Shared types between frontend/backend, Zod schemas for validation
6. **Build Output**: Frontend → `dist/public`, Backend → `dist/index.js`
7. **Landing Page**: Separate animated landing page served at root (`/`) that redirects to `/platform`

### Core Features
- **Animated Landing Page**: Interactive entry point with 3D particle effects showcasing platform concept
- **Event Management System**: Tech sharing and networking events with RSVP functionality
- **Agent Product Showcase**: AI/ML tools discovery platform for researchers
- **Co-founder Matching System**: Application-based matching with detailed profiles
- **Admin Dashboard**: Content moderation and user management
- **User Profiles**: Research fields, affiliations, and collaboration interests

### Development Notes
- Environment variables required for database connection (`DATABASE_URL`)
- Session secret required for production (`SESSION_SECRET`)
- Development uses Vite dev server with proxy to backend
- Production serves static files through Express
- TypeScript configured with strict mode for enhanced type safety
- Replit-specific Vite plugins included for development environment

### Project Structure
- `/client` - React frontend application
- `/server` - Express backend server
- `/shared` - Shared types and database schema
- `/public` - Static assets
- `landing.html` - Animated landing page (served at root)
- `dist/` - Production build output