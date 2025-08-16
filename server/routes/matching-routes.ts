import { Router } from "express";
import { storage } from "../storage";
import { matchingEngine } from "../services/matching-engine";
import { enhancedMatchingEngine } from "../services/enhanced-matching-engine";
import { aiEnhancedMatchingEngine } from "../services/ai-enhanced-matching-engine";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth } from "../middleware/validation";
import { performanceCache_middleware, cache } from "../middleware/cache.js";
import { queryMonitoring, addQueryHelpers } from "../middleware/query-optimization.js";

const router = Router();

// Add optimization middleware
router.use(queryMonitoring());
router.use(addQueryHelpers());

// Get user matches (with caching)
router.get("/", requireAuth, 
  performanceCache_middleware(300), // 5 minute cache
  asyncHandler(async (req, res) => {
    const matches = await storage.getUserMatches(req.user!.id);
    res.json(matches);
  })
);

// Get match recommendations (with AI enhancement and caching)
router.get("/recommendations", requireAuth, 
  cache({ 
    ttl: 600, // 10 minute cache for AI recommendations
    keyGenerator: (req) => `recommendations:${req.user?.id}:${req.query.limit || 10}:${req.query.useAI || 'true'}`,
    namespace: "matching"
  }),
  asyncHandler(async (req, res) => {
    const { limit: limitParam, useAI: useAIParam } = req.query;
    const limit = parseInt(limitParam as string) || 10;
    const useAI = useAIParam !== 'false'; // 默认使用AI
    
    try {
      // 如果启用AI增强，使用新的AI匹配引擎
      if (useAI) {
        const recommendations = await aiEnhancedMatchingEngine.generateRecommendations(req.user!.id, limit);
        res.json(recommendations);
      } else {
        // 降级到原始匹配引擎
        const recommendations = await matchingEngine.generateRecommendations(req.user!.id, limit);
        res.json(recommendations);
    }
  } catch (error: any) {
    console.error("Match recommendations error:", error);
    if (error.message?.includes("not found or not approved")) {
      return res.status(404).json({ 
        error: "请先完成Co-founder申请并等待审核通过" 
      });
    }
    throw error;
  }
}));

// Express interest in a potential match
router.post("/:userId/interest", requireAuth, asyncHandler(async (req, res) => {
  const targetUserId = parseInt(req.params.userId);
  
  if (targetUserId === req.user!.id) {
    return res.status(400).json({ error: "Cannot match with yourself" });
  }

  try {
    await matchingEngine.createMatch(req.user!.id, targetUserId);
    res.json({ message: "Interest expressed successfully" });
  } catch (error: any) {
    console.error("Express interest error:", error);
    if (error.message?.includes("duplicate")) {
      return res.status(409).json({ error: "已经表达过兴趣" });
    }
    throw error;
  }
}));

// Get breaking ice questions
router.get("/ice-breakers", asyncHandler(async (req, res) => {
  const questions = matchingEngine.getBreakingIceQuestions();
  res.json({ questions });
}));

// Get AI-enhanced match explanation
router.get("/:userId/ai-explanation", requireAuth, asyncHandler(async (req, res) => {
  const targetUserId = parseInt(req.params.userId);
  
  try {
    // 获取两个用户的信息并生成AI匹配解释
    const candidates = await aiEnhancedMatchingEngine.generateRecommendations(req.user!.id, 20);
    const targetCandidate = candidates.find(c => c.id === targetUserId);
    
    if (!targetCandidate || !targetCandidate.aiInsights) {
      return res.status(404).json({ error: "Match explanation not found" });
    }
    
    const matchResult = {
      compatibilityScore: targetCandidate.aiInsights.compatibilityScore,
      matchScore: targetCandidate.matchScore,
      explanation: targetCandidate.matchReasons.join('，')
    };
    
    // 生成更详细的AI解释
    const detailedReason = await aiEnhancedMatchingEngine.generateMatchReason(matchResult);
    
    res.json({
      matchScore: targetCandidate.matchScore,
      aiInsights: targetCandidate.aiInsights,
      detailedReason,
      summary: targetCandidate.matchReasons
    });
  } catch (error: any) {
    console.error("AI explanation error:", error);
    res.status(500).json({ error: "Failed to generate AI explanation" });
  }
}));

// Start conversation with breaking ice questions
router.post("/:userId/start-conversation", requireAuth, asyncHandler(async (req, res) => {
  const targetUserId = parseInt(req.params.userId);
  const { answers } = req.body;

  if (!answers || !Array.isArray(answers) || answers.length === 0) {
    return res.status(400).json({ error: "Answers are required" });
  }

  // Get ice breaker questions
  const questions = matchingEngine.getBreakingIceQuestions();
  
  // Format initial message with questions and answers
  const formattedMessage = `🤝 **破冰问答**\n\n${
    questions.map((question, index) => 
      `**${question}**\n${answers[index] || '未回答'}\n`
    ).join('\n')
  }\n期待与你进一步交流！`;

  // Send the formatted message
  const message = await storage.createMessage({
    senderId: req.user!.id,
    receiverId: targetUserId,
    content: formattedMessage
  });

  res.json({ message: "Conversation started successfully", messageId: message.id });
}));

// Enhanced matching routes
router.get("/enhanced", requireAuth, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 10;
  const matches = await enhancedMatchingEngine.getEnhancedMatches(req.user!.id, limit);
  res.json(matches);
}));

// Get daily recommendation
router.get("/daily-recommendation", requireAuth, asyncHandler(async (req, res) => {
  const recommendation = await enhancedMatchingEngine.getDailyRecommendation(req.user!.id);
  res.json({ recommendation });
}));

// Record interaction
router.post("/:userId/interaction", requireAuth, asyncHandler(async (req, res) => {
  const targetUserId = parseInt(req.params.userId);
  const { action, metadata } = req.body;
  
  if (!action || !['viewed', 'liked', 'passed', 'messaged'].includes(action)) {
    return res.status(400).json({ error: "Invalid action" });
  }
  
  await storage.recordInteraction({
    userId: req.user!.id,
    targetUserId,
    action,
    metadata: metadata || null
  });
  
  res.json({ message: "Interaction recorded" });
}));

// Submit match feedback
router.post("/:matchId/feedback", requireAuth, asyncHandler(async (req, res) => {
  const matchId = parseInt(req.params.matchId);
  const { rating, didMeet, didContinue, feedbackText, notMatchReasons } = req.body;
  
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: "Rating must be between 1 and 5" });
  }
  
  // Verify user is part of this match
  const match = await storage.getUserMatches(req.user!.id);
  const userMatch = match.find(m => m.id === matchId);
  if (!userMatch) {
    return res.status(403).json({ error: "You are not part of this match" });
  }
  
  const feedback = await storage.createMatchFeedback({
    matchId,
    userId: req.user!.id,
    rating,
    didMeet: !!didMeet,
    didContinue: !!didContinue,
    feedbackText,
    notMatchReasons: notMatchReasons || null
  });
  
  res.json(feedback);
}));

// Create collaboration space
router.post("/:matchId/collaboration", requireAuth, asyncHandler(async (req, res) => {
  const matchId = parseInt(req.params.matchId);
  const { name, description } = req.body;
  
  // Verify user is part of this match
  const matches = await storage.getUserMatches(req.user!.id);
  const userMatch = matches.find(m => m.id === matchId);
  if (!userMatch) {
    return res.status(403).json({ error: "You are not part of this match" });
  }
  
  // Check if collaboration space already exists
  const existing = await storage.getCollaborationSpace(matchId);
  if (existing) {
    return res.status(409).json({ error: "Collaboration space already exists" });
  }
  
  const space = await storage.createCollaborationSpace({
    matchId,
    name: name || `${userMatch.user1Id}-${userMatch.user2Id} 合作空间`,
    description,
    tasks: [],
    meetingNotes: [],
    sharedDocs: []
  });
  
  res.json(space);
}));

export default router;