import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { UserCircle, Send, CheckCircle, Clock, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertCofounderApplicationSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";
import type { CofounderApplication, Match } from "@shared/schema";

const applicationFormSchema = insertCofounderApplicationSchema;
type ApplicationForm = z.infer<typeof applicationFormSchema>;

export default function MatchingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isApplicationDialogOpen, setIsApplicationDialogOpen] = useState(false);

  const { data: myApplication } = useQuery<CofounderApplication | null>({
    queryKey: ["/api/cofounder-applications/my"],
    enabled: !!user,
  });

  const { data: matches = [] } = useQuery<Match[]>({
    queryKey: ["/api/matches"],
    enabled: !!user,
  });

  const createApplicationMutation = useMutation({
    mutationFn: async (applicationData: ApplicationForm) => {
      return await apiRequest("POST", "/api/cofounder-applications", applicationData);
    },
    onSuccess: () => {
      toast({
        title: "申请提交成功",
        description: "我们将在3个工作日内联系您",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cofounder-applications/my"] });
      setIsApplicationDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "申请失败",
        description: error.message || "提交申请时发生错误，请重试",
        variant: "destructive",
      });
    },
  });

  const form = useForm<ApplicationForm>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      researchField: "",
      startupDirection: "",
      experience: "",
      lookingFor: "",
    },
  });

  const onSubmit = (data: ApplicationForm) => {
    createApplicationMutation.mutate(data);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending":
        return "审核中";
      case "approved":
        return "已通过";
      case "rejected":
        return "已拒绝";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-amber-100 text-amber-800";
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">请先登录</h1>
          <p className="text-gray-600 mb-8">您需要登录后才能使用创始人匹配功能</p>
          <Button className="bg-primary-blue hover:bg-primary-dark">
            去登录
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">创始人匹配</h1>
          <p className="text-lg text-gray-600">找到与您专业背景和创业理念匹配的合作伙伴</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Left side - Process and Application */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8">匹配流程</h2>
            <div className="space-y-6 mb-8">
              <div className="flex items-start space-x-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                  !myApplication ? "bg-primary-blue text-white" : "bg-green-500 text-white"
                }`}>
                  {!myApplication ? "1" : <CheckCircle className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">提交申请</h3>
                  <p className="text-gray-600">填写详细的个人背景、研究方向和创业意向</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${
                  myApplication?.status === "approved" ? "bg-green-500 text-white" : 
                  myApplication?.status === "pending" ? "bg-amber-500 text-white" : 
                  "bg-gray-300 text-white"
                }`}>
                  {myApplication?.status === "approved" ? <CheckCircle className="w-4 h-4" /> :
                   myApplication?.status === "pending" ? <Clock className="w-4 h-4" /> : "2"}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">资格审核</h3>
                  <p className="text-gray-600">平台团队将审核您的资料并安排面试</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-gray-300 text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm">3</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">智能匹配</h3>
                  <p className="text-gray-600">基于专业背景和创业方向进行精准匹配</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-gray-300 text-white w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm">4</div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">开始合作</h3>
                  <p className="text-gray-600">与匹配的伙伴交流并开启创业征程</p>
                </div>
              </div>
            </div>

            {!myApplication ? (
              <Dialog open={isApplicationDialogOpen} onOpenChange={setIsApplicationDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="lg" className="bg-primary-blue hover:bg-primary-dark">
                    开始申请
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>创始人匹配申请</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <div>
                      <Label htmlFor="researchField">研究领域</Label>
                      <Select onValueChange={(value) => form.setValue("researchField", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择您的研究领域" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ai">人工智能</SelectItem>
                          <SelectItem value="biotech">生物技术</SelectItem>
                          <SelectItem value="materials">材料科学</SelectItem>
                          <SelectItem value="cs">计算机科学</SelectItem>
                          <SelectItem value="physics">物理学</SelectItem>
                          <SelectItem value="chemistry">化学</SelectItem>
                          <SelectItem value="other">其他</SelectItem>
                        </SelectContent>
                      </Select>
                      {form.formState.errors.researchField && (
                        <p className="text-sm text-red-500 mt-1">
                          {form.formState.errors.researchField.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="startupDirection">创业方向</Label>
                      <Textarea
                        id="startupDirection"
                        {...form.register("startupDirection")}
                        placeholder="请简述您的创业想法和方向"
                        rows={4}
                      />
                      {form.formState.errors.startupDirection && (
                        <p className="text-sm text-red-500 mt-1">
                          {form.formState.errors.startupDirection.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="experience">相关经验</Label>
                      <Textarea
                        id="experience"
                        {...form.register("experience")}
                        placeholder="请描述您的创业经验、项目经历或相关技能"
                        rows={4}
                      />
                    </div>

                    <div>
                      <Label htmlFor="lookingFor">寻找的合作伙伴</Label>
                      <Textarea
                        id="lookingFor"
                        {...form.register("lookingFor")}
                        placeholder="请描述您希望找到什么样的合作伙伴"
                        rows={4}
                      />
                    </div>

                    <div className="flex justify-end space-x-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsApplicationDialogOpen(false)}
                      >
                        取消
                      </Button>
                      <Button
                        type="submit"
                        className="bg-primary-blue hover:bg-primary-dark"
                        disabled={createApplicationMutation.isPending}
                      >
                        {createApplicationMutation.isPending ? "提交中..." : "提交申请"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>您的申请状态</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-medium">申请状态</span>
                    <Badge className={getStatusColor(myApplication.status)}>
                      {getStatusLabel(myApplication.status)}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <span className="font-medium">研究领域：</span>
                      <span className="text-gray-600">{myApplication.researchField}</span>
                    </div>
                    <div>
                      <span className="font-medium">创业方向：</span>
                      <p className="text-gray-600 text-sm">{myApplication.startupDirection}</p>
                    </div>
                    <div>
                      <span className="font-medium">申请时间：</span>
                      <span className="text-gray-600">
                        {new Date(myApplication.createdAt).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                  {myApplication.status === "pending" && (
                    <p className="text-sm text-amber-600 mt-4">
                      您的申请正在审核中，我们将在3个工作日内联系您
                    </p>
                  )}
                  {myApplication.status === "approved" && (
                    <p className="text-sm text-green-600 mt-4">
                      恭喜！您的申请已通过，我们将为您匹配合适的合作伙伴
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right side - Success Stories */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-8">成功匹配案例</h2>
            <div className="space-y-6">
              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <UserCircle className="w-12 h-12 text-gray-400" />
                    <UserCircle className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">AI医疗诊断平台</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    计算机视觉专家与医学博士通过平台匹配，共同创建了AI医疗诊断公司，已完成A轮融资
                  </p>
                  <div className="text-sm text-primary-blue font-medium">
                    融资金额：500万美元
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <UserCircle className="w-12 h-12 text-gray-400" />
                    <UserCircle className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">智能材料科技</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    材料科学博士与机械工程师合作，开发新型智能材料应用，产品已进入量产阶段
                  </p>
                  <div className="text-sm text-primary-blue font-medium">
                    估值：2000万人民币
                  </div>
                </CardContent>
              </Card>

              <Card className="shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <UserCircle className="w-12 h-12 text-gray-400" />
                    <UserCircle className="w-12 h-12 text-gray-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">教育AI平台</h3>
                  <p className="text-gray-600 text-sm mb-4">
                    NLP研究员与教育专家携手打造个性化学习平台，服务超过10万名学生
                  </p>
                  <div className="text-sm text-primary-blue font-medium">
                    用户数：100k+
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Matches Section */}
        {myApplication?.status === "approved" && matches.length > 0 && (
          <div className="mt-16">
            <h2 className="text-2xl font-bold text-gray-900 mb-8">推荐匹配</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {matches.map((match) => (
                <Card key={match.id} className="hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <UserCircle className="w-12 h-12 text-gray-400" />
                      <Badge variant="outline">匹配度: {match.matchScore}%</Badge>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">潜在合作伙伴</h3>
                    <p className="text-gray-600 text-sm mb-4">
                      基于您的背景和需求，我们为您推荐了这位合作伙伴
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1">
                        <Send className="w-4 h-4 mr-1" />
                        发送消息
                      </Button>
                      <Button size="sm" variant="outline">
                        查看详情
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
