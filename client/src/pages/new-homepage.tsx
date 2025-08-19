import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Calendar, 
  Users, 
  Brain, 
  ShoppingBag,
  BookOpen,
  ArrowRight, 
  Clock,
  MessageSquare,
  TrendingUp,
  Heart,
  Eye,
  ChevronRight,
  Sparkles,
  Package,
  GraduationCap
} from "lucide-react";
import type { Event, AgentProduct } from "@shared/schema";

interface BannerItem {
  id: string;
  title: string;
  description: string;
  image?: string;
  link: string;
  type: 'event' | 'content' | 'announcement';
  featured: boolean;
}

export default function NewHomePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'ai-products' | 'alumni-products' | 'tutorials'>('ai-products');

  // 获取数据
  const { data: eventsResponse } = useQuery<{data: Event[]}>({
    queryKey: ["/api/events"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
  const events = eventsResponse?.data || [];

  const { data: agentProducts = [] } = useQuery<AgentProduct[]>({
    queryKey: ["/api/agent-products"],
    retry: false,
    staleTime: 1000 * 60 * 5,
  });

  // 模拟 Banner 数据 - 后续可以从 CMS API 获取
  const bannerItems: BannerItem[] = [
    {
      id: '1',
      title: 'AI 创业者年度峰会',
      description: '连接全球 AI 创业者，探讨最新技术趋势和商业机会',
      link: '/platform/events/summit-2024',
      type: 'event',
      featured: true
    },
    {
      id: '2',
      title: 'GPT-5 深度解析',
      description: '专家解读最新 AI 模型的技术突破与应用前景',
      link: '/platform/content/gpt5-analysis',
      type: 'content',
      featured: true
    },
    {
      id: '3',
      title: '创业导师计划启动',
      description: '匹配经验丰富的创业导师，助力您的创业之路',
      link: '/platform/mentorship',
      type: 'announcement',
      featured: true
    }
  ];

  // 内容沉淀数据 - 后续从 API 获取
  const contentArchive = [
    { id: '1', title: 'AI Agent 开发指南', views: 1250, category: '技术教程' },
    { id: '2', title: '创业融资策略', views: 980, category: '创业指南' },
    { id: '3', title: 'LLM 应用案例集', views: 856, category: '案例分析' },
    { id: '4', title: '技术选型最佳实践', views: 720, category: '技术架构' },
  ];

  // 最新活动
  const latestEvents = events.slice(0, 4);

  // AI 产品、校友产品、热门教程数据
  const aiProducts = agentProducts.slice(0, 6);
  const alumniProducts = agentProducts.slice(0, 4); // 模拟校友产品
  const popularTutorials = [
    { id: '1', title: 'RAG 系统从零到一', author: '张三', duration: '2小时', level: '中级' },
    { id: '2', title: 'Prompt Engineering 进阶', author: '李四', duration: '1.5小时', level: '高级' },
    { id: '3', title: 'AI 产品设计思维', author: '王五', duration: '3小时', level: '初级' },
  ];

  // 讨论帖数据
  const discussionPosts = [
    { id: '1', title: '如何评估 AI 产品的市场潜力？', author: '创业者A', replies: 23, views: 456, time: '2小时前' },
    { id: '2', title: 'GPT-4 API 成本优化经验分享', author: '技术专家B', replies: 18, views: 324, time: '5小时前' },
    { id: '3', title: '寻找技术合伙人的最佳途径', author: '创始人C', replies: 31, views: 567, time: '1天前' },
    { id: '4', title: 'AI 创业公司的法律合规要点', author: '律师D', replies: 12, views: 234, time: '2天前' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 主要内容区域 - 三栏布局 */}
      <section className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧 - 内容沉淀 */}
          <div className="col-span-12 lg:col-span-3">
            <Card className="sticky top-4">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center">
                    <BookOpen className="w-5 h-5 mr-2 text-blue-600" />
                    内容沉淀
                  </span>
                  <Link href="/platform/archive">
                    <Button variant="ghost" size="sm" className="text-xs">
                      查看全部
                    </Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {contentArchive.map((item) => (
                  <Link key={item.id} href={`/platform/content/${item.id}`}>
                    <div className="group cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <h4 className="text-sm font-medium text-gray-900 group-hover:text-blue-600 line-clamp-2">
                        {item.title}
                      </h4>
                      <div className="flex items-center justify-between mt-2">
                        <Badge variant="secondary" className="text-xs">
                          {item.category}
                        </Badge>
                        <span className="text-xs text-gray-500 flex items-center">
                          <Eye className="w-3 h-3 mr-1" />
                          {item.views}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* 中间 - Banner 卡片 */}
          <div className="col-span-12 lg:col-span-6">
            <div className="space-y-4">
              {/* 主要 Banner */}
              <Card className="overflow-hidden bg-gradient-to-br from-blue-50 to-purple-50 border-0 shadow-lg">
                <div className="p-8">
                  <Badge className="mb-4 bg-blue-600 text-white">精选推荐</Badge>
                  <h2 className="text-3xl font-bold text-gray-900 mb-4">
                    {bannerItems[0].title}
                  </h2>
                  <p className="text-lg text-gray-700 mb-6">
                    {bannerItems[0].description}
                  </p>
                  <Link href={bannerItems[0].link}>
                    <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-white">
                      了解详情
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Button>
                  </Link>
                </div>
              </Card>

              {/* 次要 Banner 卡片 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {bannerItems.slice(1, 3).map((item) => (
                  <Card key={item.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <Link href={item.link}>
                      <CardContent className="p-6">
                        <Badge variant="outline" className="mb-3">
                          {item.type === 'event' ? '活动' : item.type === 'content' ? '内容' : '公告'}
                        </Badge>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          {item.title}
                        </h3>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {item.description}
                        </p>
                        <div className="mt-4 flex items-center text-sm text-blue-600 font-medium">
                          查看详情
                          <ChevronRight className="w-4 h-4 ml-1" />
                        </div>
                      </CardContent>
                    </Link>
                  </Card>
                ))}
              </div>

              {/* 更多 Banner 预留位 */}
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="border-dashed border-2 bg-gray-50/50">
                    <CardContent className="p-4 text-center">
                      <div className="text-gray-400">
                        <Sparkles className="w-6 h-6 mx-auto mb-2" />
                        <p className="text-xs">预留位 {i}</p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* 右侧 - 最新活动 */}
          <div className="col-span-12 lg:col-span-3">
            <Card className="sticky top-4">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg flex items-center justify-between">
                  <span className="flex items-center">
                    <Calendar className="w-5 h-5 mr-2 text-green-600" />
                    最新活动
                  </span>
                  <Link href="/platform/events">
                    <Button variant="ghost" size="sm" className="text-xs">
                      查看全部
                    </Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {latestEvents.map((event) => (
                  <Link key={event.id} href={`/platform/events/${event.id}`}>
                    <div className="group cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <h4 className="text-sm font-medium text-gray-900 group-hover:text-green-600 line-clamp-2">
                        {event.title}
                      </h4>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-gray-500">
                          {new Date(event.date).toLocaleDateString('zh-CN', { 
                            month: 'short', 
                            day: 'numeric' 
                          })}
                        </span>
                        <span className="text-xs text-gray-500 flex items-center">
                          <Users className="w-3 h-3 mr-1" />
                          {event.currentAttendees || 0}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 第一栏 - 产品/教程切换区 */}
      <section className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
          <div className="flex items-center justify-between mb-6">
            <TabsList className="grid w-auto grid-cols-3 bg-gray-100">
              <TabsTrigger value="ai-products" className="flex items-center">
                <Brain className="w-4 h-4 mr-2" />
                AI热门产品市集
              </TabsTrigger>
              <TabsTrigger value="alumni-products" className="flex items-center">
                <GraduationCap className="w-4 h-4 mr-2" />
                校友产品推荐
              </TabsTrigger>
              <TabsTrigger value="tutorials" className="flex items-center">
                <BookOpen className="w-4 h-4 mr-2" />
                热门教程推荐
              </TabsTrigger>
            </TabsList>
            
            <Link href={`/platform/${activeTab}`}>
              <Button variant="outline" size="sm">
                查看更多
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <TabsContent value="ai-products" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {aiProducts.map((product) => (
                <Card key={product.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Brain className="w-6 h-6 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 line-clamp-1">{product.name}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <Badge variant="secondary" className="text-xs">
                            {product.status === 'published' ? '已发布' : '测试中'}
                          </Badge>
                          <span className="text-xs text-gray-500 flex items-center">
                            <TrendingUp className="w-3 h-3 mr-1" />
                            {product.usageCount || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="alumni-products" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {alumniProducts.map((product) => (
                <Card key={product.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <Package className="w-6 h-6 text-green-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-gray-900 line-clamp-1">{product.name}</h3>
                        <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                          {product.description}
                        </p>
                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-gray-500">校友作品</span>
                          <span className="text-xs text-gray-500 flex items-center">
                            <Heart className="w-3 h-3 mr-1" />
                            {Math.floor(Math.random() * 100) + 50}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="tutorials" className="mt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {popularTutorials.map((tutorial) => (
                <Card key={tutorial.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <Badge variant="outline" className="mb-3">{tutorial.level}</Badge>
                    <h3 className="font-semibold text-gray-900 mb-2">{tutorial.title}</h3>
                    <p className="text-sm text-gray-600 mb-4">讲师：{tutorial.author}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-500 flex items-center">
                        <Clock className="w-4 h-4 mr-1" />
                        {tutorial.duration}
                      </span>
                      <Button size="sm" variant="outline">
                        开始学习
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </section>

      {/* 第二栏 - 讨论区 */}
      <section className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-orange-600" />
                社区讨论
              </span>
              <div className="flex items-center space-x-2">
                <Button variant="ghost" size="sm">最新</Button>
                <Button variant="ghost" size="sm">最热</Button>
                <Button variant="ghost" size="sm">最近回复</Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {discussionPosts.map((post) => (
                <div key={post.id} className="flex items-start space-x-4 p-4 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                  <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-medium text-gray-600">
                      {post.author.charAt(0)}
                    </span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900 hover:text-blue-600 transition-colors">
                      {post.title}
                    </h4>
                    <div className="flex items-center space-x-4 mt-2 text-sm text-gray-500">
                      <span>{post.author}</span>
                      <span>•</span>
                      <span>{post.time}</span>
                      <span>•</span>
                      <span className="flex items-center">
                        <MessageSquare className="w-3 h-3 mr-1" />
                        {post.replies} 回复
                      </span>
                      <span>•</span>
                      <span className="flex items-center">
                        <Eye className="w-3 h-3 mr-1" />
                        {post.views} 浏览
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 text-center">
              <Link href="/platform/community">
                <Button variant="outline">
                  查看更多讨论
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}