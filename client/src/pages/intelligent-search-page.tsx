import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { LuSearch, LuFilter, LuSparkles, LuClock, LuTrendingUp, LuUser, LuCalendar, LuBox, LuFile, LuArrowRight, LuMapPin, LuBriefcase, LuCode } from "react-icons/lu";
import { motion, AnimatePresence } from "framer-motion";
import { useDebounce } from "@/hooks/use-debounce";

interface SearchResult {
  type: 'user' | 'event' | 'product' | 'content';
  id: number;
  title: string;
  description: string;
  relevanceScore: number;
  semanticScore?: number;
  data: any;
  reasons?: string[];
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
  searchTime: number;
}

interface PersonalizedRecommendation {
  type: 'similar_users' | 'relevant_events' | 'interesting_products' | 'trending_content';
  title: string;
  description: string;
  items: SearchResult[];
  reason: string;
}

export function IntelligentSearchPage() {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    type: [] as string[],
    roleIntent: [] as string[],
    industries: [] as string[],
    skills: [] as string[],
    location: "",
  });
  const [semanticSearch, setSemanticSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  
  const debouncedQuery = useDebounce(query, 300);

  // Search mutations
  const searchMutation = useMutation({
    mutationFn: async (searchParams: any) => {
      const response = await fetch("/api/search/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(searchParams),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Search failed");
      return response.json() as Promise<SearchResponse>;
    },
  });

  // Quick search for suggestions
  const { data: quickResults } = useQuery({
    queryKey: ["quick-search", debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery || debouncedQuery.length < 2) return null;
      const response = await fetch(`/api/search/quick?q=${encodeURIComponent(debouncedQuery)}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Quick search failed");
      return response.json() as Promise<SearchResponse>;
    },
    enabled: !!debouncedQuery && debouncedQuery.length >= 2,
  });

  // Personalized recommendations
  const { data: recommendations } = useQuery({
    queryKey: ["search-recommendations"],
    queryFn: async () => {
      const response = await fetch("/api/search/recommendations", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to get recommendations");
      const data = await response.json();
      return data.recommendations as PersonalizedRecommendation[];
    },
  });

  // Search suggestions
  const { data: suggestions } = useQuery({
    queryKey: ["search-suggestions"],
    queryFn: async () => {
      const response = await fetch("/api/search/suggestions", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to get suggestions");
      const data = await response.json();
      return data.suggestions as string[];
    },
  });

  // Trending searches
  const { data: trending } = useQuery({
    queryKey: ["trending-searches"],
    queryFn: async () => {
      const response = await fetch("/api/search/trending", {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to get trending searches");
      const data = await response.json();
      return data.trending as Array<{ query: string; count: number }>;
    },
  });

  const handleSearch = () => {
    if (!query.trim()) return;

    searchMutation.mutate({
      query: query.trim(),
      filters: Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => 
          Array.isArray(value) ? value.length > 0 : value
        )
      ),
      semanticSearch,
      limit: 50,
    });
  };

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const toggleFilter = (category: string, value: string) => {
    setFilters(prev => ({
      ...prev,
      [category]: prev[category as keyof typeof prev].includes(value)
        ? (prev[category as keyof typeof prev] as string[]).filter(item => item !== value)
        : [...(prev[category as keyof typeof prev] as string[]), value]
    }));
  };

  const clearFilters = () => {
    setFilters({
      type: [],
      roleIntent: [],
      industries: [],
      skills: [],
      location: "",
    });
  };

  const activeFiltersCount = useMemo(() => {
    return Object.values(filters).reduce((count, value) => {
      if (Array.isArray(value)) {
        return count + value.length;
      }
      return count + (value ? 1 : 0);
    }, 0);
  }, [filters]);

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'user': return LuUser;
      case 'event': return LuCalendar;
      case 'product': return LuBox;
      case 'content': return LuFile;
      default: return LuSearch;
    }
  };

  const getResultTypeLabel = (type: string) => {
    switch (type) {
      case 'user': return '用户';
      case 'event': return '活动';
      case 'product': return '产品';
      case 'content': return '内容';
      default: return type;
    }
  };

  return (
    <div className="container py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">智能搜索</h1>
        <p className="text-muted-foreground">AI 驱动的全平台智能搜索与发现</p>
      </div>

      <div className="space-y-6">
        {/* Search Bar */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <LuSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="搜索用户、活动、产品、内容..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 pr-4"
                />
              </div>
              <Button
                variant="outline"
                onClick={() => setShowFilters(!showFilters)}
                className="relative"
              >
                <LuFilter className="h-4 w-4 mr-2" />
                筛选
                {activeFiltersCount > 0 && (
                  <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 text-xs">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
              <Button onClick={handleSearch} disabled={!query.trim()}>
                <LuSearch className="h-4 w-4 mr-2" />
                搜索
              </Button>
            </div>

            {/* Advanced Options */}
            <div className="flex items-center gap-4 mt-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="semantic"
                  checked={semanticSearch}
                  onCheckedChange={(checked) => setSemanticSearch(checked === true)}
                />
                <Label htmlFor="semantic" className="text-sm">
                  语义搜索 <LuSparkles className="inline h-3 w-3" />
                </Label>
              </div>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-xs text-muted-foreground">
                智能 AI 理解搜索意图
              </span>
            </div>

            {/* Filters Panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 pt-6 border-t"
                >
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {/* Content Type Filter */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">内容类型</Label>
                      <div className="space-y-2">
                        {['users', 'events', 'products', 'content'].map((type) => (
                          <div key={type} className="flex items-center space-x-2">
                            <Checkbox
                              id={type}
                              checked={filters.type.includes(type)}
                              onCheckedChange={() => toggleFilter('type', type)}
                            />
                            <Label htmlFor={type} className="text-sm">
                              {getResultTypeLabel(type)}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Role Intent Filter */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">角色</Label>
                      <div className="space-y-2">
                        {['CEO', 'CTO', 'CPO', 'Technical', 'Business'].map((role) => (
                          <div key={role} className="flex items-center space-x-2">
                            <Checkbox
                              id={role}
                              checked={filters.roleIntent.includes(role)}
                              onCheckedChange={() => toggleFilter('roleIntent', role)}
                            />
                            <Label htmlFor={role} className="text-sm">
                              {role}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Industries Filter */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">行业</Label>
                      <div className="space-y-2">
                        {['AI/ML', 'FinTech', 'Healthcare', 'Education', 'SaaS'].map((industry) => (
                          <div key={industry} className="flex items-center space-x-2">
                            <Checkbox
                              id={industry}
                              checked={filters.industries.includes(industry)}
                              onCheckedChange={() => toggleFilter('industries', industry)}
                            />
                            <Label htmlFor={industry} className="text-sm">
                              {industry}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Location Filter */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">位置</Label>
                      <Input
                        placeholder="输入城市..."
                        value={filters.location}
                        onChange={(e) => handleFilterChange('location', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end mt-4">
                    <Button variant="outline" onClick={clearFilters} className="mr-2">
                      清除筛选
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <Tabs defaultValue="results" className="space-y-6">
          <TabsList>
            <TabsTrigger value="results">搜索结果</TabsTrigger>
            <TabsTrigger value="recommendations">个性化推荐</TabsTrigger>
            <TabsTrigger value="trending">热门搜索</TabsTrigger>
          </TabsList>

          <TabsContent value="results">
            {/* Search Results */}
            {searchMutation.data ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    找到 {searchMutation.data.totalCount} 个结果 
                    <span className="ml-2">
                      (用时 {searchMutation.data.searchTime}ms)
                    </span>
                  </p>
                  {semanticSearch && (
                    <Badge variant="secondary" className="text-xs">
                      <LuSparkles className="h-3 w-3 mr-1" />
                      AI 语义搜索
                    </Badge>
                  )}
                </div>

                <div className="grid gap-4">
                  {searchMutation.data.results.map((result, idx) => {
                    const IconComponent = getResultIcon(result.type);
                    return (
                      <motion.div
                        key={`${result.type}-${result.id}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                      >
                        <Card className="hover:shadow-md transition-shadow">
                          <CardContent className="p-4">
                            <div className="flex items-start gap-4">
                              <div className="flex-shrink-0">
                                {result.type === 'user' && result.data.user ? (
                                  <Avatar>
                                    <AvatarImage src={result.data.user.avatarUrl} />
                                    <AvatarFallback>{result.data.user.fullName[0]}</AvatarFallback>
                                  </Avatar>
                                ) : (
                                  <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                                    <IconComponent className="h-5 w-5" />
                                  </div>
                                )}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="outline" className="text-xs">
                                    {getResultTypeLabel(result.type)}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    匹配度: {Math.round(result.relevanceScore)}%
                                  </span>
                                  {result.semanticScore && (
                                    <span className="text-xs text-muted-foreground">
                                      语义: {Math.round(result.semanticScore * 100)}%
                                    </span>
                                  )}
                                </div>
                                
                                <h3 className="font-medium mb-1">{result.title}</h3>
                                <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                  {result.description}
                                </p>
                                
                                {/* Additional info for different types */}
                                {result.type === 'user' && result.data.profile && (
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <LuBriefcase className="h-3 w-3" />
                                      {result.data.profile.roleIntent}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <LuMapPin className="h-3 w-3" />
                                      {result.data.profile.locationCity}
                                    </span>
                                  </div>
                                )}

                                {result.type === 'event' && (
                                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <LuCalendar className="h-3 w-3" />
                                      {new Date(result.data.date).toLocaleDateString()}
                                    </span>
                                    <span>{result.data.category}</span>
                                  </div>
                                )}

                                {/* Matching reasons */}
                                {result.reasons && result.reasons.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {result.reasons.slice(0, 3).map((reason, idx) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">
                                        {reason}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              
                              <Button variant="ghost" size="sm">
                                <LuArrowRight className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : query && !searchMutation.data && !searchMutation.isPending ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <LuSearch className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground mb-2">开始搜索</p>
                  <p className="text-sm text-muted-foreground">
                    输入关键词并点击搜索按钮
                  </p>
                </CardContent>
              </Card>
            ) : searchMutation.isPending ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                  <p className="text-muted-foreground">搜索中...</p>
                </CardContent>
              </Card>
            ) : (
              /* Search suggestions and quick results */
              <div className="space-y-6">
                {/* Quick search results */}
                {quickResults && quickResults.results.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">快速结果</CardTitle>
                      <CardDescription>基于 "{debouncedQuery}" 的即时搜索</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-2">
                        {quickResults.results.slice(0, 5).map((result) => (
                          <div key={`${result.type}-${result.id}`} className="flex items-center gap-3 p-2 rounded-lg hover:bg-secondary">
                            <div className="h-6 w-6 rounded bg-secondary flex items-center justify-center">
                              {React.createElement(getResultIcon(result.type), { className: "h-3 w-3" })}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{result.title}</p>
                              <p className="text-xs text-muted-foreground">{getResultTypeLabel(result.type)}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Search suggestions */}
                {suggestions && suggestions.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">搜索建议</CardTitle>
                      <CardDescription>为您推荐的搜索关键词</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {suggestions.map((suggestion, idx) => (
                          <Button
                            key={idx}
                            variant="outline"
                            size="sm"
                            onClick={() => setQuery(suggestion)}
                            className="h-8"
                          >
                            {suggestion}
                          </Button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="recommendations">
            {/* Personalized Recommendations */}
            {recommendations && recommendations.length > 0 ? (
              <div className="space-y-6">
                {recommendations.map((rec, idx) => (
                  <motion.div
                    key={rec.type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                  >
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <LuSparkles className="h-5 w-5 text-primary" />
                          {rec.title}
                        </CardTitle>
                        <CardDescription>{rec.description}</CardDescription>
                        <Badge variant="secondary" className="w-fit text-xs">
                          {rec.reason}
                        </Badge>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3">
                          {rec.items.slice(0, 5).map((item) => {
                            const IconComponent = getResultIcon(item.type);
                            return (
                              <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 p-3 rounded-lg border">
                                <div className="h-8 w-8 rounded bg-secondary flex items-center justify-center">
                                  <IconComponent className="h-4 w-4" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{item.title}</p>
                                  <p className="text-xs text-muted-foreground line-clamp-1">{item.description}</p>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  {Math.round(item.relevanceScore)}%
                                </Badge>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <LuSparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground mb-2">正在准备个性化推荐</p>
                  <p className="text-sm text-muted-foreground">
                    完善您的个人资料以获得更好的推荐
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="trending">
            {/* Trending Searches */}
            {trending && trending.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LuTrendingUp className="h-5 w-5 text-primary" />
                    热门搜索
                  </CardTitle>
                  <CardDescription>社区中最受关注的搜索关键词</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {trending.map((trend, idx) => (
                      <div key={trend.query} className="flex items-center justify-between p-2 rounded-lg hover:bg-secondary">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-mono text-muted-foreground w-6">
                            {idx + 1}
                          </span>
                          <button
                            onClick={() => setQuery(trend.query)}
                            className="text-sm font-medium hover:text-primary"
                          >
                            {trend.query}
                          </button>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {trend.count} 次搜索
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <LuTrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground">正在加载热门搜索</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}