import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Calendar, 
  Users, 
  Brain, 
  MessageSquare, 
  TrendingUp,
  ArrowRight,
  Star,
  Play,
  Podcast,
  Youtube,
  Twitter,
  Github,
  Heart,
  Share,
  Bookmark
} from "lucide-react";
import type { Event, AgentProduct } from "@shared/schema";

export default function LatentInspiredHomePage() {
  const { user } = useAuth();

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

  // 精选和推荐内容
  const featuredEvent = events[0];
  const recentEvents = events.slice(0, 4);
  const popularProducts = agentProducts.slice(0, 6);
  
  // 格式化日期
  const formatDate = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - d.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 1) return '今天';
    if (diffDays === 1) return '昨天';
    if (diffDays < 7) return `${diffDays} 天前`;
    return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header - Clean and minimal */}
      <header className="sticky top-0 z-50 bg-white border-b latent-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <Link href="/platform">
              <div className="flex items-center space-x-3 group">
                <div className="w-10 h-10 bg-black rounded-lg flex items-center justify-center group-hover:bg-gray-800 transition-colors">
                  <span className="text-white font-bold text-lg">潜</span>
                </div>
                <div className="flex flex-col">
                  <h1 className="text-xl font-bold text-gray-900 group-hover:text-black transition-colors">潜空间</h1>
                  <p className="text-xs text-gray-500">AI 研究者社区</p>
                </div>
              </div>
            </Link>

            {/* Navigation */}
            <nav className="hidden lg:flex items-center space-x-7">
              <Link href="/platform/home-latent" className="text-sm font-medium text-gray-900 border-b-2 border-black pb-1">
                首页
              </Link>
              <Link href="/platform/events" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                活动
              </Link>
              <Link href="/platform/search" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                探索
              </Link>
              <Link href="/platform/community" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                社区
              </Link>
              <Link href="/platform/matching" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                匹配
              </Link>
              <Link href="/platform/about" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                关于
              </Link>
            </nav>

            {/* Actions */}
            <div className="flex items-center space-x-3">
              <Button variant="ghost" size="sm" className="hidden sm:flex text-sm">
                <MessageSquare className="w-4 h-4 mr-2" />
                订阅
              </Button>
              {!user && (
                <Link href="/platform/auth">
                  <Button size="sm" className="text-sm">登录</Button>
                </Link>
              )}
              {user && (
                <Link href="/platform/profile">
                  <Avatar className="w-8 h-8 cursor-pointer ring-2 ring-transparent hover:ring-gray-300 transition-all">
                    <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                      {user.username.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Featured Article Hero */}
        {featuredEvent && (
          <section className="mb-12">
            <div className="grid lg:grid-cols-3 gap-8">
              {/* Main Featured */}
              <div className="lg:col-span-2">
                <Card className="overflow-hidden border-0 shadow-lg">
                  <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-blue-600 to-purple-700">
                    <div className="p-8 text-white flex flex-col justify-end">
                      <Badge className="bg-white/20 text-white w-fit mb-4">
                        精选活动
                      </Badge>
                      <h2 className="text-3xl font-bold mb-3">
                        {featuredEvent.title}
                      </h2>
                      <p className="text-lg opacity-90 mb-4">
                        {featuredEvent.description}
                      </p>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(featuredEvent.date)}
                        </span>
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {featuredEvent.currentAttendees || 0} 人已报名
                        </span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Button variant="ghost" size="sm" className="h-8 px-3 hover:bg-gray-100 latent-engagement">
                          <Heart className="w-4 h-4 mr-1.5" />
                          <span className="text-sm font-medium">42</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-3 hover:bg-gray-100 latent-engagement">
                          <MessageSquare className="w-4 h-4 mr-1.5" />
                          <span className="text-sm font-medium">8</span>
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-gray-100 latent-engagement">
                          <Share className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 hover:bg-gray-100 latent-engagement">
                          <Bookmark className="w-4 h-4" />
                        </Button>
                      </div>
                      <Link href={`/platform/events/${featuredEvent.id}`}>
                        <Button className="bg-black hover:bg-gray-800 text-white">
                          立即报名
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar - Secondary Articles */}
              <div className="space-y-6">
                {recentEvents.slice(1, 3).map((event, index) => (
                  <Card key={event.id} className="hover:shadow-md transition-shadow latent-card-hover">
                    <div className="aspect-w-16 aspect-h-9 bg-gray-100 rounded-t-lg">
                      <div className="p-4 bg-gradient-to-br from-gray-600 to-gray-800 text-white flex items-end rounded-t-lg">
                        <Badge className="bg-white/20 text-white text-xs">
                          {event.category === 'tech_share' ? '技术分享' : '创业分享'}
                        </Badge>
                      </div>
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">
                        {event.title}
                      </h3>
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {event.description}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span>{formatDate(event.date)}</span>
                        <div className="flex items-center space-x-3">
                          <span className="flex items-center">
                            <Heart className="w-3 h-3 mr-1" />
                            12
                          </span>
                          <span className="flex items-center">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            5
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {/* Newsletter Signup */}
                <Card className="bg-gray-50">
                  <CardContent className="p-6 text-center">
                    <h3 className="font-semibold text-gray-900 mb-2">订阅我们的周刊</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      每周获取最新的AI研究与创业资讯
                    </p>
                    <div className="space-y-2">
                      <input
                        type="email"
                        placeholder="输入邮箱地址"
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                      />
                      <Button size="sm" className="w-full bg-black hover:bg-gray-800 text-white">
                        订阅
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        )}

        {/* Recent Posts Grid */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">最新内容</h2>
            <Link href="/platform/archive">
              <Button variant="ghost">
                查看全部
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentEvents.map((event) => (
              <Card key={event.id} className="group hover:shadow-lg transition-all cursor-pointer latent-card-hover">
                <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-t-lg">
                  <div className="p-4 text-white flex items-end">
                    <Badge className="bg-white/20 text-white text-xs">
                      {event.category === 'tech_share' ? '技术分享' : 
                       event.category === 'startup_share' ? '创业分享' : '网络聚会'}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-blue-600 transition-colors line-clamp-2">
                    {event.title}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                    {event.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 text-xs text-gray-500">
                      <span>{formatDate(event.date)}</span>
                      <span className="flex items-center">
                        <Users className="w-3 h-3 mr-1" />
                        {event.currentAttendees || 0}
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                        <Heart className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                        <MessageSquare className="w-3 h-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="p-1 h-6 w-6">
                        <Share className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* AI Tools Section */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">推荐工具</h2>
            <Link href="/platform/marketplace">
              <Button variant="ghost">
                发现更多
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {popularProducts.map((product) => (
              <Card key={product.id} className="hover:shadow-md transition-shadow latent-card-hover">
                <CardContent className="p-4">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Brain className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1">{product.name}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                        {product.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="text-xs">
                          {product.status === 'published' ? '已发布' : '测试中'}
                        </Badge>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <TrendingUp className="w-3 h-3" />
                          <span>{product.usageCount || 0} 使用</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Recommended Publications */}
        <section className="mb-12">
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">推荐订阅</h3>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: "AI Engineering", description: "深度AI工程实践", subscribers: "12.5K" },
                { name: "Startup Stories", description: "创业者的真实故事", subscribers: "8.3K" },
                { name: "Tech Trends", description: "前沿技术趋势分析", subscribers: "15.7K" },
                { name: "Research Papers", description: "精选学术论文解读", subscribers: "6.9K" }
              ].map((pub, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-4">
                    <div className="w-12 h-12 bg-gray-200 rounded-full mx-auto mb-3"></div>
                    <h4 className="font-medium text-gray-900 mb-1">{pub.name}</h4>
                    <p className="text-xs text-gray-600 mb-2">{pub.description}</p>
                    <p className="text-xs text-gray-500 mb-3">{pub.subscribers} 订阅者</p>
                    <Button size="sm" variant="outline" className="text-xs h-7">
                      关注
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-50 border-t">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold">潜</span>
                </div>
                <span className="font-bold text-gray-900">潜空间</span>
              </div>
              <p className="text-sm text-gray-600 mb-4">
                连接科研与创业，构建AI时代的创新网络
              </p>
              <div className="flex space-x-3">
                <a href="#" className="text-gray-400 hover:text-gray-600">
                  <Youtube className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-gray-600">
                  <Twitter className="w-5 h-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-gray-600">
                  <Github className="w-5 h-5" />
                </a>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">内容</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/platform/archive">全部文章</Link></li>
                <li><Link href="/platform/podcast">播客节目</Link></li>
                <li><Link href="/platform/events">活动中心</Link></li>
                <li><Link href="/platform/newsletter">周刊订阅</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">社区</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/platform/community">Discord</Link></li>
                <li><Link href="/platform/meetups">线下聚会</Link></li>
                <li><Link href="/platform/contributors">贡献者</Link></li>
                <li><Link href="/platform/jobs">工作机会</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-900 mb-3">关于</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li><Link href="/platform/about">关于我们</Link></li>
                <li><Link href="/platform/contact">联系方式</Link></li>
                <li><Link href="/platform/privacy">隐私政策</Link></li>
                <li><Link href="/platform/terms">使用条款</Link></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-200 mt-8 pt-8 text-center">
            <p className="text-sm text-gray-500">
              © 2024 潜空间. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}