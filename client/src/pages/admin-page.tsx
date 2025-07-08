import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Users, Calendar, Brain, UserCheck, Check, X, Eye, MessageSquare } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";
import { Redirect } from "wouter";
import type { Event, AgentProduct, CofounderApplication } from "@shared/schema";

export default function AdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedApplication, setSelectedApplication] = useState<CofounderApplication | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");

  // Check admin access
  if (!user || user.role !== "admin") {
    return <Redirect to="/" />;
  }

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: products = [], isLoading: productsLoading } = useQuery<AgentProduct[]>({
    queryKey: ["/api/agent-products"],
  });

  const { data: applications = [], isLoading: applicationsLoading } = useQuery<CofounderApplication[]>({
    queryKey: ["/api/cofounder-applications"],
  });

  const reviewApplicationMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return await apiRequest("PATCH", `/api/cofounder-applications/${id}`, {
        status,
        reviewNotes,
      });
    },
    onSuccess: () => {
      toast({
        title: "审核完成",
        description: "申请状态已更新",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cofounder-applications"] });
      setReviewDialogOpen(false);
      setSelectedApplication(null);
      setReviewNotes("");
    },
    onError: () => {
      toast({
        title: "审核失败",
        description: "更新申请状态时发生错误",
        variant: "destructive",
      });
    },
  });

  const handleReview = (application: CofounderApplication) => {
    setSelectedApplication(application);
    setReviewDialogOpen(true);
  };

  const handleApprove = () => {
    if (selectedApplication) {
      reviewApplicationMutation.mutate({
        id: selectedApplication.id,
        status: "approved",
      });
    }
  };

  const handleReject = () => {
    if (selectedApplication) {
      reviewApplicationMutation.mutate({
        id: selectedApplication.id,
        status: "rejected",
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-100 text-amber-800">待审核</Badge>;
      case "approved":
        return <Badge className="bg-green-100 text-green-800">已通过</Badge>;
      case "rejected":
        return <Badge className="bg-red-100 text-red-800">已拒绝</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getProductStatusBadge = (status: string) => {
    switch (status) {
      case "published":
        return <Badge className="bg-green-100 text-green-800">已发布</Badge>;
      case "testing":
        return <Badge className="bg-blue-100 text-blue-800">测试中</Badge>;
      case "development":
        return <Badge className="bg-amber-100 text-amber-800">开发中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const stats = {
    totalEvents: events.length,
    totalProducts: products.length,
    pendingApplications: applications.filter(app => app.status === "pending").length,
    approvedApplications: applications.filter(app => app.status === "approved").length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">管理后台</h1>
          <p className="text-gray-600">管理平台内容和用户申请</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-primary-blue" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">总活动数</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalEvents}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Brain className="h-8 w-8 text-accent-green" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Agent产品</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalProducts}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <UserCheck className="h-8 w-8 text-amber-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">待审核申请</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.pendingApplications}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Users className="h-8 w-8 text-green-500" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">已通过申请</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.approvedApplications}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="applications" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="applications">创始人申请</TabsTrigger>
            <TabsTrigger value="events">活动管理</TabsTrigger>
            <TabsTrigger value="products">产品管理</TabsTrigger>
          </TabsList>

          {/* Cofounder Applications */}
          <TabsContent value="applications">
            <Card>
              <CardHeader>
                <CardTitle>创始人匹配申请</CardTitle>
              </CardHeader>
              <CardContent>
                {applicationsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-20 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : applications.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>申请人</TableHead>
                        <TableHead>研究领域</TableHead>
                        <TableHead>创业方向</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>申请时间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {applications.map((application) => (
                        <TableRow key={application.id}>
                          <TableCell className="font-medium">
                            用户 #{application.userId}
                          </TableCell>
                          <TableCell>{application.researchField}</TableCell>
                          <TableCell className="max-w-xs truncate">
                            {application.startupDirection}
                          </TableCell>
                          <TableCell>{getStatusBadge(application.status)}</TableCell>
                          <TableCell>
                            {new Date(application.createdAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReview(application)}
                            >
                              <Eye className="w-4 h-4 mr-2" />
                              审核
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <UserCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">暂无申请</h3>
                    <p className="text-gray-500">还没有收到创始人匹配申请</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Management */}
          <TabsContent value="events">
            <Card>
              <CardHeader>
                <CardTitle>活动管理</CardTitle>
              </CardHeader>
              <CardContent>
                {eventsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : events.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>活动标题</TableHead>
                        <TableHead>类型</TableHead>
                        <TableHead>日期</TableHead>
                        <TableHead>报名人数</TableHead>
                        <TableHead>创建者</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.title}</TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {event.category === 'tech_share' ? '技术分享' : 
                               event.category === 'startup_share' ? '创业分享' : '网络聚会'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(event.date).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            {event.currentAttendees || 0} / {event.maxAttendees || '无限制'}
                          </TableCell>
                          <TableCell>用户 #{event.createdBy}</TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4 mr-2" />
                              查看
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">暂无活动</h3>
                    <p className="text-gray-500">还没有创建任何活动</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Products Management */}
          <TabsContent value="products">
            <Card>
              <CardHeader>
                <CardTitle>Agent产品管理</CardTitle>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="h-16 bg-gray-200 rounded"></div>
                      </div>
                    ))}
                  </div>
                ) : products.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>产品名称</TableHead>
                        <TableHead>类别</TableHead>
                        <TableHead>状态</TableHead>
                        <TableHead>使用次数</TableHead>
                        <TableHead>创建者</TableHead>
                        <TableHead>创建时间</TableHead>
                        <TableHead>操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell>{product.category}</TableCell>
                          <TableCell>{getProductStatusBadge(product.status)}</TableCell>
                          <TableCell>{product.usageCount || 0}</TableCell>
                          <TableCell>用户 #{product.creatorId}</TableCell>
                          <TableCell>
                            {new Date(product.createdAt).toLocaleDateString('zh-CN')}
                          </TableCell>
                          <TableCell>
                            <Button size="sm" variant="outline">
                              <Eye className="w-4 h-4 mr-2" />
                              查看
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8">
                    <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">暂无产品</h3>
                    <p className="text-gray-500">还没有发布任何Agent产品</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Review Dialog */}
        <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>审核创始人申请</DialogTitle>
            </DialogHeader>
            {selectedApplication && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-600">申请人</Label>
                    <p className="text-gray-900">用户 #{selectedApplication.userId}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-600">申请时间</Label>
                    <p className="text-gray-900">
                      {new Date(selectedApplication.createdAt).toLocaleDateString('zh-CN')}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-600">研究领域</Label>
                  <p className="text-gray-900">{selectedApplication.researchField}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-600">创业方向</Label>
                  <p className="text-gray-900">{selectedApplication.startupDirection}</p>
                </div>

                {selectedApplication.experience && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">相关经验</Label>
                    <p className="text-gray-900">{selectedApplication.experience}</p>
                  </div>
                )}

                {selectedApplication.lookingFor && (
                  <div>
                    <Label className="text-sm font-medium text-gray-600">寻找的合作伙伴</Label>
                    <p className="text-gray-900">{selectedApplication.lookingFor}</p>
                  </div>
                )}

                <div>
                  <Label htmlFor="reviewNotes">审核备注（可选）</Label>
                  <Textarea
                    id="reviewNotes"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="请输入审核备注..."
                    rows={4}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => setReviewDialogOpen(false)}
                  >
                    取消
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={reviewApplicationMutation.isPending}
                  >
                    <X className="w-4 h-4 mr-2" />
                    拒绝
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={reviewApplicationMutation.isPending}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    通过
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
