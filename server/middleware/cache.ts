import type { Request, Response, NextFunction } from "express";
import { cacheService } from "../services/cache-service";
import { cacheConfig } from "../config/cache-config";
import NodeCache from 'node-cache';

interface CacheMiddlewareOptions {
  ttl?: number;
  namespace?: string;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request) => boolean;
  tags?: string[];
}

/**
 * Cache middleware for GET requests
 */
export function cache(options: CacheMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Check condition if provided
    if (options.condition && !options.condition(req)) {
      return next();
    }

    // Generate cache key
    const keyGenerator = options.keyGenerator || defaultKeyGenerator;
    const cacheKey = keyGenerator(req);
    
    // Try to get from cache
    const cached = await cacheService.get(cacheKey, {
      namespace: options.namespace || "http",
    });

    if (cached.hit && cached.data) {
      // Add cache headers
      res.set("X-Cache", "HIT");
      res.set("X-Cache-Key", cached.key);
      
      return res.json(cached.data);
    }

    // Store original res.json
    const originalJson = res.json;
    
    // Override res.json to cache the response
    res.json = function(data: any) {
      // Cache the response
      cacheService.set(cacheKey, data, {
        ttl: options.ttl || 300,
        namespace: options.namespace || "http",
      }).then(() => {
        // Tag the cache entry if tags provided
        if (options.tags && options.tags.length > 0) {
          cacheService.tag(cacheKey, options.tags, options.namespace || "http");
        }
      }).catch(err => {
        console.error("Failed to cache response:", err);
      });

      // Add cache headers
      res.set("X-Cache", "MISS");
      res.set("X-Cache-Key", cacheKey);
      
      // Call original json method
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Default cache key generator
 */
function defaultKeyGenerator(req: Request): string {
  const { path, query } = req;
  const queryString = Object.keys(query).length > 0 
    ? `:${JSON.stringify(query)}` 
    : "";
  
  return `${path}${queryString}`;
}

/**
 * User-specific cache middleware
 */
export function userCache(options: CacheMiddlewareOptions = {}) {
  return cache({
    ...options,
    keyGenerator: (req) => {
      const userId = req.user?.id || "anonymous";
      const defaultKey = defaultKeyGenerator(req);
      return `user:${userId}:${defaultKey}`;
    },
    condition: (req) => {
      // Only cache for authenticated users
      return req.isAuthenticated();
    },
  });
}

/**
 * Public cache middleware (CDN-friendly)
 */
export function publicCache(maxAge: number = 300) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    // Set cache control headers
    res.set("Cache-Control", `public, max-age=${maxAge}`);
    
    // Use standard cache middleware
    return cache({
      ttl: maxAge,
      namespace: "public",
    })(req, res, next);
  };
}

/**
 * No-cache middleware
 */
export function noCache() {
  return (req: Request, res: Response, next: NextFunction) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    next();
  };
}

/**
 * Cache invalidation middleware
 */
export function invalidateCache(patterns: string[], namespace?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original methods
    const originalJson = res.json;
    const originalSend = res.send;
    const originalStatus = res.status;
    
    let responseStatus = 200;
    
    // Override status to capture it
    res.status = function(code: number) {
      responseStatus = code;
      return originalStatus.call(this, code);
    };
    
    // Override json/send to invalidate cache after successful responses
    const invalidateAfterResponse = async () => {
      // Only invalidate on successful modifications (2xx status codes)
      if (responseStatus >= 200 && responseStatus < 300) {
        for (const pattern of patterns) {
          await cacheService.deletePattern(pattern, namespace);
        }
      }
    };
    
    res.json = function(data: any) {
      invalidateAfterResponse().catch(err => 
        console.error("Cache invalidation error:", err)
      );
      return originalJson.call(this, data);
    };
    
    res.send = function(data: any) {
      invalidateAfterResponse().catch(err => 
        console.error("Cache invalidation error:", err)
      );
      return originalSend.call(this, data);
    };
    
    next();
  };
}

/**
 * Conditional cache based on response
 */
export function conditionalCache(
  condition: (data: any) => boolean,
  options: CacheMiddlewareOptions = {}
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only cache GET requests
    if (req.method !== "GET") {
      return next();
    }

    const originalJson = res.json;
    
    res.json = function(data: any) {
      // Check condition
      if (condition(data)) {
        // Apply caching
        const keyGenerator = options.keyGenerator || defaultKeyGenerator;
        const cacheKey = keyGenerator(req);
        
        cacheService.set(cacheKey, data, {
          ttl: options.ttl || 300,
          namespace: options.namespace || "conditional",
        }).catch(err => {
          console.error("Conditional cache error:", err);
        });
      }
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

// Enhanced memory cache instances for performance optimization
const performanceCache = new NodeCache({ 
  stdTTL: 300,     // 5 minutes default
  checkperiod: 60, // Check for expired keys every 60 seconds
  useClones: false, // Better performance
  maxKeys: 1000    // Limit memory usage
});

/**
 * High-performance cache for frequently accessed data
 */
export function performanceCache_middleware(ttl: number = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET') {
      return next();
    }

    const cacheKey = `perf:${req.originalUrl}`;
    const cached = performanceCache.get(cacheKey);
    
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }

    const originalJson = res.json;
    res.json = function(data: any) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        performanceCache.set(cacheKey, data, ttl);
        res.set('X-Cache', 'MISS');
      }
      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Cache manager for performance monitoring
 */
export class CacheManager {
  static getMemoryCacheStats() {
    return {
      performance: performanceCache.getStats(),
      keys: performanceCache.keys().length
    };
  }

  static clearMemoryCache() {
    performanceCache.flushAll();
  }

  static invalidatePattern(pattern: string) {
    const keys = performanceCache.keys();
    const matching = keys.filter(key => key.includes(pattern));
    matching.forEach(key => performanceCache.del(key));
    return matching.length;
  }
}