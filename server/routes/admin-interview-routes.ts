import { Router } from "express";
import { db } from "../db";
import { users, cofounderApplications, interviewSchedules } from "@shared/schema";
import { eq, and, or, desc, isNotNull } from "drizzle-orm";
import { asyncHandler } from "../middleware/error-handler";
import { requireAuth, requireAdmin } from "../middleware/validation";

const router = Router();

// Get all interviews for admin evaluation
router.get("/interviews", requireAdmin, asyncHandler(async (req, res) => {
  const interviews = await db
    .select({
      interview: interviewSchedules,
      candidate: {
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        avatarUrl: users.avatarUrl,
        researchField: users.researchField,
        affiliation: users.affiliation,
      },
      application: {
        id: cofounderApplications.id,
        researchField: cofounderApplications.researchField,
        startupDirection: cofounderApplications.startupDirection,
        experience: cofounderApplications.experience,
        lookingFor: cofounderApplications.lookingFor,
        applicationType: cofounderApplications.applicationType,
      }
    })
    .from(interviewSchedules)
    .innerJoin(users, eq(interviewSchedules.candidateId, users.id))
    .innerJoin(cofounderApplications, eq(cofounderApplications.userId, users.id))
    .where(
      or(
        eq(interviewSchedules.status, 'confirmed'),
        eq(interviewSchedules.status, 'completed')
      )
    )
    .orderBy(desc(interviewSchedules.scheduledDate));

  // Transform to match frontend interface
  const formattedInterviews = interviews.map(row => ({
    id: row.interview.id,
    candidateId: row.interview.candidateId,
    interviewerId: row.interview.interviewerId,
    scheduledDate: row.interview.scheduledDate.toISOString(),
    meetingLink: row.interview.meetingLink,
    status: row.interview.status,
    rating: row.interview.rating,
    feedback: row.interview.feedback,
    recommendation: row.interview.recommendation,
    notes: row.interview.notes,
    candidate: row.candidate,
    application: row.application
  }));

  res.json(formattedInterviews);
}));

// Get interview details with full candidate profile
router.get("/interviews/:id", requireAdmin, asyncHandler(async (req, res) => {
  const interviewId = parseInt(req.params.id);

  const [result] = await db
    .select({
      interview: interviewSchedules,
      candidate: users,
      application: cofounderApplications
    })
    .from(interviewSchedules)
    .innerJoin(users, eq(interviewSchedules.candidateId, users.id))
    .innerJoin(cofounderApplications, eq(cofounderApplications.userId, users.id))
    .where(eq(interviewSchedules.id, interviewId))
    .limit(1);

  if (!result) {
    return res.status(404).json({ error: "Interview not found" });
  }

  const formattedInterview = {
    id: result.interview.id,
    candidateId: result.interview.candidateId,
    interviewerId: result.interview.interviewerId,
    scheduledDate: result.interview.scheduledDate.toISOString(),
    meetingLink: result.interview.meetingLink,
    status: result.interview.status,
    rating: result.interview.rating,
    feedback: result.interview.feedback,
    recommendation: result.interview.recommendation,
    notes: result.interview.notes,
    candidate: {
      id: result.candidate.id,
      fullName: result.candidate.fullName,
      email: result.candidate.email,
      avatarUrl: result.candidate.avatarUrl,
      researchField: result.candidate.researchField,
      affiliation: result.candidate.affiliation,
      bio: result.candidate.bio,
    },
    application: {
      id: result.application.id,
      researchField: result.application.researchField,
      startupDirection: result.application.startupDirection,
      experience: result.application.experience,
      lookingFor: result.application.lookingFor,
      applicationType: result.application.applicationType,
      linkedinUrl: result.application.linkedinUrl,
      accomplishments: result.application.accomplishments,
      education: result.application.education,
      employment: result.application.employment,
    }
  };

  res.json(formattedInterview);
}));

// Batch evaluation endpoint for multiple interviews
router.post("/interviews/batch-evaluate", requireAdmin, asyncHandler(async (req, res) => {
  const { evaluations } = req.body;

  if (!Array.isArray(evaluations) || evaluations.length === 0) {
    return res.status(400).json({ error: "Evaluations array is required" });
  }

  const results = [];

  for (const evaluation of evaluations) {
    const { interviewId, rating, feedback, recommendation, notes } = evaluation;

    if (!interviewId || !rating || !recommendation) {
      continue; // Skip invalid evaluations
    }

    try {
      // Update interview with evaluation
      await db
        .update(interviewSchedules)
        .set({
          rating,
          feedback,
          recommendation,
          notes,
          status: 'completed'
        })
        .where(eq(interviewSchedules.id, interviewId));

      // Get candidate ID for application status update
      const [interview] = await db
        .select({ candidateId: interviewSchedules.candidateId })
        .from(interviewSchedules)
        .where(eq(interviewSchedules.id, interviewId))
        .limit(1);

      if (interview) {
        // Update application status based on recommendation
        let newStatus = 'pending';
        if (recommendation === 'approved') {
          newStatus = 'approved';
        } else if (recommendation === 'rejected') {
          newStatus = 'rejected';
        }

        await db
          .update(cofounderApplications)
          .set({ 
            status: newStatus,
            reviewedBy: req.user!.id,
            reviewedAt: new Date()
          })
          .where(eq(cofounderApplications.userId, interview.candidateId));

        results.push({ interviewId, status: 'success' });
      }
    } catch (error) {
      console.error(`Failed to evaluate interview ${interviewId}:`, error);
      results.push({ interviewId, status: 'error', error: 'Evaluation failed' });
    }
  }

  res.json({
    message: "Batch evaluation completed",
    results,
    totalProcessed: evaluations.length,
    successful: results.filter(r => r.status === 'success').length,
    failed: results.filter(r => r.status === 'error').length
  });
}));

// Get evaluation statistics
router.get("/interviews/stats", requireAdmin, asyncHandler(async (req, res) => {
  const timeRange = req.query.timeRange as 'week' | 'month' | 'quarter' || 'month';
  
  let dateFilter = new Date();
  if (timeRange === 'week') {
    dateFilter.setDate(dateFilter.getDate() - 7);
  } else if (timeRange === 'month') {
    dateFilter.setMonth(dateFilter.getMonth() - 1);
  } else if (timeRange === 'quarter') {
    dateFilter.setMonth(dateFilter.getMonth() - 3);
  }

  // Get basic statistics
  const totalInterviews = await db
    .select({ count: interviewSchedules.id })
    .from(interviewSchedules)
    .where(eq(interviewSchedules.status, 'completed'));

  const recentInterviews = await db
    .select({ count: interviewSchedules.id })
    .from(interviewSchedules)
    .where(
      and(
        eq(interviewSchedules.status, 'completed'),
        // Add date filter here if needed
      )
    );

  // Get recommendation statistics
  const recommendationStats = await db
    .select({
      recommendation: interviewSchedules.recommendation,
      count: interviewSchedules.id
    })
    .from(interviewSchedules)
    .where(isNotNull(interviewSchedules.recommendation))
    .groupBy(interviewSchedules.recommendation);

  // Get average rating
  const ratingStats = await db
    .select({
      avgRating: interviewSchedules.rating,
      count: interviewSchedules.id
    })
    .from(interviewSchedules)
    .where(isNotNull(interviewSchedules.rating));

  const avgRating = ratingStats.length > 0 
    ? ratingStats.reduce((sum, item) => sum + (item.avgRating || 0), 0) / ratingStats.length
    : 0;

  // Get pending interviews count
  const pendingInterviews = await db
    .select({ count: interviewSchedules.id })
    .from(interviewSchedules)
    .where(
      or(
        eq(interviewSchedules.status, 'confirmed'),
        eq(interviewSchedules.status, 'pending')
      )
    );

  const stats = {
    totalInterviews: totalInterviews.length,
    recentInterviews: recentInterviews.length,
    pendingEvaluations: pendingInterviews.length,
    averageRating: Math.round(avgRating * 10) / 10,
    recommendationBreakdown: {
      approved: recommendationStats.find(r => r.recommendation === 'approved')?.count || 0,
      rejected: recommendationStats.find(r => r.recommendation === 'rejected')?.count || 0,
      needsMoreInfo: recommendationStats.find(r => r.recommendation === 'needs_more_info')?.count || 0,
    },
    approvalRate: recommendationStats.length > 0 
      ? Math.round((recommendationStats.find(r => r.recommendation === 'approved')?.count || 0) / recommendationStats.length * 100)
      : 0
  };

  res.json(stats);
}));

// Export interview data for analysis
router.get("/interviews/export", requireAdmin, asyncHandler(async (req, res) => {
  const format = req.query.format as 'json' | 'csv' || 'json';
  
  const interviews = await db
    .select({
      interviewId: interviewSchedules.id,
      candidateName: users.fullName,
      candidateEmail: users.email,
      researchField: cofounderApplications.researchField,
      startupDirection: cofounderApplications.startupDirection,
      scheduledDate: interviewSchedules.scheduledDate,
      status: interviewSchedules.status,
      rating: interviewSchedules.rating,
      recommendation: interviewSchedules.recommendation,
      feedback: interviewSchedules.feedback,
      applicationType: cofounderApplications.applicationType,
    })
    .from(interviewSchedules)
    .innerJoin(users, eq(interviewSchedules.candidateId, users.id))
    .innerJoin(cofounderApplications, eq(cofounderApplications.userId, users.id))
    .orderBy(desc(interviewSchedules.scheduledDate));

  if (format === 'csv') {
    // Convert to CSV format
    const headers = Object.keys(interviews[0] || {});
    const csvContent = [
      headers.join(','),
      ...interviews.map(row => 
        headers.map(header => 
          JSON.stringify(row[header as keyof typeof row] || '')
        ).join(',')
      )
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=interviews-export-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvContent);
  } else {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=interviews-export-${new Date().toISOString().split('T')[0]}.json`);
    res.json({
      exportDate: new Date().toISOString(),
      totalRecords: interviews.length,
      data: interviews
    });
  }
}));

export default router;