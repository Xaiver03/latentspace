import { Router } from "express";
import { storage } from "../storage";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

// Get random ice-breaking questions
router.get("/", asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit as string) || 3;
  const questions = await storage.getRandomQuestions(limit);
  
  // Increment usage count for selected questions
  for (const question of questions) {
    await storage.incrementQuestionUsage(question.id);
  }
  
  res.json({ questions });
}));

export default router;