import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { MatchCard } from "@/components/match-card";
import { toast } from "@/hooks/use-toast";
import { 
  Users, 
  UserPlus, 
  Sparkles, 
  RefreshCw, 
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Heart,
  MessageCircle,
  TrendingUp
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCofounderApplicationSchema } from "@shared/schema";
import { z } from "zod";
import Navbar from "@/components/navbar";

const applicationFormSchema = insertCofounderApplicationSchema;
type ApplicationForm = z.infer<typeof applicationFormSchema>;

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
  };
  matchScore: number;
  matchReasons: string[];
}

interface CofounderApplication {
  id: number;
  userId: number;
  researchField: string;
  startupDirection: string;
  experience?: string;
  lookingFor?: string;
  status: string;
  createdAt: string;
}

interface Match {
  id: number;
  user1Id: number;
  user2Id: number;
  matchScore: number;
  status: string;
  createdAt: string;
}

interface MatchResult {
  candidate: MatchCandidate;
  score: number;
  explanation: string[];
}

const apiRequest = async (method: string, url: string, data?: any) => {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data ? JSON.stringify(data) : undefined,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw { status: response.status, ...error };
  }
  
  return response.json();
};

export default function EnhancedMatchingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isApplicationDialogOpen, setIsApplicationDialogOpen] = useState(false);
  const [interactedUsers, setInteractedUsers] = useState<Set<number>>(new Set());
  const [currentTab, setCurrentTab] = useState("recommendations");

  const { register, handleSubmit, formState: { errors }, reset, setValue } = useForm<ApplicationForm>({
    resolver: zodResolver(applicationFormSchema)
  });

  // Get user's application status
  const { data: myApplication, isLoading: applicationLoading } = useQuery<CofounderApplication | null>({
    queryKey: ["/api/cofounder-applications/my"],
    queryFn: () => apiRequest("GET", "/api/cofounder-applications/my"),
    enabled: !!user,
  });

  // Get enhanced match recommendations
  const { data: recommendations = [], isLoading: recommendationsLoading, refetch: refetchRecommendations } = useQuery<any[]>({
    queryKey: ["/api/matches/enhanced"],
    queryFn: () => apiRequest("GET", "/api/matches/enhanced?limit=20"),
    enabled: !!user && myApplication?.status === 'approved',
  });

  // Get daily recommendation
  const { data: dailyRecommendationData } = useQuery<{ recommendation: any }>({
    queryKey: ["/api/matches/daily-recommendation"],
    queryFn: () => apiRequest("GET", "/api/matches/daily-recommendation"),
    enabled: !!user && myApplication?.status === 'approved',
  });

  // Get existing matches
  const { data: existingMatches = [], isLoading: matchesLoading } = useQuery<Match[]>({
    queryKey: ["/api/matches"],
    queryFn: () => apiRequest("GET", "/api/matches"),
    enabled: !!user && myApplication?.status === 'approved',
  });

  const createApplicationMutation = useMutation({
    mutationFn: (applicationData: ApplicationForm) =>
      apiRequest("POST", "/api/cofounder-applications", applicationData),
    onSuccess: () => {
      toast({
        title: "申请提交成功",
        description: "我们将在3个工作日内联系您进行审核",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cofounder-applications/my"] });
      setIsApplicationDialogOpen(false);
      reset();
    },
    onError: (error: any) => {
      toast({
        title: "申请提交失败",
        description: error.error || "提交申请时发生错误",
        variant: "destructive",
      });
    },
  });

  const handleInterest = (userId: number) => {
    setInteractedUsers(prev => new Set(prev).add(userId));
  };

  const handlePass = (userId: number) => {
    setInteractedUsers(prev => new Set(prev).add(userId));
  };

  const onSubmit = (data: ApplicationForm) => {
    createApplicationMutation.mutate(data);
  };

  const filteredRecommendations = recommendations.filter(
    rec => !interactedUsers.has(rec.candidate.id)
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto py-8">
          <Card>
            <CardContent className="p-6 text-center">
              <p>请先登录以使用Co-founder匹配功能</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold flex items-center justify-center">
            <Users className="w-8 h-8 mr-3 text-blue-600" />
            Co-founder 匹配
          </h1>
          <p className="text-gray-600">
            基于AI算法的智能匹配，为你找到最佳创业伙伴
          </p>
        </div>

        {/* Application Status Check */}
        {applicationLoading ? (
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-center">
                <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                <span>加载中...</span>
              </div>
            </CardContent>
          </Card>
        ) : !myApplication ? (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-6">
              <div className="text-center space-y-4">
                <UserPlus className="w-12 h-12 mx-auto text-blue-600" />
                <div>
                  <h3 className="text-lg font-semibold">开始Co-founder匹配之旅</h3>
                  <p className="text-gray-600">
                    填写申请表，让我们了解你的背景和需求，为你匹配最适合的创业伙伴
                  </p>
                </div>
                <Dialog open={isApplicationDialogOpen} onOpenChange={setIsApplicationDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700">
                      <UserPlus className="w-4 h-4 mr-2" />
                      提交申请
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Co-founder匹配申请</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                      <div>
                        <Label htmlFor="researchField">研究领域</Label>
                        <Input
                          {...register("researchField")}
                          placeholder="如：人工智能、生物技术等"
                          className={errors.researchField ? "border-red-500" : ""}
                        />
                        {errors.researchField && (
                          <p className="text-red-500 text-sm mt-1">{errors.researchField.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="startupDirection">创业方向</Label>
                        <Input
                          {...register("startupDirection")}
                          placeholder="描述你的创业方向和目标市场"
                          className={errors.startupDirection ? "border-red-500" : ""}
                        />
                        {errors.startupDirection && (
                          <p className="text-red-500 text-sm mt-1">{errors.startupDirection.message}</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor="experience">相关经验</Label>
                        <Textarea
                          {...register("experience")}
                          placeholder="描述你的技术背景、工作经验或创业经历"
                          rows={3}
                        />
                      </div>

                      <div>
                        <Label htmlFor="lookingFor">寻找的合伙人</Label>
                        <Textarea
                          {...register("lookingFor")}
                          placeholder="描述你希望找到什么样的合伙人，具备哪些技能"
                          rows={2}
                        />
                      </div>

                      <Button
                        type="submit"
                        className="w-full"
                        disabled={createApplicationMutation.isPending}
                      >
                        {createApplicationMutation.isPending ? "提交中..." : "提交申请"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        ) : myApplication.status === 'pending' ? (
          <Card className="border-yellow-200 bg-yellow-50">
            <CardContent className="p-6">
              <div className="flex items-center">
                <Clock className="w-5 h-5 text-yellow-600 mr-3" />
                <div>
                  <h3 className="font-semibold text-yellow-800">申请审核中</h3>
                  <p className="text-yellow-700">
                    您的申请正在审核中，我们将在3个工作日内联系您
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : myApplication.status === 'rejected' ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-6">
              <div className="flex items-center">
                <XCircle className="w-5 h-5 text-red-600 mr-3" />
                <div>
                  <h3 className="font-semibold text-red-800">申请未通过</h3>
                  <p className="text-red-700">
                    您的申请暂未通过审核，如有疑问请联系我们
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Approved - Show Matching Interface */
          <div className="space-y-6">
            {/* Status Banner */}
            <Card className="border-green-200 bg-green-50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 text-green-600 mr-3" />
                    <div>
                      <h3 className="font-semibold text-green-800">已加入匹配池</h3>
                      <p className="text-green-700 text-sm">
                        开始发现志同道合的创业伙伴吧！
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchRecommendations()}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    刷新推荐
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Main Matching Interface */}
            <Tabs value={currentTab} onValueChange={setCurrentTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="recommendations" className="flex items-center">
                  <Sparkles className="w-4 h-4 mr-2" />
                  智能推荐
                  {filteredRecommendations.length > 0 && (
                    <Badge className="ml-2" variant="secondary">
                      {filteredRecommendations.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="matches" className="flex items-center">
                  <Heart className="w-4 h-4 mr-2" />
                  我的匹配
                  {existingMatches.length > 0 && (
                    <Badge className="ml-2" variant="secondary">
                      {existingMatches.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="stats" className="flex items-center">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  统计数据
                </TabsTrigger>
              </TabsList>

              {/* Recommendations Tab */}
              <TabsContent value="recommendations" className="space-y-4">
                {recommendationsLoading ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i} className="animate-pulse">
                        <CardContent className="p-4">
                          <div className="space-y-3">
                            <div className="flex items-center space-x-3">
                              <div className="w-12 h-12 bg-gray-200 rounded-full"></div>
                              <div className="space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-24"></div>
                                <div className="h-3 bg-gray-200 rounded w-16"></div>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="h-3 bg-gray-200 rounded"></div>
                              <div className="h-3 bg-gray-200 rounded w-3/4"></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : filteredRecommendations.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Sparkles className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        暂无新推荐
                      </h3>
                      <p className="text-gray-500">
                        {interactedUsers.size > 0 
                          ? "你已经查看了所有推荐，稍后再来看看吧！"
                          : "暂时没有找到合适的匹配，我们会持续为你寻找最佳伙伴"
                        }
                      </p>
                      <Button
                        variant="outline"
                        className="mt-4"
                        onClick={() => {
                          setInteractedUsers(new Set());
                          refetchRecommendations();
                        }}
                      >
                        <RefreshCw className="w-4 h-4 mr-2" />
                        重新开始
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredRecommendations.map((result) => (
                      <MatchCard
                        key={result.candidate.id}
                        candidate={result.candidate}
                        onInterest={handleInterest}
                        onPass={handlePass}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Matches Tab */}
              <TabsContent value="matches" className="space-y-4">
                {matchesLoading ? (
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
                        <span>加载匹配记录...</span>
                      </div>
                    </CardContent>
                  </Card>
                ) : existingMatches.length === 0 ? (
                  <Card>
                    <CardContent className="p-8 text-center">
                      <Heart className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 mb-2">
                        还没有匹配记录
                      </h3>
                      <p className="text-gray-500">
                        去智能推荐页面发现你的理想合伙人吧！
                      </p>
                      <Button
                        className="mt-4"
                        onClick={() => setCurrentTab("recommendations")}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        开始匹配
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="space-y-4">
                    {existingMatches.map((match) => (
                      <Card key={match.id}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                                <Users className="w-5 h-5 text-blue-600" />
                              </div>
                              <div>
                                <p className="font-medium">匹配 #{match.id}</p>
                                <p className="text-sm text-gray-500">
                                  匹配度: {match.matchScore}% • {new Date(match.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Badge 
                              variant={match.status === 'accepted' ? 'default' : 'secondary'}
                            >
                              {match.status === 'accepted' ? '已接受' : match.status === 'pending' ? '待确认' : '已拒绝'}
                            </Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>

              {/* Stats Tab */}
              <TabsContent value="stats" className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Sparkles className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{recommendations.length}</p>
                          <p className="text-sm text-gray-600">推荐候选人</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Heart className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{interactedUsers.size}</p>
                          <p className="text-sm text-gray-600">已表达兴趣</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <MessageCircle className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{existingMatches.length}</p>
                          <p className="text-sm text-gray-600">成功匹配</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      匹配分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm">
                        <p className="font-medium">平均匹配度</p>
                        <p className="text-gray-600">
                          {recommendations.length > 0 
                            ? Math.round(recommendations.reduce((acc, rec) => acc + rec.candidate.matchScore, 0) / recommendations.length * 100)
                            : 0
                          }%
                        </p>
                      </div>
                      <Separator />
                      <div className="text-sm">
                        <p className="font-medium">主要匹配因素</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {Array.from(new Set(
                            recommendations.flatMap(rec => rec.candidate.matchReasons)
                          )).slice(0, 5).map(reason => (
                            <Badge key={reason} variant="outline" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}