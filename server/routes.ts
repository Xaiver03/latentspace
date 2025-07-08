import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertEventSchema, insertAgentProductSchema, insertCofounderApplicationSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

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
    } catch (error) {
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
    } catch (error) {
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

  // Messages routes
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

  const httpServer = createServer(app);
  return httpServer;
}
