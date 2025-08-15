/**
 * Cache configuration for different resources
 */
export const cacheConfig = {
  // User-related caching
  users: {
    profile: {
      ttl: 300, // 5 minutes
      namespace: "users",
    },
    session: {
      ttl: 3600, // 1 hour
      namespace: "users",
    },
    matchingProfile: {
      ttl: 600, // 10 minutes
      namespace: "users",
    },
  },

  // Events caching
  events: {
    list: {
      ttl: 60, // 1 minute
      namespace: "events",
    },
    detail: {
      ttl: 300, // 5 minutes
      namespace: "events",
    },
    registrations: {
      ttl: 120, // 2 minutes
      namespace: "events",
    },
  },

  // Matching system caching
  matching: {
    candidates: {
      ttl: 300, // 5 minutes
      namespace: "matching",
    },
    recommendations: {
      ttl: 600, // 10 minutes
      namespace: "matching",
    },
    analytics: {
      ttl: 900, // 15 minutes
      namespace: "matching",
    },
  },

  // AI services caching
  ai: {
    embeddings: {
      ttl: 86400, // 24 hours
      namespace: "ai",
    },
    searchResults: {
      ttl: 300, // 5 minutes
      namespace: "ai",
    },
    recommendations: {
      ttl: 600, // 10 minutes
      namespace: "ai",
    },
  },

  // Content caching
  content: {
    posts: {
      ttl: 300, // 5 minutes
      namespace: "content",
    },
    comments: {
      ttl: 120, // 2 minutes
      namespace: "content",
    },
    trending: {
      ttl: 600, // 10 minutes
      namespace: "content",
    },
  },

  // Analytics caching
  analytics: {
    dashboard: {
      ttl: 900, // 15 minutes
      namespace: "analytics",
    },
    reports: {
      ttl: 3600, // 1 hour
      namespace: "analytics",
    },
  },

  // Reputation system caching
  reputation: {
    scores: {
      ttl: 600, // 10 minutes
      namespace: "reputation",
    },
    leaderboard: {
      ttl: 300, // 5 minutes
      namespace: "reputation",
    },
  },
};

// Cache invalidation patterns
export const cacheInvalidationPatterns = {
  // When a user updates their profile
  userUpdate: (userId: number) => [
    `users:profile:${userId}`,
    `users:matchingProfile:${userId}`,
    `matching:candidates:*`,
  ],

  // When an event is created/updated
  eventUpdate: (eventId?: number) => [
    `events:list:*`,
    eventId ? `events:detail:${eventId}` : `events:detail:*`,
    `events:registrations:*`,
  ],

  // When a match is created
  matchCreated: (userId1: number, userId2: number) => [
    `matching:candidates:${userId1}`,
    `matching:candidates:${userId2}`,
    `matching:recommendations:${userId1}`,
    `matching:recommendations:${userId2}`,
  ],

  // When content is created/updated
  contentUpdate: (contentType: string, contentId?: number) => [
    `content:${contentType}:*`,
    `content:trending:*`,
    contentId ? `content:${contentType}:${contentId}` : null,
  ].filter(Boolean) as string[],

  // When reputation changes
  reputationUpdate: (userId: number) => [
    `reputation:scores:${userId}`,
    `reputation:leaderboard:*`,
  ],
};

// Cache warming strategies
export const cacheWarmingStrategies = {
  /**
   * Warm frequently accessed data on startup
   */
  startup: [
    { key: "events:trending", factory: () => getTopEvents(), ttl: 300 },
    { key: "users:leaderboard", factory: () => getTopUsers(), ttl: 600 },
  ],

  /**
   * Periodic cache warming (run via cron)
   */
  periodic: [
    { 
      key: "analytics:daily", 
      factory: () => generateDailyAnalytics(), 
      ttl: 3600,
      schedule: "0 1 * * *", // Daily at 1 AM
    },
  ],
};

// Placeholder functions - implement in respective services
async function getTopEvents() {
  // Implementation in events service
  return [];
}

async function getTopUsers() {
  // Implementation in users service
  return [];
}

async function generateDailyAnalytics() {
  // Implementation in analytics service
  return {};
}