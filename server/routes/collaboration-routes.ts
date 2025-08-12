import { Router } from "express";
import { z } from "zod";
import { collaborationService } from "../services/collaboration-service";
import { 
  insertCollaborationWorkspaceSchema,
  insertWorkspaceTaskSchema,
  insertTaskCommentSchema,
  insertWorkspaceDocumentSchema,
  insertWorkspaceMeetingSchema,
} from "@shared/collaboration-schema";

const router = Router();

// Middleware to ensure user is authenticated
const requireAuth = (req: any, res: any, next: any) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// ===== WORKSPACE ROUTES =====

// Get user's workspaces
router.get("/workspaces", requireAuth, async (req, res) => {
  try {
    const workspaces = await collaborationService.getUserWorkspaces(req.user!.id);
    res.json({ workspaces });
  } catch (error) {
    console.error("Failed to get workspaces:", error);
    res.status(500).json({ error: "Failed to get workspaces" });
  }
});

// Create new workspace
router.post("/workspaces", requireAuth, async (req, res) => {
  try {
    const data = insertCollaborationWorkspaceSchema.parse(req.body);
    const workspace = await collaborationService.createWorkspace(data, req.user!.id);
    res.status(201).json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid workspace data", details: error.errors });
    }
    console.error("Failed to create workspace:", error);
    res.status(500).json({ error: "Failed to create workspace" });
  }
});

// Get workspace details
router.get("/workspaces/:id", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const workspace = await collaborationService.getWorkspaceWithDetails(workspaceId);
    res.json(workspace);
  } catch (error) {
    console.error("Failed to get workspace:", error);
    res.status(404).json({ error: "Workspace not found" });
  }
});

// Update workspace
router.put("/workspaces/:id", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const updates = insertCollaborationWorkspaceSchema.partial().parse(req.body);
    const workspace = await collaborationService.updateWorkspace(workspaceId, req.user!.id, updates);
    res.json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid update data", details: error.errors });
    }
    console.error("Failed to update workspace:", error);
    res.status(500).json({ error: "Failed to update workspace" });
  }
});

// Add co-founder to workspace
router.post("/workspaces/:id/members", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const { userId } = z.object({ userId: z.number() }).parse(req.body);
    
    await collaborationService.addCoFounder(workspaceId, req.user!.id, userId);
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid member data", details: error.errors });
    }
    console.error("Failed to add member:", error);
    res.status(500).json({ error: "Failed to add member" });
  }
});

// ===== TASK ROUTES =====

// Get workspace tasks
router.get("/workspaces/:id/tasks", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const filters = {
      status: req.query.status as string | undefined,
      assignedTo: req.query.assignedTo ? parseInt(req.query.assignedTo as string) : undefined,
      priority: req.query.priority as string | undefined,
      overdue: req.query.overdue === 'true',
    };

    const tasks = await collaborationService.getWorkspaceTasks(workspaceId, filters);
    res.json({ tasks });
  } catch (error) {
    console.error("Failed to get tasks:", error);
    res.status(500).json({ error: "Failed to get tasks" });
  }
});

// Create task
router.post("/workspaces/:id/tasks", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const data = insertWorkspaceTaskSchema.parse({
      ...req.body,
      workspaceId,
      createdById: req.user!.id,
    });
    
    const task = await collaborationService.createTask(data);
    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid task data", details: error.errors });
    }
    console.error("Failed to create task:", error);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// Get task details
router.get("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const task = await collaborationService.getTaskWithDetails(taskId);
    res.json(task);
  } catch (error) {
    console.error("Failed to get task:", error);
    res.status(404).json({ error: "Task not found" });
  }
});

// Update task
router.put("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const updates = insertWorkspaceTaskSchema.partial().parse(req.body);
    const task = await collaborationService.updateTask(taskId, req.user!.id, updates);
    res.json(task);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid task update", details: error.errors });
    }
    console.error("Failed to update task:", error);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// Get task comments
router.get("/tasks/:id/comments", requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const comments = await collaborationService.getTaskComments(taskId);
    res.json({ comments });
  } catch (error) {
    console.error("Failed to get comments:", error);
    res.status(500).json({ error: "Failed to get comments" });
  }
});

// Add task comment
router.post("/tasks/:id/comments", requireAuth, async (req, res) => {
  try {
    const taskId = parseInt(req.params.id);
    const data = insertTaskCommentSchema.parse({
      ...req.body,
      taskId,
      authorId: req.user!.id,
    });
    
    const comment = await collaborationService.addTaskComment(data);
    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid comment data", details: error.errors });
    }
    console.error("Failed to add comment:", error);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// ===== DOCUMENT ROUTES =====

// Get workspace documents
router.get("/workspaces/:id/documents", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const filters = {
      type: req.query.type as string | undefined,
      category: req.query.category as string | undefined,
      ownerId: req.query.ownerId ? parseInt(req.query.ownerId as string) : undefined,
    };

    const documents = await collaborationService.getWorkspaceDocuments(workspaceId, filters);
    res.json({ documents });
  } catch (error) {
    console.error("Failed to get documents:", error);
    res.status(500).json({ error: "Failed to get documents" });
  }
});

// Create document
router.post("/workspaces/:id/documents", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const data = insertWorkspaceDocumentSchema.parse({
      ...req.body,
      workspaceId,
      ownerId: req.user!.id,
    });
    
    const document = await collaborationService.createDocument(data);
    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid document data", details: error.errors });
    }
    console.error("Failed to create document:", error);
    res.status(500).json({ error: "Failed to create document" });
  }
});

// Get document details
router.get("/documents/:id", requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const document = await collaborationService.getDocumentWithDetails(documentId);
    res.json(document);
  } catch (error) {
    console.error("Failed to get document:", error);
    res.status(404).json({ error: "Document not found" });
  }
});

// Update document
router.put("/documents/:id", requireAuth, async (req, res) => {
  try {
    const documentId = parseInt(req.params.id);
    const updates = insertWorkspaceDocumentSchema.partial().parse(req.body);
    const document = await collaborationService.updateDocument(documentId, req.user!.id, updates);
    res.json(document);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid document update", details: error.errors });
    }
    console.error("Failed to update document:", error);
    res.status(500).json({ error: "Failed to update document" });
  }
});

// ===== MEETING ROUTES =====

// Get workspace meetings
router.get("/workspaces/:id/meetings", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const upcoming = req.query.upcoming === 'true';
    const meetings = await collaborationService.getWorkspaceMeetings(workspaceId, upcoming);
    res.json({ meetings });
  } catch (error) {
    console.error("Failed to get meetings:", error);
    res.status(500).json({ error: "Failed to get meetings" });
  }
});

// Create meeting
router.post("/workspaces/:id/meetings", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const data = insertWorkspaceMeetingSchema.parse({
      ...req.body,
      workspaceId,
      organizerId: req.user!.id,
    });
    
    const meeting = await collaborationService.createMeeting(data);
    res.status(201).json(meeting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid meeting data", details: error.errors });
    }
    console.error("Failed to create meeting:", error);
    res.status(500).json({ error: "Failed to create meeting" });
  }
});

// Update meeting
router.put("/meetings/:id", requireAuth, async (req, res) => {
  try {
    const meetingId = parseInt(req.params.id);
    const updates = insertWorkspaceMeetingSchema.partial().parse(req.body);
    const meeting = await collaborationService.updateMeeting(meetingId, req.user!.id, updates);
    res.json(meeting);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid meeting update", details: error.errors });
    }
    console.error("Failed to update meeting:", error);
    res.status(500).json({ error: "Failed to update meeting" });
  }
});

// ===== ANALYTICS ROUTES =====

// Get workspace analytics
router.get("/workspaces/:id/analytics", requireAuth, async (req, res) => {
  try {
    const workspaceId = parseInt(req.params.id);
    const days = req.query.days ? parseInt(req.query.days as string) : 30;
    const analytics = await collaborationService.getWorkspaceAnalytics(workspaceId, days);
    res.json(analytics);
  } catch (error) {
    console.error("Failed to get analytics:", error);
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

export default router;