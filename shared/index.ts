// ================================
// 潜空间 (Latent Space) - 共享类型导出索引
// ================================

// Core schemas and types
export * from "./schema";

// Domain-specific schemas
export * from "./ai-matching-schema";
export * from "./collaboration-schema";
export * from "./ai-marketplace-schema"; 
export * from "./reputation-schema";

// Re-export commonly used types for convenience
export type {
  User,
  Event,
  Message,
  Match,
  CofounderApplication,
  EventContent,
  EventFeedback,
  EventTag,
  EventRegistration,
  AgentProduct,
  Notification,
  NotificationSettings,
  UserMatchingInsights,
  AlgorithmPerformance,
  ContentInteraction
} from "./schema";

export type {
  UserProfile,
  MatchingPreference,
  AiMatchingInteraction,
  AiMatch,
  MeetingSchedule,
  MatchingFeatureWeights,
  BatchMatchingRun
} from "./ai-matching-schema";

export type {
  CollaborationWorkspace,
  WorkspaceTask,
  TaskComment,
  WorkspaceDocument,
  DocumentComment,
  WorkspaceMeeting,
  WorkspaceAnalytics
} from "./collaboration-schema";

export type {
  AiAgent,
  AgentReview,
  AgentCollection,
  AgentUsageAnalytics,
  AgentBookmark,
  AgentRecommendation
} from "./ai-marketplace-schema";

export type {
  ReputationScore,
  ReputationTransaction,
  ReputationAchievement,
  ReputationEndorsement,
  ReputationStake,
  ReputationGovernance,
  GovernanceVote
} from "./reputation-schema";