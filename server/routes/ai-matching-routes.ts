import { Router } from "express";
import { z } from "zod";
import { aiMatchingService } from "../services/ai-matching-service";
import { 
  insertUserProfileSchema, 
  insertMatchingPreferenceSchema,
  insertAiMatchingInteractionSchema,
} from "@shared/ai-matching-schema";

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// Get or create user profile
router.get("/profile", requireAuth, async (req, res) => {
  try {
    const profile = await aiMatchingService.getProfile(req.user!.id);
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

// Create or update user profile
router.post("/profile", requireAuth, async (req, res) => {
  try {
    const data = insertUserProfileSchema.parse(req.body);
    const profile = await aiMatchingService.createOrUpdateProfile(req.user!.id, data);
    res.json(profile);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid profile data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// Get user preferences
router.get("/preferences", requireAuth, async (req, res) => {
  try {
    const preferences = await aiMatchingService.getPreferences(req.user!.id);
    res.json(preferences);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch preferences" });
  }
});

// Update user preferences
router.put("/preferences", requireAuth, async (req, res) => {
  try {
    const data = insertMatchingPreferenceSchema.parse(req.body);
    const preferences = await aiMatchingService.updatePreferences(req.user!.id, data);
    res.json(preferences);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid preference data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update preferences" });
  }
});

// Get match recommendations
router.get("/recommendations", requireAuth, async (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
    const recommendations = await aiMatchingService.getRecommendations(req.user!.id, limit);
    
    // Transform data for frontend
    const items = recommendations.map(rec => ({
      userId: rec.userId,
      score: rec.score,
      reasons: rec.reasons,
      riskHints: rec.riskHints,
      user: {
        id: rec.user.id,
        fullName: rec.user.fullName,
        avatarUrl: rec.user.avatarUrl,
        researchField: rec.user.researchField,
        affiliation: rec.user.affiliation,
      },
      profile: {
        roleIntent: rec.profile.roleIntent,
        seniority: rec.profile.seniority,
        locationCity: rec.profile.locationCity,
        weeklyHours: rec.profile.weeklyHours,
        remotePref: rec.profile.remotePref,
        skills: rec.profile.skills,
        industries: rec.profile.industries,
      },
    }));

    res.json({ items });
  } catch (error) {
    console.error("Failed to get recommendations:", error);
    res.status(500).json({ error: "Failed to get recommendations" });
  }
});

// Record interaction
router.post("/interactions", requireAuth, async (req, res) => {
  try {
    const data = insertAiMatchingInteractionSchema.parse({
      ...req.body,
      userId: req.user!.id,
    });
    await aiMatchingService.recordInteraction(data);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid interaction data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to record interaction" });
  }
});

// Get active matches
router.get("/matches", requireAuth, async (req, res) => {
  try {
    const matches = await aiMatchingService.getActiveMatches(req.user!.id);
    res.json({ matches });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch matches" });
  }
});

// Propose meeting
router.post("/matches/:matchId/meeting", requireAuth, async (req, res) => {
  try {
    const matchId = parseInt(req.params.matchId);
    const proposeMeetingSchema = z.object({
      slots: z.array(z.object({
        start: z.string(),
        end: z.string(),
        timezone: z.string(),
      })).min(1).max(5),
    });
    
    const { slots } = proposeMeetingSchema.parse(req.body);
    const schedule = await aiMatchingService.proposeMeeting(matchId, req.user!.id, slots);
    res.json(schedule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid meeting data", details: error.errors });
    }
    res.status(500).json({ error: "Failed to propose meeting" });
  }
});

// Accept or decline meeting
router.put("/meetings/:scheduleId", requireAuth, async (req, res) => {
  try {
    const scheduleId = parseInt(req.params.scheduleId);
    const updateSchema = z.object({
      action: z.enum(["accept", "decline", "reschedule"]),
      selectedSlot: z.object({
        start: z.string(),
        end: z.string(),
        timezone: z.string(),
      }).optional(),
    });
    
    const data = updateSchema.parse(req.body);
    const updated = await aiMatchingService.updateMeetingSchedule(scheduleId, req.user!.id, data);
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid meeting update", details: error.errors });
    }
    res.status(500).json({ error: "Failed to update meeting" });
  }
});

// Get profile completeness and insights
router.get("/insights", requireAuth, async (req, res) => {
  try {
    const insights = await aiMatchingService.getUserInsights(req.user!.id);
    res.json(insights);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch insights" });
  }
});

// Admin endpoint: Run batch matching
router.post("/admin/batch-match", requireAuth, async (req, res) => {
  if (req.user!.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  try {
    const { eventId } = req.body;
    const run = await aiMatchingService.runBatchMatching(eventId);
    res.json(run);
  } catch (error) {
    res.status(500).json({ error: "Failed to run batch matching" });
  }
});

export default router;