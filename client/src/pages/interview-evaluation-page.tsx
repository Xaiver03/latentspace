import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  LuCalendar, 
  LuClock, 
  LuUser, 
  LuStar,
  LuCheck,
  LuX,
  LuTriangleAlert,
  LuVideo,
  LuFileText,
  LuThumbsUp,
  LuThumbsDown,
  LuMessageSquare
} from "react-icons/lu";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";

interface InterviewSchedule {
  id: number;
  candidateId: number;
  interviewerId: number;
  scheduledDate: string;
  meetingLink?: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  rating?: number;
  feedback?: string;
  recommendation?: 'approved' | 'rejected' | 'needs_more_info';
  notes?: string;
  candidate: {
    id: number;
    fullName: string;
    email: string;
    avatarUrl?: string;
    researchField?: string;
    affiliation?: string;
  };
  application: {
    id: number;
    researchField: string;
    startupDirection: string;
    experience?: string;
    lookingFor?: string;
    applicationType: 'basic' | 'advanced';
  };
}

interface EvaluationForm {
  rating: number;
  feedback: string;
  recommendation: 'approved' | 'rejected' | 'needs_more_info';
  technicalSkills: number;
  businessAcumen: number;
  communication: number;
  entrepreneurialMindset: number;
  teamCollaboration: number;
  notes: string;
}

export function InterviewEvaluationPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedInterview, setSelectedInterview] = useState<InterviewSchedule | null>(null);
  const [evaluationForm, setEvaluationForm] = useState<EvaluationForm>({
    rating: 3,
    feedback: '',
    recommendation: 'needs_more_info',
    technicalSkills: 3,
    businessAcumen: 3,
    communication: 3,
    entrepreneurialMindset: 3,
    teamCollaboration: 3,
    notes: ''
  });

  // Fetch interviews for evaluation
  const { data: interviews, isLoading } = useQuery<InterviewSchedule[]>({
    queryKey: ["/api/admin/interviews"],
    queryFn: async () => {
      const response = await fetch("/api/admin/interviews", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch interviews");
      return response.json();
    }
  });

  // Submit evaluation mutation
  const submitEvaluation = useMutation({
    mutationFn: async (data: { interviewId: number; evaluation: EvaluationForm }) => {
      const response = await fetch(`/api/interviews/${data.interviewId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.evaluation),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to submit evaluation");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "评估已提交",
        description: "面试评估已成功保存",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/interviews"] });
      setSelectedInterview(null);
      setEvaluationForm({
        rating: 3,
        feedback: '',
        recommendation: 'needs_more_info',
        technicalSkills: 3,
        businessAcumen: 3,
        communication: 3,
        entrepreneurialMindset: 3,
        teamCollaboration: 3,
        notes: ''
      });
    },
    onError: (error) => {
      toast({
        title: "提交失败",
        description: "评估提交失败，请重试",
        variant: "destructive",
      });
    }
  });

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: "secondary" as const, label: "待确认", icon: LuClock },
      confirmed: { variant: "default" as const, label: "已确认", icon: LuCheck },
      completed: { variant: "secondary" as const, label: "已完成", icon: LuCheck },
      cancelled: { variant: "destructive" as const, label: "已取消", icon: LuX },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getRecommendationBadge = (recommendation?: string) => {
    if (!recommendation) return null;
    
    const config = {
      approved: { variant: "default" as const, label: "通过", icon: LuThumbsUp, color: "text-green-600" },
      rejected: { variant: "destructive" as const, label: "未通过", icon: LuThumbsDown, color: "text-red-600" },
      needs_more_info: { variant: "secondary" as const, label: "需更多信息", icon: LuTriangleAlert, color: "text-yellow-600" },
    };
    
    const recConfig = config[recommendation as keyof typeof config];
    if (!recConfig) return null;
    
    const Icon = recConfig.icon;
    
    return (
      <Badge variant={recConfig.variant} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {recConfig.label}
      </Badge>
    );
  };

  const StarRating = ({ value, onChange, label }: { value: number; onChange: (value: number) => void; label: string }) => (
    <div className="space-y-2">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className={`transition-colors ${
              star <= value ? 'text-yellow-400' : 'text-gray-300'
            } hover:text-yellow-400`}
          >
            <LuStar className="h-5 w-5 fill-current" />
          </button>
        ))}
      </div>
    </div>
  );

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">加载面试列表...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">面试评估管理</h1>
        <p className="text-muted-foreground">管理和评估申请人面试</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Interview List */}
        <div className="lg:col-span-1 space-y-4">
          <h3 className="text-lg font-semibold">待评估面试</h3>
          
          {interviews && interviews.length > 0 ? (
            <div className="space-y-3">
              {interviews
                .filter(interview => interview.status === 'completed' || interview.status === 'confirmed')
                .map((interview) => (
                <Card 
                  key={interview.id} 
                  className={`cursor-pointer transition-colors ${
                    selectedInterview?.id === interview.id ? 'ring-2 ring-primary' : 'hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedInterview(interview)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={interview.candidate.avatarUrl} />
                        <AvatarFallback>{interview.candidate.fullName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{interview.candidate.fullName}</h4>
                        <p className="text-sm text-muted-foreground truncate">
                          {interview.candidate.affiliation}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <LuCalendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(interview.scheduledDate), 'MM月dd日 HH:mm', { locale: zhCN })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {getStatusBadge(interview.status)}
                          {getRecommendationBadge(interview.recommendation)}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <LuFileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">暂无待评估的面试</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Interview Details and Evaluation */}
        <div className="lg:col-span-2">
          {selectedInterview ? (
            <div className="space-y-6">
              {/* Interview Details */}
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={selectedInterview.candidate.avatarUrl} />
                          <AvatarFallback>{selectedInterview.candidate.fullName[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="text-xl">{selectedInterview.candidate.fullName}</h3>
                          <p className="text-muted-foreground">{selectedInterview.candidate.email}</p>
                        </div>
                      </CardTitle>
                    </div>
                    <div className="flex flex-col gap-2">
                      {getStatusBadge(selectedInterview.status)}
                      {getRecommendationBadge(selectedInterview.recommendation)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">面试时间</Label>
                      <p className="flex items-center gap-2 text-sm">
                        <LuCalendar className="h-4 w-4" />
                        {format(new Date(selectedInterview.scheduledDate), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                      </p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium">申请类型</Label>
                      <p className="text-sm">
                        <Badge variant="outline">
                          {selectedInterview.application.applicationType === 'advanced' ? '深度申请' : '基础申请'}
                        </Badge>
                      </p>
                    </div>
                  </div>

                  {selectedInterview.meetingLink && (
                    <div>
                      <Label className="text-sm font-medium">会议链接</Label>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" asChild>
                          <a href={selectedInterview.meetingLink} target="_blank" rel="noopener noreferrer">
                            <LuVideo className="mr-2 h-4 w-4" />
                            加入会议
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}

                  <div>
                    <Label className="text-sm font-medium">研究领域</Label>
                    <p className="text-sm">{selectedInterview.application.researchField}</p>
                  </div>

                  <div>
                    <Label className="text-sm font-medium">创业方向</Label>
                    <p className="text-sm">{selectedInterview.application.startupDirection}</p>
                  </div>

                  {selectedInterview.application.experience && (
                    <div>
                      <Label className="text-sm font-medium">相关经验</Label>
                      <p className="text-sm">{selectedInterview.application.experience}</p>
                    </div>
                  )}

                  {selectedInterview.application.lookingFor && (
                    <div>
                      <Label className="text-sm font-medium">寻找合伙人</Label>
                      <p className="text-sm">{selectedInterview.application.lookingFor}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Evaluation Form */}
              {(!selectedInterview.recommendation || selectedInterview.recommendation === 'needs_more_info') && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LuMessageSquare className="h-5 w-5" />
                      面试评估
                    </CardTitle>
                    <CardDescription>
                      请对候选人的面试表现进行全面评估
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Overall Rating */}
                    <div>
                      <StarRating
                        value={evaluationForm.rating}
                        onChange={(value) => setEvaluationForm(prev => ({ ...prev, rating: value }))}
                        label="总体评分"
                      />
                    </div>

                    {/* Detailed Ratings */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <StarRating
                        value={evaluationForm.technicalSkills}
                        onChange={(value) => setEvaluationForm(prev => ({ ...prev, technicalSkills: value }))}
                        label="技术能力"
                      />
                      <StarRating
                        value={evaluationForm.businessAcumen}
                        onChange={(value) => setEvaluationForm(prev => ({ ...prev, businessAcumen: value }))}
                        label="商业敏锐度"
                      />
                      <StarRating
                        value={evaluationForm.communication}
                        onChange={(value) => setEvaluationForm(prev => ({ ...prev, communication: value }))}
                        label="沟通能力"
                      />
                      <StarRating
                        value={evaluationForm.entrepreneurialMindset}
                        onChange={(value) => setEvaluationForm(prev => ({ ...prev, entrepreneurialMindset: value }))}
                        label="创业思维"
                      />
                      <StarRating
                        value={evaluationForm.teamCollaboration}
                        onChange={(value) => setEvaluationForm(prev => ({ ...prev, teamCollaboration: value }))}
                        label="团队协作"
                      />
                    </div>

                    {/* Recommendation */}
                    <div>
                      <Label className="text-sm font-medium mb-3 block">审核决策</Label>
                      <RadioGroup
                        value={evaluationForm.recommendation}
                        onValueChange={(value) => setEvaluationForm(prev => ({ 
                          ...prev, 
                          recommendation: value as 'approved' | 'rejected' | 'needs_more_info' 
                        }))}
                        className="flex gap-6"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="approved" id="approved" />
                          <Label htmlFor="approved" className="flex items-center gap-2 cursor-pointer">
                            <LuThumbsUp className="h-4 w-4 text-green-600" />
                            通过
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="rejected" id="rejected" />
                          <Label htmlFor="rejected" className="flex items-center gap-2 cursor-pointer">
                            <LuThumbsDown className="h-4 w-4 text-red-600" />
                            未通过
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="needs_more_info" id="needs_more_info" />
                          <Label htmlFor="needs_more_info" className="flex items-center gap-2 cursor-pointer">
                            <LuTriangleAlert className="h-4 w-4 text-yellow-600" />
                            需更多信息
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Feedback */}
                    <div>
                      <Label htmlFor="feedback" className="text-sm font-medium">面试反馈</Label>
                      <Textarea
                        id="feedback"
                        placeholder="请详细描述候选人的面试表现、优势和改进点..."
                        value={evaluationForm.feedback}
                        onChange={(e) => setEvaluationForm(prev => ({ ...prev, feedback: e.target.value }))}
                        className="mt-2"
                        rows={4}
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <Label htmlFor="notes" className="text-sm font-medium">内部备注</Label>
                      <Textarea
                        id="notes"
                        placeholder="内部备注（不会分享给候选人）..."
                        value={evaluationForm.notes}
                        onChange={(e) => setEvaluationForm(prev => ({ ...prev, notes: e.target.value }))}
                        className="mt-2"
                        rows={3}
                      />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setSelectedInterview(null)}
                      >
                        取消
                      </Button>
                      <Button
                        onClick={() => submitEvaluation.mutate({
                          interviewId: selectedInterview.id,
                          evaluation: evaluationForm
                        })}
                        disabled={submitEvaluation.isPending}
                      >
                        {submitEvaluation.isPending ? "提交中..." : "提交评估"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Existing Evaluation Display */}
              {selectedInterview.recommendation && selectedInterview.recommendation !== 'needs_more_info' && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LuFileText className="h-5 w-5" />
                      评估结果
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div>
                        <Label className="text-sm font-medium">总体评分</Label>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <LuStar
                              key={star}
                              className={`h-4 w-4 ${
                                star <= (selectedInterview.rating || 0) ? 'text-yellow-400 fill-current' : 'text-gray-300'
                              }`}
                            />
                          ))}
                          <span className="ml-2 text-sm text-muted-foreground">
                            {selectedInterview.rating || 0}/5
                          </span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-sm font-medium">审核结果</Label>
                        <div className="mt-1">
                          {getRecommendationBadge(selectedInterview.recommendation)}
                        </div>
                      </div>
                    </div>

                    {selectedInterview.feedback && (
                      <div>
                        <Label className="text-sm font-medium">面试反馈</Label>
                        <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                          {selectedInterview.feedback}
                        </p>
                      </div>
                    )}

                    {selectedInterview.notes && (
                      <div>
                        <Label className="text-sm font-medium">内部备注</Label>
                        <p className="text-sm mt-1 p-3 bg-muted rounded-md">
                          {selectedInterview.notes}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <LuUser className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">请选择一个面试进行评估</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}