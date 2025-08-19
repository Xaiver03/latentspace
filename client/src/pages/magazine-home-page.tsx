import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  Calendar, 
  Users, 
  Brain, 
  Handshake, 
  ArrowRight, 
  Clock,
  TrendingUp,
  Star,
  MessageSquare,
  Eye,
  Sparkles,
  Rocket,
  Target,
  User as UserIcon
} from "lucide-react";
// 使用App中已有的导航系统，不需要单独导入导航栏
import type { Event, AgentProduct, User } from "@shared/schema";

export default function MagazineHomePage() {
  const { user } = useAuth();

  // 获取数据 - 修复API响应格式
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

  // 暂时使用模拟数据，稍后可以添加真实的featured users API
  const featuredUsers: User[] = [];

  // 数据处理
  const featuredContent = useMemo(() => {
    // 使用第一个事件和产品作为精选内容
    const featuredEvent = Array.isArray(events) && events.length > 0 ? events[0] : null;
    const featuredProduct = Array.isArray(agentProducts) && agentProducts.length > 0 ? agentProducts[0] : null;
    return { featuredEvent, featuredProduct };
  }, [events, agentProducts]);

  const latestEvents = useMemo(() => {
    if (!Array.isArray(events)) return [];
    return events.slice(0, 4);
  }, [events]);
  
  const popularProducts = useMemo(() => {
    if (!Array.isArray(agentProducts)) return [];
    return agentProducts
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
      .slice(0, 3);
  }, [agentProducts]);

  return (
    <div className="min-h-screen bg-gray-50">
      
      {/* Hero Section - Magazine Style */}
      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-blue-50 text-primary-blue px-4 py-2 rounded-full text-sm font-medium mb-4">
              <Sparkles className="w-4 h-4" />
              <span>连接科研与创业的桥梁</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              在GenAI时代，找到你的
              <span className="text-primary-blue"> 创业伙伴</span>
            </h1>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              加入500+研究者社区，参与前沿技术分享，寻找志同道合的创业伙伴
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { icon: Users, label: "活跃研究者", value: "500+", color: "text-blue-600" },
              { icon: Handshake, label: "成功匹配", value: "120+", color: "text-green-600" },
              { icon: Brain, label: "AI产品", value: `${agentProducts.length}+`, color: "text-purple-600" },
              { icon: Calendar, label: "月度活动", value: "15+", color: "text-amber-600" },
            ].map((stat, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4 text-center">
                <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-2`} />
                <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
                <div className="text-sm text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <>
                <Link href="/platform/matching">
                  <Button size="lg" className="bg-primary-blue hover:bg-primary-dark">
                    <Rocket className="w-4 h-4 mr-2" />
                    开始匹配
                  </Button>
                </Link>
                <Link href="/platform/events">
                  <Button size="lg" variant="outline">
                    浏览活动
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link href="/platform/auth">
                  <Button size="lg" className="bg-primary-blue hover:bg-primary-dark">
                    立即加入
                  </Button>
                </Link>
                <Button size="lg" variant="outline">
                  了解更多
                </Button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Featured Content Section */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Featured Content */}
            <div className="lg:col-span-2">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                <Star className="w-6 h-6 text-amber-500 mr-2" />
                精选内容
              </h2>
              
              {featuredContent.featuredEvent && (
                <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="aspect-w-16 aspect-h-9 bg-gradient-to-br from-blue-500 to-purple-600">
                    <div className="p-8 text-white">
                      <Badge className="bg-white/20 text-white border-white/20 mb-4">
                        即将开始
                      </Badge>
                      <h3 className="text-3xl font-bold mb-2">
                        {featuredContent.featuredEvent.title}
                      </h3>
                      <p className="text-lg opacity-90 mb-4">
                        {featuredContent.featuredEvent.description}
                      </p>
                      <div className="flex items-center space-x-4 text-sm">
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {new Date(featuredContent.featuredEvent.date).toLocaleDateString('zh-CN')}
                        </span>
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {featuredContent.featuredEvent.currentAttendees || 0} 人已报名
                        </span>
                      </div>
                    </div>
                  </div>
                  <CardContent className="p-6">
                    <Link href={`/platform/events/${featuredContent.featuredEvent.id}`}>
                      <Button className="w-full">
                        查看详情
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar Content */}
            <div className="space-y-6">
              {/* Trending Topics */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
                  热门话题
                </h3>
                <div className="space-y-2">
                  {['AI Agent开发', 'LLM应用', '创业融资', '技术选型'].map((topic, index) => (
                    <Link key={index} href="/platform/search">
                      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                        <span className="text-sm font-medium">{topic}</span>
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Quick Actions */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Target className="w-5 h-5 text-purple-600 mr-2" />
                  快速开始
                </h3>
                <div className="space-y-2">
                  <Link href="/platform/matching">
                    <Button variant="outline" className="w-full justify-start">
                      <Handshake className="w-4 h-4 mr-2" />
                      寻找创业伙伴
                    </Button>
                  </Link>
                  <Link href="/platform/workspace">
                    <Button variant="outline" className="w-full justify-start">
                      <Users className="w-4 h-4 mr-2" />
                      创建协作空间
                    </Button>
                  </Link>
                  <Link href="/platform/marketplace">
                    <Button variant="outline" className="w-full justify-start">
                      <Brain className="w-4 h-4 mr-2" />
                      探索AI工具
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Latest & Popular Section */}
      <section className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12">
            {/* Latest Events */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <Clock className="w-6 h-6 text-blue-600 mr-2" />
                  最新活动
                </h2>
                <Link href="/platform/events">
                  <Button variant="ghost" size="sm">
                    查看全部
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              
              <div className="space-y-4">
                {latestEvents.map((event) => (
                  <Card key={event.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Calendar className="w-6 h-6 text-blue-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <Badge variant="secondary" className="text-xs">
                              {event.category === 'tech_share' ? '技术分享' : 
                               event.category === 'startup_share' ? '创业分享' : '网络聚会'}
                            </Badge>
                            <span className="text-xs text-gray-500">
                              {new Date(event.date).toLocaleDateString('zh-CN')}
                            </span>
                          </div>
                          <h4 className="text-base font-semibold text-gray-900 mb-1">
                            {event.title}
                          </h4>
                          <p className="text-sm text-gray-600 line-clamp-2">
                            {event.description}
                          </p>
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Users className="w-3 h-3 mr-1" />
                              {event.currentAttendees || 0} 人
                            </span>
                            <span className="flex items-center">
                              <Eye className="w-3 h-3 mr-1" />
                              {Math.floor(Math.random() * 100) + 50} 浏览
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Popular Products */}
            <div>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <TrendingUp className="w-6 h-6 text-green-600 mr-2" />
                  热门产品
                </h2>
                <Link href="/platform/marketplace">
                  <Button variant="ghost" size="sm">
                    查看全部
                    <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
              
              <div className="space-y-4">
                {popularProducts.map((product) => (
                  <Card key={product.id} className="hover:shadow-md transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Brain className="w-6 h-6 text-purple-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="text-base font-semibold text-gray-900">
                              {product.name}
                            </h4>
                            <Badge 
                              variant={product.status === 'published' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {product.status === 'published' ? '已发布' : 
                               product.status === 'testing' ? '测试中' : '开发中'}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-2 mb-2">
                            {product.description}
                          </p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span className="flex items-center">
                              <Eye className="w-3 h-3 mr-1" />
                              {product.usageCount || 0} 使用
                            </span>
                            <span className="flex items-center">
                              <Star className="w-3 h-3 mr-1" />
                              4.5 评分
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Community Highlights */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">社区成员</h2>
            <p className="text-gray-600">认识我们优秀的研究者和创业者</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {featuredUsers.length > 0 ? (
              featuredUsers.slice(0, 12).map((member, index) => (
                <Link key={index} href={`/platform/profile/${member.id}`}>
                  <div className="text-center group cursor-pointer">
                    <Avatar className="w-16 h-16 mx-auto mb-2 ring-2 ring-gray-200 group-hover:ring-primary-blue transition-all">
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {member.fullName?.charAt(0) || member.username.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <h4 className="text-sm font-medium text-gray-900 group-hover:text-primary-blue transition-colors">
                      {member.fullName || member.username}
                    </h4>
                    <p className="text-xs text-gray-500 truncate px-2">
                      {member.researchField || '研究者'}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              // 占位符显示
              Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="text-center">
                  <div className="w-16 h-16 mx-auto mb-2 bg-gray-200 rounded-full flex items-center justify-center">
                    <UserIcon className="w-8 h-8 text-gray-400" />
                  </div>
                  <div className="text-sm text-gray-400">待加入</div>
                </div>
              ))
            )}
          </div>
          
          <div className="text-center mt-8">
            <Link href="/platform/community">
              <Button variant="outline">
                探索更多社区成员
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-br from-primary-blue to-blue-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">准备开始您的创业之旅了吗？</h2>
          <p className="text-xl text-blue-100 mb-8">
            加入我们，与志同道合的伙伴一起，在AI时代创造无限可能
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link href="/platform/matching">
                <Button size="lg" className="bg-white text-primary-blue hover:bg-gray-100">
                  立即开始匹配
                </Button>
              </Link>
            ) : (
              <Link href="/platform/auth">
                <Button size="lg" className="bg-white text-primary-blue hover:bg-gray-100">
                  免费加入
                </Button>
              </Link>
            )}
            <Link href="/platform/success-stories">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                查看成功案例
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Simple Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="mb-4 md:mb-0">
              <p className="text-gray-400">
                © 2024 潜空间 Latent Space. All rights reserved.
              </p>
            </div>
            <div className="flex space-x-6">
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                使用条款
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                隐私政策
              </a>
              <a href="#" className="text-gray-400 hover:text-white transition-colors">
                联系我们
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}