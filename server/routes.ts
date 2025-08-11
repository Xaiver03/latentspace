import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertEventSchema, insertAgentProductSchema, insertCofounderApplicationSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import path from "path";
import fs from "fs";
import { matchingEngine } from "./services/matching-engine";

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

  // Serve the React platform application at /platform/*
  app.get("/platform*", (req, res, next) => {
    // Let the vite middleware handle platform routes
    next();
  });

  const httpServer = createServer(app);
  return httpServer;
}
