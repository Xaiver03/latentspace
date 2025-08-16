import { Router } from "express";
import { storage } from "../storage";
import { asyncHandler } from "../middleware/error-handler";

const router = Router();

// Popular tags route
router.get("/popular", asyncHandler(async (req, res) => {
  const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
  const tags = await storage.getPopularTags(limit);
  res.json(tags);
}));

export default router;