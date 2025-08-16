import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertEventSchema, insertAgentProductSchema, insertCofounderApplicationSchema, insertMessageSchema, insertEventContentSchema, insertEventFeedbackSchema, insertEventTagSchema, collaborationSpaces } from "@shared/schema";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { eventsService } from "./services/events-service";
import { validate, requireAuth, commonSchemas } from "./middleware/validation";
import { AppError, asyncHandler } from "./middleware/error-handler";
import { createResourceRateLimit, authRateLimit } from "./middleware/rate-limit";
import { cache, userCache, invalidateCache } from "./middleware/cache";
import { matchingEngine } from "./services/matching-engine";
import { enhancedMatchingEngine } from "./services/enhanced-matching-engine";
import { matchingAnalytics } from "./services/matching-analytics";
import { contentRecommendation } from "./services/content-recommendation";
import { notificationService } from "./services/notification-service";
import { adminService } from "./services/admin-service";
import { initializeWebSocketService, getWebSocketService } from "./services/websocket-service";
import { db } from "./db";
import { eq } from "drizzle-orm";
import aiMatchingRoutes from "./routes/ai-matching-routes";
import intelligentSearchRoutes from "./routes/intelligent-search-routes";
import collaborationRoutes from "./routes/collaboration-routes";
import aiMarketplaceRoutes from "./routes/ai-marketplace-routes";
import reputationRoutes from "./routes/reputation-routes";
import eventsRoutes from "./routes/events-routes";
import matchingRoutes from "./routes/matching-routes";
import tagsRoutes from "./routes/tags-routes";
import iceBreakingQuestionsRoutes from "./routes/ice-breaking-questions-routes";
import aiAdminRoutes from "./routes/ai-admin-routes";
import interviewRoutes from "./routes/interview-routes";
import adminInterviewRoutes from "./routes/admin-interview-routes";
import abTestingRoutes from "./routes/ab-testing-routes";
import performanceRoutes from "./routes/performance-routes";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  // Serve the landing page as the main index
  app.get("/", async (req, res) => {
    try {
      const landingPath = path.resolve(import.meta.dirname, "..", "landing.html");
      const landingContent = await fs.promises.readFile(landingPath, "utf-8");
      res.setHeader("Content-Type", "text/html");
      res.send(landingContent);
    } catch (error) {
      res.status(500).send("Landing page not found");
    }
  });

  // Note: Events routes have been modularized to server/routes/events-routes.ts

  // Agent products routes
  app.get("/api/agent-products", async (req, res) => {
    try {
      const products = await storage.getAgentProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch agent products" });
    }
  });

  app.post("/api/agent-products", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const productData = insertAgentProductSchema.parse({
        ...req.body,
        creatorId: req.user!.id,
      });
      const product = await storage.createAgentProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid product data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create agent product" });
    }
  });

  // Cofounder applications routes
  app.get("/api/cofounder-applications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only admins can see all applications
    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const applications = await storage.getCofounderApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  app.get("/api/cofounder-applications/my", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const application = await storage.getUserCofounderApplication(req.user!.id);
      res.json(application || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch application" });
    }
  });

  app.post("/api/cofounder-applications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      // Check if user already has an application
      const existing = await storage.getUserCofounderApplication(req.user!.id);
      if (existing) {
        return res.status(400).json({ error: "You already have a pending application" });
      }

      const applicationData = insertCofounderApplicationSchema.parse({
        ...req.body,
        userId: req.user!.id,
      });
      const application = await storage.createCofounderApplication(applicationData);
      res.status(201).json(application);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid application data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create application" });
    }
  });

  app.patch("/api/cofounder-applications/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Only admins can update applications
    if (req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const id = parseInt(req.params.id);
      const updates = {
        ...req.body,
        reviewedBy: req.user!.id,
        reviewedAt: new Date(),
      };
      const application = await storage.updateCofounderApplication(id, updates);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }
      res.json(application);
    } catch (error) {
      res.status(500).json({ error: "Failed to update application" });
    }
  });

  // Note: Matches routes have been modularized to server/routes/matching-routes.ts

  // Get match recommendations
  app.get("/api/matches/recommendations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const recommendations = await matchingEngine.generateRecommendations(req.user!.id, limit);
      res.json(recommendations);
    } catch (error: any) {
      console.error("Match recommendations error:", error);
      if (error.message?.includes("not found or not approved")) {
        return res.status(404).json({ 
          error: "请先完成Co-founder申请并等待审核通过" 
        });
      }
      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  // Express interest in a potential match
  app.post("/api/matches/:userId/interest", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const targetUserId = parseInt(req.params.userId);
      if (targetUserId === req.user!.id) {
        return res.status(400).json({ error: "Cannot match with yourself" });
      }

      // Create match record
      await matchingEngine.createMatch(req.user!.id, targetUserId);
      
      res.json({ message: "Interest expressed successfully" });
    } catch (error: any) {
      console.error("Express interest error:", error);
      if (error.message?.includes("duplicate")) {
        return res.status(409).json({ error: "已经表达过兴趣" });
      }
      res.status(500).json({ error: "Failed to express interest" });
    }
  });

  // Get breaking ice questions
  app.get("/api/matches/ice-breakers", async (req, res) => {
    try {
      const questions = matchingEngine.getBreakingIceQuestions();
      res.json({ questions });
    } catch (error) {
      console.error("Ice breakers error:", error);
      res.status(500).json({ error: "Failed to get ice breaker questions" });
    }
  });

  // Start conversation with breaking ice questions
  app.post("/api/matches/:userId/start-conversation", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
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
    } catch (error) {
      console.error("Start conversation error:", error);
      res.status(500).json({ error: "Failed to start conversation" });
    }
  });

  // Enhanced matching routes
  app.get("/api/matches/enhanced", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const matches = await enhancedMatchingEngine.getEnhancedMatches(req.user!.id, limit);
      res.json(matches);
    } catch (error) {
      console.error("Enhanced matching error:", error);
      res.status(500).json({ error: "Failed to get enhanced matches" });
    }
  });

  // Get daily recommendation
  app.get("/api/matches/daily-recommendation", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const recommendation = await enhancedMatchingEngine.getDailyRecommendation(req.user!.id);
      res.json({ recommendation });
    } catch (error) {
      console.error("Daily recommendation error:", error);
      res.status(500).json({ error: "Failed to get daily recommendation" });
    }
  });

  // Record interaction
  app.post("/api/matches/:userId/interaction", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
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
    } catch (error) {
      console.error("Record interaction error:", error);
      res.status(500).json({ error: "Failed to record interaction" });
    }
  });

  // Get ice-breaking questions
  app.get("/api/ice-breaking-questions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 3;
      const questions = await storage.getRandomQuestions(limit);
      
      // Increment usage count for selected questions
      for (const question of questions) {
        await storage.incrementQuestionUsage(question.id);
      }
      
      res.json({ questions });
    } catch (error) {
      console.error("Ice breaking questions error:", error);
      res.status(500).json({ error: "Failed to get ice breaking questions" });
    }
  });

  // Submit match feedback
  app.post("/api/matches/:matchId/feedback", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
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
    } catch (error) {
      console.error("Match feedback error:", error);
      res.status(500).json({ error: "Failed to submit feedback" });
    }
  });

  // Create collaboration space
  app.post("/api/matches/:matchId/collaboration", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
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
    } catch (error) {
      console.error("Create collaboration space error:", error);
      res.status(500).json({ error: "Failed to create collaboration space" });
    }
  });

  // Get collaboration spaces
  app.get("/api/collaboration-spaces", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const spaces = await storage.getActiveCollaborationSpaces(req.user!.id);
      res.json(spaces);
    } catch (error) {
      console.error("Get collaboration spaces error:", error);
      res.status(500).json({ error: "Failed to get collaboration spaces" });
    }
  });

  // Update collaboration space
  app.put("/api/collaboration-spaces/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }
    try {
      const spaceId = parseInt(req.params.id);
      const updates = req.body;
      
      // Get the space to verify user access
      const space = await db.select().from(collaborationSpaces)
        .where(eq(collaborationSpaces.id, spaceId))
        .limit(1);
      
      if (!space.length) {
        return res.status(404).json({ error: "Collaboration space not found" });
      }
      
      // Verify user is part of this match
      const matches = await storage.getUserMatches(req.user!.id);
      const hasAccess = matches.some(m => m.id === space[0].matchId);
      if (!hasAccess) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const updatedSpace = await storage.updateCollaborationSpace(spaceId, updates);
      res.json(updatedSpace);
    } catch (error) {
      console.error("Update collaboration space error:", error);
      res.status(500).json({ error: "Failed to update collaboration space" });
    }
  });

  // Messages routes
  app.get("/api/messages/conversations", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const conversations = await storage.getUserConversations(req.user!.id);
      res.json(conversations);
    } catch (error) {
      console.error("Get conversations error:", error);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const messages = await storage.getUserMessages(req.user!.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/conversation/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const otherUserId = parseInt(req.params.userId);
      const messages = await storage.getConversation(req.user!.id, otherUserId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const messageData = insertMessageSchema.parse({
        ...req.body,
        senderId: req.user!.id,
      });
      const message = await storage.createMessage(messageData);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  // Modular route mounting
  app.use("/api/events", eventsRoutes);
  app.use("/api/matches", matchingRoutes);
  app.use("/api/tags", tagsRoutes);
  app.use("/api/ice-breaking-questions", iceBreakingQuestionsRoutes);
  
  // AI Matching routes
  app.use("/api/matching", aiMatchingRoutes);

  // Intelligent Search routes
  app.use("/api/search", intelligentSearchRoutes);

  // Collaboration routes
  app.use("/api/collaboration", collaborationRoutes);

  // AI Marketplace routes
  app.use("/api/marketplace", aiMarketplaceRoutes);

  // Reputation routes
  app.use("/api/reputation", reputationRoutes);

  // AI Admin routes
  app.use("/api/admin/ai", aiAdminRoutes);

  // Interview routes
  app.use("/api/interviews", interviewRoutes);

  // Admin Interview routes
  app.use("/api/admin", adminInterviewRoutes);

  // A/B Testing routes
  app.use("/api/ab-testing", abTestingRoutes);
  app.use("/api/performance", performanceRoutes);

  // Admin routes
  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      // This would need a new storage method to get all users
      res.json({ message: "Admin users endpoint - to be implemented" });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // User profile routes
  app.get("/api/users/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const user = await storage.getUserById(req.user!.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove sensitive data
      const { password, ...userProfile } = user;
      res.json(userProfile);
    } catch (error) {
      console.error("Get profile error:", error);
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  app.put("/api/users/profile", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { fullName, researchField, affiliation, bio, avatarUrl } = req.body;
      
      // Validate input
      if (!fullName?.trim()) {
        return res.status(400).json({ error: "Full name is required" });
      }

      const updatedUser = await storage.updateUserProfile(req.user!.id, {
        fullName: fullName.trim(),
        researchField: researchField?.trim() || null,
        affiliation: affiliation?.trim() || null,
        bio: bio?.trim() || null,
        avatarUrl: avatarUrl?.trim() || null,
      });

      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Remove sensitive data
      const { password, ...userProfile } = updatedUser;
      res.json(userProfile);
    } catch (error) {
      console.error("Update profile error:", error);
      res.status(500).json({ error: "Failed to update profile" });
    }
  });

  app.post("/api/users/avatar", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      // For now, return a placeholder response
      // In a real implementation, you would handle file upload to a service like Cloudinary
      res.json({ 
        avatarUrl: "https://via.placeholder.com/150",
        message: "Avatar upload feature to be implemented with cloud storage service" 
      });
    } catch (error) {
      console.error("Avatar upload error:", error);
      res.status(500).json({ error: "Failed to upload avatar" });
    }
  });

  // Matching Analytics routes
  app.get("/api/analytics/matching/metrics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const timeRange = req.query.timeRange as 'week' | 'month' | 'quarter' || 'month';
      const metrics = await matchingAnalytics.getSystemMetrics(timeRange);
      res.json(metrics);
    } catch (error) {
      console.error("Matching metrics error:", error);
      res.status(500).json({ error: "Failed to fetch matching metrics" });
    }
  });

  app.get("/api/analytics/matching/insights/:userId", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Users can only see their own insights, unless they're admin
    const requestedUserId = parseInt(req.params.userId);
    if (requestedUserId !== req.user!.id && req.user!.role !== "admin") {
      return res.status(403).json({ error: "Access denied" });
    }

    try {
      const insights = await matchingAnalytics.getUserInsights(requestedUserId);
      res.json(insights);
    } catch (error) {
      console.error("User insights error:", error);
      res.status(500).json({ error: "Failed to fetch user insights" });
    }
  });

  app.get("/api/analytics/matching/algorithm-recommendations", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const recommendations = await matchingAnalytics.getAlgorithmRecommendations();
      res.json(recommendations);
    } catch (error) {
      console.error("Algorithm recommendations error:", error);
      res.status(500).json({ error: "Failed to fetch algorithm recommendations" });
    }
  });

  // Content Recommendation routes
  app.get("/api/content/feed", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const feed = await contentRecommendation.getPersonalizedFeed(req.user!.id, limit);
      res.json(feed);
    } catch (error) {
      console.error("Content feed error:", error);
      res.status(500).json({ error: "Failed to fetch content feed" });
    }
  });

  app.get("/api/content/analytics", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const analytics = await contentRecommendation.getContentAnalytics();
      res.json(analytics);
    } catch (error) {
      console.error("Content analytics error:", error);
      res.status(500).json({ error: "Failed to fetch content analytics" });
    }
  });

  app.post("/api/content/track-interaction", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { contentType, contentId, action, metadata } = req.body;
      
      if (!contentType || !contentId || !action) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      await contentRecommendation.trackContentInteraction(
        req.user!.id,
        contentType,
        parseInt(contentId),
        action,
        metadata
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Track interaction error:", error);
      res.status(500).json({ error: "Failed to track interaction" });
    }
  });

  // Notification System routes
  app.get("/api/notifications", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const notifications = await notificationService.getNotificationHistory(req.user!.id, limit);
      res.json(notifications);
    } catch (error) {
      console.error("Get notifications error:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/settings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const settings = await notificationService.getUserSettings(req.user!.id);
      res.json(settings);
    } catch (error) {
      console.error("Get notification settings error:", error);
      res.status(500).json({ error: "Failed to fetch notification settings" });
    }
  });

  app.put("/api/notifications/settings", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      await notificationService.updateUserSettings(req.user!.id, req.body);
      res.json({ success: true });
    } catch (error) {
      console.error("Update notification settings error:", error);
      res.status(500).json({ error: "Failed to update notification settings" });
    }
  });

  app.post("/api/notifications/mark-read", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const { notificationIds } = req.body;
      if (!Array.isArray(notificationIds)) {
        return res.status(400).json({ error: "notificationIds must be an array" });
      }

      await notificationService.markAsRead(req.user!.id, notificationIds);
      res.json({ success: true });
    } catch (error) {
      console.error("Mark notifications as read error:", error);
      res.status(500).json({ error: "Failed to mark notifications as read" });
    }
  });

  app.post("/api/notifications/test", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      await notificationService.sendNotification({
        type: 'system_announcement',
        title: '🧪 测试通知',
        message: '这是一条测试通知，用于验证通知系统正常工作',
        priority: 'medium',
        channels: ['websocket', 'in_app'],
        targetUserId: req.user!.id,
      });

      res.json({ success: true, message: "Test notification sent" });
    } catch (error) {
      console.error("Send test notification error:", error);
      res.status(500).json({ error: "Failed to send test notification" });
    }
  });

  // Admin-only notification endpoints
  app.post("/api/notifications/announcement", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { title, message, priority = 'medium', targetRole } = req.body;
      
      if (!title || !message) {
        return res.status(400).json({ error: "Title and message are required" });
      }

      await notificationService.sendSystemAnnouncement(title, message, priority, targetRole);
      res.json({ success: true });
    } catch (error) {
      console.error("Send system announcement error:", error);
      res.status(500).json({ error: "Failed to send system announcement" });
    }
  });

  app.post("/api/notifications/schedule-reminders", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      await notificationService.scheduleEventReminders();
      res.json({ success: true, message: "Event reminders scheduled" });
    } catch (error) {
      console.error("Schedule event reminders error:", error);
      res.status(500).json({ error: "Failed to schedule event reminders" });
    }
  });

  // Admin Management System routes
  app.get("/api/admin/stats", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const timeRange = req.query.timeRange as 'week' | 'month' | 'quarter' || 'month';
      const stats = await adminService.getPlatformStats(timeRange);
      res.json(stats);
    } catch (error) {
      console.error("Get admin stats error:", error);
      res.status(500).json({ error: "Failed to fetch platform statistics" });
    }
  });

  app.get("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const filter = {
        role: req.query.role as string,
        status: req.query.status as string,
        search: req.query.search as string,
      };

      const result = await adminService.getUsers(page, limit, filter);
      res.json(result);
    } catch (error) {
      console.error("Get admin users error:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/users/:userId", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const userId = parseInt(req.params.userId);
      const userDetails = await adminService.getUserDetails(userId);
      
      if (!userDetails) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(userDetails);
    } catch (error) {
      console.error("Get user details error:", error);
      res.status(500).json({ error: "Failed to fetch user details" });
    }
  });

  app.get("/api/admin/content/moderation", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const type = req.query.type as 'event' | 'product' | 'application';
      const content = await adminService.getContentForModeration(type);
      res.json(content);
    } catch (error) {
      console.error("Get content for moderation error:", error);
      res.status(500).json({ error: "Failed to fetch content for moderation" });
    }
  });

  app.post("/api/admin/moderate/application/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const applicationId = parseInt(req.params.id);
      const { action, notes } = req.body;

      if (!['approve', 'reject'].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'approve' or 'reject'" });
      }

      await adminService.moderateApplication(applicationId, action, req.user!.id, notes);
      res.json({ success: true, message: `Application ${action}d successfully` });
    } catch (error) {
      console.error("Moderate application error:", error);
      res.status(500).json({ error: "Failed to moderate application" });
    }
  });

  app.post("/api/admin/moderate/user/:id", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const userId = parseInt(req.params.id);
      const { action, reason } = req.body;

      if (!['suspend', 'unsuspend', 'warn'].includes(action)) {
        return res.status(400).json({ error: "Invalid action. Must be 'suspend', 'unsuspend', or 'warn'" });
      }

      if (!reason) {
        return res.status(400).json({ error: "Reason is required for user moderation" });
      }

      await adminService.moderateUser(userId, action, req.user!.id, reason);
      res.json({ success: true, message: `User ${action} action completed successfully` });
    } catch (error) {
      console.error("Moderate user error:", error);
      res.status(500).json({ error: "Failed to moderate user" });
    }
  });

  app.get("/api/admin/alerts", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const alerts = await adminService.getSystemAlerts();
      res.json(alerts);
    } catch (error) {
      console.error("Get system alerts error:", error);
      res.status(500).json({ error: "Failed to fetch system alerts" });
    }
  });

  app.post("/api/admin/announcement", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const { title, message, priority = 'medium', targetRole } = req.body;
      
      if (!title || !message) {
        return res.status(400).json({ error: "Title and message are required" });
      }

      await adminService.sendSystemAnnouncement(title, message, priority, targetRole, req.user!.id);
      res.json({ success: true, message: "System announcement sent successfully" });
    } catch (error) {
      console.error("Send admin announcement error:", error);
      res.status(500).json({ error: "Failed to send system announcement" });
    }
  });

  app.get("/api/admin/moderation-log", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const log = await adminService.getModerationLog(limit);
      res.json(log);
    } catch (error) {
      console.error("Get moderation log error:", error);
      res.status(500).json({ error: "Failed to fetch moderation log" });
    }
  });

  app.get("/api/admin/export/:type", async (req, res) => {
    if (!req.isAuthenticated() || req.user!.role !== "admin") {
      return res.status(403).json({ error: "Admin access required" });
    }

    try {
      const type = req.params.type as 'users' | 'events' | 'applications' | 'analytics';
      const data = await adminService.exportPlatformData(type);
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=${type}-export-${new Date().toISOString().split('T')[0]}.json`);
      res.json(data);
    } catch (error) {
      console.error("Export data error:", error);
      res.status(500).json({ error: "Failed to export data" });
    }
  });

  // Serve the React platform application at /platform/*
  app.get("/platform*", (req, res, next) => {
    // Let the vite middleware handle platform routes
    next();
  });

  // WebSocket status endpoint
  app.get("/api/ws/status", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const wsService = getWebSocketService();
    if (!wsService) {
      return res.status(503).json({ error: "WebSocket service not available" });
    }

    const isOnline = wsService.isUserOnline(req.user!.id);
    const lastSeen = wsService.getUserLastSeen(req.user!.id);

    res.json({
      isConnected: isOnline,
      lastSeen,
      onlineUsers: wsService.getOnlineUsers().map(u => ({
        id: u.id,
        fullName: u.fullName,
        avatarUrl: u.avatarUrl
      }))
    });
  });

  const httpServer = createServer(app);
  
  // Initialize WebSocket service
  initializeWebSocketService(httpServer);
  
  return httpServer;
}
