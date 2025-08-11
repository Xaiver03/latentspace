import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "@/hooks/use-toast";
import { 
  Sparkles, 
  TrendingUp, 
  BookOpen, 
  Users, 
  ExternalLink,
  Play,
  Download,
  Eye,
  Calendar,
  MapPin,
  Star,
  Heart,
  Share2,
  ChevronRight,
  Filter,
  Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import Navbar from "@/components/navbar";

interface ContentItem {
  id: string;
  type: 'event' | 'agent_product' | 'event_content';
  title: string;
  description: string;
  category?: string;
  tags: string[];
  score: number;
  reason: string;
  metadata: Record<string, any>;
}

interface PersonalizedFeed {
  userId: number;
  trending: ContentItem[];
  recommended: ContentItem[];
  interests: ContentItem[];
  collaborative: ContentItem[];
}

interface ContentAnalytics {
  totalViews: number;
  engagement: number;
  topCategories: string[];
  trendingTags: string[];
  userPreferences: Record<string, number>;
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

export default function ContentDiscoveryPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const { data: feed, isLoading: feedLoading, refetch } = useQuery<PersonalizedFeed>({
    queryKey: ["/api/content/feed"],
    queryFn: () => apiRequest("GET", "/api/content/feed?limit=40"),
    enabled: !!user,
  });

  const { data: analytics, isLoading: analyticsLoading } = useQuery<ContentAnalytics>({
    queryKey: ["/api/content/analytics"],
    queryFn: () => apiRequest("GET", "/api/content/analytics"),
    enabled: !!user,
  });

  const trackInteractionMutation = useMutation({
    mutationFn: ({ contentType, contentId, action, metadata }: any) =>
      apiRequest("POST", "/api/content/track-interaction", { 
        contentType, 
        contentId, 
        action, 
        metadata 
      }),
  });

  const handleInteraction = (item: ContentItem, action: 'view' | 'like' | 'share') => {
    const contentId = parseInt(item.id.split('-')[1]);
    trackInteractionMutation.mutate({
      contentType: item.type,
      contentId,
      action,
      metadata: { reason: item.reason, score: item.score }
    });

    if (action === 'like') {
      toast({
        title: "已收藏",
        description: `${item.title} 已添加到您的收藏`,
      });
    }
  };

  const renderContentCard = (item: ContentItem) => (
    <Card 
      key={item.id} 
      className="group hover:shadow-lg transition-all duration-200 cursor-pointer border-l-4 border-blue-500"
      onClick={() => handleInteraction(item, 'view')}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <Badge variant="secondary" className="text-xs">
                {item.reason}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {item.type === 'event' ? '活动' : 
                 item.type === 'agent_product' ? '产品' : '内容'}
              </Badge>
            </div>
            <CardTitle className="text-lg group-hover:text-blue-600 transition-colors">
              {item.title}
            </CardTitle>
            <p className="text-sm text-gray-600 mt-2 line-clamp-2">
              {item.description}
            </p>
          </div>
          <div className="flex items-center space-x-1 text-yellow-500">
            <Star className="w-4 h-4 fill-current" />
            <span className="text-sm font-medium">{item.score.toFixed(1)}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap gap-1">
            {item.tags.slice(0, 3).map((tag, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
            {item.category && (
              <Badge variant="secondary" className="text-xs">
                {item.category}
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleInteraction(item, 'like');
              }}
              className="h-8 w-8 p-0"
            >
              <Heart className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                handleInteraction(item, 'share');
              }}
              className="h-8 w-8 p-0"
            >
              <Share2 className="w-4 h-4" />
            </Button>
            {item.type === 'event' && (
              <Button size="sm" variant="outline" className="h-8">
                <Calendar className="w-3 h-3 mr-1" />
                报名
              </Button>
            )}
            {item.type === 'agent_product' && item.metadata.demoUrl && (
              <Button size="sm" variant="outline" className="h-8">
                <ExternalLink className="w-3 h-3 mr-1" />
                体验
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (!user) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p>请先登录以查看个性化内容推荐</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50">
      <Navbar />
      <div className="container mx-auto py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">智能内容发现 ✨</h1>
          <p className="text-gray-600">基于AI的个性化内容推荐，发现最适合您的学习资源</p>
        </div>

        {/* Search and Filter Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="搜索内容..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                筛选
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => refetch()}
              >
                刷新推荐
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Overview */}
        {!analyticsLoading && analytics && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-blue-600">{analytics.totalViews}</div>
                <div className="text-sm text-gray-600">总浏览量</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-green-600">{analytics.engagement.toFixed(1)}%</div>
                <div className="text-sm text-gray-600">参与度</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <div className="text-2xl font-bold text-purple-600">{analytics.topCategories.length}</div>
                <div className="text-sm text-gray-600">热门分类</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="recommended" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="recommended">为您推荐</TabsTrigger>
            <TabsTrigger value="trending">热门内容</TabsTrigger>
            <TabsTrigger value="interests">兴趣匹配</TabsTrigger>
            <TabsTrigger value="collaborative">同行推荐</TabsTrigger>
          </TabsList>

          <TabsContent value="recommended" className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <Sparkles className="w-5 h-5 text-purple-500" />
              <h2 className="text-xl font-semibold">AI 智能推荐</h2>
              <Badge className="bg-purple-100 text-purple-700">个性化</Badge>
            </div>

            {feedLoading ? (
              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-6">
                      <div className="animate-pulse">
                        <div className="h-6 bg-gray-200 rounded mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded mb-4"></div>
                        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {feed?.recommended.map(renderContentCard)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trending" className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <TrendingUp className="w-5 h-5 text-orange-500" />
              <h2 className="text-xl font-semibold">热门趋势</h2>
              <Badge className="bg-orange-100 text-orange-700">实时更新</Badge>
            </div>

            <div className="space-y-4">
              {feed?.trending.map(renderContentCard)}
            </div>
          </TabsContent>

          <TabsContent value="interests" className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <BookOpen className="w-5 h-5 text-blue-500" />
              <h2 className="text-xl font-semibold">兴趣匹配</h2>
              <Badge className="bg-blue-100 text-blue-700">基于研究领域</Badge>
            </div>

            <div className="space-y-4">
              {feed?.interests.map(renderContentCard)}
            </div>
          </TabsContent>

          <TabsContent value="collaborative" className="space-y-6">
            <div className="flex items-center space-x-2 mb-4">
              <Users className="w-5 h-5 text-green-500" />
              <h2 className="text-xl font-semibold">同行推荐</h2>
              <Badge className="bg-green-100 text-green-700">协同发现</Badge>
            </div>

            <div className="space-y-4">
              {feed?.collaborative.map(renderContentCard)}
            </div>
          </TabsContent>
        </Tabs>

        {/* Trending Tags */}
        {!analyticsLoading && analytics?.trendingTags && analytics.trendingTags.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Star className="w-5 h-5 mr-2" />
                热门标签
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {analytics?.trendingTags?.map((tag, index) => (
                  <Badge 
                    key={index} 
                    variant="outline" 
                    className="cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors"
                    onClick={() => setSearchTerm(tag)}
                  >
                    #{tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}