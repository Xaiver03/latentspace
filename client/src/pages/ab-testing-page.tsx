import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { 
  LuPlay, 
  LuPause, 
  LuBarChart, 
  LuTrendingUp,
  LuUsers,
  LuClock,
  LuTarget,
  LuBrain,
  LuBeaker,
  LuDownload,
  LuRocket,
  LuCheck,
  LuX,
  LuTriangleAlert,
  LuZap
} from "react-icons/lu";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  startDate: string;
  endDate: string;
  variants: Array<{
    id: string;
    name: string;
    description: string;
    config: {
      aiProvider?: string;
      matchingAlgorithm?: string;
      parameters?: Record<string, any>;
    };
  }>;
  trafficSplit: number[];
  metrics: string[];
}

interface ABTestResult {
  testId: string;
  variant: string;
  metrics: {
    participants: number;
    conversionRate: number;
    averageMatchScore: number;
    interactionRate: number;
    messagingRate: number;
    retentionRate: number;
    userSatisfaction: number;
  };
  significance: {
    isSignificant: boolean;
    pValue: number;
    confidenceInterval: [number, number];
  };
}

interface AIModelComparison {
  testName: string;
  duration: number;
  variants: Array<{
    name: string;
    aiProvider: string;
    participants: number;
    metrics: {
      matchAccuracy: number;
      responseTime: number;
      userSatisfaction: number;
      costPerMatch: number;
    };
    isWinner: boolean;
  }>;
  recommendation: string;
}

export function ABTestingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);

  // Fetch active A/B tests
  const { data: tests, isLoading: testsLoading } = useQuery<ABTest[]>({
    queryKey: ["/api/ab-testing/tests"],
  });

  // Fetch analytics summary
  const { data: analytics } = useQuery<{
    activeTests: number;
    totalParticipants: number;
    testsCompleted: number;
    averageTestDuration: number;
    recentFindings: Array<{
      testName: string;
      result: string;
      date: string;
    }>;
  }>({
    queryKey: ["/api/ab-testing/analytics/summary"],
  });

  // Start AI comparison test mutation
  const startAITest = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/ab-testing/tests/ai-comparison/start", {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to start AI comparison test");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "AI模型对比测试已启动",
        description: `测试ID: ${data.testId}，将运行${data.duration}`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ab-testing/tests"] });
    }
  });

  // Stop test mutation
  const stopTest = useMutation({
    mutationFn: async (testId: string) => {
      const response = await fetch(`/api/ab-testing/tests/${testId}/stop`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to stop test");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "测试已停止",
        description: "A/B测试已成功停止",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/ab-testing/tests"] });
    }
  });

  const getStatusBadge = (status: string) => {
    const configs = {
      running: { variant: "default" as const, label: "运行中", icon: LuPlay, color: "text-green-600" },
      paused: { variant: "secondary" as const, label: "已暂停", icon: LuPause, color: "text-yellow-600" },
      completed: { variant: "outline" as const, label: "已完成", icon: LuCheck, color: "text-blue-600" },
      draft: { variant: "secondary" as const, label: "草稿", icon: LuX, color: "text-gray-600" },
    };
    
    const config = configs[status as keyof typeof configs] || configs.draft;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {config.label}
      </Badge>
    );
  };

  if (testsLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载A/B测试数据...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">A/B测试管理</h1>
        <p className="text-muted-foreground">比较不同AI模型和算法的匹配效果</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">概览</TabsTrigger>
          <TabsTrigger value="tests">活跃测试</TabsTrigger>
          <TabsTrigger value="ai-comparison">AI模型对比</TabsTrigger>
          <TabsTrigger value="analytics">数据分析</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">活跃测试</CardTitle>
                <LuBeaker className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.activeTests || 0}</div>
                <p className="text-xs text-muted-foreground">正在运行的A/B测试</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">总参与者</CardTitle>
                <LuUsers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalParticipants || 0}</div>
                <p className="text-xs text-muted-foreground">参与测试的用户</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">完成测试</CardTitle>
                <LuCheck className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.testsCompleted || 0}</div>
                <p className="text-xs text-muted-foreground">已完成的测试</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">平均周期</CardTitle>
                <LuClock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.averageTestDuration || 14}</div>
                <p className="text-xs text-muted-foreground">天</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Findings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LuTrendingUp className="h-5 w-5" />
                最新发现
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.recentFindings?.map((finding: any, index: number) => (
                  <div key={index} className="flex items-start gap-4 p-4 border rounded-lg">
                    <div className={`p-2 rounded-full ${
                      finding.impact === 'high' ? 'bg-green-100 text-green-600' :
                      finding.impact === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                      'bg-blue-100 text-blue-600'
                    }`}>
                      <LuZap className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium">{finding.testName}</h4>
                      <p className="text-sm text-muted-foreground mt-1">{finding.finding}</p>
                      <p className="text-xs text-muted-foreground mt-2">
                        {format(new Date(finding.date), 'yyyy年MM月dd日', { locale: zhCN })}
                      </p>
                    </div>
                    <Badge variant={finding.impact === 'high' ? 'default' : 'secondary'}>
                      {finding.impact === 'high' ? '高影响' : finding.impact === 'medium' ? '中等影响' : '低影响'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>快速操作</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button 
                  className="h-auto p-6 flex flex-col items-start gap-2"
                  onClick={() => startAITest.mutate()}
                  disabled={startAITest.isPending}
                >
                  <div className="flex items-center gap-2">
                    <LuBrain className="h-5 w-5" />
                    <span className="font-medium">启动AI模型对比测试</span>
                  </div>
                  <span className="text-sm text-left opacity-90">
                    比较OpenAI、Claude、DeepSeek的匹配效果
                  </span>
                </Button>

                <Button 
                  variant="outline" 
                  className="h-auto p-6 flex flex-col items-start gap-2"
                  onClick={() => {
                    toast({
                      title: "功能开发中",
                      description: "自定义测试功能即将上线",
                    });
                  }}
                >
                  <div className="flex items-center gap-2">
                    <LuTarget className="h-5 w-5" />
                    <span className="font-medium">创建自定义测试</span>
                  </div>
                  <span className="text-sm text-left text-muted-foreground">
                    设计自定义的A/B测试实验
                  </span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tests" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">活跃的A/B测试</h3>
            <Button onClick={() => startAITest.mutate()} disabled={startAITest.isPending}>
              <LuRocket className="mr-2 h-4 w-4" />
              启动新测试
            </Button>
          </div>

          {tests && tests.length > 0 ? (
            <div className="grid gap-4">
              {tests.map((test) => (
                <Card key={test.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-semibold text-lg">{test.name}</h4>
                          {getStatusBadge(test.status)}
                        </div>
                        <p className="text-muted-foreground mb-4">{test.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-sm font-medium">变体数量</p>
                            <p className="text-2xl font-bold">{test.variants.length}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">流量分配</p>
                            <p className="text-sm">{test.trafficSplit.join('% / ')}%</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">开始时间</p>
                            <p className="text-sm">{format(new Date(test.startDate), 'MM月dd日', { locale: zhCN })}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">预计结束</p>
                            <p className="text-sm">{format(new Date(test.endDate), 'MM月dd日', { locale: zhCN })}</p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mb-4">
                          {test.variants.map((variant, index) => (
                            <Badge key={variant.id} variant="outline" className="text-xs">
                              {variant.name} ({test.trafficSplit[index]}%)
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2 ml-4">
                        <Button size="sm" variant="outline">
                          <LuBarChart className="h-4 w-4 mr-1" />
                          查看结果
                        </Button>
                        {test.status === 'running' && (
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => stopTest.mutate(test.id)}
                          >
                            <LuPause className="h-4 w-4 mr-1" />
                            停止
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <LuBeaker className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground mb-4">暂无活跃的A/B测试</p>
                <Button onClick={() => startAITest.mutate()}>
                  <LuRocket className="mr-2 h-4 w-4" />
                  启动首个AI对比测试
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="ai-comparison" className="space-y-6">
          <AIModelComparisonView />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>测试分析</CardTitle>
              <CardDescription>深入分析A/B测试的效果和影响</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <LuBarChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">高级分析功能即将上线</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AIModelComparisonView() {
  const [selectedTestId, setSelectedTestId] = useState<string>("");

  const { data: comparison, isLoading } = useQuery<AIModelComparison>({
    queryKey: ["/api/ab-testing/tests", selectedTestId, "ai-comparison"],
    enabled: !!selectedTestId,
  });

  if (!selectedTestId) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <LuBrain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground mb-4">请选择一个AI对比测试查看结果</p>
          <p className="text-sm text-muted-foreground">
            AI模型对比测试会自动运行，比较不同AI提供商的匹配效果
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">加载AI对比数据...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LuBrain className="h-5 w-5" />
            {comparison?.testName}
          </CardTitle>
          <CardDescription>
            测试运行了 {comparison?.duration} 天 • {comparison?.recommendation}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {comparison?.variants.map((variant, index) => (
              <div 
                key={index} 
                className={`p-4 border rounded-lg ${variant.isWinner ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : ''}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium">{variant.name}</h4>
                    <Badge variant="outline">{variant.aiProvider}</Badge>
                    {variant.isWinner && (
                      <Badge className="bg-green-600">
                        <LuTrendingUp className="mr-1 h-3 w-3" />
                        最佳表现
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{variant.participants} 参与者</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm font-medium">匹配准确率</p>
                    <p className="text-2xl font-bold">{variant.metrics.matchAccuracy.toFixed(1)}%</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">响应时间</p>
                    <p className="text-2xl font-bold">{variant.metrics.responseTime.toFixed(0)}ms</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">用户满意度</p>
                    <p className="text-2xl font-bold">{variant.metrics.userSatisfaction.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">单次成本</p>
                    <p className="text-2xl font-bold">¥{variant.metrics.costPerMatch.toFixed(3)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}