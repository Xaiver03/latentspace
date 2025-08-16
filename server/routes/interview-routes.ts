import { Router } from "express";
import { db } from "../db";
import { users, cofounderApplications, interviewSchedules } from "@shared/schema";
import { eq, and, or, desc } from "drizzle-orm";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth, requireAdmin } from "../middleware/validation";

const router = Router();

interface InterviewNotification {
  id: number;
  userId: number;
  candidateId: number;
  interviewDate: string;
  meetingLink?: string;
  status: 'pending' | 'confirmed' | 'completed';
  type: 'interviewer' | 'interviewee';
}

// Get interview notifications for current user
router.get("/notifications", requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  
  // Get notifications where user is either interviewer or interviewee
  const notifications = await db
    .select({
      id: interviewSchedules.id,
      interviewerId: interviewSchedules.interviewerId,
      candidateId: interviewSchedules.candidateId,
      scheduledDate: interviewSchedules.scheduledDate,
      meetingLink: interviewSchedules.meetingLink,
      status: interviewSchedules.status,
    })
    .from(interviewSchedules)
    .where(
      or(
        eq(interviewSchedules.interviewerId, userId),
        eq(interviewSchedules.candidateId, userId)
      )
    )
    .orderBy(desc(interviewSchedules.scheduledDate));

  // Transform to InterviewNotification format
  const formattedNotifications: InterviewNotification[] = notifications.map(notif => ({
    id: notif.id,
    userId: notif.interviewerId,
    candidateId: notif.candidateId,
    interviewDate: notif.scheduledDate.toISOString(),
    meetingLink: notif.meetingLink || undefined,
    status: notif.status as 'pending' | 'confirmed' | 'completed',
    type: notif.interviewerId === userId ? 'interviewer' : 'interviewee'
  }));

  res.json(formattedNotifications);
}));

// Schedule an interview (admin only)
router.post("/schedule", requireAdmin, asyncHandler(async (req, res) => {
  const { candidateId, interviewerId, scheduledDate, meetingLink } = req.body;

  if (!candidateId || !interviewerId || !scheduledDate) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  // Verify candidate has advanced application
  const candidateApp = await db
    .select()
    .from(cofounderApplications)
    .where(
      and(
        eq(cofounderApplications.userId, candidateId),
        eq(cofounderApplications.applicationType, 'advanced')
      )
    )
    .limit(1);

  if (!candidateApp.length) {
    return res.status(400).json({ error: "Candidate does not have advanced application" });
  }

  // Create interview schedule
  const [interview] = await db.insert(interviewSchedules).values({
    candidateId,
    interviewerId,
    scheduledDate: new Date(scheduledDate),
    meetingLink,
    status: 'pending',
    notes: ''
  }).returning();

  // TODO: Send email notifications to both parties

  res.json({
    message: "Interview scheduled successfully",
    interview
  });
}));

// Update interview status
router.patch("/:id/status", requireAuth, asyncHandler(async (req, res) => {
  const interviewId = parseInt(req.params.id);
  const { status } = req.body;
  const userId = req.user!.id;

  if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  // Check if user is part of this interview
  const interview = await db
    .select()
    .from(interviewSchedules)
    .where(eq(interviewSchedules.id, interviewId))
    .limit(1);

  if (!interview.length) {
    return res.status(404).json({ error: "Interview not found" });
  }

  const isAuthorized = interview[0].interviewerId === userId || 
                      interview[0].candidateId === userId ||
                      req.user!.isAdmin;

  if (!isAuthorized) {
    return res.status(403).json({ error: "Not authorized to update this interview" });
  }

  // Update status
  await db
    .update(interviewSchedules)
    .set({ status })
    .where(eq(interviewSchedules.id, interviewId));

  res.json({ message: "Interview status updated successfully" });
}));

// Add interview feedback (interviewer only)
router.post("/:id/feedback", requireAuth, asyncHandler(async (req, res) => {
  const interviewId = parseInt(req.params.id);
  const { rating, feedback, recommendation } = req.body;
  const userId = req.user!.id;

  // Verify user is the interviewer
  const interview = await db
    .select()
    .from(interviewSchedules)
    .where(
      and(
        eq(interviewSchedules.id, interviewId),
        eq(interviewSchedules.interviewerId, userId)
      )
    )
    .limit(1);

  if (!interview.length) {
    return res.status(403).json({ error: "Not authorized to provide feedback for this interview" });
  }

  // Update interview with feedback
  await db
    .update(interviewSchedules)
    .set({
      rating,
      feedback,
      recommendation,
      status: 'completed'
    })
    .where(eq(interviewSchedules.id, interviewId));

  // Update application status based on recommendation
  if (recommendation === 'approved') {
    await db
      .update(cofounderApplications)
      .set({ status: 'approved' })
      .where(eq(cofounderApplications.userId, interview[0].candidateId));
  } else if (recommendation === 'rejected') {
    await db
      .update(cofounderApplications)
      .set({ status: 'rejected' })
      .where(eq(cofounderApplications.userId, interview[0].candidateId));
  }

  res.json({ message: "Interview feedback submitted successfully" });
}));

export default router;