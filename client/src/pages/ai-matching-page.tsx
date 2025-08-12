import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { LuHeart, LuX, LuMessageCircle, LuCalendar, LuMapPin, LuClock, LuBriefcase, LuCode, LuTarget, LuTriangleAlert } from "react-icons/lu";
import { motion, AnimatePresence } from "framer-motion";

interface MatchCandidate {
  userId: number;
  score: number;
  reasons: Array<{
    type: string;
    detail: string;
    score: number;
  }>;
  riskHints: string[];
  user: {
    id: number;
    fullName: string;
    avatarUrl?: string;
    researchField?: string;
    affiliation?: string;
  };
  profile: {
    roleIntent: string;
    seniority: string;
    locationCity: string;
    weeklyHours: number;
    remotePref: string;
    skills?: string[];
    industries?: string[];
  };
}

interface UserInsights {
  profileCompleteness: number;
  matchingActivity: {
    views: number;
    likes: number;
    passes: number;
    messagesInitiated: number;
  };
  successMetrics: {
    matchRate: number;
    responseRate: number;
    conversationRate: number;
  };
  recommendations: string[];
}

export function AiMatchingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  // Fetch recommendations
  const { data: recommendations, isLoading: loadingRecs } = useQuery<{ items: MatchCandidate[] }>({
    queryKey: ["/api/matching/recommendations"],
  });

  // Fetch user insights
  const { data: insights } = useQuery<UserInsights>({
    queryKey: ["/api/matching/insights"],
  });

  // Record interaction
  const recordInteraction = useMutation({
    mutationFn: async (data: { targetUserId: number; action: string; latencyMs?: number }) => {
      const response = await fetch("/api/matching/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to record interaction");
      return response.json();
    },
  });

  const currentCandidate = recommendations?.items[currentIndex];

  const handleAction = async (action: "like" | "skip" | "connect") => {
    if (!currentCandidate) return;

    setSwipeDirection(action === "skip" ? "left" : "right");
    
    await recordInteraction.mutateAsync({
      targetUserId: currentCandidate.userId,
      action,
      latencyMs: Date.now() - (window as any).candidateShownAt,
    });

    setTimeout(() => {
      setCurrentIndex((prev) => prev + 1);
      setSwipeDirection(null);
      (window as any).candidateShownAt = Date.now();
    }, 300);
  };

  const roleIconMap: Record<string, any> = {
    CEO: LuTarget,
    CTO: LuCode,
    CPO: LuBriefcase,
    Business: LuBriefcase,
    Technical: LuCode,
  };

  const reasonTypeLabels: Record<string, string> = {
    role_complement: "角色互补",
    timezone_overlap: "时区重叠",
    industry_align: "行业匹配",
    tech_stack: "技术栈",
    equity_align: "股权期望",
    risk_align: "风险偏好",
  };

  if (loadingRecs) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">正在为您寻找最佳匹配...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">AI 智能匹配</h1>
        <p className="text-muted-foreground">基于深度学习的合伙人推荐系统</p>
      </div>

      <Tabs defaultValue="matching" className="space-y-6">
        <TabsList>
          <TabsTrigger value="matching">候选推荐</TabsTrigger>
          <TabsTrigger value="insights">个人洞察</TabsTrigger>
          <TabsTrigger value="preferences">偏好设置</TabsTrigger>
        </TabsList>

        <TabsContent value="matching" className="space-y-6">
          {currentCandidate ? (
            <div className="max-w-2xl mx-auto">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentCandidate.userId}
                  initial={{ opacity: 0, x: swipeDirection === "left" ? -100 : swipeDirection === "right" ? 100 : 0 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: swipeDirection === "left" ? -300 : swipeDirection === "right" ? 300 : 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <Card className="relative overflow-hidden">
                    {/* Match Score Badge */}
                    <div className="absolute top-4 right-4 z-10">
                      <Badge variant="secondary" className="text-lg px-3 py-1">
                        {Math.round(currentCandidate.score * 100)}% 匹配度
                      </Badge>
                    </div>

                    <CardHeader className="pb-4">
                      <div className="flex items-start gap-4">
                        <Avatar className="h-20 w-20">
                          <AvatarImage src={currentCandidate.user.avatarUrl} />
                          <AvatarFallback>{currentCandidate.user.fullName[0]}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <CardTitle className="text-2xl">{currentCandidate.user.fullName}</CardTitle>
                          <CardDescription className="text-base">
                            {currentCandidate.user.researchField} · {currentCandidate.user.affiliation}
                          </CardDescription>
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              {roleIconMap[currentCandidate.profile.roleIntent] && (
                                <span className="text-primary">
                                  {roleIconMap[currentCandidate.profile.roleIntent]({ size: 16 })}
                                </span>
                              )}
                              {currentCandidate.profile.roleIntent} · {currentCandidate.profile.seniority}
                            </span>
                            <span className="flex items-center gap-1">
                              <LuMapPin className="h-4 w-4" />
                              {currentCandidate.profile.locationCity}
                            </span>
                            <span className="flex items-center gap-1">
                              <LuClock className="h-4 w-4" />
                              {currentCandidate.profile.weeklyHours}h/周
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Matching Reasons */}
                      <div>
                        <h4 className="font-medium mb-2">匹配理由</h4>
                        <div className="space-y-2">
                          {currentCandidate.reasons.map((reason, idx) => (
                            <div key={idx} className="flex items-center justify-between bg-secondary/50 rounded-lg p-3">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">{reasonTypeLabels[reason.type] || reason.type}</Badge>
                                <span className="text-sm">{reason.detail}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">
                                +{Math.round(reason.score * 100)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Risk Hints */}
                      {currentCandidate.riskHints.length > 0 && (
                        <div>
                          <h4 className="font-medium mb-2 flex items-center gap-2">
                            <LuTriangleAlert className="h-4 w-4 text-yellow-600" />
                            潜在考虑
                          </h4>
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-3">
                            {currentCandidate.riskHints.map((hint, idx) => (
                              <p key={idx} className="text-sm text-yellow-800 dark:text-yellow-200">{hint}</p>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Skills & Industries */}
                      <div className="grid grid-cols-2 gap-4">
                        {currentCandidate.profile.skills && currentCandidate.profile.skills.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">技能</h4>
                            <div className="flex flex-wrap gap-1">
                              {currentCandidate.profile.skills.slice(0, 5).map((skill, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {currentCandidate.profile.industries && currentCandidate.profile.industries.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">行业</h4>
                            <div className="flex flex-wrap gap-1">
                              {currentCandidate.profile.industries.slice(0, 3).map((industry, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {industry}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-center gap-4 p-6 bg-secondary/30">
                      <Button
                        size="lg"
                        variant="outline"
                        className="rounded-full h-14 w-14"
                        onClick={() => handleAction("skip")}
                      >
                        <LuX className="h-6 w-6" />
                      </Button>
                      <Button
                        size="lg"
                        variant="default"
                        className="rounded-full h-16 w-16"
                        onClick={() => handleAction("like")}
                      >
                        <LuHeart className="h-7 w-7" />
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="rounded-full h-14 w-14"
                        onClick={() => handleAction("connect")}
                      >
                        <LuMessageCircle className="h-6 w-6" />
                      </Button>
                    </div>
                  </Card>
                </motion.div>
              </AnimatePresence>

              {/* Progress indicator */}
              <div className="mt-4 text-center text-sm text-muted-foreground">
                {currentIndex + 1} / {recommendations?.items.length || 0}
              </div>
            </div>
          ) : (
            <Card className="max-w-2xl mx-auto">
              <CardContent className="py-12 text-center">
                <p className="text-lg text-muted-foreground mb-4">
                  暂时没有更多推荐了
                </p>
                <Button onClick={() => window.location.reload()}>
                  刷新推荐
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {insights && (
            <div className="grid gap-6">
              {/* Profile Completeness */}
              <Card>
                <CardHeader>
                  <CardTitle>个人资料完整度</CardTitle>
                  <CardDescription>
                    完整的资料可以获得更精准的匹配
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Progress value={insights.profileCompleteness} className="h-3 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {insights.profileCompleteness}% 完成
                  </p>
                </CardContent>
              </Card>

              {/* Activity Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>匹配活动统计</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold">{insights.matchingActivity.views}</p>
                      <p className="text-sm text-muted-foreground">浏览</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">{insights.matchingActivity.likes}</p>
                      <p className="text-sm text-muted-foreground">喜欢</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-red-600">{insights.matchingActivity.passes}</p>
                      <p className="text-sm text-muted-foreground">跳过</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">{insights.matchingActivity.messagesInitiated}</p>
                      <p className="text-sm text-muted-foreground">发起对话</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Success Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>成功指标</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">匹配率</span>
                        <span className="text-sm font-medium">{insights.successMetrics.matchRate}%</span>
                      </div>
                      <Progress value={insights.successMetrics.matchRate} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">响应率</span>
                        <span className="text-sm font-medium">{insights.successMetrics.responseRate}%</span>
                      </div>
                      <Progress value={insights.successMetrics.responseRate} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="text-sm">对话转化率</span>
                        <span className="text-sm font-medium">{insights.successMetrics.conversationRate}%</span>
                      </div>
                      <Progress value={insights.successMetrics.conversationRate} className="h-2" />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              {insights.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>改进建议</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {insights.recommendations.map((rec, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-primary mt-1">•</span>
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>匹配偏好设置</CardTitle>
              <CardDescription>
                设置您的硬性要求和软性偏好，获得更精准的推荐
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">偏好设置功能即将上线...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}