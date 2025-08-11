import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertEventSchema, insertAgentProductSchema, insertCofounderApplicationSchema, insertMessageSchema, insertEventContentSchema, insertEventFeedbackSchema, insertEventTagSchema, collaborationSpaces } from "@shared/schema";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { matchingEngine } from "./services/matching-engine";
import { enhancedMatchingEngine } from "./services/enhanced-matching-engine";
import { matchingAnalytics } from "./services/matching-analytics";
import { contentRecommendation } from "./services/content-recommendation";
import { notificationService } from "./services/notification-service";
import { initializeWebSocketService, getWebSocketService } from "./services/websocket-service";
import { db } from "./db";
import { eq } from "drizzle-orm";

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

  // Events routes
  app.get("/api/events", async (req, res) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEvent(parseInt(req.params.id));
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch event" });
    }
  });

  app.post("/api/events", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const eventData = insertEventSchema.parse({
        ...req.body,
        createdBy: req.user!.id,
      });
      const event = await storage.createEvent(eventData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid event data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create event" });
    }
  });

  app.post("/api/events/:id/register", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const eventId = parseInt(req.params.id);
      const registration = await storage.registerForEvent(eventId, req.user!.id);
      res.status(201).json(registration);
    } catch (error: any) {
      const errorMessage = error.message || "Failed to register for event";
      
      // Handle specific error types
      if (errorMessage.includes("Event not found")) {
        return res.status(404).json({ error: "Event not found" });
      }
      if (errorMessage.includes("Event is full")) {
        return res.status(409).json({ error: "Event is full" });
      }
      if (errorMessage.includes("Already registered")) {
        return res.status(409).json({ error: "Already registered for this event" });
      }
      
      console.error("Event registration error:", error);
      res.status(500).json({ error: "Failed to register for event" });
    }
  });

  app.delete("/api/events/:id/register", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const eventId = parseInt(req.params.id);
      const success = await storage.unregisterFromEvent(eventId, req.user!.id);
      if (success) {
        res.json({ message: "Unregistered successfully" });
      } else {
        res.status(404).json({ error: "Registration not found" });
      }
    } catch (error: any) {
      const errorMessage = error.message || "Failed to unregister from event";
      
      if (errorMessage.includes("Event not found")) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      console.error("Event unregistration error:", error);
      res.status(500).json({ error: "Failed to unregister from event" });
    }
  });

  // Event content management routes
  app.get("/api/events/:id/contents", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const contents = await storage.getEventContents(eventId);
      res.json(contents);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch event contents" });
    }
  });

  app.get("/api/event-contents/:id", async (req, res) => {
    try {
      const content = await storage.getEventContent(parseInt(req.params.id));
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      // Increment view count
      await storage.incrementContentViewCount(content.id);
      
      res.json(content);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch content" });
    }
  });

  app.post("/api/events/:id/contents", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      // Only event creator or admin can upload content
      if (event.createdBy !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Permission denied" });
      }
      
      const contentData = insertEventContentSchema.parse({
        ...req.body,
        eventId: eventId,
        uploadedBy: req.user!.id,
      });
      
      const content = await storage.createEventContent(contentData);
      res.status(201).json(content);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid content data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create content" });
    }
  });

  app.delete("/api/event-contents/:id", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const content = await storage.getEventContent(parseInt(req.params.id));
      
      if (!content) {
        return res.status(404).json({ error: "Content not found" });
      }
      
      // Only content uploader, event creator or admin can delete
      const event = await storage.getEvent(content.eventId);
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      if (content.uploadedBy !== req.user!.id && 
          event.createdBy !== req.user!.id && 
          req.user!.role !== "admin") {
        return res.status(403).json({ error: "Permission denied" });
      }
      
      const success = await storage.deleteEventContent(content.id);
      if (success) {
        res.json({ message: "Content deleted successfully" });
      } else {
        res.status(500).json({ error: "Failed to delete content" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete content" });
    }
  });

  // Event feedback routes
  app.get("/api/events/:id/feedback", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const feedback = await storage.getEventFeedback(eventId);
      const avgRating = await storage.getEventAverageRating(eventId);
      
      res.json({ 
        feedback, 
        averageRating: avgRating,
        totalReviews: feedback.length 
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch feedback" });
    }
  });

  app.post("/api/events/:id/feedback", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      // Check if user attended the event
      const registrations = await storage.getEventRegistrations(eventId);
      const attended = registrations.some(r => r.userId === req.user!.id);
      
      if (!attended) {
        return res.status(403).json({ error: "Only event attendees can leave feedback" });
      }
      
      // Check if user already submitted feedback
      const existing = await storage.getUserEventFeedback(eventId, req.user!.id);
      if (existing) {
        return res.status(400).json({ error: "You have already submitted feedback for this event" });
      }
      
      const feedbackData = insertEventFeedbackSchema.parse({
        ...req.body,
        eventId: eventId,
        userId: req.user!.id,
      });
      
      const feedback = await storage.createEventFeedback(feedbackData);
      res.status(201).json(feedback);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid feedback data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create feedback" });
    }
  });

  // Event tags routes
  app.get("/api/events/:id/tags", async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const tags = await storage.getEventTags(eventId);
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.post("/api/events/:id/tags", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      // Only event creator or admin can add tags
      if (event.createdBy !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Permission denied" });
      }
      
      const tagData = insertEventTagSchema.parse({
        eventId: eventId,
        tag: req.body.tag.toLowerCase().trim(),
      });
      
      const tag = await storage.createEventTag(tagData);
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid tag data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  app.delete("/api/events/:id/tags/:tag", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ error: "Event not found" });
      }
      
      // Only event creator or admin can delete tags
      if (event.createdBy !== req.user!.id && req.user!.role !== "admin") {
        return res.status(403).json({ error: "Permission denied" });
      }
      
      const success = await storage.deleteEventTag(eventId, req.params.tag);
      if (success) {
        res.json({ message: "Tag deleted successfully" });
      } else {
        res.status(404).json({ error: "Tag not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  app.get("/api/tags/popular", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
      const tags = await storage.getPopularTags(limit);
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch popular tags" });
    }
  });

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

  // Matches routes
  app.get("/api/matches", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ error: "Authentication required" });
    }

    try {
      const matches = await storage.getUserMatches(req.user!.id);
      res.json(matches);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch matches" });
    }
  });

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
