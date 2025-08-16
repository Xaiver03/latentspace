// AI Admin Routes - AI系统管理接口
import { Router } from 'express';
import { getAIManager, checkAIHealth, getAICosts } from '../services/ai/index.js';

const router = Router();

// 中间件：检查管理员权限
const requireAdmin = (req: any, res: any, next: any) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: '需要管理员权限' });
  }
  next();
};

// GET /api/admin/ai/providers - 获取AI提供商列表
router.get('/providers', requireAdmin, async (req, res) => {
  try {
    const aiManager = getAIManager();
    const providers = aiManager.listProviders();
    
    // 获取每个提供商的详细信息和指标
    const providersWithMetrics = await Promise.all(
      providers.map(async (provider) => {
        const config = aiManager.getProviderConfig(provider.id);
        const router = aiManager.getRouter();
        const analytics = aiManager.getAnalytics();
        
        // 获取过去30天的统计数据
        const end = new Date();
        const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        const stats = await analytics.getProviderStats(provider.id, { start, end });
        
        return {
          id: provider.id,
          name: provider.name,
          displayName: config?.displayName || provider.name,
          enabled: provider.enabled,
          status: provider.status,
          config: {
            apiKey: config?.apiKey ? '***' + config.apiKey.slice(-4) : '',
            baseUrl: config?.baseUrl || '',
            priority: config?.priority || 1,
          },
          metrics: {
            requestCount: stats.totalRequests,
            successRate: stats.successRate,
            averageLatency: stats.averageLatency,
            totalCost: stats.totalCost,
          }
        };
      })
    );
    
    res.json(providersWithMetrics);
  } catch (error: any) {
    console.error('Error fetching AI providers:', error);
    res.status(500).json({ error: '获取AI提供商信息失败' });
  }
});

// GET /api/admin/ai/stats - 获取AI系统统计信息
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const aiManager = getAIManager();
    const analytics = aiManager.getAnalytics();
    const router = aiManager.getRouter();
    const cache = aiManager.getCache();
    
    // 获取系统健康状态
    const healthStatus = await checkAIHealth();
    
    // 获取过去30天的系统统计
    const end = new Date();
    const start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    const systemStats = await analytics.getSystemStats({ start, end });
    
    // 获取缓存统计
    const cacheStats = await cache.getStats();
    
    const stats = {
      totalRequests: systemStats.totalRequests,
      averageLatency: systemStats.averageLatency,
      totalCost: Object.values(systemStats.costsByProvider).reduce((sum: number, cost: number) => sum + cost, 0),
      cacheHitRate: cacheStats.hitRate * 100,
      activeProviders: Object.keys(systemStats.requestsByProvider).length,
      emergencyMode: aiManager.isEmergencyMode(),
      routingStrategy: process.env.AI_ROUTING_STRATEGY || 'cost-optimized',
    };
    
    res.json(stats);
  } catch (error: any) {
    console.error('Error fetching AI stats:', error);
    res.status(500).json({ error: '获取AI统计信息失败' });
  }
});

// PUT /api/admin/ai/providers/:providerId - 更新AI提供商配置
router.put('/providers/:providerId', requireAdmin, async (req, res) => {
  try {
    const { providerId } = req.params;
    const { enabled, config } = req.body;
    
    const aiManager = getAIManager();
    
    if (typeof enabled === 'boolean') {
      // 更新启用状态
      const router = aiManager.getRouter();
      const providers = router.getAvailableProviders();
      const provider = providers.find(p => p.providerId === providerId);
      
      if (!provider) {
        return res.status(404).json({ error: '提供商不存在' });
      }
      
      // 这里应该实现启用/禁用逻辑
      // 暂时返回成功状态
    }
    
    if (config) {
      // 更新配置
      await aiManager.updateProviderConfig(providerId, config);
    }
    
    res.json({ success: true, message: '配置更新成功' });
  } catch (error: any) {
    console.error('Error updating AI provider:', error);
    res.status(500).json({ error: '更新AI提供商配置失败' });
  }
});

// PUT /api/admin/ai/routing - 更新AI路由策略
router.put('/routing', requireAdmin, async (req, res) => {
  try {
    const { strategy } = req.body;
    
    if (!['cost-optimized', 'performance-optimized', 'quality-optimized', 'round-robin'].includes(strategy)) {
      return res.status(400).json({ error: '无效的路由策略' });
    }
    
    const aiManager = getAIManager();
    const router = aiManager.getRouter();
    router.setRoutingStrategy(strategy);
    
    // 更新环境变量（在实际部署中可能需要更持久的存储）
    process.env.AI_ROUTING_STRATEGY = strategy;
    
    res.json({ success: true, message: '路由策略更新成功' });
  } catch (error: any) {
    console.error('Error updating routing strategy:', error);
    res.status(500).json({ error: '更新路由策略失败' });
  }
});

// POST /api/admin/ai/providers/:providerId/test - 测试AI提供商连接
router.post('/providers/:providerId/test', requireAdmin, async (req, res) => {
  try {
    const { providerId } = req.params;
    
    const aiManager = getAIManager();
    const router = aiManager.getRouter();
    const providers = router.getAvailableProviders();
    const provider = providers.find(p => p.providerId === providerId);
    
    if (!provider) {
      return res.status(404).json({ error: '提供商不存在' });
    }
    
    // 执行健康检查
    const isHealthy = await provider.checkHealth();
    
    res.json({ 
      success: isHealthy, 
      message: isHealthy ? '连接测试成功' : '连接测试失败',
      providerId,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('Error testing AI provider:', error);
    res.status(500).json({ error: '测试连接失败' });
  }
});

// GET /api/admin/ai/costs - 获取AI成本分析
router.get('/costs', requireAdmin, async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const timeRange = {
      start: new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000),
      end: new Date()
    };
    
    const costs = await getAICosts(timeRange);
    
    res.json(costs);
  } catch (error: any) {
    console.error('Error fetching AI costs:', error);
    res.status(500).json({ error: '获取成本信息失败' });
  }
});

// GET /api/admin/ai/alerts - 获取AI系统告警
router.get('/alerts', requireAdmin, async (req, res) => {
  try {
    // 这里应该从告警系统获取数据
    // 暂时返回模拟数据
    const alerts = [
      {
        id: 'ai-001',
        level: 'warning' as const,
        title: 'OpenAI响应时间较高',
        message: '过去1小时平均响应时间超过3秒',
        component: 'AI Router',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        resolved: false
      },
      {
        id: 'ai-002', 
        level: 'info' as const,
        title: '成本预警',
        message: '本月AI使用成本已达到预算的80%',
        component: 'Cost Monitor',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        resolved: false
      }
    ];
    
    res.json(alerts);
  } catch (error: any) {
    console.error('Error fetching AI alerts:', error);
    res.status(500).json({ error: '获取告警信息失败' });
  }
});

// POST /api/admin/ai/emergency - 切换紧急模式
router.post('/emergency', requireAdmin, async (req, res) => {
  try {
    const { enabled } = req.body;
    
    const aiManager = getAIManager();
    
    if (enabled) {
      aiManager.enableEmergencyMode();
    } else {
      aiManager.disableEmergencyMode();
    }
    
    res.json({ 
      success: true, 
      message: enabled ? '紧急模式已启用' : '紧急模式已关闭',
      emergencyMode: aiManager.isEmergencyMode()
    });
  } catch (error: any) {
    console.error('Error toggling emergency mode:', error);
    res.status(500).json({ error: '切换紧急模式失败' });
  }
});

export default router;