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
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { 
  Shield, 
  Users, 
  FileText, 
  Activity, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  UserX,
  MessageSquare,
  Download,
  Send,
  Eye,
  Search,
  Filter,
  BarChart3,
  TrendingUp,
  Clock,
  Globe,
  Database,
  Server,
  Wifi,
  Brain,
  Settings,
  Zap,
  DollarSign,
  AlertCircle,
  Play,
  Pause,
  RotateCcw,
  Monitor
} from "lucide-react";
import Navbar from "@/components/navbar";

interface PlatformStats {
  users: {
    total: number;
    active: number;
    pending: number;
    approved: number;
    newThisWeek: number;
  };
  content: {
    events: number;
    products: number;
    applications: number;
    pendingReview: number;
  };
  engagement: {
    matches: number;
    messages: number;
    eventRegistrations: number;
    averageSessionTime: number;
  };
  systemHealth: {
    activeConnections: number;
    notificationsSent: number;
    errorRate: number;
    performanceScore: number;
  };
}

interface UserDetails {
  id: number;
  username: string;
  email: string;
  fullName: string;
  role: string;
  isApproved: boolean;
  createdAt: string;
  lastActive?: string;
  application?: any;
  stats: {
    matches: number;
    messages: number;
    events: number;
    contentInteractions: number;
  };
  flags: {
    reported: boolean;
    suspended: boolean;
    warnings: number;
  };
}

interface ContentItem {
  id: number;
  type: 'event' | 'product' | 'application';
  title: string;
  description: string;
  creator: string;
  status: string;
  createdAt: string;
  flags: number;
  engagement: number;
}

interface SystemAlert {
  id: string;
  level: 'info' | 'warning' | 'error' | 'critical';
  title: string;
  message: string;
  component: string;
  timestamp: string;
  resolved: boolean;
}

interface AIProvider {
  id: string;
  name: string;
  displayName: string;
  enabled: boolean;
  status: 'healthy' | 'degraded' | 'down';
  config: {
    apiKey: string;
    baseUrl: string;
    priority: number;
  };
  metrics: {
    requestCount: number;
    successRate: number;
    averageLatency: number;
    totalCost: number;
  };
}

interface AISystemStats {
  totalRequests: number;
  averageLatency: number;
  totalCost: number;
  cacheHitRate: number;
  activeProviders: number;
  emergencyMode: boolean;
  routingStrategy: string;
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

export default function AdvancedAdminPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'quarter'>('month');
  const [selectedUser, setSelectedUser] = useState<UserDetails | null>(null);
  const [userFilter, setUserFilter] = useState({ search: '', role: '', status: '' });
  const [contentFilter, setContentFilter] = useState<'event' | 'product' | 'application' | ''>('');
  const [announcementDialog, setAnnouncementDialog] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  const [aiConfigDialog, setAiConfigDialog] = useState(false);

  // API Queries
  const { data: platformStats, isLoading: statsLoading } = useQuery<PlatformStats>({
    queryKey: ["/api/admin/stats", timeRange],
    queryFn: () => apiRequest("GET", `/api/admin/stats?timeRange=${timeRange}`),
    enabled: !!user && user.role === "admin",
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ["/api/admin/users", userFilter],
    queryFn: () => apiRequest("GET", `/api/admin/users?search=${userFilter.search}&role=${userFilter.role}&status=${userFilter.status}`),
    enabled: !!user && user.role === "admin",
  });

  const { data: contentItems = [], isLoading: contentLoading } = useQuery<ContentItem[]>({
    queryKey: ["/api/admin/content/moderation", contentFilter],
    queryFn: () => apiRequest("GET", `/api/admin/content/moderation${contentFilter ? `?type=${contentFilter}` : ''}`),
    enabled: !!user && user.role === "admin",
  });

  const { data: systemAlerts = [], isLoading: alertsLoading } = useQuery<SystemAlert[]>({
    queryKey: ["/api/admin/alerts"],
    queryFn: () => apiRequest("GET", "/api/admin/alerts"),
    enabled: !!user && user.role === "admin",
  });

  const { data: aiProviders = [], isLoading: aiProvidersLoading } = useQuery<AIProvider[]>({
    queryKey: ["/api/admin/ai/providers"],
    queryFn: () => apiRequest("GET", "/api/admin/ai/providers"),
    enabled: !!user && user.role === "admin",
  });

  const { data: aiSystemStats, isLoading: aiStatsLoading } = useQuery<AISystemStats>({
    queryKey: ["/api/admin/ai/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/ai/stats"),
    enabled: !!user && user.role === "admin",
  });

  // Mutations
  const moderateApplicationMutation = useMutation({
    mutationFn: ({ id, action, notes }: { id: number; action: string; notes?: string }) =>
      apiRequest("POST", `/api/admin/moderate/application/${id}`, { action, notes }),
    onSuccess: () => {
      toast({ title: "操作成功", description: "申请状态已更新" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/content/moderation"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "操作失败", 
        description: error.error || "操作失败，请重试",
        variant: "destructive" 
      });
    },
  });

  const moderateUserMutation = useMutation({
    mutationFn: ({ id, action, reason }: { id: number; action: string; reason: string }) =>
      apiRequest("POST", `/api/admin/moderate/user/${id}`, { action, reason }),
    onSuccess: () => {
      toast({ title: "操作成功", description: "用户状态已更新" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({ 
        title: "操作失败", 
        description: error.error || "操作失败，请重试",
        variant: "destructive" 
      });
    },
  });

  const sendAnnouncementMutation = useMutation({
    mutationFn: (data: { title: string; message: string; priority: string; targetRole?: string }) =>
      apiRequest("POST", "/api/admin/announcement", data),
    onSuccess: () => {
      toast({ title: "发送成功", description: "系统通知已发送" });
      setAnnouncementDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "发送失败", 
        description: error.error || "发送失败，请重试",
        variant: "destructive" 
      });
    },
  });

  const updateAIProviderMutation = useMutation({
    mutationFn: ({ providerId, enabled, config }: { providerId: string; enabled?: boolean; config?: any }) =>
      apiRequest("PUT", `/api/admin/ai/providers/${providerId}`, { enabled, config }),
    onSuccess: () => {
      toast({ title: "更新成功", description: "AI提供商配置已更新" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/providers"] });
      setAiConfigDialog(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "更新失败", 
        description: error.error || "更新失败，请重试",
        variant: "destructive" 
      });
    },
  });

  const updateAIRoutingMutation = useMutation({
    mutationFn: (strategy: string) =>
      apiRequest("PUT", "/api/admin/ai/routing", { strategy }),
    onSuccess: () => {
      toast({ title: "更新成功", description: "AI路由策略已更新" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ai/stats"] });
    },
    onError: (error: any) => {
      toast({ 
        title: "更新失败", 
        description: error.error || "更新失败，请重试",
        variant: "destructive" 
      });
    },
  });

  if (!user || user.role !== "admin") {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <Shield className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold mb-2">访问受限</h2>
            <p className="text-gray-600">此页面仅限管理员访问</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">高级管理控制台 🛡️</h1>
          <p className="text-gray-600">全面的平台管理、内容审核和系统监控</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-8">
            <TabsTrigger value="overview">总览</TabsTrigger>
            <TabsTrigger value="users">用户管理</TabsTrigger>
            <TabsTrigger value="content">内容审核</TabsTrigger>
            <TabsTrigger value="interviews">面试评估</TabsTrigger>
            <TabsTrigger value="ai">AI管理</TabsTrigger>
            <TabsTrigger value="system">系统监控</TabsTrigger>
            <TabsTrigger value="notifications">通知管理</TabsTrigger>
            <TabsTrigger value="analytics">数据分析</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">平台概览</h2>
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

            {statsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
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
            ) : platformStats ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-blue-600">{platformStats.users.total}</p>
                          <p className="text-sm text-gray-600">总用户数</p>
                        </div>
                        <Users className="w-8 h-8 text-blue-500" />
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        本周新增: {platformStats.users.newThisWeek}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-green-600">{platformStats.users.approved}</p>
                          <p className="text-sm text-gray-600">已认证用户</p>
                        </div>
                        <CheckCircle className="w-8 h-8 text-green-500" />
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        待审核: {platformStats.users.pending}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-purple-600">{platformStats.engagement.matches}</p>
                          <p className="text-sm text-gray-600">成功匹配</p>
                        </div>
                        <TrendingUp className="w-8 h-8 text-purple-500" />
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        消息数: {platformStats.engagement.messages}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-2xl font-bold text-orange-600">{platformStats.content.pendingReview}</p>
                          <p className="text-sm text-gray-600">待审核内容</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-orange-500" />
                      </div>
                      <div className="mt-3 text-xs text-gray-500">
                        需要关注
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <Activity className="w-5 h-5 mr-2" />
                        系统健康状态
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>系统性能</span>
                          <span>{platformStats.systemHealth.performanceScore}%</span>
                        </div>
                        <Progress value={platformStats.systemHealth.performanceScore} className="h-2" />
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="flex items-center">
                          <Wifi className="w-4 h-4 mr-2 text-green-500" />
                          <span>在线连接: {platformStats.systemHealth.activeConnections}</span>
                        </div>
                        <div className="flex items-center">
                          <Database className="w-4 h-4 mr-2 text-blue-500" />
                          <span>错误率: {platformStats.systemHealth.errorRate}%</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center">
                        <BarChart3 className="w-5 h-5 mr-2" />
                        内容统计
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">活动</span>
                          <Badge variant="secondary">{platformStats.content.events}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">AI产品</span>
                          <Badge variant="secondary">{platformStats.content.products}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">申请</span>
                          <Badge variant="secondary">{platformStats.content.applications}</Badge>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">活动报名</span>
                          <Badge variant="secondary">{platformStats.engagement.eventRegistrations}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">用户管理</h2>
              <div className="flex space-x-2">
                <Input 
                  placeholder="搜索用户..." 
                  value={userFilter.search}
                  onChange={(e) => setUserFilter(prev => ({ ...prev, search: e.target.value }))}
                  className="w-64"
                />
                <Select value={userFilter.role} onValueChange={(value) => setUserFilter(prev => ({ ...prev, role: value }))}>
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="角色" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部</SelectItem>
                    <SelectItem value="user">用户</SelectItem>
                    <SelectItem value="admin">管理员</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-96">
                  {usersLoading ? (
                    <div className="p-6">加载中...</div>
                  ) : (
                    <div className="divide-y">
                      {usersData?.users?.map((user: UserDetails) => (
                        <div key={user.id} className="p-4 hover:bg-gray-50 cursor-pointer" onClick={() => setSelectedUser(user)}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold">
                                {user.fullName?.charAt(0) || user.username.charAt(0)}
                              </div>
                              <div>
                                <p className="font-medium">{user.fullName || user.username}</p>
                                <p className="text-sm text-gray-500">{user.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={user.isApproved ? "default" : "secondary"}>
                                {user.isApproved ? "已认证" : "未认证"}
                              </Badge>
                              <Badge variant="outline">{user.role}</Badge>
                              <Button size="sm" variant="outline">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* User Detail Modal */}
            <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>用户详情</DialogTitle>
                </DialogHeader>
                {selectedUser && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>用户名</Label>
                        <p className="text-sm">{selectedUser.username}</p>
                      </div>
                      <div>
                        <Label>邮箱</Label>
                        <p className="text-sm">{selectedUser.email}</p>
                      </div>
                      <div>
                        <Label>姓名</Label>
                        <p className="text-sm">{selectedUser.fullName}</p>
                      </div>
                      <div>
                        <Label>角色</Label>
                        <Badge>{selectedUser.role}</Badge>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{selectedUser.stats.matches}</p>
                        <p className="text-xs text-gray-500">匹配数</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{selectedUser.stats.messages}</p>
                        <p className="text-xs text-gray-500">消息数</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">{selectedUser.stats.events}</p>
                        <p className="text-xs text-gray-500">活动数</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">{selectedUser.stats.contentInteractions}</p>
                        <p className="text-xs text-gray-500">互动数</p>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button 
                        variant="outline" 
                        onClick={() => moderateUserMutation.mutate({ 
                          id: selectedUser.id, 
                          action: 'warn', 
                          reason: '管理员警告' 
                        })}
                      >
                        <AlertTriangle className="w-4 h-4 mr-2" />
                        警告
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => moderateUserMutation.mutate({ 
                          id: selectedUser.id, 
                          action: 'suspend', 
                          reason: '违反社区规定' 
                        })}
                      >
                        <UserX className="w-4 h-4 mr-2" />
                        暂停
                      </Button>
                    </div>
                  </div>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="content" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">内容审核</h2>
              <Select value={contentFilter} onValueChange={(value: any) => setContentFilter(value)}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="内容类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">全部</SelectItem>
                  <SelectItem value="application">申请</SelectItem>
                  <SelectItem value="event">活动</SelectItem>
                  <SelectItem value="product">产品</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-96">
                  {contentLoading ? (
                    <div className="p-6">加载中...</div>
                  ) : (
                    <div className="divide-y">
                      {contentItems.map((item) => (
                        <div key={`${item.type}-${item.id}`} className="p-4 hover:bg-gray-50">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-2">
                                <Badge variant="outline">{
                                  item.type === 'application' ? '申请' : 
                                  item.type === 'event' ? '活动' : '产品'
                                }</Badge>
                                {item.type === 'application' && item.status === 'pending' && (
                                  <Badge variant="secondary">待审核</Badge>
                                )}
                              </div>
                              <h4 className="font-medium">{item.title}</h4>
                              <p className="text-sm text-gray-600 mt-1">{item.description}</p>
                              <p className="text-xs text-gray-500 mt-2">创建者: {item.creator}</p>
                            </div>
                            {item.type === 'application' && item.status === 'pending' && (
                              <div className="flex space-x-2 ml-4">
                                <Button 
                                  size="sm" 
                                  onClick={() => moderateApplicationMutation.mutate({ 
                                    id: item.id, 
                                    action: 'approve' 
                                  })}
                                  disabled={moderateApplicationMutation.isPending}
                                >
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                  通过
                                </Button>
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  onClick={() => moderateApplicationMutation.mutate({ 
                                    id: item.id, 
                                    action: 'reject',
                                    notes: '不符合要求' 
                                  })}
                                  disabled={moderateApplicationMutation.isPending}
                                >
                                  <XCircle className="w-4 h-4 mr-1" />
                                  拒绝
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">AI系统管理</h2>
              <Dialog open={aiConfigDialog} onOpenChange={setAiConfigDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Settings className="w-4 h-4 mr-2" />
                    系统配置
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>AI系统配置</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-6">
                    <div>
                      <Label>路由策略</Label>
                      <Select 
                        value={aiSystemStats?.routingStrategy || 'cost-optimized'} 
                        onValueChange={(strategy) => updateAIRoutingMutation.mutate(strategy)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cost-optimized">成本优化</SelectItem>
                          <SelectItem value="performance-optimized">性能优化</SelectItem>
                          <SelectItem value="quality-optimized">质量优化</SelectItem>
                          <SelectItem value="round-robin">轮询平衡</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {aiSystemStats?.emergencyMode && (
                      <div className="p-4 bg-red-50 border-red-200 border rounded-lg">
                        <div className="flex items-center">
                          <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                          <span className="text-red-700 font-medium">紧急模式已启用</span>
                        </div>
                        <p className="text-red-600 text-sm mt-1">系统正在使用备用AI提供商</p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* AI System Overview */}
            {aiStatsLoading ? (
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
            ) : aiSystemStats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-blue-600">{aiSystemStats.totalRequests}</p>
                        <p className="text-sm text-gray-600">总请求数</p>
                      </div>
                      <Brain className="w-8 h-8 text-blue-500" />
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      平均延迟: {aiSystemStats.averageLatency.toFixed(0)}ms
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-green-600">{aiSystemStats.cacheHitRate.toFixed(1)}%</p>
                        <p className="text-sm text-gray-600">缓存命中率</p>
                      </div>
                      <Zap className="w-8 h-8 text-green-500" />
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      性能优化良好
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-purple-600">{aiSystemStats.activeProviders}</p>
                        <p className="text-sm text-gray-600">活跃提供商</p>
                      </div>
                      <Server className="w-8 h-8 text-purple-500" />
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      策略: {aiSystemStats.routingStrategy}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-orange-600">¥{aiSystemStats.totalCost.toFixed(2)}</p>
                        <p className="text-sm text-gray-600">总成本</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-orange-500" />
                    </div>
                    <div className="mt-3 text-xs text-gray-500">
                      本月支出
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : null}

            {/* AI Providers Management */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Monitor className="w-5 h-5 mr-2" />
                  AI提供商管理
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-96">
                  {aiProvidersLoading ? (
                    <div className="p-6">加载中...</div>
                  ) : (
                    <div className="space-y-4">
                      {aiProviders.map((provider) => (
                        <div key={provider.id} className="border rounded-lg p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <div className={`w-3 h-3 rounded-full ${
                                provider.status === 'healthy' ? 'bg-green-500' :
                                provider.status === 'degraded' ? 'bg-yellow-500' : 'bg-red-500'
                              }`}></div>
                              <div>
                                <h4 className="font-medium">{provider.displayName}</h4>
                                <p className="text-sm text-gray-500">{provider.name}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge variant={provider.enabled ? "default" : "secondary"}>
                                {provider.enabled ? "启用" : "禁用"}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAIProviderMutation.mutate({
                                  providerId: provider.id,
                                  enabled: !provider.enabled
                                })}
                              >
                                {provider.enabled ? (
                                  <Pause className="w-4 h-4" />
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedProvider(provider)}
                              >
                                <Settings className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-4 gap-4 mt-4 text-sm">
                            <div>
                              <p className="text-gray-500">请求数</p>
                              <p className="font-medium">{provider.metrics.requestCount}</p>
                            </div>
                            <div>
                              <p className="text-gray-500">成功率</p>
                              <p className="font-medium">{(provider.metrics.successRate * 100).toFixed(1)}%</p>
                            </div>
                            <div>
                              <p className="text-gray-500">平均延迟</p>
                              <p className="font-medium">{provider.metrics.averageLatency.toFixed(0)}ms</p>
                            </div>
                            <div>
                              <p className="text-gray-500">总成本</p>
                              <p className="font-medium">¥{provider.metrics.totalCost.toFixed(2)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Provider Detail Modal */}
            <Dialog open={!!selectedProvider} onOpenChange={() => setSelectedProvider(null)}>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>提供商配置 - {selectedProvider?.displayName}</DialogTitle>
                </DialogHeader>
                {selectedProvider && (
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    updateAIProviderMutation.mutate({
                      providerId: selectedProvider.id,
                      config: {
                        apiKey: formData.get('apiKey') as string,
                        priority: parseInt(formData.get('priority') as string),
                      }
                    });
                  }}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="apiKey">API密钥</Label>
                        <Input 
                          id="apiKey" 
                          name="apiKey" 
                          type="password"
                          defaultValue={selectedProvider.config.apiKey} 
                          placeholder="输入API密钥"
                        />
                      </div>
                      <div>
                        <Label htmlFor="priority">优先级</Label>
                        <Input 
                          id="priority" 
                          name="priority" 
                          type="number"
                          defaultValue={selectedProvider.config.priority} 
                          min="1" 
                          max="10"
                        />
                      </div>
                      <div>
                        <Label>基础URL</Label>
                        <p className="text-sm text-gray-600">{selectedProvider.config.baseUrl}</p>
                      </div>
                      <div className="flex space-x-2">
                        <Button type="submit" disabled={updateAIProviderMutation.isPending}>
                          {updateAIProviderMutation.isPending ? '更新中...' : '保存配置'}
                        </Button>
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => apiRequest("POST", `/api/admin/ai/providers/${selectedProvider.id}/test`)}
                        >
                          <RotateCcw className="w-4 h-4 mr-2" />
                          测试连接
                        </Button>
                      </div>
                    </div>
                  </form>
                )}
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <h2 className="text-2xl font-semibold">系统监控</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Server className="w-5 h-5 mr-2" />
                    系统警报
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-64">
                    {alertsLoading ? (
                      <div>加载中...</div>
                    ) : systemAlerts.length === 0 ? (
                      <div className="text-center text-gray-500 py-8">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>系统运行正常</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {systemAlerts.map((alert) => (
                          <div key={alert.id} className={`p-3 rounded-lg border-l-4 ${
                            alert.level === 'critical' ? 'border-red-500 bg-red-50' :
                            alert.level === 'error' ? 'border-orange-500 bg-orange-50' :
                            alert.level === 'warning' ? 'border-yellow-500 bg-yellow-50' :
                            'border-blue-500 bg-blue-50'
                          }`}>
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm">{alert.title}</p>
                                <p className="text-xs text-gray-600">{alert.message}</p>
                                <p className="text-xs text-gray-500 mt-1">{alert.component}</p>
                              </div>
                              <Badge variant={alert.resolved ? "default" : "secondary"}>
                                {alert.resolved ? "已解决" : "待处理"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Download className="w-5 h-5 mr-2" />
                    数据导出
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => window.open('/api/admin/export/users')}
                    >
                      <Users className="w-4 h-4 mr-2" />
                      导出用户数据
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => window.open('/api/admin/export/events')}
                    >
                      <FileText className="w-4 h-4 mr-2" />
                      导出活动数据
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => window.open('/api/admin/export/applications')}
                    >
                      <Database className="w-4 h-4 mr-2" />
                      导出申请数据
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={() => window.open('/api/admin/export/analytics')}
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      导出分析数据
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">通知管理</h2>
              <Dialog open={announcementDialog} onOpenChange={setAnnouncementDialog}>
                <DialogTrigger asChild>
                  <Button>
                    <Send className="w-4 h-4 mr-2" />
                    发送公告
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>发送系统公告</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target as HTMLFormElement);
                    sendAnnouncementMutation.mutate({
                      title: formData.get('title') as string,
                      message: formData.get('message') as string,
                      priority: formData.get('priority') as string,
                      targetRole: formData.get('targetRole') as string || undefined,
                    });
                  }}>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="title">标题</Label>
                        <Input id="title" name="title" required />
                      </div>
                      <div>
                        <Label htmlFor="message">内容</Label>
                        <Textarea id="message" name="message" rows={4} required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="priority">优先级</Label>
                          <Select name="priority" defaultValue="medium">
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="low">低</SelectItem>
                              <SelectItem value="medium">中</SelectItem>
                              <SelectItem value="high">高</SelectItem>
                              <SelectItem value="urgent">紧急</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="targetRole">目标角色</Label>
                          <Select name="targetRole">
                            <SelectTrigger>
                              <SelectValue placeholder="全部用户" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="">全部用户</SelectItem>
                              <SelectItem value="user">普通用户</SelectItem>
                              <SelectItem value="admin">管理员</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <Button type="submit" disabled={sendAnnouncementMutation.isPending}>
                        {sendAnnouncementMutation.isPending ? '发送中...' : '发送公告'}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>通知统计</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="w-12 h-12 mx-auto mb-2" />
                  <p>通知统计功能开发中...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6">
            <h2 className="text-2xl font-semibold">数据分析</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>用户增长趋势</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-gray-500 py-8">
                    <TrendingUp className="w-12 h-12 mx-auto mb-2" />
                    <p>图表功能开发中...</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>内容参与度</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center text-gray-500 py-8">
                    <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                    <p>图表功能开发中...</p>
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