import express from 'express';
import { checkDatabaseHealth } from '../config/database.js';
import { getQueryStats } from '../middleware/query-optimization.js';
import { CacheManager } from '../middleware/cache.js';
import { requireAuth, requireAdmin } from '../middleware/validation.js';
import os from 'os';
import process from 'process';

const router = express.Router();

/**
 * System health check endpoint
 */
router.get('/health', async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    const memoryUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    const health = {
      status: dbHealth.isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: dbHealth.isHealthy ? 'up' : 'down',
          latency: dbHealth.latency,
          poolStats: dbHealth.poolStats
        },
        application: {
          status: 'up',
          uptime: Math.floor(uptime),
          memory: {
            used: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
            total: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
            external: Math.round(memoryUsage.external / 1024 / 1024) + 'MB'
          },
          cpu: {
            loadAverage: os.loadavg(),
            cores: os.cpus().length
          }
        }
      }
    };
    
    const statusCode = dbHealth.isHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed'
    });
  }
});

/**
 * Performance metrics (admin only)
 */
router.get('/metrics', requireAuth, requireAdmin, async (req, res) => {
  try {
    const queryStats = getQueryStats();
    const cacheStats = CacheManager.getMemoryCacheStats();
    const memoryUsage = process.memoryUsage();
    
    const metrics = {
      timestamp: new Date().toISOString(),
      performance: {
        queries: queryStats,
        cache: cacheStats,
        memory: {
          heapUsed: memoryUsage.heapUsed,
          heapTotal: memoryUsage.heapTotal,
          external: memoryUsage.external,
          rss: memoryUsage.rss
        },
        uptime: process.uptime(),
        eventLoop: {
          // Add event loop metrics if needed
        }
      }
    };
    
    res.json(metrics);
  } catch (error) {
    console.error('Metrics error:', error);
    res.status(500).json({ error: 'Failed to collect metrics' });
  }
});

/**
 * Cache management endpoints (admin only)
 */
router.post('/cache/clear', requireAuth, requireAdmin, async (req, res) => {
  try {
    CacheManager.clearMemoryCache();
    res.json({ 
      success: true, 
      message: 'Cache cleared successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache clear error:', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

router.post('/cache/invalidate/:pattern', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { pattern } = req.params;
    const deletedCount = CacheManager.invalidatePattern(pattern);
    
    res.json({ 
      success: true, 
      message: `Invalidated ${deletedCount} cache entries`,
      pattern,
      deletedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cache invalidation error:', error);
    res.status(500).json({ error: 'Failed to invalidate cache' });
  }
});

/**
 * Database connection stats (admin only)
 */
router.get('/database/stats', requireAuth, requireAdmin, async (req, res) => {
  try {
    const dbHealth = await checkDatabaseHealth();
    
    res.json({
      timestamp: new Date().toISOString(),
      database: {
        health: dbHealth.isHealthy,
        latency: dbHealth.latency,
        connectionPool: dbHealth.poolStats,
        environment: {
          nodeEnv: process.env.NODE_ENV,
          databaseUrl: process.env.DATABASE_URL ? '[CONFIGURED]' : '[NOT SET]'
        }
      }
    });
  } catch (error) {
    console.error('Database stats error:', error);
    res.status(500).json({ error: 'Failed to get database stats' });
  }
});

/**
 * Performance optimization recommendations
 */
router.get('/recommendations', requireAuth, requireAdmin, async (req, res) => {
  try {
    const queryStats = getQueryStats();
    const cacheStats = CacheManager.getMemoryCacheStats();
    const memoryUsage = process.memoryUsage();
    
    const recommendations: string[] = [];
    
    // Query performance recommendations
    if (queryStats.avgDuration > 1000) {
      recommendations.push('Consider optimizing slow queries (average response time > 1s)');
    }
    
    if (queryStats.slowQueries > 5) {
      recommendations.push('Multiple slow queries detected - review database indexes');
    }
    
    // Memory recommendations
    const heapUsedMB = memoryUsage.heapUsed / 1024 / 1024;
    if (heapUsedMB > 512) {
      recommendations.push('High memory usage detected - consider memory optimization');
    }
    
    // Cache recommendations
    if (cacheStats.performance && cacheStats.performance.hits + cacheStats.performance.misses > 0) {
      const hitRate = cacheStats.performance.hits / (cacheStats.performance.hits + cacheStats.performance.misses);
      if (hitRate < 0.5) {
        recommendations.push('Low cache hit rate - review caching strategy');
      }
    }
    
    // Database recommendations
    const dbHealth = await checkDatabaseHealth();
    if (dbHealth.poolStats.waitingCount > 5) {
      recommendations.push('Database connection pool under pressure - consider increasing pool size');
    }
    
    if (recommendations.length === 0) {
      recommendations.push('System performance looks optimal');
    }
    
    res.json({
      timestamp: new Date().toISOString(),
      recommendations,
      stats: {
        queries: queryStats,
        memory: Math.round(heapUsedMB) + 'MB',
        database: dbHealth
      }
    });
  } catch (error) {
    console.error('Recommendations error:', error);
    res.status(500).json({ error: 'Failed to generate recommendations' });
  }
});

export default router;