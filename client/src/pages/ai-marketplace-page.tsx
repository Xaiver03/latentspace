import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { 
  LuSearch, LuFilter, LuStar, LuBookmark, LuExternalLink, LuHeart, 
  LuEye, LuTrendingUp, LuSparkles, LuGrid3X3, LuList, LuChevronDown,
  LuDollarSign, LuCode, LuSmartphone, LuMonitor, LuGlobe, LuCheck
} from "react-icons/lu";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/hooks/use-toast";

interface AgentData {
  id: number;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  logo?: string;
  screenshots: string[];
  website?: string;
  pricingModel: string;
  priceRange?: string;
  keyFeatures: string[];
  useCases: string[];
  platforms: string[];
  rating: string;
  reviewCount: number;
  usageCount: number;
  tags: string[];
  verified: boolean;
  featured: boolean;
  creator: {
    id: number;
    fullName: string;
    avatarUrl?: string;
  };
  reviewStats: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: { [key: number]: number };
  };
  isBookmarked?: boolean;
}

interface SearchFilters {
  category?: string;
  pricingModel?: string[];
  platforms?: string[];
  rating?: number;
  verified?: boolean;
  sortBy?: string;
  semanticSearch?: boolean;
}

export function AiMarketplacePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<SearchFilters>({
    sortBy: "popularity",
    semanticSearch: false,
  });
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch agents with search and filters
  const { data: agentsData, isLoading } = useQuery<{
    agents: AgentData[];
    totalCount: number;
  }>({
    queryKey: ["/api/marketplace/agents", debouncedSearch, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set("q", debouncedSearch);
      if (filters.category) params.set("category", filters.category);
      if (filters.pricingModel?.length) params.set("pricingModel", filters.pricingModel.join(","));
      if (filters.platforms?.length) params.set("platforms", filters.platforms.join(","));
      if (filters.rating) params.set("rating", filters.rating.toString());
      if (filters.verified) params.set("verified", "true");
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.semanticSearch) params.set("semanticSearch", "true");
      
      const response = await fetch(`/api/marketplace/agents?${params}`);
      if (!response.ok) throw new Error("Failed to fetch agents");
      return response.json();
    },
  });

  // Fetch discovery data for featured/trending
  const { data: discoveryData } = useQuery<{
    featured: AgentData[];
    trending: AgentData[];
    categories: { category: string; count: number }[];
  }>({
    queryKey: ["/api/marketplace/discover"],
  });

  // Bookmark mutation
  const bookmarkMutation = useMutation({
    mutationFn: async ({ agentId, remove }: { agentId: number; remove?: boolean }) => {
      const method = remove ? "DELETE" : "POST";
      const response = await fetch(`/api/marketplace/agents/${agentId}/bookmark`, {
        method,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to bookmark agent");
      return response.json();
    },
    onSuccess: (_, { remove }) => {
      toast({
        title: remove ? "Bookmark removed" : "Agent bookmarked",
        description: remove ? "Removed from your bookmarks" : "Added to your bookmarks",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/agents"] });
    },
  });

  const handleBookmark = (agentId: number, isBookmarked: boolean) => {
    bookmarkMutation.mutate({ agentId, remove: isBookmarked });
  };

  const getPricingBadgeColor = (model: string) => {
    switch (model) {
      case "free": return "bg-green-100 text-green-800";
      case "freemium": return "bg-blue-100 text-blue-800";
      case "subscription": return "bg-purple-100 text-purple-800";
      case "one-time": return "bg-orange-100 text-orange-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const categories = [
    { value: "productivity", label: "生产力工具", icon: "💼" },
    { value: "research", label: "研究分析", icon: "🔬" },
    { value: "design", label: "设计创作", icon: "🎨" },
    { value: "development", label: "开发工具", icon: "💻" },
    { value: "analytics", label: "数据分析", icon: "📊" },
    { value: "communication", label: "沟通协作", icon: "💬" },
  ];

  const pricingModels = [
    { value: "free", label: "免费" },
    { value: "freemium", label: "免费试用" },
    { value: "subscription", label: "订阅制" },
    { value: "one-time", label: "一次性购买" },
    { value: "usage-based", label: "按使用付费" },
  ];

  const platforms = [
    { value: "web", label: "网页版", icon: LuGlobe },
    { value: "desktop", label: "桌面端", icon: LuMonitor },
    { value: "mobile", label: "移动端", icon: LuSmartphone },
    { value: "api", label: "API", icon: LuCode },
  ];

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="h-80 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">AI 工具市场</h1>
            <p className="text-muted-foreground">
              发现最新最优秀的 AI 工具，提升你的工作效率
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === "grid" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("grid")}
            >
              <LuGrid3X3 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "list" ? "default" : "outline"}
              size="sm"
              onClick={() => setViewMode("list")}
            >
              <LuList className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col gap-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <LuSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="搜索 AI 工具..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <LuFilter className="h-4 w-4" />
              筛选
              <LuChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </Button>
          </div>

          {/* Quick Categories */}
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <Button
                key={category.value}
                variant={filters.category === category.value ? "default" : "outline"}
                size="sm"
                onClick={() => setFilters(prev => ({
                  ...prev,
                  category: prev.category === category.value ? undefined : category.value
                }))}
                className="flex items-center gap-1"
              >
                <span>{category.icon}</span>
                {category.label}
              </Button>
            ))}
          </div>

          {/* Advanced Filters */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <Card className="p-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label className="text-sm font-medium">定价模式</Label>
                      <div className="mt-2 space-y-2">
                        {pricingModels.map((model) => (
                          <div key={model.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={model.value}
                              checked={filters.pricingModel?.includes(model.value)}
                              onCheckedChange={(checked) => {
                                setFilters(prev => ({
                                  ...prev,
                                  pricingModel: checked
                                    ? [...(prev.pricingModel || []), model.value]
                                    : prev.pricingModel?.filter(p => p !== model.value)
                                }));
                              }}
                            />
                            <Label htmlFor={model.value} className="text-sm">
                              {model.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">支持平台</Label>
                      <div className="mt-2 space-y-2">
                        {platforms.map((platform) => (
                          <div key={platform.value} className="flex items-center space-x-2">
                            <Checkbox
                              id={platform.value}
                              checked={filters.platforms?.includes(platform.value)}
                              onCheckedChange={(checked) => {
                                setFilters(prev => ({
                                  ...prev,
                                  platforms: checked
                                    ? [...(prev.platforms || []), platform.value]
                                    : prev.platforms?.filter(p => p !== platform.value)
                                }));
                              }}
                            />
                            <Label htmlFor={platform.value} className="text-sm flex items-center gap-1">
                              <platform.icon className="h-3 w-3" />
                              {platform.label}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">最低评分</Label>
                      <Select
                        value={filters.rating?.toString() || ""}
                        onValueChange={(value) => setFilters(prev => ({
                          ...prev,
                          rating: value ? parseFloat(value) : undefined
                        }))}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue placeholder="选择最低评分" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">全部评分</SelectItem>
                          <SelectItem value="4">4+ 星</SelectItem>
                          <SelectItem value="3">3+ 星</SelectItem>
                          <SelectItem value="2">2+ 星</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">排序方式</Label>
                      <Select
                        value={filters.sortBy || "popularity"}
                        onValueChange={(value) => setFilters(prev => ({ ...prev, sortBy: value }))}
                      >
                        <SelectTrigger className="mt-2">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="popularity">热度排序</SelectItem>
                          <SelectItem value="rating">评分排序</SelectItem>
                          <SelectItem value="newest">最新发布</SelectItem>
                          <SelectItem value="name">名称排序</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="verified"
                        checked={filters.verified || false}
                        onCheckedChange={(checked) => setFilters(prev => ({ ...prev, verified: !!checked }))}
                      />
                      <Label htmlFor="verified" className="text-sm flex items-center gap-1">
                        <LuCheck className="h-3 w-3" />
                        仅显示已验证工具
                      </Label>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="semantic"
                        checked={filters.semanticSearch || false}
                        onCheckedChange={(checked) => setFilters(prev => ({ ...prev, semanticSearch: !!checked }))}
                      />
                      <Label htmlFor="semantic" className="text-sm flex items-center gap-1">
                        <LuSparkles className="h-3 w-3" />
                        语义搜索
                      </Label>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Results */}
      <Tabs defaultValue="all" className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">
            全部工具 ({agentsData?.totalCount || 0})
          </TabsTrigger>
          <TabsTrigger value="featured">
            精选推荐
          </TabsTrigger>
          <TabsTrigger value="trending">
            <LuTrendingUp className="h-4 w-4 mr-1" />
            热门趋势
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <div className={viewMode === "grid" ? "grid gap-6 md:grid-cols-2 lg:grid-cols-3" : "space-y-4"}>
            {agentsData?.agents.map((agent, idx) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="hover:shadow-lg transition-shadow cursor-pointer h-full">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {agent.logo ? (
                          <img src={agent.logo} alt={agent.name} className="w-12 h-12 rounded-lg" />
                        ) : (
                          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
                            {agent.name[0]}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-lg truncate">{agent.name}</CardTitle>
                            {agent.verified && (
                              <Badge variant="secondary" className="text-xs">
                                <LuCheck className="h-3 w-3 mr-1" />
                                已验证
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <div className="flex items-center gap-1">
                              <LuStar className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span className="text-sm font-medium">
                                {agent.reviewStats.averageRating.toFixed(1)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({agent.reviewStats.totalReviews})
                              </span>
                            </div>
                            <Separator orientation="vertical" className="h-3" />
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <LuEye className="h-3 w-3" />
                              {agent.usageCount}
                            </div>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBookmark(agent.id, agent.isBookmarked || false);
                        }}
                        disabled={bookmarkMutation.isPending}
                      >
                        <LuBookmark className={`h-4 w-4 ${agent.isBookmarked ? 'fill-current' : ''}`} />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="line-clamp-2 mb-3">
                      {agent.description}
                    </CardDescription>

                    <div className="space-y-3">
                      {/* Pricing */}
                      <div className="flex items-center gap-2">
                        <Badge className={getPricingBadgeColor(agent.pricingModel)}>
                          <LuDollarSign className="h-3 w-3 mr-1" />
                          {agent.pricingModel === "free" ? "免费" :
                           agent.pricingModel === "freemium" ? "免费试用" :
                           agent.pricingModel === "subscription" ? "订阅制" :
                           agent.pricingModel === "one-time" ? "一次性" : "按量付费"}
                        </Badge>
                        {agent.priceRange && (
                          <span className="text-xs text-muted-foreground">
                            {agent.priceRange}
                          </span>
                        )}
                      </div>

                      {/* Platforms */}
                      <div className="flex items-center gap-1">
                        {agent.platforms.slice(0, 3).map((platform) => {
                          const PlatformIcon = platforms.find(p => p.value === platform)?.icon || LuGlobe;
                          return (
                            <Badge key={platform} variant="outline" className="text-xs">
                              <PlatformIcon className="h-3 w-3 mr-1" />
                              {platforms.find(p => p.value === platform)?.label || platform}
                            </Badge>
                          );
                        })}
                        {agent.platforms.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{agent.platforms.length - 3}
                          </span>
                        )}
                      </div>

                      {/* Key Features */}
                      <div className="flex flex-wrap gap-1">
                        {agent.keyFeatures.slice(0, 3).map((feature) => (
                          <Badge key={feature} variant="secondary" className="text-xs">
                            {feature}
                          </Badge>
                        ))}
                        {agent.keyFeatures.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{agent.keyFeatures.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" className="flex-1">
                          查看详情
                        </Button>
                        {agent.website && (
                          <Button size="sm" variant="outline">
                            <LuExternalLink className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          {agentsData?.agents.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold mb-2">未找到相关工具</h3>
              <p className="text-muted-foreground">
                尝试调整搜索关键词或筛选条件
              </p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="featured">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {discoveryData?.featured.map((agent, idx) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                {/* Similar card structure as above */}
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
                        <LuSparkles className="h-3 w-3 mr-1" />
                        精选
                      </Badge>
                    </div>
                  </CardHeader>
                  {/* Rest of card content */}
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trending">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {discoveryData?.trending.map((agent, idx) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                {/* Similar card structure with trending badge */}
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-gradient-to-r from-red-500 to-pink-500 text-white">
                        <LuTrendingUp className="h-3 w-3 mr-1" />
                        热门
                      </Badge>
                    </div>
                  </CardHeader>
                  {/* Rest of card content */}
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}