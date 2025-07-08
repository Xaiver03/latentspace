# 潜空间 (Latent Space) - Researcher Founder Platform

## Overview

This is a full-stack web application called "潜空间" (Latent Space) that serves as a platform connecting researchers with potential co-founders in the GenAI era. The platform facilitates tech sharing, startup networking, and co-founder matching for the research community.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **UI Library**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: TanStack Query (React Query) for server state
- **Forms**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and bundling

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Authentication**: Passport.js with local strategy and session-based auth
- **Session Storage**: PostgreSQL-backed sessions via connect-pg-simple
- **API Design**: RESTful endpoints with structured error handling

### Database Layer
- **ORM**: Drizzle ORM for type-safe database operations
- **Database**: PostgreSQL (configured for Neon serverless)
- **Migrations**: Drizzle Kit for schema management
- **Connection**: Neon serverless driver with WebSocket support

## Key Components

### Authentication System
- Session-based authentication using Passport.js
- Secure password hashing with Node.js crypto (scrypt)
- Role-based access control (user/admin roles)
- Protected routes with authentication middleware

### Core Features
1. **Event Management**: Create, browse, and register for research/startup events
2. **Agent Product Showcase**: Share and discover AI/ML tools and products
3. **Co-founder Matching**: Application system for finding research partners
4. **Admin Dashboard**: Content moderation and user management
5. **Community Features**: User profiles with research fields and affiliations

### Data Models
- **Users**: Researchers with profiles, affiliations, and role management
- **Events**: Tech sharing, startup networking, and general events
- **Agent Products**: AI/ML tools with categories and usage tracking
- **Co-founder Applications**: Matching system for research collaborations
- **Matches**: Pair researchers based on compatibility
- **Messages**: Communication system between matched users

## Data Flow

1. **Authentication Flow**: Login → Session creation → Protected route access
2. **Event Flow**: Browse events → Register → Attend → Network
3. **Product Flow**: Submit agent product → Review → Publish → Community access
4. **Matching Flow**: Submit application → Admin review → Algorithm matching → Communication

## External Dependencies

### Core Dependencies
- **Database**: Neon PostgreSQL serverless database
- **UI Components**: Radix UI primitives for accessibility
- **Validation**: Zod for runtime type checking
- **Date Handling**: date-fns for date manipulation
- **Icons**: Lucide React for consistent iconography

### Development Tools
- **Type Checking**: TypeScript with strict configuration
- **Build**: Vite with React plugin and development overlays
- **Code Quality**: ESLint and PostCSS for consistent code style

## Deployment Strategy

### Build Process
1. **Frontend**: Vite builds React app to `dist/public`
2. **Backend**: esbuild bundles Node.js server to `dist/index.js`
3. **Database**: Drizzle Kit manages schema migrations

### Environment Configuration
- **Development**: Local development with Vite dev server
- **Production**: Express serves static files and API routes
- **Database**: Environment-based connection string configuration

### Replit Integration
- Development error overlays and debugging tools
- Cartographer plugin for enhanced development experience
- Runtime error modal for better debugging

## Changelog

```
Changelog:
- July 08, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```