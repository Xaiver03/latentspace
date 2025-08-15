import Redis from "ioredis";
import { AppError } from "../middleware/error-handler";

interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string;
  compress?: boolean;
}

interface CacheResult<T> {
  data: T | null;
  hit: boolean;
  key: string;
}

export class CacheService {
  private client: Redis | null = null;
  private readonly defaultTTL = 300; // 5 minutes
  private readonly maxTTL = 86400; // 24 hours
  private readonly keyPrefix = "latentspace:";
  private isConnected = false;

  constructor() {
    this.initializeRedis();
  }

  private async initializeRedis() {
    try {
      // Redis connection configuration
      const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
      
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError: (err) => {
          const targetError = "READONLY";
          if (err.message.includes(targetError)) {
            // Only reconnect when the error contains "READONLY"
            return true;
          }
          return false;
        },
        enableOfflineQueue: false,
        lazyConnect: true,
      });

      // Event handlers
      this.client.on("connect", () => {
        console.log("Redis connected successfully");
        this.isConnected = true;
      });

      this.client.on("error", (err) => {
        console.error("Redis connection error:", err);
        this.isConnected = false;
      });

      this.client.on("close", () => {
        console.log("Redis connection closed");
        this.isConnected = false;
      });

      // Attempt connection
      await this.client.connect();
    } catch (error) {
      console.error("Failed to initialize Redis:", error);
      // Don't throw - allow app to run without cache
      this.client = null;
      this.isConnected = false;
    }
  }

  /**
   * Generate cache key with namespace and prefix
   */
  private generateKey(key: string, namespace?: string): string {
    const ns = namespace || "default";
    return `${this.keyPrefix}${ns}:${key}`;
  }

  /**
   * Serialize value for storage
   */
  private serialize(value: any): string {
    return JSON.stringify(value);
  }

  /**
   * Deserialize value from storage
   */
  private deserialize<T>(value: string): T {
    try {
      return JSON.parse(value);
    } catch {
      return value as unknown as T;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<CacheResult<T>> {
    if (!this.isConnected || !this.client) {
      return { data: null, hit: false, key };
    }

    try {
      const fullKey = this.generateKey(key, options.namespace);
      const value = await this.client.get(fullKey);
      
      if (value === null) {
        return { data: null, hit: false, key: fullKey };
      }

      const data = this.deserialize<T>(value);
      return { data, hit: true, key: fullKey };
    } catch (error) {
      console.error("Cache get error:", error);
      return { data: null, hit: false, key };
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.generateKey(key, options.namespace);
      const serialized = this.serialize(value);
      const ttl = Math.min(options.ttl || this.defaultTTL, this.maxTTL);
      
      await this.client.set(fullKey, serialized, "EX", ttl);
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const fullKey = this.generateKey(key, options.namespace);
      const result = await this.client.del(fullKey);
      return result === 1;
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  /**
   * Delete all keys matching a pattern
   */
  async deletePattern(pattern: string, namespace?: string): Promise<number> {
    if (!this.isConnected || !this.client) {
      return 0;
    }

    try {
      const fullPattern = this.generateKey(pattern, namespace);
      const keys = await this.client.keys(fullPattern);
      
      if (keys.length === 0) {
        return 0;
      }

      const pipeline = this.client.pipeline();
      keys.forEach(key => pipeline.del(key));
      const results = await pipeline.exec();
      
      return results?.length || 0;
    } catch (error) {
      console.error("Cache delete pattern error:", error);
      return 0;
    }
  }

  /**
   * Cache aside pattern - get or compute
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached.hit && cached.data !== null) {
      return cached.data;
    }

    // Compute value
    const value = await factory();
    
    // Store in cache (fire and forget)
    this.set(key, value, options).catch(err => 
      console.error("Failed to cache computed value:", err)
    );

    return value;
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const pipeline = this.client.pipeline();
      
      for (const tag of tags) {
        const tagKey = `${this.keyPrefix}tag:${tag}`;
        const members = await this.client.smembers(tagKey);
        
        // Delete all cache entries with this tag
        members.forEach(key => pipeline.del(key));
        
        // Delete the tag set itself
        pipeline.del(tagKey);
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error("Cache invalidate by tags error:", error);
    }
  }

  /**
   * Tag a cache entry
   */
  async tag(key: string, tags: string[], namespace?: string): Promise<void> {
    if (!this.isConnected || !this.client) {
      return;
    }

    try {
      const fullKey = this.generateKey(key, namespace);
      const pipeline = this.client.pipeline();
      
      for (const tag of tags) {
        const tagKey = `${this.keyPrefix}tag:${tag}`;
        pipeline.sadd(tagKey, fullKey);
        // Set tag expiry to slightly longer than max TTL
        pipeline.expire(tagKey, this.maxTTL + 3600);
      }
      
      await pipeline.exec();
    } catch (error) {
      console.error("Cache tag error:", error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    memory?: string;
    keys?: number;
    hits?: number;
    misses?: number;
  }> {
    if (!this.isConnected || !this.client) {
      return { connected: false };
    }

    try {
      const info = await this.client.info("memory");
      const dbSize = await this.client.dbsize();
      
      // Parse memory info
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : undefined;

      return {
        connected: true,
        memory,
        keys: dbSize,
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return { connected: false };
    }
  }

  /**
   * Flush all cache entries (use with caution)
   */
  async flush(namespace?: string): Promise<boolean> {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      if (namespace) {
        // Flush only specific namespace
        const pattern = this.generateKey("*", namespace);
        const keys = await this.client.keys(pattern);
        
        if (keys.length > 0) {
          const pipeline = this.client.pipeline();
          keys.forEach(key => pipeline.del(key));
          await pipeline.exec();
        }
      } else {
        // Flush entire cache (dangerous!)
        await this.client.flushdb();
      }
      
      return true;
    } catch (error) {
      console.error("Cache flush error:", error);
      return false;
    }
  }

  /**
   * Close Redis connection gracefully
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.isConnected = false;
    }
  }
}

// Singleton instance
export const cacheService = new CacheService();

// Cache decorators for methods
export function Cacheable(options: CacheOptions = {}) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Generate cache key from method name and arguments
      const cacheKey = `${target.constructor.name}:${propertyKey}:${JSON.stringify(args)}`;
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey, options);
      if (cached.hit && cached.data !== null) {
        return cached.data;
      }

      // Call original method
      const result = await originalMethod.apply(this, args);
      
      // Cache the result
      await cacheService.set(cacheKey, result, options);
      
      return result;
    };

    return descriptor;
  };
}

// Cache invalidation decorator
export function CacheInvalidate(patterns: string[], namespace?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      // Call original method
      const result = await originalMethod.apply(this, args);
      
      // Invalidate cache patterns
      for (const pattern of patterns) {
        await cacheService.deletePattern(pattern, namespace);
      }
      
      return result;
    };

    return descriptor;
  };
}