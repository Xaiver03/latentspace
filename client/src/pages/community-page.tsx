import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Brain, Plus, Search, Download, ExternalLink, Github } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertAgentProductSchema } from "@shared/schema";
import { z } from "zod";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import Navbar from "@/components/navbar";
import type { AgentProduct } from "@shared/schema";

const productFormSchema = insertAgentProductSchema.extend({
  tags: z.array(z.string()).optional(),
});

type ProductForm = z.infer<typeof productFormSchema>;

export default function CommunityPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: products = [], isLoading } = useQuery<AgentProduct[]>({
    queryKey: ["/api/agent-products"],
  });

  const createProductMutation = useMutation({
    mutationFn: async (productData: ProductForm) => {
      return await apiRequest("POST", "/api/agent-products", productData);
    },
    onSuccess: () => {
      toast({
        title: "产品创建成功",
        description: "您的Agent产品已成功创建",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/agent-products"] });
      setIsCreateDialogOpen(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "创建失败",
        description: "创建产品时发生错误，请重试",
        variant: "destructive",
      });
    },
  });

  const form = useForm<ProductForm>({
    resolver: zodResolver(productFormSchema),
    defaultValues: {
      name: "",
      description: "",
      category: "research",
      status: "development",
      demoUrl: "",
      githubUrl: "",
      tags: [],
    },
  });

  const filteredProducts = products.filter(product => {
    const matchesFilter = filter === "all" || product.status === filter;
    const matchesSearch = searchTerm === "" || 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.description.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const onSubmit = (data: ProductForm) => {
    createProductMutation.mutate(data);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "published":
        return "已发布";
      case "testing":
        return "测试中";
      case "development":
        return "开发中";
      default:
        return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800";
      case "testing":
        return "bg-blue-100 text-blue-800";
      case "development":
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
            <h1 className="text-3xl font-bold text-gray-900">内容社区</h1>
            <p className="text-gray-600">发现最新AI Agent产品和研究成果</p>
          </div>
          
          {user && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary-blue hover:bg-primary-dark">
                  <Plus className="w-4 h-4 mr-2" />
                  发布产品
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>发布Agent产品</DialogTitle>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div>
                    <Label htmlFor="name">产品名称</Label>
                    <Input
                      id="name"
                      {...form.register("name")}
                      placeholder="请输入产品名称"
                    />
                    {form.formState.errors.name && (
                      <p className="text-sm text-red-500 mt-1">
                        {form.formState.errors.name.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description">产品描述</Label>
                    <Textarea
                      id="description"
                      {...form.register("description")}
                      placeholder="请详细描述您的Agent产品功能和特点"
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
                      <Label htmlFor="category">产品类别</Label>
                      <Select onValueChange={(value) => form.setValue("category", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择产品类别" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="research">科研助手</SelectItem>
                          <SelectItem value="analysis">数据分析</SelectItem>
                          <SelectItem value="writing">写作助手</SelectItem>
                          <SelectItem value="visualization">可视化</SelectItem>
                          <SelectItem value="other">其他</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="status">开发状态</Label>
                      <Select onValueChange={(value) => form.setValue("status", value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="请选择开发状态" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="development">开发中</SelectItem>
                          <SelectItem value="testing">测试中</SelectItem>
                          <SelectItem value="published">已发布</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="demoUrl">演示链接（可选）</Label>
                    <Input
                      id="demoUrl"
                      {...form.register("demoUrl")}
                      placeholder="https://example.com/demo"
                    />
                  </div>

                  <div>
                    <Label htmlFor="githubUrl">GitHub链接（可选）</Label>
                    <Input
                      id="githubUrl"
                      {...form.register("githubUrl")}
                      placeholder="https://github.com/username/repo"
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
                      disabled={createProductMutation.isPending}
                    >
                      {createProductMutation.isPending ? "发布中..." : "发布产品"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Content Categories */}
        <div className="flex justify-center mb-8">
          <div className="bg-gray-100 p-1 rounded-lg flex">
            <Button
              variant={filter === "all" ? "default" : "ghost"}
              onClick={() => setFilter("all")}
              className={filter === "all" ? "bg-white text-primary-blue shadow-sm" : ""}
            >
              全部产品
            </Button>
            <Button
              variant={filter === "published" ? "default" : "ghost"}
              onClick={() => setFilter("published")}
              className={filter === "published" ? "bg-white text-primary-blue shadow-sm" : ""}
            >
              已发布
            </Button>
            <Button
              variant={filter === "testing" ? "default" : "ghost"}
              onClick={() => setFilter("testing")}
              className={filter === "testing" ? "bg-white text-primary-blue shadow-sm" : ""}
            >
              测试中
            </Button>
            <Button
              variant={filter === "development" ? "default" : "ghost"}
              onClick={() => setFilter("development")}
              className={filter === "development" ? "bg-white text-primary-blue shadow-sm" : ""}
            >
              开发中
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md mx-auto mb-8">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="搜索Agent产品..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-12 w-12 bg-gray-200 rounded-lg mb-4"></div>
                  <div className="h-4 bg-gray-200 rounded mb-2"></div>
                  <div className="h-20 bg-gray-200 rounded mb-4"></div>
                  <div className="h-8 bg-gray-200 rounded"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : filteredProducts.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="bg-gray-50 hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-primary-blue text-white w-12 h-12 rounded-lg flex items-center justify-center">
                      <Brain className="w-6 h-6" />
                    </div>
                    <Badge className={getStatusColor(product.status)}>
                      {getStatusLabel(product.status)}
                    </Badge>
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{product.name}</h3>
                  <p className="text-gray-600 text-sm mb-4 line-clamp-3">{product.description}</p>
                  
                  <div className="flex items-center justify-between mb-4">
                    <div className="text-gray-500 text-sm">
                      <Download className="w-4 h-4 inline mr-1" />
                      使用次数: {product.usageCount || 0}
                    </div>
                    <div className="text-gray-500 text-sm">
                      分类: {product.category}
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4">
                    {product.demoUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(product.demoUrl, "_blank")}
                        className="flex-1"
                      >
                        <ExternalLink className="w-4 h-4 mr-1" />
                        演示
                      </Button>
                    )}
                    {product.githubUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => window.open(product.githubUrl, "_blank")}
                        className="flex-1"
                      >
                        <Github className="w-4 h-4 mr-1" />
                        代码
                      </Button>
                    )}
                  </div>

                  <Button 
                    className="w-full"
                    disabled={product.status === "development"}
                    variant={product.status === "published" ? "default" : "secondary"}
                  >
                    {product.status === "development" 
                      ? "即将发布" 
                      : product.status === "testing" 
                      ? "预览体验" 
                      : "立即体验"
                    }
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Brain className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">暂无产品</h3>
            <p className="text-gray-500">
              {searchTerm ? "没有找到匹配的产品" : "请稍后查看最新Agent产品"}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
