import { Router } from "express";
import { z } from "zod";
import { aiMarketplaceService } from "../services/ai-marketplace-service";
import { 
  insertAiAgentSchema,
  insertAgentReviewSchema,
  insertAgentCollectionSchema,
  insertAgentBookmarkSchema,
  insertUsageAnalyticsSchema,
} from "@shared/ai-marketplace-schema";

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// ===== AGENT ROUTES =====

// Get all agents with search and filtering
router.get("/agents", async (req, res) => {
  try {
    const query = req.query.q as string || "";
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    
    const filters = {
      category: req.query.category as string,
      subcategory: req.query.subcategory as string,
      pricingModel: req.query.pricingModel ? (req.query.pricingModel as string).split(',') : undefined,
      priceRange: req.query.priceRange ? (req.query.priceRange as string).split(',') : undefined,
      platforms: req.query.platforms ? (req.query.platforms as string).split(',') : undefined,
      rating: req.query.rating ? parseFloat(req.query.rating as string) : undefined,
      verified: req.query.verified === 'true',
      sortBy: req.query.sortBy as 'popularity' | 'rating' | 'newest' | 'name' || 'popularity',
      semanticSearch: req.query.semanticSearch === 'true',
    };

    const userId = req.isAuthenticated() ? req.user!.id : undefined;
    const result = await aiMarketplaceService.searchAgents(query, filters, page, limit, userId);
    
    res.json(result);
  } catch (error) {
    console.error("Search agents error:", error);
    res.status(500).json({ error: "Failed to search agents" });
  }
});

// Get agent by ID
router.get("/agents/:id", async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const userId = req.isAuthenticated() ? req.user!.id : undefined;
    
    const agent = await aiMarketplaceService.getAgentWithDetails(agentId, userId);
    
    // Track view
    if (userId) {
      await aiMarketplaceService.trackUsage({
        agentId,
        userId,
        action: 'view',
        metadata: { source: 'agent_detail' },
      });
    }
    
    res.json(agent);
  } catch (error) {
    console.error("Get agent error:", error);
    if (error instanceof Error && error.message === "Agent not found") {
      return res.status(404).json({ error: "Agent not found" });
    }
    res.status(500).json({ error: "Failed to get agent" });
  }
});

// Create new agent
router.post("/agents", requireAuth, async (req, res) => {
  try {
    const data = insertAiAgentSchema.parse(req.body);
    const agent = await aiMarketplaceService.createAgent(data, req.user!.id);
    res.status(201).json(agent);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid agent data", details: error.errors });
    }
    console.error("Create agent error:", error);
    res.status(500).json({ error: "Failed to create agent" });
  }
});

// Get featured agents
router.get("/agents/featured", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const agents = await aiMarketplaceService.getFeaturedAgents(limit);
    res.json({ agents });
  } catch (error) {
    console.error("Get featured agents error:", error);
    res.status(500).json({ error: "Failed to get featured agents" });
  }
});

// Get trending agents
router.get("/agents/trending", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const agents = await aiMarketplaceService.getTrendingAgents(limit);
    res.json({ agents });
  } catch (error) {
    console.error("Get trending agents error:", error);
    res.status(500).json({ error: "Failed to get trending agents" });
  }
});

// Get agents by category
router.get("/agents/category/:category", async (req, res) => {
  try {
    const category = req.params.category;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const agents = await aiMarketplaceService.getAgentsByCategory(category, limit);
    res.json({ agents });
  } catch (error) {
    console.error("Get agents by category error:", error);
    res.status(500).json({ error: "Failed to get agents by category" });
  }
});

// Get similar agents
router.get("/agents/:id/similar", async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const limit = Math.min(parseInt(req.query.limit as string) || 5, 20);
    const agents = await aiMarketplaceService.getSimilarAgents(agentId, limit);
    res.json({ agents });
  } catch (error) {
    console.error("Get similar agents error:", error);
    res.status(500).json({ error: "Failed to get similar agents" });
  }
});

// ===== REVIEW ROUTES =====

// Get agent reviews
router.get("/agents/:id/reviews", async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    
    const result = await aiMarketplaceService.getAgentReviews(agentId, page, limit);
    res.json(result);
  } catch (error) {
    console.error("Get agent reviews error:", error);
    res.status(500).json({ error: "Failed to get agent reviews" });
  }
});

// Create agent review
router.post("/agents/:id/reviews", requireAuth, async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const data = insertAgentReviewSchema.parse({
      ...req.body,
      agentId,
      userId: req.user!.id,
    });
    
    const review = await aiMarketplaceService.createReview(data);
    
    // Track review action
    await aiMarketplaceService.trackUsage({
      agentId,
      userId: req.user!.id,
      action: 'review',
      metadata: { rating: data.rating },
    });
    
    res.status(201).json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid review data", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("already reviewed")) {
      return res.status(409).json({ error: "You have already reviewed this agent" });
    }
    console.error("Create review error:", error);
    res.status(500).json({ error: "Failed to create review" });
  }
});

// ===== COLLECTION ROUTES =====

// Get user's collections
router.get("/collections/my", requireAuth, async (req, res) => {
  try {
    const collections = await aiMarketplaceService.getUserCollections(req.user!.id);
    res.json({ collections });
  } catch (error) {
    console.error("Get user collections error:", error);
    res.status(500).json({ error: "Failed to get collections" });
  }
});

// Get public collections
router.get("/collections/public", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const collections = await aiMarketplaceService.getPublicCollections(limit);
    res.json({ collections });
  } catch (error) {
    console.error("Get public collections error:", error);
    res.status(500).json({ error: "Failed to get public collections" });
  }
});

// Create collection
router.post("/collections", requireAuth, async (req, res) => {
  try {
    const data = insertAgentCollectionSchema.parse(req.body);
    const collection = await aiMarketplaceService.createCollection(data, req.user!.id);
    res.status(201).json(collection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid collection data", details: error.errors });
    }
    console.error("Create collection error:", error);
    res.status(500).json({ error: "Failed to create collection" });
  }
});

// ===== BOOKMARK ROUTES =====

// Get user bookmarks
router.get("/bookmarks", requireAuth, async (req, res) => {
  try {
    const bookmarks = await aiMarketplaceService.getUserBookmarks(req.user!.id);
    res.json({ bookmarks });
  } catch (error) {
    console.error("Get bookmarks error:", error);
    res.status(500).json({ error: "Failed to get bookmarks" });
  }
});

// Bookmark agent
router.post("/agents/:id/bookmark", requireAuth, async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const data = insertAgentBookmarkSchema.parse({
      ...req.body,
      userId: req.user!.id,
      agentId,
    });
    
    await aiMarketplaceService.bookmarkAgent(data);
    
    // Track bookmark action
    await aiMarketplaceService.trackUsage({
      agentId,
      userId: req.user!.id,
      action: 'bookmark',
      metadata: {},
    });
    
    res.json({ message: "Agent bookmarked successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid bookmark data", details: error.errors });
    }
    if (error instanceof Error && error.message.includes("already bookmarked")) {
      return res.status(409).json({ error: "Agent already bookmarked" });
    }
    console.error("Bookmark agent error:", error);
    res.status(500).json({ error: "Failed to bookmark agent" });
  }
});

// Remove bookmark
router.delete("/agents/:id/bookmark", requireAuth, async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    await aiMarketplaceService.removeBookmark(req.user!.id, agentId);
    res.json({ message: "Bookmark removed successfully" });
  } catch (error) {
    console.error("Remove bookmark error:", error);
    res.status(500).json({ error: "Failed to remove bookmark" });
  }
});

// ===== ANALYTICS ROUTES =====

// Track agent usage
router.post("/agents/:id/track", requireAuth, async (req, res) => {
  try {
    const agentId = parseInt(req.params.id);
    const data = insertUsageAnalyticsSchema.parse({
      ...req.body,
      agentId,
      userId: req.user!.id,
    });
    
    await aiMarketplaceService.trackUsage(data);
    res.json({ message: "Usage tracked successfully" });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid tracking data", details: error.errors });
    }
    console.error("Track usage error:", error);
    res.status(500).json({ error: "Failed to track usage" });
  }
});

// Get marketplace statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await aiMarketplaceService.getMarketplaceStats();
    res.json(stats);
  } catch (error) {
    console.error("Get marketplace stats error:", error);
    res.status(500).json({ error: "Failed to get marketplace statistics" });
  }
});

// ===== RECOMMENDATION ROUTES =====

// Get personalized recommendations
router.get("/recommendations", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);
    const recommendations = await aiMarketplaceService.getPersonalizedRecommendations(req.user!.id, limit);
    res.json({ recommendations });
  } catch (error) {
    console.error("Get recommendations error:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
});

// ===== DISCOVERY ROUTES =====

// Get marketplace overview for homepage
router.get("/discover", async (req, res) => {
  try {
    const [featured, trending, categories] = await Promise.all([
      aiMarketplaceService.getFeaturedAgents(6),
      aiMarketplaceService.getTrendingAgents(6),
      aiMarketplaceService.getMarketplaceStats().then(stats => stats.categoryStats.slice(0, 8)),
    ]);

    res.json({
      featured,
      trending,
      categories,
    });
  } catch (error) {
    console.error("Get discovery data error:", error);
    res.status(500).json({ error: "Failed to get discovery data" });
  }
});

export default router;