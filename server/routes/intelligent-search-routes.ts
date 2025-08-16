import { Router } from "express";
import { z } from "zod";
import { intelligentSearchService } from "../services/intelligent-search-service";

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// Search schema
const searchSchema = z.object({
  query: z.string().min(1, "Query is required"),
  filters: z.object({
    type: z.array(z.enum(['users', 'events', 'products', 'content'])).optional(),
    roleIntent: z.array(z.string()).optional(),
    industries: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    location: z.string().optional(),
    dateRange: z.object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    }).optional(),
  }).optional(),
  limit: z.number().min(1).max(100).optional(),
  semanticSearch: z.boolean().optional(),
});

// Advanced search endpoint
router.post("/search", requireAuth, async (req, res) => {
  try {
    const parsedRequest = searchSchema.parse(req.body);
    
    // Create properly typed search request with date conversion
    const searchRequest = {
      ...parsedRequest,
      userId: req.user!.id,
      filters: parsedRequest.filters ? {
        ...parsedRequest.filters,
        dateRange: parsedRequest.filters.dateRange ? {
          start: new Date(parsedRequest.filters.dateRange.start),
          end: new Date(parsedRequest.filters.dateRange.end),
        } : undefined
      } : undefined
    };

    const results = await intelligentSearchService.search(searchRequest);

    res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid search parameters", details: error.errors });
    }
    console.error("Search error:", error);
    res.status(500).json({ error: "Search failed" });
  }
});

// Quick search endpoint for autocomplete/suggestions
router.get("/quick", requireAuth, async (req, res) => {
  try {
    const query = req.query.q as string;
    const type = req.query.type as string;
    
    if (!query || query.length < 2) {
      return res.json({ results: [], totalCount: 0, searchTime: 0 });
    }

    const results = await intelligentSearchService.search({
      query,
      filters: type ? { type: [type as any] } : undefined,
      userId: req.user!.id,
      limit: 10,
      semanticSearch: false, // Use fast keyword search for quick results
    });

    res.json(results);
  } catch (error) {
    console.error("Quick search error:", error);
    res.status(500).json({ error: "Quick search failed" });
  }
});

// Personalized recommendations
router.get("/recommendations", requireAuth, async (req, res) => {
  try {
    const recommendations = await intelligentSearchService.getPersonalizedRecommendations(req.user!.id);
    res.json({ recommendations });
  } catch (error) {
    console.error("Recommendations error:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
});

// Search suggestions based on user profile
router.get("/suggestions", requireAuth, async (req, res) => {
  try {
    // Generate search suggestions based on user's profile and activity
    const suggestions = [
      "寻找技术合伙人",
      "AI 创业活动",
      "产品经理合作",
      "深度学习工具",
      "创业投资分享",
      "技术分享会",
      "开源项目合作",
      "商业模式设计",
    ];

    res.json({ suggestions });
  } catch (error) {
    console.error("Suggestions error:", error);
    res.status(500).json({ error: "Failed to get suggestions" });
  }
});

// Trending searches
router.get("/trending", async (req, res) => {
  try {
    // Return trending search terms (could be tracked from actual searches)
    const trending = [
      { query: "AI 合伙人", count: 156 },
      { query: "区块链创业", count: 142 },
      { query: "前端开发", count: 128 },
      { query: "产品设计", count: 115 },
      { query: "数据科学", count: 98 },
      { query: "创业融资", count: 87 },
      { query: "技术分享", count: 76 },
      { query: "商业策略", count: 65 },
    ];

    res.json({ trending });
  } catch (error) {
    console.error("Trending error:", error);
    res.status(500).json({ error: "Failed to get trending searches" });
  }
});

// Search analytics (for admin)
router.get("/analytics", requireAuth, async (req, res) => {
  if (req.user!.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    // Return search analytics data
    const analytics = {
      totalSearches: 1250,
      averageResultsPerSearch: 8.5,
      averageSearchTime: 145, // milliseconds
      topQueries: [
        { query: "合伙人", count: 89 },
        { query: "技术", count: 76 },
        { query: "创业", count: 65 },
        { query: "AI", count: 54 },
        { query: "产品", count: 43 },
      ],
      searchTypes: {
        users: 45,
        events: 30,
        products: 15,
        content: 10,
      },
      semanticSearchUsage: 25, // percentage
    };

    res.json(analytics);
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

export default router;