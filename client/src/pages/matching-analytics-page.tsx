import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Heart, 
  MessageCircle, 
  Target,
  Calendar,
  ChevronRight,
  Lightbulb,
  Award,
  Activity
} from "lucide-react";
import Navbar from "@/components/navbar";

interface MatchingMetrics {
  totalMatches: number;
  successfulMatches: number;
  averageSuccessRate: number;
  averageResponseTime: number;
  topMatchingFactors: string[];
  userEngagementRate: number;
  conversionToMessaging: number;
}

interface UserMatchingInsights {
  userId: number;
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

interface AlgorithmRecommendations {
  currentPerformance: number;
  recommendedAdjustments: string[];
  testSuggestions: string[];
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

export default function MatchingAnalyticsPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');

  const { data: metrics, isLoading: metricsLoading } = useQuery<MatchingMetrics>({
    queryKey: ["/api/analytics/matching/metrics", timeRange],
    queryFn: () => apiRequest("GET", `/api/analytics/matching/metrics?timeRange=${timeRange}`),
    enabled: !!user,
  });

  const { data: userInsights, isLoading: insightsLoading } = useQuery<UserMatchingInsights>({
    queryKey: ["/api/analytics/matching/insights", user?.id],
    queryFn: () => apiRequest("GET", `/api/analytics/matching/insights/${user?.id}`),
    enabled: !!user,
  });

  const { data: algorithmRec, isLoading: algorithmLoading } = useQuery<AlgorithmRecommendations>({
    queryKey: ["/api/analytics/matching/algorithm-recommendations"],
    queryFn: () => apiRequest("GET", "/api/analytics/matching/algorithm-recommendations"),
    enabled: !!user && user.role === "admin",
  });

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p>请先登录以查看匹配分析</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">匹配分析 📊</h1>
          <p className="text-gray-600">深度洞察匹配表现，优化推荐算法</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">系统概览</TabsTrigger>
            <TabsTrigger value="personal">个人洞察</TabsTrigger>
            {user.role === "admin" && (
              <TabsTrigger value="algorithm">算法优化</TabsTrigger>
            )}
            <TabsTrigger value="insights">深度分析</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">系统匹配指标</h2>
              <Select value={timeRange} onValueChange={(value: 'week' | 'month' | 'quarter') => setTimeRange(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">近一周</SelectItem>
                  <SelectItem value="month">近一月</SelectItem>
                  <SelectItem value="quarter">近三月</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {metricsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(4)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="animate-pulse">
                        <div className="h-8 bg-gray-200 rounded mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : metrics ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{metrics.totalMatches}</p>
                          <p className="text-sm text-gray-600">总匹配数</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                          <Heart className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{metrics.successfulMatches}</p>
                          <p className="text-sm text-gray-600">成功匹配</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                          <Target className="w-5 h-5 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{metrics.averageSuccessRate.toFixed(1)}%</p>
                          <p className="text-sm text-gray-600">成功率</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <MessageCircle className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{metrics.conversionToMessaging.toFixed(1)}%</p>
                          <p className="text-sm text-gray-600">消息转化率</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <TrendingUp className="w-5 h-5 mr-2" />
                      关键成功因素
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {metrics.topMatchingFactors.map((factor, index) => (
                        <Badge key={index} variant="secondary" className="text-sm">
                          #{index + 1} {factor}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          <TabsContent value="personal" className="space-y-6">
            <h2 className="text-2xl font-semibold">个人匹配洞察</h2>

            {insightsLoading ? (
              <div className="space-y-6">
                {[...Array(3)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="animate-pulse">
                        <div className="h-6 bg-gray-200 rounded mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : userInsights ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Award className="w-5 h-5 mr-2" />
                      资料完整度
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span>当前完整度</span>
                      <span className="font-semibold">{userInsights.profileCompleteness}%</span>
                    </div>
                    <Progress value={userInsights.profileCompleteness} className="h-2" />
                    <p className="text-sm text-gray-600">
                      {userInsights.profileCompleteness >= 80 
                        ? "🎉 资料非常完整！这有助于获得更精准的匹配"
                        : "⚡ 建议完善更多资料信息以提高匹配质量"
                      }
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-blue-600">{userInsights.matchingActivity.views}</p>
                      <p className="text-sm text-gray-600">浏览次数</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-green-600">{userInsights.matchingActivity.likes}</p>
                      <p className="text-sm text-gray-600">点赞数</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-orange-600">{userInsights.matchingActivity.passes}</p>
                      <p className="text-sm text-gray-600">跳过数</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-purple-600">{userInsights.matchingActivity.messagesInitiated}</p>
                      <p className="text-sm text-gray-600">发起聊天</p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center">
                      <Lightbulb className="w-5 h-5 mr-2" />
                      个性化建议
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-32">
                      <div className="space-y-2">
                        {userInsights.recommendations.map((rec, index) => (
                          <div key={index} className="flex items-start space-x-2 p-2 bg-blue-50 rounded-lg">
                            <ChevronRight className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{rec}</p>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </div>
            ) : null}
          </TabsContent>

          {user.role === "admin" && (
            <TabsContent value="algorithm" className="space-y-6">
              <h2 className="text-2xl font-semibold">算法性能优化</h2>

              {algorithmLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="animate-pulse">
                      <div className="h-6 bg-gray-200 rounded mb-4"></div>
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded"></div>
                    </div>
                  </CardContent>
                </Card>
              ) : algorithmRec ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        当前算法表现
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center space-y-2">
                        <div className="text-4xl font-bold text-blue-600">
                          {algorithmRec.currentPerformance.toFixed(1)}%
                        </div>
                        <div className="text-gray-600">综合评分</div>
                        <Progress value={algorithmRec.currentPerformance} className="h-2 mt-4" />
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>优化建议</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {algorithmRec.recommendedAdjustments.map((adj, index) => (
                          <div key={index} className="flex items-start space-x-2 p-3 bg-yellow-50 rounded-lg">
                            <Activity className="w-5 h-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{adj}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>A/B 测试建议</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {algorithmRec.testSuggestions.map((suggestion, index) => (
                          <div key={index} className="flex items-start space-x-2 p-3 bg-blue-50 rounded-lg">
                            <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm">{suggestion}</p>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </TabsContent>
          )}

          <TabsContent value="insights" className="space-y-6">
            <h2 className="text-2xl font-semibold">深度分析报告</h2>
            
            <Card>
              <CardHeader>
                <CardTitle>匹配质量趋势</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  📊 图表功能开发中...
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>用户行为分析</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    📈 行为分析图表开发中...
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>成功因子权重</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-48 flex items-center justify-center text-gray-500">
                    🎯 权重分析开发中...
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}