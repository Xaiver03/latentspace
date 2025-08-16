import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { insertEventSchema, insertEventContentSchema, insertEventFeedbackSchema, insertEventTagSchema } from "@shared/schema";
import { eventsService } from "../services/events-service";
import { validate, requireAuth, commonSchemas } from "../middleware/validation";
import { asyncHandler } from "../middleware/error-handler";
import { createResourceRateLimit } from "../middleware/rate-limit";
import { cache, invalidateCache } from "../middleware/cache";

const router = Router();

// Events routes with improved error handling, pagination and caching
router.get("/", 
  cache({ ttl: 60, namespace: "events" }), // Cache for 1 minute
  validate({ query: commonSchemas.pagination.merge(commonSchemas.search) }),
  asyncHandler(async (req, res) => {
    const { page, limit, sort, order, q: search, category } = req.query as any;
    
    const filters = { search, category };
    const pagination = { page, limit, sort, order };
    
    const result = await eventsService.getEvents(filters, pagination);
    res.json(result);
  })
);

router.get("/:id",
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as any;
    const event = await eventsService.getEvent(id);
    res.json(event);
  })
);

router.post("/",
  createResourceRateLimit,
  requireAuth,
  validate({ body: insertEventSchema.omit({ createdBy: true }) }),
  invalidateCache(["events:*"], "events"), // Invalidate all events cache
  asyncHandler(async (req, res) => {
    const eventData = req.body as any;
    const event = await eventsService.createEvent(eventData, req.user!.id);
    res.status(201).json(event);
  })
);

router.post("/:id/register",
  requireAuth,
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as any;
    const registration = await eventsService.registerForEvent(id, req.user!.id);
    res.status(201).json(registration);
  })
);

router.delete("/:id/register",
  requireAuth,
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as any;
    await eventsService.unregisterFromEvent(id, req.user!.id);
    res.json({ message: "Unregistered successfully" });
  })
);

// Event content management routes
router.get("/:id/contents",
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as any;
    const contents = await eventsService.getEventContents(id);
    res.json(contents);
  })
);

router.get("/contents/:id",
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
    const { id } = req.params as any;
    const content = await eventsService.getEventContent(id);
    
    // TODO: Increment view count - to be implemented in service
    // await eventsService.incrementContentViewCount(id);
    
    res.json(content);
  })
);

router.post("/:id/contents", 
  requireAuth,
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
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
  })
);

router.delete("/contents/:id",
  requireAuth,
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
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
  })
);

// Event feedback routes
router.get("/:id/feedback",
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
    const eventId = parseInt(req.params.id);
    const feedback = await storage.getEventFeedback(eventId);
    const avgRating = await storage.getEventAverageRating(eventId);
    
    res.json({ 
      feedback, 
      averageRating: avgRating,
      totalReviews: feedback.length 
    });
  })
);

router.post("/:id/feedback",
  requireAuth,
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
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
  })
);

// Event tags routes
router.get("/:id/tags",
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
    const eventId = parseInt(req.params.id);
    const tags = await storage.getEventTags(eventId);
    res.json(tags);
  })
);

router.post("/:id/tags",
  requireAuth,
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
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
  })
);

router.delete("/:id/tags/:tag",
  requireAuth,
  validate({ params: commonSchemas.id }),
  asyncHandler(async (req, res) => {
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
  })
);

export default router;