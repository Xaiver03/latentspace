import { useState, useEffect } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { formatDate } from "date-fns";
import { Calendar, MapPin, Users, ArrowLeft, Upload, Download, Eye, Star, Tag, FileText, Video, Presentation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

interface EventContent {
  id: number;
  eventId: number;
  type: string;
  title: string;
  description?: string;
  url: string;
  metadata?: any;
  uploadedBy: number;
  uploadedAt: string;
  viewCount: number;
  downloadCount: number;
}

interface EventFeedback {
  id: number;
  eventId: number;
  userId: number;
  rating: number;
  content?: string;
  isAnonymous: boolean;
  createdAt: string;
}

interface EventTag {
  id: number;
  eventId: number;
  tag: string;
  createdAt: string;
}

const contentTypeIcons = {
  slide: Presentation,
  recording: Video,
  summary: FileText,
  material: FileText,
};

export function EventDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const eventId = parseInt(params.id || "0");
  
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [rating, setRating] = useState(5);
  const [feedbackContent, setFeedbackContent] = useState("");
  const [contentForm, setContentForm] = useState({
    type: "slide",
    title: "",
    description: "",
    url: "",
  });

  // Fetch event details
  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("Failed to fetch event");
      return res.json();
    },
  });

  // Fetch event contents
  const { data: contents = [] } = useQuery({
    queryKey: ["event-contents", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/contents`);
      if (!res.ok) throw new Error("Failed to fetch contents");
      return res.json();
    },
  });

  // Fetch event feedback
  const { data: feedbackData } = useQuery({
    queryKey: ["event-feedback", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/feedback`);
      if (!res.ok) throw new Error("Failed to fetch feedback");
      return res.json();
    },
  });

  // Fetch event tags
  const { data: tags = [] } = useQuery({
    queryKey: ["event-tags", eventId],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/tags`);
      if (!res.ok) throw new Error("Failed to fetch tags");
      return res.json();
    },
  });

  // Check if user is registered
  const { data: registrations = [] } = useQuery({
    queryKey: ["my-registrations"],
    queryFn: async () => {
      const res = await fetch("/api/my-registrations");
      if (!res.ok) throw new Error("Failed to fetch registrations");
      return res.json();
    },
  });

  const isRegistered = registrations.some((r: any) => r.eventId === eventId);
  const isEventCreator = event?.createdBy === user?.id;
  const isAdmin = user?.role === "admin";
  const canManageContent = isEventCreator || isAdmin;

  // Register for event
  const registerMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/register`, {
        method: "POST",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to register");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["event", eventId] });
      toast({
        title: "注册成功",
        description: "您已成功注册此活动",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "注册失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Upload content
  const uploadContentMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/contents`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contentForm),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to upload content");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-contents", eventId] });
      toast({
        title: "上传成功",
        description: "内容已成功上传",
      });
      setShowUploadForm(false);
      setContentForm({ type: "slide", title: "", description: "", url: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "上传失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Submit feedback
  const submitFeedbackMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, content: feedbackContent }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to submit feedback");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-feedback", eventId] });
      toast({
        title: "反馈提交成功",
        description: "感谢您的反馈",
      });
      setShowFeedbackForm(false);
      setRating(5);
      setFeedbackContent("");
    },
    onError: (error: Error) => {
      toast({
        title: "提交失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Add tag
  const addTagMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/events/${eventId}/tags`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tag: newTag }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to add tag");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-tags", eventId] });
      toast({
        title: "标签添加成功",
      });
      setNewTag("");
    },
    onError: (error: Error) => {
      toast({
        title: "添加失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete content
  const deleteContentMutation = useMutation({
    mutationFn: async (contentId: number) => {
      const res = await fetch(`/api/event-contents/${contentId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to delete content");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["event-contents", eventId] });
      toast({
        title: "删除成功",
        description: "内容已删除",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "删除失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // View content
  const viewContent = async (content: EventContent) => {
    // Track view
    await fetch(`/api/event-contents/${content.id}`);
    // Open content
    window.open(content.url, "_blank");
  };

  if (eventLoading) {
    return <div className="container py-8">加载中...</div>;
  }

  if (!event) {
    return <div className="container py-8">活动未找到</div>;
  }

  const eventDate = new Date(event.date);
  const isPastEvent = eventDate < new Date();
  const attendanceRate = event.maxAttendees > 0 
    ? (event.currentAttendees / event.maxAttendees) * 100 
    : 0;

  return (
    <div className="container py-8">
      <Link href="/platform/events">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回活动列表
        </Button>
      </Link>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          {/* Event Header */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-2xl">{event.title}</CardTitle>
                  <CardDescription className="mt-2">
                    <Badge variant={event.category === "tech_share" ? "default" : "secondary"}>
                      {event.category === "tech_share" ? "技术分享" : 
                       event.category === "startup_share" ? "创业分享" : "社交活动"}
                    </Badge>
                  </CardDescription>
                </div>
                {!isPastEvent && (
                  <Button
                    onClick={() => registerMutation.mutate()}
                    disabled={isRegistered || registerMutation.isPending}
                  >
                    {isRegistered ? "已注册" : "注册参加"}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">{event.description}</p>
              
              <div className="grid gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>{formatDate(eventDate, "yyyy年MM月dd日 HH:mm")}</span>
                </div>
                {event.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{event.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{event.currentAttendees} / {event.maxAttendees} 人</span>
                </div>
              </div>

              {event.maxAttendees > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>报名进度</span>
                    <span>{Math.round(attendanceRate)}%</span>
                  </div>
                  <Progress value={attendanceRate} />
                </div>
              )}

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {tags.map((tag: EventTag) => (
                  <Badge key={tag.id} variant="outline">
                    <Tag className="mr-1 h-3 w-3" />
                    {tag.tag}
                  </Badge>
                ))}
                {canManageContent && (
                  <div className="flex gap-2">
                    <Input
                      placeholder="添加标签"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      className="h-6 w-24 text-xs"
                      onKeyPress={(e) => {
                        if (e.key === "Enter" && newTag.trim()) {
                          addTagMutation.mutate();
                        }
                      }}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Content Tabs */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>活动内容</CardTitle>
                {canManageContent && (
                  <Button
                    size="sm"
                    onClick={() => setShowUploadForm(!showUploadForm)}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    上传内容
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {showUploadForm && (
                <div className="mb-6 p-4 border rounded-lg space-y-4">
                  <Select
                    value={contentForm.type}
                    onValueChange={(value) => setContentForm({ ...contentForm, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="slide">演示文稿</SelectItem>
                      <SelectItem value="recording">录像回放</SelectItem>
                      <SelectItem value="summary">活动总结</SelectItem>
                      <SelectItem value="material">相关资料</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="内容标题"
                    value={contentForm.title}
                    onChange={(e) => setContentForm({ ...contentForm, title: e.target.value })}
                  />
                  <Textarea
                    placeholder="内容描述（可选）"
                    value={contentForm.description}
                    onChange={(e) => setContentForm({ ...contentForm, description: e.target.value })}
                  />
                  <Input
                    placeholder="内容链接"
                    value={contentForm.url}
                    onChange={(e) => setContentForm({ ...contentForm, url: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={() => uploadContentMutation.mutate()}
                      disabled={!contentForm.title || !contentForm.url || uploadContentMutation.isPending}
                    >
                      上传
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowUploadForm(false)}
                    >
                      取消
                    </Button>
                  </div>
                </div>
              )}

              <Tabs defaultValue="all">
                <TabsList>
                  <TabsTrigger value="all">全部</TabsTrigger>
                  <TabsTrigger value="slide">演示文稿</TabsTrigger>
                  <TabsTrigger value="recording">录像</TabsTrigger>
                  <TabsTrigger value="summary">总结</TabsTrigger>
                  <TabsTrigger value="material">资料</TabsTrigger>
                </TabsList>
                
                {["all", "slide", "recording", "summary", "material"].map((type) => (
                  <TabsContent key={type} value={type} className="space-y-4">
                    {contents
                      .filter((c: EventContent) => type === "all" || c.type === type)
                      .map((content: EventContent) => {
                        const Icon = contentTypeIcons[content.type as keyof typeof contentTypeIcons] || FileText;
                        return (
                          <div
                            key={content.id}
                            className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <Icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                              <div>
                                <h4 className="font-medium">{content.title}</h4>
                                {content.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {content.description}
                                  </p>
                                )}
                                <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Eye className="h-3 w-3" />
                                    {content.viewCount} 次查看
                                  </span>
                                  <span className="flex items-center gap-1">
                                    <Download className="h-3 w-3" />
                                    {content.downloadCount} 次下载
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => viewContent(content)}
                              >
                                查看
                              </Button>
                              {canManageContent && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => deleteContentMutation.mutate(content.id)}
                                >
                                  删除
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {contents.filter((c: EventContent) => type === "all" || c.type === type).length === 0 && (
                      <p className="text-center text-muted-foreground py-8">
                        暂无内容
                      </p>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Feedback Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5" />
                活动反馈
              </CardTitle>
            </CardHeader>
            <CardContent>
              {feedbackData && (
                <div className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold">
                      {feedbackData.averageRating.toFixed(1)}
                    </div>
                    <div className="flex justify-center gap-1 my-2">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${
                            i <= Math.round(feedbackData.averageRating)
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {feedbackData.totalReviews} 条评价
                    </p>
                  </div>

                  {isPastEvent && isRegistered && !feedbackData.feedback.some((f: any) => f.userId === user?.id) && (
                    <Button
                      className="w-full"
                      onClick={() => setShowFeedbackForm(true)}
                    >
                      提交反馈
                    </Button>
                  )}

                  {showFeedbackForm && (
                    <div className="space-y-4 p-4 border rounded-lg">
                      <div>
                        <label className="text-sm font-medium">评分</label>
                        <div className="flex gap-2 mt-2">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <button
                              key={i}
                              onClick={() => setRating(i)}
                              className="p-1"
                            >
                              <Star
                                className={`h-6 w-6 ${
                                  i <= rating
                                    ? "fill-yellow-400 text-yellow-400"
                                    : "text-gray-300"
                                } hover:text-yellow-400 transition-colors`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                      <Textarea
                        placeholder="分享您的体验..."
                        value={feedbackContent}
                        onChange={(e) => setFeedbackContent(e.target.value)}
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => submitFeedbackMutation.mutate()}
                          disabled={submitFeedbackMutation.isPending}
                        >
                          提交
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => setShowFeedbackForm(false)}
                        >
                          取消
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {feedbackData.feedback.slice(0, 5).map((feedback: EventFeedback) => (
                      <div key={feedback.id} className="p-3 border rounded-lg">
                        <div className="flex gap-1 mb-2">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i <= feedback.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "text-gray-300"
                              }`}
                            />
                          ))}
                        </div>
                        {feedback.content && (
                          <p className="text-sm text-muted-foreground">
                            {feedback.content}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          {formatDate(new Date(feedback.createdAt), "yyyy-MM-dd")}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}