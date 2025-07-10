import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Brain, Handshake, ArrowRight, CheckCircle } from "lucide-react";
import Navbar from "@/components/navbar";
import type { Event, AgentProduct } from "@shared/schema";

export default function HomePage() {
  const { user } = useAuth();

  const { data: events = [] } = useQuery<Event[]>({
    queryKey: ["/api/events"],
  });

  const { data: agentProducts = [] } = useQuery<AgentProduct[]>({
    queryKey: ["/api/agent-products"],
  });

  const recentEvents = events.slice(0, 3);
  const featuredProducts = agentProducts.slice(0, 3);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              连接科研与创业的
              <span className="text-primary-blue"> 桥梁</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              在GenAI时代，为优秀的研究者提供创业伙伴匹配、前沿技术分享和创业活动参与的综合平台
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              {user ? (
                <Link href="/platform/events">
                  <Button size="lg" className="bg-primary-blue hover:bg-primary-dark">
                    开始探索
                  </Button>
                </Link>
              ) : (
                <Link href="/platform/auth">
                  <Button size="lg" className="bg-primary-blue hover:bg-primary-dark">
                    开始探索
                  </Button>
                </Link>
              )}
              <Button variant="outline" size="lg" className="border-primary-blue text-primary-blue hover:bg-blue-50">
                观看演示
              </Button>
            </div>
          </div>
          
          {/* Platform Statistics */}
          <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-blue">500+</div>
              <div className="text-gray-600">活跃研究者</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-blue">120+</div>
              <div className="text-gray-600">成功匹配</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-blue">{agentProducts.length}+</div>
              <div className="text-gray-600">Agent产品</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-blue">15+</div>
              <div className="text-gray-600">月度活动</div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Modules */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">三大核心模块</h2>
            <p className="text-lg text-gray-600">全方位支持您的科研创业之路</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Activities Module */}
            <Card className="bg-gradient-to-br from-blue-50 to-white border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="text-primary-blue text-4xl mb-4">
                  <Calendar className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">活动门户</h3>
                <p className="text-gray-600 mb-6">参与前沿技术分享会、创业经验交流和行业峰会，与顶尖研究者和成功创业者面对面交流</p>
                <ul className="text-sm text-gray-600 mb-6 space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    技术分享会
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    创业经验分享
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    行业峰会
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    网络聚会
                  </li>
                </ul>
                <Link href="/platform/events">
                  <Button className="w-full bg-primary-blue hover:bg-primary-dark">
                    查看活动
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Community Module */}
            <Card className="bg-gradient-to-br from-green-50 to-white border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="text-accent-green text-4xl mb-4">
                  <Users className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">内容社区</h3>
                <p className="text-gray-600 mb-6">探索最新的AI Agent产品，分享研究成果，沉淀活动精华，构建知识共享生态</p>
                <ul className="text-sm text-gray-600 mb-6 space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    Agent产品展示
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    研究成果分享
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    活动精华回顾
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    技术讨论
                  </li>
                </ul>
                <Link href="/platform/community">
                  <Button className="w-full bg-accent-green hover:bg-green-600">
                    进入社区
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Matching Module */}
            <Card className="bg-gradient-to-br from-amber-50 to-white border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardContent className="p-8">
                <div className="text-accent-amber text-4xl mb-4">
                  <Handshake className="w-10 h-10" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">创始人匹配</h3>
                <p className="text-gray-600 mb-6">基于专业背景和创业方向的智能匹配系统，找到最合适的创业伙伴，共同开启创业征程</p>
                <ul className="text-sm text-gray-600 mb-6 space-y-2">
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    专业背景匹配
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    创业方向对齐
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    人工审核筛选
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="w-4 h-4 text-accent-green mr-2" />
                    定期主题推荐
                  </li>
                </ul>
                <Link href="/platform/matching">
                  <Button className="w-full bg-accent-amber hover:bg-yellow-600">
                    开始匹配
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Recent Activities */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">近期活动</h2>
              <p className="text-lg text-gray-600">参与前沿技术和创业经验分享</p>
            </div>
            <Link href="/platform/events">
              <Button className="bg-primary-blue hover:bg-primary-dark">
                查看全部
              </Button>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recentEvents.length > 0 ? (
              recentEvents.map((event) => (
                <Card key={event.id} className="hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className="bg-primary-blue text-white">
                        {event.category === 'tech_share' ? '技术分享' : 
                         event.category === 'startup_share' ? '创业分享' : '网络聚会'}
                      </Badge>
                      <span className="text-gray-500 text-sm">
                        {new Date(event.date).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{event.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{event.description}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center text-gray-500 text-sm">
                        <Users className="w-4 h-4 mr-2" />
                        <span>已报名 {event.currentAttendees || 0}人</span>
                      </div>
                      <Link href="/platform/events">
                        <Button size="sm" className="bg-primary-blue hover:bg-primary-dark">
                          立即报名
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无活动</h3>
                <p className="text-gray-500">请稍后查看最新活动信息</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Featured Agent Products */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">精选Agent产品</h2>
            <p className="text-lg text-gray-600">发现最新AI Agent产品和研究成果</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredProducts.length > 0 ? (
              featuredProducts.map((product) => (
                <Card key={product.id} className="bg-gray-50 hover:shadow-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="bg-primary-blue text-white w-12 h-12 rounded-lg flex items-center justify-center">
                        <Brain className="w-6 h-6" />
                      </div>
                      <Badge variant={product.status === 'published' ? 'default' : 
                                   product.status === 'testing' ? 'secondary' : 'outline'}>
                        {product.status === 'published' ? '已发布' : 
                         product.status === 'testing' ? '测试中' : '开发中'}
                      </Badge>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.name}</h3>
                    <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-gray-500 text-sm">
                        使用次数: {product.usageCount || 0}
                      </div>
                    </div>
                    <Link href="/platform/community">
                      <Button className="w-full" disabled={product.status === 'development'}>
                        {product.status === 'development' ? '即将发布' : '立即体验'}
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">暂无产品</h3>
                <p className="text-gray-500">请稍后查看最新Agent产品</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-blue text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">准备开始您的创业之旅了吗？</h2>
          <p className="text-xl text-blue-100 mb-8">
            加入潜空间，与优秀的研究者和创业者建立联系，在GenAI时代开创属于您的事业
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link href="/platform/matching">
                <Button size="lg" className="bg-white text-primary-blue hover:bg-gray-100">
                  开始匹配
                </Button>
              </Link>
            ) : (
              <Link href="/platform/auth">
                <Button size="lg" className="bg-white text-primary-blue hover:bg-gray-100">
                  立即注册
                </Button>
              </Link>
            )}
            <Button variant="outline" size="lg" className="border-white text-white hover:bg-blue-600">
              了解更多
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-primary-blue rounded-full flex items-center justify-center">
                  <span className="text-white font-bold">潜</span>
                </div>
                <h3 className="text-xl font-bold">潜空间</h3>
              </div>
              <p className="text-gray-400 mb-4">连接科研与创业，助力研究者成为成功的创业者</p>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">平台功能</h4>
              <ul className="space-y-2 text-gray-400">
                <li><Link href="/platform/events" className="hover:text-white transition-colors">活动中心</Link></li>
                <li><Link href="/platform/community" className="hover:text-white transition-colors">内容社区</Link></li>
                <li><Link href="/platform/matching" className="hover:text-white transition-colors">创始人匹配</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">支持与帮助</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="#" className="hover:text-white transition-colors">使用指南</a></li>
                <li><a href="#" className="hover:text-white transition-colors">常见问题</a></li>
                <li><a href="#" className="hover:text-white transition-colors">联系我们</a></li>
              </ul>
            </div>

            <div>
              <h4 className="text-lg font-semibold mb-4">联系信息</h4>
              <div className="space-y-2 text-gray-400">
                <div>contact@latentspace.ai</div>
                <div>+86 400-123-4567</div>
                <div>北京市朝阳区创业大街</div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-400">
              © 2024 潜空间 (Latent Space). All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
