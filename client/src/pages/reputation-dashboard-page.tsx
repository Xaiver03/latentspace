import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  Trophy, Medal, Star, Shield, TrendingUp, Clock, 
  Coins, Award, Gavel, Link, ExternalLink, Info,
  ThumbsUp, Lock, LockOpen, AlertTriangle, CheckCircle,
  BarChart3, Users, Heart, Brain, GitBranch
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";

interface ReputationStats {
  score: {
    totalScore: string;
    level: number;
    rank: string;
    matchingScore: string;
    contributionScore: string;
    collaborationScore: string;
    communityScore: string;
    verificationLevel: number;
    trustScore: string;
    totalTransactions: number;
    successfulMatches: number;
    failedMatches: number;
    walletAddress?: string;
  };
  recentTransactions: Array<{
    id: number;
    type: string;
    category: string;
    amount: string;
    reason: string;
    createdAt: string;
    txHash?: string;
    status: string;
  }>;
  achievements: Array<{
    id: number;
    type: string;
    title: string;
    description: string;
    currentProgress: number;
    maxProgress: number;
    progressPercentage: number;
    unlockedAt?: string;
    tokenId?: string;
    rarity?: string;
  }>;
  endorsements: Array<{
    id: number;
    skill: string;
    level: number;
    comment?: string;
    weight: string;
    endorserName: string;
    endorserAvatar?: string;
    createdAt: string;
  }>;
  activeStakes: Array<{
    id: number;
    stakeType: string;
    amount: string;
    lockedUntil: string;
    status: string;
  }>;
  rank: {
    current: string;
    nextRank: string;
    progress: number;
  };
}

const endorsementSchema = z.object({
  endorsedId: z.number(),
  skill: z.string().min(1, "Skill is required"),
  level: z.number().min(1).max(5),
  comment: z.string().max(500).optional(),
});

const stakeSchema = z.object({
  stakeType: z.enum(["match_guarantee", "project_commitment", "quality_pledge"]),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, "Invalid amount"),
  duration: z.number().min(1).max(365),
});

export function ReputationDashboardPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showEndorseDialog, setShowEndorseDialog] = useState(false);
  const [showStakeDialog, setShowStakeDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);

  // Fetch reputation stats
  const { data: stats, isLoading } = useQuery<ReputationStats>({
    queryKey: ["/api/reputation/my"],
  });

  // Fetch leaderboard
  const { data: leaderboard } = useQuery<{
    leaderboard: Array<{
      user: { id: number; fullName: string; avatarUrl?: string };
      score: { totalScore: string; rank: string };
      rank: number;
    }>;
  }>({
    queryKey: ["/api/reputation/leaderboard"],
  });

  // Fetch achievement catalog
  const { data: achievements } = useQuery<{
    catalog: Array<{
      type: string;
      title: string;
      description: string;
      rarity: string;
      requirements: string;
    }>;
  }>({
    queryKey: ["/api/reputation/achievements/catalog"],
  });

  // Endorsement form
  const endorsementForm = useForm<z.infer<typeof endorsementSchema>>({
    resolver: zodResolver(endorsementSchema),
    defaultValues: {
      endorsedId: 0,
      skill: "",
      level: 3,
      comment: "",
    },
  });

  // Stake form
  const stakeForm = useForm<z.infer<typeof stakeSchema>>({
    resolver: zodResolver(stakeSchema),
    defaultValues: {
      stakeType: "match_guarantee",
      amount: "",
      duration: 30,
    },
  });

  // Mutations
  const endorseMutation = useMutation({
    mutationFn: async (data: z.infer<typeof endorsementSchema>) => {
      const response = await fetch("/api/reputation/endorsements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create endorsement");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "认可成功", description: "您的认可已记录" });
      queryClient.invalidateQueries({ queryKey: ["/api/reputation"] });
      setShowEndorseDialog(false);
      endorsementForm.reset();
    },
  });

  const stakeMutation = useMutation({
    mutationFn: async (data: z.infer<typeof stakeSchema>) => {
      const lockedUntil = new Date();
      lockedUntil.setDate(lockedUntil.getDate() + data.duration);
      
      const response = await fetch("/api/reputation/stakes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          lockedUntil: lockedUntil.toISOString(),
        }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create stake");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "质押成功", description: "您的信誉已质押" });
      queryClient.invalidateQueries({ queryKey: ["/api/reputation"] });
      setShowStakeDialog(false);
      stakeForm.reset();
    },
  });

  const getRankIcon = (rank: string) => {
    switch (rank) {
      case "visionary": return { icon: Trophy, color: "text-yellow-500" };
      case "leader": return { icon: Medal, color: "text-purple-500" };
      case "expert": return { icon: Star, color: "text-blue-500" };
      case "contributor": return { icon: Award, color: "text-green-500" };
      default: return { icon: Shield, color: "text-gray-500" };
    }
  };

  const getRankBadgeColor = (rank: string) => {
    switch (rank) {
      case "visionary": return "bg-gradient-to-r from-yellow-400 to-amber-500 text-white";
      case "leader": return "bg-gradient-to-r from-purple-400 to-purple-600 text-white";
      case "expert": return "bg-gradient-to-r from-blue-400 to-blue-600 text-white";
      case "contributor": return "bg-gradient-to-r from-green-400 to-green-600 text-white";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case "match_success": return { icon: CheckCircle, color: "text-green-500" };
      case "contribution": return { icon: GitBranch, color: "text-blue-500" };
      case "peer_review": return { icon: ThumbsUp, color: "text-purple-500" };
      case "community_vote": return { icon: Users, color: "text-orange-500" };
      case "penalty": return { icon: AlertTriangle, color: "text-red-500" };
      default: return { icon: Coins, color: "text-gray-500" };
    }
  };

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary": return "bg-gradient-to-r from-yellow-400 to-amber-500 text-white";
      case "epic": return "bg-gradient-to-r from-purple-400 to-purple-600 text-white";
      case "rare": return "bg-gradient-to-r from-blue-400 to-blue-600 text-white";
      case "common": return "bg-gradient-to-r from-gray-400 to-gray-600 text-white";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const radarData = stats ? [
    {
      subject: '匹配',
      value: parseFloat(stats.score.matchingScore),
      fullMark: 1000,
    },
    {
      subject: '贡献',
      value: parseFloat(stats.score.contributionScore),
      fullMark: 1000,
    },
    {
      subject: '协作',
      value: parseFloat(stats.score.collaborationScore),
      fullMark: 1000,
    },
    {
      subject: '社区',
      value: parseFloat(stats.score.communityScore),
      fullMark: 1000,
    },
  ] : [];

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">信誉仪表板</h1>
            <p className="text-muted-foreground">
              基于区块链的去中心化信誉系统
            </p>
          </div>
          {stats?.score.walletAddress && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                <Link className="h-3 w-3 mr-1" />
                {stats.score.walletAddress.slice(0, 6)}...{stats.score.walletAddress.slice(-4)}
              </Badge>
              <Button variant="ghost" size="sm">
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">总信誉分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {stats?.score.totalScore || "0"}
                </div>
                <p className="text-xs text-muted-foreground">
                  等级 {stats?.score.level || 1}
                </p>
              </div>
              <div className={`p-3 rounded-full ${getRankIcon(stats?.score.rank || "").color} bg-opacity-10`}>
                {(() => {
                  const { icon: Icon } = getRankIcon(stats?.score.rank || "");
                  return <Icon className="h-6 w-6" />;
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">信任评分</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {(parseFloat(stats?.score.trustScore || "0") * 100).toFixed(0)}%
                </div>
                <Progress 
                  value={parseFloat(stats?.score.trustScore || "0") * 100} 
                  className="h-2 mt-2"
                />
              </div>
              <div className="p-3 rounded-full text-blue-500 bg-blue-50">
                <Shield className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">成功匹配</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-2xl font-bold">
                  {stats?.score.successfulMatches || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  总计 {stats?.score.totalTransactions || 0} 次
                </p>
              </div>
              <div className="p-3 rounded-full text-green-500 bg-green-50">
                <Heart className="h-6 w-6" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">当前等级</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Badge className={getRankBadgeColor(stats?.score.rank || "")}>
                {stats?.score.rank === "visionary" ? "远见者" :
                 stats?.score.rank === "leader" ? "领导者" :
                 stats?.score.rank === "expert" ? "专家" :
                 stats?.score.rank === "contributor" ? "贡献者" : "新人"}
              </Badge>
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span>升级进度</span>
                  <span>{stats?.rank.progress.toFixed(0)}%</span>
                </div>
                <Progress value={stats?.rank.progress || 0} className="h-2" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="transactions">交易记录</TabsTrigger>
          <TabsTrigger value="achievements">成就</TabsTrigger>
          <TabsTrigger value="endorsements">认可</TabsTrigger>
          <TabsTrigger value="stakes">质押</TabsTrigger>
          <TabsTrigger value="leaderboard">排行榜</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Reputation Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>信誉分布</CardTitle>
                <CardDescription>各类别信誉评分分布</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={90} domain={[0, 1000]} />
                    <Radar name="信誉分" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.6} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>近期活动</CardTitle>
                <CardDescription>最近的信誉变化</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats?.recentTransactions.slice(0, 5).map((tx) => {
                    const { icon: Icon, color } = getTransactionIcon(tx.type);
                    return (
                      <div key={tx.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${color} bg-opacity-10`}>
                            <Icon className={`h-4 w-4 ${color}`} />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{tx.reason}</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-medium ${
                            parseFloat(tx.amount) > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {parseFloat(tx.amount) > 0 ? '+' : ''}{tx.amount}
                          </p>
                          {tx.txHash && (
                            <Badge variant="outline" className="text-xs">
                              <Link className="h-2 w-2 mr-1" />
                              已上链
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center">
                  <ThumbsUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <h3 className="font-semibold mb-1">认可他人</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    为其他用户的技能背书
                  </p>
                  <Dialog open={showEndorseDialog} onOpenChange={setShowEndorseDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        给予认可
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>认可用户技能</DialogTitle>
                        <DialogDescription>
                          为其他用户的专业技能提供认可
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...endorsementForm}>
                        <form onSubmit={endorsementForm.handleSubmit((data) => endorseMutation.mutate(data))} className="space-y-4">
                          <FormField
                            control={endorsementForm.control}
                            name="endorsedId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>用户ID</FormLabel>
                                <FormControl>
                                  <Input type="number" placeholder="输入要认可的用户ID" {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={endorsementForm.control}
                            name="skill"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>技能</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="选择技能类别" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="leadership">领导力</SelectItem>
                                    <SelectItem value="technical">技术能力</SelectItem>
                                    <SelectItem value="communication">沟通能力</SelectItem>
                                    <SelectItem value="creativity">创造力</SelectItem>
                                    <SelectItem value="execution">执行力</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={endorsementForm.control}
                            name="level"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>评级 (1-5)</FormLabel>
                                <FormControl>
                                  <Input type="number" min={1} max={5} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={endorsementForm.control}
                            name="comment"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>评语（可选）</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="描述您的认可理由..." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setShowEndorseDialog(false)}>
                              取消
                            </Button>
                            <Button type="submit" disabled={endorseMutation.isPending}>
                              {endorseMutation.isPending ? "提交中..." : "提交认可"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Lock className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <h3 className="font-semibold mb-1">质押信誉</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    为承诺质押信誉分
                  </p>
                  <Dialog open={showStakeDialog} onOpenChange={setShowStakeDialog}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        创建质押
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>质押信誉</DialogTitle>
                        <DialogDescription>
                          质押信誉分以证明您的承诺
                        </DialogDescription>
                      </DialogHeader>
                      <Form {...stakeForm}>
                        <form onSubmit={stakeForm.handleSubmit((data) => stakeMutation.mutate(data))} className="space-y-4">
                          <FormField
                            control={stakeForm.control}
                            name="stakeType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>质押类型</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="match_guarantee">匹配保证</SelectItem>
                                    <SelectItem value="project_commitment">项目承诺</SelectItem>
                                    <SelectItem value="quality_pledge">质量保证</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={stakeForm.control}
                            name="amount"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>质押金额</FormLabel>
                                <FormControl>
                                  <Input placeholder="输入质押的信誉分" {...field} />
                                </FormControl>
                                <p className="text-xs text-muted-foreground mt-1">
                                  最多可质押总信誉分的20%: {((parseFloat(stats?.score.totalScore || "0") * 0.2).toFixed(2))}
                                </p>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={stakeForm.control}
                            name="duration"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>锁定天数</FormLabel>
                                <FormControl>
                                  <Input type="number" min={1} max={365} {...field} onChange={e => field.onChange(parseInt(e.target.value))} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="flex justify-end gap-2">
                            <Button type="button" variant="outline" onClick={() => setShowStakeDialog(false)}>
                              取消
                            </Button>
                            <Button type="submit" disabled={stakeMutation.isPending}>
                              {stakeMutation.isPending ? "质押中..." : "确认质押"}
                            </Button>
                          </div>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="text-center">
                  <Gavel className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                  <h3 className="font-semibold mb-1">参与治理</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    对平台决策进行投票
                  </p>
                  <Button variant="outline" size="sm">
                    查看提案
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>交易历史</CardTitle>
              <CardDescription>所有信誉变化记录</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.recentTransactions.map((tx) => {
                  const { icon: Icon, color } = getTransactionIcon(tx.type);
                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-full ${color} bg-opacity-10`}>
                          <Icon className={`h-5 w-5 ${color}`} />
                        </div>
                        <div>
                          <p className="font-medium">{tx.reason}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">{tx.category}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${
                          parseFloat(tx.amount) > 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {parseFloat(tx.amount) > 0 ? '+' : ''}{tx.amount}
                        </p>
                        {tx.txHash && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="secondary" className="text-xs cursor-pointer">
                                  <Link className="h-3 w-3 mr-1" />
                                  {tx.status === "confirmed" ? "已确认" : "待确认"}
                                </Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="font-mono text-xs">{tx.txHash}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="achievements">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>已解锁成就</CardTitle>
                <CardDescription>您获得的成就NFT</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {stats?.achievements.filter(a => a.unlockedAt).map((achievement) => (
                    <Card key={achievement.id} className="border-2">
                      <CardContent className="pt-6">
                        <div className="text-center">
                          <div className="mb-4">
                            <Award className="h-12 w-12 mx-auto text-yellow-500" />
                          </div>
                          <h3 className="font-semibold mb-1">{achievement.title}</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            {achievement.description}
                          </p>
                          <Badge className={getRarityColor(achievement.rarity || "common")}>
                            {achievement.rarity === "legendary" ? "传奇" :
                             achievement.rarity === "epic" ? "史诗" :
                             achievement.rarity === "rare" ? "稀有" : "普通"}
                          </Badge>
                          {achievement.tokenId && (
                            <p className="text-xs text-muted-foreground mt-2">
                              NFT #{achievement.tokenId}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>成就进度</CardTitle>
                <CardDescription>正在进行中的成就</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {achievements?.catalog.map((achievement) => {
                    const userAchievement = stats?.achievements.find(a => a.type === achievement.type);
                    const progress = userAchievement?.progressPercentage || 0;
                    const isUnlocked = !!userAchievement?.unlockedAt;
                    
                    return (
                      <div key={achievement.type} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{achievement.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {achievement.requirements}
                            </p>
                          </div>
                          {isUnlocked ? (
                            <Badge variant="secondary">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              已解锁
                            </Badge>
                          ) : (
                            <span className="text-sm font-medium">{progress}%</span>
                          )}
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="endorsements">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>收到的认可</CardTitle>
                <CardDescription>其他用户对您的技能认可</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.endorsements.map((endorsement) => (
                    <div key={endorsement.id} className="flex items-start gap-3">
                      <Avatar>
                        <AvatarImage src={endorsement.endorserAvatar} />
                        <AvatarFallback>{endorsement.endorserName[0]}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium">{endorsement.endorserName}</p>
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < endorsement.level
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </div>
                        <Badge variant="outline" className="mb-2">{endorsement.skill}</Badge>
                        {endorsement.comment && (
                          <p className="text-sm text-muted-foreground">
                            {endorsement.comment}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          权重: {endorsement.weight}x · {new Date(endorsement.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>技能分布</CardTitle>
                <CardDescription>各项技能的认可统计</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {["领导力", "技术能力", "沟通能力", "创造力", "执行力"].map((skill) => {
                    const skillEndorsements = stats?.endorsements.filter(e => 
                      e.skill === skill.toLowerCase().replace("能力", "")
                    ) || [];
                    const avgLevel = skillEndorsements.length > 0
                      ? skillEndorsements.reduce((sum, e) => sum + e.level, 0) / skillEndorsements.length
                      : 0;
                    
                    return (
                      <div key={skill}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium">{skill}</span>
                          <span className="text-sm text-muted-foreground">
                            {skillEndorsements.length} 认可
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Progress value={avgLevel * 20} className="flex-1 h-2" />
                          <span className="text-xs font-medium w-12 text-right">
                            {avgLevel.toFixed(1)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="stakes">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>活跃质押</CardTitle>
                <CardDescription>当前锁定的信誉质押</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {stats?.activeStakes.map((stake) => (
                    <div key={stake.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="font-medium">
                            {stake.stakeType === "match_guarantee" ? "匹配保证" :
                             stake.stakeType === "project_commitment" ? "项目承诺" :
                             "质量保证"}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            锁定至 {new Date(stake.lockedUntil).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-semibold">{stake.amount} 分</p>
                          <Badge variant={stake.status === "active" ? "default" : "secondary"}>
                            {stake.status === "active" ? "活跃" : stake.status}
                          </Badge>
                        </div>
                      </div>
                      <Progress 
                        value={
                          Math.max(0, Math.min(100, 
                            ((new Date(stake.lockedUntil).getTime() - Date.now()) / 
                            (new Date(stake.lockedUntil).getTime() - Date.now() + 30 * 24 * 60 * 60 * 1000)) * 100
                          ))
                        } 
                        className="h-2"
                      />
                    </div>
                  ))}
                  
                  {stats?.activeStakes.length === 0 && (
                    <div className="text-center py-8">
                      <Lock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">暂无活跃质押</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>质押说明</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="p-2 rounded-full bg-blue-50">
                      <Info className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">匹配保证</h4>
                      <p className="text-sm text-muted-foreground">
                        为您的匹配意向提供担保，成功匹配后可获得10%奖励
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="p-2 rounded-full bg-green-50">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">项目承诺</h4>
                      <p className="text-sm text-muted-foreground">
                        为项目里程碑提供担保，按时完成可获得奖励
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="p-2 rounded-full bg-purple-50">
                      <Shield className="h-4 w-4 text-purple-500" />
                    </div>
                    <div>
                      <h4 className="font-medium mb-1">质量保证</h4>
                      <p className="text-sm text-muted-foreground">
                        为内容或服务质量提供担保，获得用户信任
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard">
          <Card>
            <CardHeader>
              <CardTitle>信誉排行榜</CardTitle>
              <CardDescription>平台用户信誉排名</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leaderboard?.leaderboard.map((entry, index) => (
                  <div key={entry.user.id} className="flex items-center gap-4 p-4 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="text-2xl font-bold text-muted-foreground w-12">
                      #{entry.rank}
                    </div>
                    <Avatar>
                      <AvatarImage src={entry.user.avatarUrl} />
                      <AvatarFallback>{entry.user.fullName[0]}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{entry.user.fullName}</p>
                      <Badge variant="outline" className={getRankBadgeColor(entry.score.rank)}>
                        {entry.score.rank}
                      </Badge>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold">{entry.score.totalScore}</p>
                      <p className="text-sm text-muted-foreground">信誉分</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}