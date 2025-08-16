import { Request, Response, NextFunction } from 'express';
import { performance } from 'perf_hooks';

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  params?: any;
  userId?: number;
  endpoint: string;
}

// Store recent query metrics in memory for monitoring
const queryMetrics: QueryMetrics[] = [];
const MAX_METRICS = 1000; // Keep last 1000 queries

/**
 * Query performance monitoring middleware
 */
export function queryMonitoring() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = performance.now();
    const originalJson = res.json;
    
    res.json = function(data: any) {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Log slow queries (> 1000ms)
      if (duration > 1000) {
        console.warn(`🐌 Slow query detected: ${req.originalUrl} - ${duration.toFixed(2)}ms`);
        
        // Store metric
        queryMetrics.push({
          query: req.originalUrl,
          duration,
          timestamp: new Date(),
          params: req.query,
          userId: req.user?.id,
          endpoint: `${req.method} ${req.route?.path || req.path}`
        });
        
        // Keep only recent metrics
        if (queryMetrics.length > MAX_METRICS) {
          queryMetrics.splice(0, queryMetrics.length - MAX_METRICS);
        }
      }
      
      // Add performance headers
      res.set('X-Response-Time', `${duration.toFixed(2)}ms`);
      
      return originalJson.call(this, data);
    };
    
    next();
  };
}

/**
 * Get query performance statistics
 */
export function getQueryStats() {
  const recentQueries = queryMetrics.slice(-100); // Last 100 queries
  
  if (recentQueries.length === 0) {
    return {
      avgDuration: 0,
      slowQueries: 0,
      totalQueries: 0,
      slowestQueries: []
    };
  }
  
  const avgDuration = recentQueries.reduce((sum, metric) => sum + metric.duration, 0) / recentQueries.length;
  const slowQueries = recentQueries.filter(metric => metric.duration > 1000).length;
  const slowestQueries = recentQueries
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10)
    .map(metric => ({
      endpoint: metric.endpoint,
      duration: Math.round(metric.duration),
      timestamp: metric.timestamp,
      params: metric.params
    }));
  
  return {
    avgDuration: Math.round(avgDuration),
    slowQueries,
    totalQueries: recentQueries.length,
    slowestQueries
  };
}

/**
 * Database query optimization utilities
 */
export class QueryOptimizer {
  /**
   * Add pagination to query parameters
   */
  static paginateQuery(req: Request): { limit: number; offset: number } {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 items
    const offset = (page - 1) * limit;
    
    return { limit, offset };
  }
  
  /**
   * Parse and validate sort parameters
   */
  static parseSortParams(req: Request, allowedFields: string[]) {
    const sortBy = req.query.sortBy as string;
    const sortOrder = (req.query.sortOrder as string)?.toLowerCase() === 'desc' ? 'desc' : 'asc';
    
    if (!sortBy || !allowedFields.includes(sortBy)) {
      return { field: allowedFields[0], order: 'asc' as const };
    }
    
    return { field: sortBy, order: sortOrder as 'asc' | 'desc' };
  }
  
  /**
   * Parse search filters
   */
  static parseFilters(req: Request, allowedFilters: string[]) {
    const filters: Record<string, any> = {};
    
    allowedFilters.forEach(filter => {
      const value = req.query[filter];
      if (value !== undefined && value !== null && value !== '') {
        filters[filter] = value;
      }
    });
    
    return filters;
  }
  
  /**
   * Generate cache key for query
   */
  static generateQueryCacheKey(req: Request, prefix: string = ''): string {
    const { path, query } = req;
    const userId = req.user?.id || 'anonymous';
    const sortedQuery = Object.keys(query)
      .sort()
      .map(key => `${key}=${query[key]}`)
      .join('&');
    
    return `${prefix}:${userId}:${path}:${sortedQuery}`;
  }
}

/**
 * Middleware to add query optimization helpers to request
 */
export function addQueryHelpers() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Add pagination helper
    req.pagination = QueryOptimizer.paginateQuery(req);
    
    // Add cache key generator
    req.getCacheKey = (prefix?: string) => QueryOptimizer.generateQueryCacheKey(req, prefix);
    
    next();
  };
}

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      pagination?: { limit: number; offset: number };
      getCacheKey?: (prefix?: string) => string;
    }
  }
}