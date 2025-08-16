import { EventEmitter } from 'events';
import { checkDatabaseHealth } from '../config/database.js';
import { getQueryStats } from '../middleware/query-optimization.js';
import { CacheManager } from '../middleware/cache.js';

interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: SystemMetrics) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  enabled: boolean;
}

interface SystemMetrics {
  timestamp: Date;
  database: {
    isHealthy: boolean;
    latency?: number;
    poolStats: {
      totalCount: number;
      idleCount: number;
      waitingCount: number;
    };
  };
  performance: {
    queries: {
      avgDuration: number;
      slowQueries: number;
      totalQueries: number;
    };
    memory: NodeJS.MemoryUsage;
    uptime: number;
  };
  cache: {
    performance: any;
    keys: number;
  };
}

interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metrics: SystemMetrics;
  acknowledged: boolean;
}

class MonitoringService extends EventEmitter {
  private alertRules: AlertRule[] = [];
  private alerts: Alert[] = [];
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private metricsHistory: SystemMetrics[] = [];
  
  constructor() {
    super();
    this.setupDefaultAlertRules();
  }

  /**
   * Setup default monitoring rules
   */
  private setupDefaultAlertRules() {
    this.alertRules = [
      {
        id: 'db-health',
        name: 'Database Health',
        condition: (metrics) => !metrics.database.isHealthy,
        severity: 'critical',
        description: 'Database is not responding or unhealthy',
        enabled: true
      },
      {
        id: 'db-latency-high',
        name: 'High Database Latency',
        condition: (metrics) => (metrics.database.latency || 0) > 2000,
        severity: 'high',
        description: 'Database response time exceeds 2 seconds',
        enabled: true
      },
      {
        id: 'db-pool-pressure',
        name: 'Database Pool Under Pressure',
        condition: (metrics) => metrics.database.poolStats.waitingCount > 10,
        severity: 'medium',
        description: 'Too many connections waiting in database pool',
        enabled: true
      },
      {
        id: 'slow-queries',
        name: 'Multiple Slow Queries',
        condition: (metrics) => metrics.performance.queries.slowQueries > 10,
        severity: 'medium',
        description: 'High number of slow queries detected',
        enabled: true
      },
      {
        id: 'avg-query-slow',
        name: 'Average Query Performance',
        condition: (metrics) => metrics.performance.queries.avgDuration > 1500,
        severity: 'low',
        description: 'Average query response time is elevated',
        enabled: true
      },
      {
        id: 'memory-high',
        name: 'High Memory Usage',
        condition: (metrics) => {
          const heapUsedMB = metrics.performance.memory.heapUsed / 1024 / 1024;
          return heapUsedMB > 1024; // 1GB threshold
        },
        severity: 'medium',
        description: 'Memory usage is high (>1GB)',
        enabled: true
      },
      {
        id: 'cache-low-hit-rate',
        name: 'Low Cache Hit Rate',
        condition: (metrics) => {
          const cacheStats = metrics.cache.performance;
          if (!cacheStats || !cacheStats.hits || !cacheStats.misses) return false;
          const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
          return hitRate < 0.3; // 30% threshold
        },
        severity: 'low',
        description: 'Cache hit rate is below optimal threshold',
        enabled: true
      }
    ];
  }

  /**
   * Start monitoring
   */
  start(intervalMs: number = 60000) { // Default: check every minute
    if (this.isRunning) {
      console.log('🔍 Monitoring service is already running');
      return;
    }

    this.isRunning = true;
    console.log(`🔍 Starting monitoring service (interval: ${intervalMs}ms)`);

    this.intervalId = setInterval(async () => {
      try {
        await this.collectMetricsAndCheckAlerts();
      } catch (error) {
        console.error('Monitoring error:', error);
      }
    }, intervalMs);

    // Initial check
    this.collectMetricsAndCheckAlerts();
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    console.log('🔍 Monitoring service stopped');
  }

  /**
   * Collect system metrics and check alert rules
   */
  private async collectMetricsAndCheckAlerts() {
    try {
      const metrics = await this.collectMetrics();
      this.storeMetrics(metrics);
      this.checkAlertRules(metrics);
    } catch (error) {
      console.error('Failed to collect metrics:', error);
    }
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<SystemMetrics> {
    const [dbHealth, queryStats, cacheStats] = await Promise.all([
      checkDatabaseHealth(),
      Promise.resolve(getQueryStats()),
      Promise.resolve(CacheManager.getMemoryCacheStats())
    ]);

    return {
      timestamp: new Date(),
      database: dbHealth,
      performance: {
        queries: queryStats,
        memory: process.memoryUsage(),
        uptime: process.uptime()
      },
      cache: cacheStats
    };
  }

  /**
   * Store metrics in history (keep last 24 hours)
   */
  private storeMetrics(metrics: SystemMetrics) {
    this.metricsHistory.push(metrics);
    
    // Keep only last 24 hours of data (assuming 1-minute intervals)
    const maxEntries = 24 * 60;
    if (this.metricsHistory.length > maxEntries) {
      this.metricsHistory = this.metricsHistory.slice(-maxEntries);
    }
  }

  /**
   * Check alert rules against current metrics
   */
  private checkAlertRules(metrics: SystemMetrics) {
    for (const rule of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        if (rule.condition(metrics)) {
          this.triggerAlert(rule, metrics);
        }
      } catch (error) {
        console.error(`Error checking alert rule ${rule.id}:`, error);
      }
    }
  }

  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, metrics: SystemMetrics) {
    // Check if we already have a recent alert for this rule (avoid spam)
    const recentAlert = this.alerts
      .filter(alert => alert.ruleId === rule.id && !alert.acknowledged)
      .find(alert => Date.now() - alert.timestamp.getTime() < 300000); // 5 minutes

    if (recentAlert) return;

    const alert: Alert = {
      id: `${rule.id}-${Date.now()}`,
      ruleId: rule.id,
      severity: rule.severity,
      message: `${rule.name}: ${rule.description}`,
      timestamp: new Date(),
      metrics,
      acknowledged: false
    };

    this.alerts.push(alert);
    
    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    // Emit alert event
    this.emit('alert', alert);
    
    // Log alert
    const severityEmoji = {
      low: '💙',
      medium: '🟡',
      high: '🟠',
      critical: '🔴'
    };
    
    console.warn(`${severityEmoji[alert.severity]} ALERT [${alert.severity.toUpperCase()}]: ${alert.message}`);
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 50): Alert[] {
    return this.alerts
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get unacknowledged alerts
   */
  getUnacknowledgedAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.acknowledged);
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      return true;
    }
    return false;
  }

  /**
   * Get current system status
   */
  getSystemStatus() {
    const recent = this.metricsHistory.slice(-1)[0];
    if (!recent) return { status: 'unknown' };

    const criticalAlerts = this.getUnacknowledgedAlerts()
      .filter(alert => alert.severity === 'critical');
    
    const highAlerts = this.getUnacknowledgedAlerts()
      .filter(alert => alert.severity === 'high');

    let status = 'healthy';
    if (criticalAlerts.length > 0) {
      status = 'critical';
    } else if (highAlerts.length > 0) {
      status = 'degraded';
    } else if (!recent.database.isHealthy) {
      status = 'unhealthy';
    }

    return {
      status,
      timestamp: recent.timestamp,
      alerts: {
        critical: criticalAlerts.length,
        high: highAlerts.length,
        total: this.getUnacknowledgedAlerts().length
      },
      metrics: recent
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(hours: number = 1): SystemMetrics[] {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    return this.metricsHistory.filter(metric => metric.timestamp >= cutoff);
  }

  /**
   * Update alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const ruleIndex = this.alertRules.findIndex(rule => rule.id === ruleId);
    if (ruleIndex === -1) return false;

    this.alertRules[ruleIndex] = { ...this.alertRules[ruleIndex], ...updates };
    return true;
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return [...this.alertRules];
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();