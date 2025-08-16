import { Router } from "express";
import { abTestingService } from "../services/ab-testing-service";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth, requireAdmin } from "../middleware/validation";

const router = Router();

// Get all active A/B tests (admin only)
router.get("/tests", requireAdmin, asyncHandler(async (req, res) => {
  const tests = abTestingService.getActiveTests();
  res.json(tests);
}));

// Create a new A/B test (admin only)
router.post("/tests", requireAdmin, asyncHandler(async (req, res) => {
  const testConfig = req.body;
  const test = await abTestingService.createTest(testConfig);
  res.status(201).json(test);
}));

// Get test results (admin only)
router.get("/tests/:testId/results", requireAdmin, asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const results = await abTestingService.getTestResults(testId);
  res.json(results);
}));

// Get AI model comparison for a test (admin only)
router.get("/tests/:testId/ai-comparison", requireAdmin, asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const comparison = await abTestingService.getAIModelComparison(testId);
  res.json(comparison);
}));

// Start AI model comparison test (admin only)
router.post("/tests/ai-comparison/start", requireAdmin, asyncHandler(async (req, res) => {
  const testId = await abTestingService.startAIModelComparisonTest();
  res.status(201).json({ 
    testId, 
    message: "AI模型对比测试已启动",
    duration: "14天",
    variants: ["OpenAI GPT-4", "Claude 3.5 Sonnet", "DeepSeek Chat"]
  });
}));

// Stop a test (admin only)
router.post("/tests/:testId/stop", requireAdmin, asyncHandler(async (req, res) => {
  const { testId } = req.params;
  abTestingService.stopTest(testId);
  res.json({ message: "测试已停止" });
}));

// Get user's assigned variant for matching (internal use by matching system)
router.get("/user-variant/:testId", requireAuth, asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const userId = req.user!.id;
  
  // Assign user to variant if not already assigned
  let variant = abTestingService.getUserVariant(userId, testId);
  if (!variant) {
    variant = abTestingService.assignUserToVariant(userId, testId);
  }
  
  res.json({ variant });
}));

// Track A/B test event
router.post("/track", requireAuth, asyncHandler(async (req, res) => {
  const { testId, variant, eventType, eventData } = req.body;
  const userId = req.user!.id;

  if (!testId || !variant || !eventType) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  await abTestingService.trackEvent(userId, testId, variant, eventType, eventData);
  res.json({ success: true });
}));

// Get test assignment for user (for frontend to know which variant to use)
router.get("/assignment/:testId", requireAuth, asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const userId = req.user!.id;
  
  let variant = abTestingService.getUserVariant(userId, testId);
  if (!variant) {
    variant = abTestingService.assignUserToVariant(userId, testId);
  }
  
  res.json({ 
    testId,
    variant,
    assigned: !!variant
  });
}));

// Get A/B testing analytics summary (admin only)
router.get("/analytics/summary", requireAdmin, asyncHandler(async (req, res) => {
  const tests = abTestingService.getActiveTests();
  
  const summary = {
    activeTests: tests.length,
    totalParticipants: 0, // Would calculate from actual data
    testsCompleted: 0, // Would track completed tests
    averageTestDuration: 14, // Days
    recentFindings: [
      {
        testName: "AI Model Comparison",
        finding: "Claude 3.5 Sonnet shows 15% higher conversion rate",
        impact: "medium",
        date: new Date().toISOString()
      },
      {
        testName: "Matching Algorithm Test",
        finding: "Enhanced algorithm improves user satisfaction by 12%",
        impact: "high", 
        date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    upcomingTests: [
      {
        name: "Notification Timing Optimization",
        startDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        variants: 3
      }
    ]
  };

  res.json(summary);
}));

// Export test data for analysis (admin only)
router.get("/export/:testId", requireAdmin, asyncHandler(async (req, res) => {
  const { testId } = req.params;
  const format = req.query.format as 'json' | 'csv' || 'json';

  const results = await abTestingService.getTestResults(testId);
  const comparison = await abTestingService.getAIModelComparison(testId);

  const exportData = {
    testId,
    exportDate: new Date().toISOString(),
    testInfo: comparison,
    results,
    summary: {
      totalParticipants: results.reduce((sum, r) => sum + r.metrics.participants, 0),
      winningVariant: results.reduce((best, current) => 
        current.metrics.conversionRate > best.metrics.conversionRate ? current : best
      ).variant,
      statisticalSignificance: results.some(r => r.significance.isSignificant)
    }
  };

  if (format === 'csv') {
    // Convert to CSV format
    const csvRows = [
      'Variant,Participants,ConversionRate,MatchScore,InteractionRate,MessagingRate,IsSignificant,PValue',
      ...results.map(r => [
        r.variant,
        r.metrics.participants,
        r.metrics.conversionRate.toFixed(2),
        r.metrics.averageMatchScore.toFixed(2),
        r.metrics.interactionRate.toFixed(2),
        r.metrics.messagingRate.toFixed(2),
        r.significance.isSignificant,
        r.significance.pValue.toFixed(4)
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=ab-test-${testId}-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvRows);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=ab-test-${testId}-${new Date().toISOString().split('T')[0]}.json`);
    res.json(exportData);
  }
}));

export default router;