import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  LuHeart, 
  LuX, 
  LuMessageCircle, 
  LuMapPin, 
  LuClock, 
  LuBriefcase, 
  LuCode, 
  LuTarget, 
  LuSparkles,
  LuVideo,
  LuCalendar,
  LuBell,
  LuInfo,
  LuChevronLeft,
  LuChevronRight
} from "react-icons/lu";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface MatchCandidate {
  id: number;
  fullName: string;
  username: string;
  avatarUrl?: string;
  researchField?: string;
  affiliation?: string;
  bio?: string;
  application: {
    id: number;
    researchField: string;
    startupDirection: string;
    experience?: string;
    lookingFor?: string;
    status: string;
    applicationType?: 'basic' | 'advanced';
    interviewScheduled?: boolean;
    interviewDate?: string;
  };
  matchScore: number;
  matchReasons: string[];
  aiInsights?: {
    compatibilityScore: {
      overallScore: number;
      dimensions: {
        roleCompatibility: number;
        skillComplementarity: number;
        valueAlignment: number;
        workStyleMatch: number;
        goalAlignment: number;
      };
      reasoning: string;
      recommendedActions: string[];
    };
    recommendedActions: string[];
  };
}

interface InterviewNotification {
  id: number;
  userId: number;
  candidateId: number;
  interviewDate: string;
  meetingLink?: string;
  status: 'pending' | 'confirmed' | 'completed';
  type: 'interviewer' | 'interviewee';
}

export function TinderMatchingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitX, setExitX] = useState(0);
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-25, 25]);
  const opacity = useTransform(x, [-200, -100, 0, 100, 200], [0, 1, 1, 1, 0]);

  // Fetch AI-enhanced recommendations
  const { data: recommendations, isLoading } = useQuery<MatchCandidate[]>({
    queryKey: ["/api/matching/recommendations"],
    queryFn: async () => {
      const response = await fetch("/api/matching/recommendations?useAI=true&limit=20", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch recommendations");
      return response.json();
    }
  });

  // Fetch interview notifications
  const { data: interviewNotifications } = useQuery<InterviewNotification[]>({
    queryKey: ["/api/interviews/notifications"],
  });

  // Record interaction mutation
  const recordInteraction = useMutation({
    mutationFn: async (data: { targetUserId: number; action: string; metadata?: any }) => {
      const response = await fetch(`/api/matching/${data.targetUserId}/interaction`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: data.action,
          metadata: data.metadata
        }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to record interaction");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/matching"] });
    }
  });

  // Express interest mutation
  const expressInterest = useMutation({
    mutationFn: async (targetUserId: number) => {
      const response = await fetch(`/api/matching/${targetUserId}/interest`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to express interest");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "已表达兴趣",
        description: "如果对方也对您感兴趣，将会开启聊天",
      });
    }
  });

  const currentCandidate = recommendations?.[currentIndex];
  const hasMoreCandidates = currentIndex < (recommendations?.length || 0) - 1;

  // Handle swipe actions
  const handleSwipe = async (direction: "left" | "right") => {
    if (!currentCandidate) return;

    const action = direction === "left" ? "passed" : "liked";
    
    // Record interaction
    await recordInteraction.mutateAsync({
      targetUserId: currentCandidate.id,
      action,
      metadata: {
        swipeDirection: direction,
        matchScore: currentCandidate.matchScore
      }
    });

    // Express interest if swiped right
    if (direction === "right") {
      await expressInterest.mutateAsync(currentCandidate.id);
    }

    // Move to next candidate
    setExitX(direction === "left" ? -300 : 300);
    setCurrentIndex(prev => prev + 1);
  };

  const handleDragEnd = (event: any, info: PanInfo) => {
    if (info.offset.x > 100) {
      handleSwipe("right");
    } else if (info.offset.x < -100) {
      handleSwipe("left");
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") handleSwipe("left");
      if (e.key === "ArrowRight") handleSwipe("right");
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [currentCandidate]);

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">AI正在为您寻找最佳匹配...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold mb-2">Co-founder 智能匹配</h1>
        <p className="text-muted-foreground">左滑跳过，右滑感兴趣</p>
      </div>

      {/* Interview Notifications */}
      {interviewNotifications && interviewNotifications.length > 0 && (
        <Alert className="mb-6 max-w-2xl mx-auto">
          <LuBell className="h-4 w-4" />
          <AlertTitle>面试通知</AlertTitle>
          <AlertDescription>
            {interviewNotifications.map(notification => (
              <div key={notification.id} className="mt-2 flex items-center justify-between">
                <span>
                  {notification.type === 'interviewer' 
                    ? `您将在 ${format(new Date(notification.interviewDate), 'MM月dd日 HH:mm', { locale: zhCN })} 面试一位候选人`
                    : `您的面试已安排在 ${format(new Date(notification.interviewDate), 'MM月dd日 HH:mm', { locale: zhCN })}`
                  }
                </span>
                {notification.meetingLink && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={notification.meetingLink} target="_blank" rel="noopener noreferrer">
                      <LuVideo className="mr-2 h-4 w-4" />
                      加入会议
                    </a>
                  </Button>
                )}
              </div>
            ))}
          </AlertDescription>
        </Alert>
      )}

      {/* Matching Cards */}
      <div className="relative max-w-md mx-auto h-[600px]">
        <AnimatePresence>
          {currentCandidate ? (
            <motion.div
              key={currentCandidate.id}
              className="absolute w-full h-full cursor-grab active:cursor-grabbing"
              style={{ x, rotate, opacity }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              onDragEnd={handleDragEnd}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ x: exitX, opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Card className="h-full overflow-hidden shadow-2xl">
                {/* Match Score Badge */}
                <div className="absolute top-4 right-4 z-10">
                  <Badge variant="secondary" className="text-lg px-3 py-1 bg-primary/10">
                    <LuSparkles className="mr-1 h-4 w-4" />
                    {Math.round(currentCandidate.matchScore * 100)}%
                  </Badge>
                </div>

                {/* Interview Badge if applicable */}
                {currentCandidate.application.applicationType === 'advanced' && (
                  <div className="absolute top-4 left-4 z-10">
                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20">
                      <LuVideo className="mr-1 h-3 w-3" />
                      深度审核
                    </Badge>
                  </div>
                )}

                {/* User Avatar and Basic Info */}
                <div className="relative h-48 bg-gradient-to-b from-primary/10 to-background">
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <div className="flex items-end gap-4">
                      <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                        <AvatarImage src={currentCandidate.avatarUrl} />
                        <AvatarFallback className="text-2xl">{currentCandidate.fullName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 pb-2">
                        <h3 className="text-2xl font-bold">{currentCandidate.fullName}</h3>
                        <p className="text-muted-foreground">{currentCandidate.affiliation}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <CardContent className="pt-6 space-y-4">
                  {/* Research Field and Startup Direction */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">研究领域</p>
                    <p className="font-medium">{currentCandidate.application.researchField}</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-1">创业方向</p>
                    <p className="font-medium">{currentCandidate.application.startupDirection}</p>
                  </div>

                  {/* Looking For */}
                  {currentCandidate.application.lookingFor && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">寻找合伙人</p>
                      <p className="font-medium">{currentCandidate.application.lookingFor}</p>
                    </div>
                  )}

                  {/* Match Reasons */}
                  {currentCandidate.matchReasons.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">匹配亮点</p>
                      <div className="space-y-1">
                        {currentCandidate.matchReasons.slice(0, 3).map((reason, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                            <span className="text-sm">{reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* AI Insights */}
                  {currentCandidate.aiInsights && (
                    <div className="pt-2 border-t">
                      <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                        <LuSparkles className="h-3 w-3" />
                        AI 分析
                      </p>
                      <p className="text-sm">{currentCandidate.aiInsights.compatibilityScore.reasoning}</p>
                    </div>
                  )}
                </CardContent>

                {/* Action Hints */}
                <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-8 pointer-events-none">
                  <motion.div
                    className="flex items-center gap-2 text-red-500"
                    style={{ opacity: useTransform(x, [-100, 0], [1, 0]) }}
                  >
                    <LuX className="h-6 w-6" />
                    <span className="font-medium">跳过</span>
                  </motion.div>
                  <motion.div
                    className="flex items-center gap-2 text-green-500"
                    style={{ opacity: useTransform(x, [0, 100], [0, 1]) }}
                  >
                    <span className="font-medium">感兴趣</span>
                    <LuHeart className="h-6 w-6" />
                  </motion.div>
                </div>
              </Card>
            </motion.div>
          ) : (
            <Card className="h-full flex items-center justify-center">
              <CardContent className="text-center">
                <h3 className="text-xl font-semibold mb-2">暂无更多推荐</h3>
                <p className="text-muted-foreground mb-4">
                  您已浏览完今日的所有推荐
                </p>
                <Button onClick={() => window.location.reload()}>
                  刷新推荐
                </Button>
              </CardContent>
            </Card>
          )}
        </AnimatePresence>

        {/* Next candidates preview */}
        {hasMoreCandidates && recommendations && (
          <div className="absolute inset-0 -z-10">
            {recommendations.slice(currentIndex + 1, currentIndex + 3).map((candidate, idx) => (
              <motion.div
                key={candidate.id}
                className="absolute w-full h-full"
                style={{
                  scale: 1 - (idx + 1) * 0.05,
                  y: (idx + 1) * 10,
                  opacity: 1 - (idx + 1) * 0.3,
                }}
              >
                <Card className="h-full shadow-lg" />
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex justify-center gap-4 mt-8">
        <Button
          size="lg"
          variant="outline"
          className="rounded-full h-14 w-14"
          onClick={() => handleSwipe("left")}
          disabled={!currentCandidate}
        >
          <LuX className="h-6 w-6" />
        </Button>
        <Button
          size="lg"
          variant="default"
          className="rounded-full h-16 w-16"
          onClick={() => handleSwipe("right")}
          disabled={!currentCandidate}
        >
          <LuHeart className="h-7 w-7" />
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="rounded-full h-14 w-14"
          onClick={() => {
            if (currentCandidate) {
              toast({
                title: "功能开发中",
                description: "直接消息功能即将上线",
              });
            }
          }}
          disabled={!currentCandidate}
        >
          <LuMessageCircle className="h-6 w-6" />
        </Button>
      </div>

      {/* Instructions */}
      <div className="text-center mt-6 text-sm text-muted-foreground">
        <p>使用键盘 ← → 或滑动卡片进行选择</p>
      </div>

      {/* Progress */}
      {recommendations && (
        <div className="max-w-md mx-auto mt-4">
          <Progress value={(currentIndex / recommendations.length) * 100} className="h-2" />
          <p className="text-center text-sm text-muted-foreground mt-2">
            {currentIndex} / {recommendations.length} 已查看
          </p>
        </div>
      )}
    </div>
  );
}