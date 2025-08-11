import { useState } from "react";
import { Link } from "wouter";
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
import { Calendar, Users, MapPin, Plus, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertEventSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";
import type { Event } from "@shared/schema";

const eventFormSchema = insertEventSchema.extend({
  date: z.string().min(1, "请选择活动日期"),
});

type EventForm = z.infer<typeof eventFormSchema>;

export default function EventsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: events = [], isLoading } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: registrations = [] } = useQuery({
    queryKey: ["/api/events/registrations", user?.id],
    enabled: !!user,
  });

  const registerMutation = useMutation({
    mutationFn: async (eventId: number) => {
      return await apiRequest("POST", `/api/events/${eventId}/register`);
    },
    onSuccess: () => {
      toast({
        title: "报名成功",
        description: "您已成功报名参加活动",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/events/registrations"] });
    },
    onError: (error: any) => {
      let errorMessage = "报名时发生错误，请重试";
      
      if (error?.status === 409) {
        if (error.error?.includes("Event is full")) {
          errorMessage = "活动已满员，无法报名";
        } else if (error.error?.includes("Already registered")) {
          errorMessage = "您已经报名了此活动";
        }
      } else if (error?.status === 404) {
        errorMessage = "活动不存在";
      } else if (error?.status === 401) {
        errorMessage = "请先登录";
      }
      
      toast({
        title: "报名失败",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (eventData: EventForm) => {
      const { date, ...rest } = eventData;
      return await apiRequest("POST", "/api/events", {
        ...rest,
        date: new Date(date).toISOString(),
      });
    },
    onSuccess: () => {
      toast({
        title: "活动创建成功",
        description: "您的活动已成功创建",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "创建失败",
        description: "创建活动时发生错误，请重试",
        variant: "destructive",
      });
    },
  });

  const form = useForm<EventForm>({
    resolver: zodResolver(eventFormSchema),
    defaultValues: {
      title: "",
      description: "",
      date: "",
      location: "",
      category: "tech_share",
      maxAttendees: 50,
      imageUrl: "",
    },
  });

  const filteredEvents = events.filter(event => {
    const matchesFilter = filter === "all" || event.category === filter;
    const matchesSearch = searchTerm === "" || 
      event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      event.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const onSubmit = (data: EventForm) => {
    createEventMutation.mutate(data);
  };

  const handleRegister = (eventId: number) => {
    registerMutation.mutate(eventId);
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "tech_share":
        return "技术分享";
      case "startup_share":
        return "创业分享";
      case "networking":
        return "网络聚会";
      default:
        return category;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "tech_share":
        return "bg-blue-100 text-blue-800";
      case "startup_share":
        return "bg-green-100 text-green-800";
      case "networking":
        return "bg-amber-100 text-amber-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">活动中心</h1>
            <p className="text-gray-600">参与前沿技术分享和创业经验交流</p>
          </div>
          
          {user && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary-blue hover:bg-primary-dark">
                  <Plus className="w-4 h-4 mr-2" />
                  创建活动
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>创建新活动</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="title">活动标题</Label>
                    <Input
                      id="title"
                      {...form.register("title")}
                      placeholder="请输入活动标题"
                    />
                    {form.formState.errors.title && (
                      <p className="text-sm text-red-500 mt-1">
                        {form.formState.errors.title.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description">活动描述</Label>
                    <Textarea
                      id="description"
                      {...form.register("description")}
                      placeholder="请描述活动内容"
                      rows={4}
                    />
                    {form.formState.errors.description && (
                      <p className="text-sm text-red-500 mt-1">
                        {form.formState.errors.description.message}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="date">活动日期</Label>
                      <Input
                        id="date"
                        type="datetime-local"
                        {...form.register("date")}
                      />
                      {form.formState.errors.date && (
                        <p className="text-sm text-red-500 mt-1">
                          {form.formState.errors.date.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="location">活动地点</Label>
                      <Input
                        id="location"
                        {...form.register("location")}
                        placeholder="请输入活动地点"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="category">活动类型</Label>
                      <Select onValueChange={(value) => form.setValue("category", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择活动类型" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tech_share">技术分享</SelectItem>
                          <SelectItem value="startup_share">创业分享</SelectItem>
                          <SelectItem value="networking">网络聚会</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="maxAttendees">最大参与人数</Label>
                      <Input
                        id="maxAttendees"
                        type="number"
                        {...form.register("maxAttendees", { valueAsNumber: true })}
                        placeholder="50"
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="imageUrl">活动图片链接（可选）</Label>
                    <Input
                      id="imageUrl"
                      {...form.register("imageUrl")}
                      placeholder="https://example.com/image.jpg"
                    />
                  </div>

                  <div className="flex justify-end space-x-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      取消
                    </Button>
                    <Button
                      type="submit"
                      className="bg-primary-blue hover:bg-primary-dark"
                      disabled={createEventMutation.isPending}
                    >
                      {createEventMutation.isPending ? "创建中..." : "创建活动"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-8">
          <div className="flex gap-2">
            <Button
              variant={filter === "all" ? "default" : "outline"}
              onClick={() => setFilter("all")}
              className={filter === "all" ? "bg-primary-blue" : ""}
            >
              全部活动
            </Button>
            <Button
              variant={filter === "tech_share" ? "default" : "outline"}
              onClick={() => setFilter("tech_share")}
              className={filter === "tech_share" ? "bg-primary-blue" : ""}
            >
              技术分享
            </Button>
            <Button
              variant={filter === "startup_share" ? "default" : "outline"}
              onClick={() => setFilter("startup_share")}
              className={filter === "startup_share" ? "bg-primary-blue" : ""}
            >
              创业分享
            </Button>
            <Button
              variant={filter === "networking" ? "default" : "outline"}
              onClick={() => setFilter("networking")}
              className={filter === "networking" ? "bg-primary-blue" : ""}
            >
              网络聚会
            </Button>
          </div>
          
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="搜索活动..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Events Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <CardContent className="p-6">
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                  <div className="h-20 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredEvents.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredEvents.map((event) => (
              <Card key={event.id} className="hover:shadow-xl transition-shadow cursor-pointer">
                <Link href={`/platform/events/${event.id}`} className="block">
                  {event.imageUrl && (
                    <div className="h-48 overflow-hidden rounded-t-lg">
                      <img 
                        src={event.imageUrl} 
                        alt={event.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={getCategoryColor(event.category)}>
                        {getCategoryLabel(event.category)}
                      </Badge>
                      <span className="text-gray-500 text-sm">
                        {new Date(event.date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{event.title}</h3>
                    <p className="text-gray-600 text-sm mb-4 line-clamp-3">{event.description}</p>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center text-gray-500 text-sm">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>{new Date(event.date).toLocaleString('zh-CN')}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center text-gray-500 text-sm">
                          <MapPin className="w-4 h-4 mr-2" />
                          <span>{event.location}</span>
                        </div>
                      )}
                      <div className="flex items-center text-gray-500 text-sm">
                        <Users className="w-4 h-4 mr-2" />
                        <span>
                          已报名 {event.currentAttendees || 0}人
                          {event.maxAttendees && ` / ${event.maxAttendees}人`}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Link>
                {user && (
                  <div className="px-6 pb-6 space-y-2">
                    <Button
                      onClick={(e) => {
                        e.preventDefault();
                        handleRegister(event.id);
                      }}
                      disabled={registerMutation.isPending}
                      className="w-full bg-primary-blue hover:bg-primary-dark"
                    >
                      {registerMutation.isPending ? "报名中..." : "立即报名"}
                    </Button>
                    <Link href={`/platform/events/${event.id}`} className="block">
                      <Button variant="outline" className="w-full">
                        查看详情
                      </Button>
                    </Link>
                  </div>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无活动</h3>
            <p className="text-gray-500">
              {searchTerm ? "没有找到匹配的活动" : "请稍后查看最新活动信息"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
