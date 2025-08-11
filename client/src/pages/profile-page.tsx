import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { Edit, Save, X, Upload } from "lucide-react";

interface UserProfile {
  id: number;
  username: string;
  email: string;
  fullName: string;
  researchField?: string;
  affiliation?: string;
  bio?: string;
  avatarUrl?: string;
  role: string;
  isApproved: boolean;
  createdAt: string;
}

interface ProfileUpdateData {
  fullName: string;
  researchField?: string;
  affiliation?: string;
  bio?: string;
  avatarUrl?: string;
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

const researchFields = [
  "人工智能",
  "机器学习", 
  "深度学习",
  "计算机视觉",
  "自然语言处理",
  "生物技术",
  "量子计算",
  "区块链",
  "网络安全",
  "数据科学",
  "其他"
];

export function ProfilePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<ProfileUpdateData>({
    fullName: "",
    researchField: "",
    affiliation: "",
    bio: "",
    avatarUrl: "",
  });

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ["/api/users/profile", user?.id],
    queryFn: () => apiRequest("GET", "/api/users/profile"),
    enabled: !!user,
  });

  useEffect(() => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || "",
        researchField: profile.researchField || "",
        affiliation: profile.affiliation || "",
        bio: profile.bio || "",
        avatarUrl: profile.avatarUrl || "",
      });
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileUpdateData) => 
      apiRequest("PUT", "/api/users/profile", data),
    onSuccess: () => {
      toast({
        title: "更新成功",
        description: "您的个人资料已更新",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users/profile"] });
      setIsEditing(false);
    },
    onError: (error: any) => {
      toast({
        title: "更新失败",
        description: error.error || "更新个人资料时发生错误",
        variant: "destructive",
      });
    },
  });

  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("avatar", file);
      
      const response = await fetch("/api/users/avatar", {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw error;
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      setFormData(prev => ({ ...prev, avatarUrl: data.avatarUrl }));
      toast({
        title: "头像上传成功",
        description: "头像已更新",
      });
    },
    onError: (error: any) => {
      toast({
        title: "头像上传失败",
        description: error.error || "上传头像时发生错误",
        variant: "destructive",
      });
    },
  });

  const handleInputChange = (field: keyof ProfileUpdateData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    updateProfileMutation.mutate(formData);
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        fullName: profile.fullName || "",
        researchField: profile.researchField || "",
        affiliation: profile.affiliation || "",
        bio: profile.bio || "",
        avatarUrl: profile.avatarUrl || "",
      });
    }
    setIsEditing(false);
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        toast({
          title: "文件太大",
          description: "头像文件大小不能超过5MB",
          variant: "destructive",
        });
        return;
      }
      uploadAvatarMutation.mutate(file);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-20 w-20 bg-gray-200 rounded-full mx-auto"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded"></div>
                  <div className="h-4 bg-gray-200 rounded w-5/6"></div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-6 text-center">
              <p>无法加载用户资料</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">个人资料</h1>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              编辑资料
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <Avatar className="w-20 h-20">
                  <AvatarImage src={isEditing ? formData.avatarUrl : profile.avatarUrl} />
                  <AvatarFallback className="text-lg">
                    {profile.fullName?.charAt(0) || profile.username.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1 cursor-pointer hover:bg-primary/90">
                    <Upload className="w-4 h-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl">{profile.fullName || profile.username}</CardTitle>
                <CardDescription>{profile.email}</CardDescription>
                <div className="flex items-center space-x-2">
                  <Badge variant={profile.isApproved ? "default" : "secondary"}>
                    {profile.isApproved ? "已认证" : "待认证"}
                  </Badge>
                  <Badge variant="outline">{profile.role}</Badge>
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {isEditing ? (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="fullName">姓名</Label>
                  <Input
                    id="fullName"
                    value={formData.fullName}
                    onChange={(e) => handleInputChange("fullName", e.target.value)}
                    placeholder="输入您的全名"
                  />
                </div>

                <div>
                  <Label htmlFor="researchField">研究领域</Label>
                  <Select 
                    value={formData.researchField}
                    onValueChange={(value) => handleInputChange("researchField", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择您的研究领域" />
                    </SelectTrigger>
                    <SelectContent>
                      {researchFields.map(field => (
                        <SelectItem key={field} value={field}>{field}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="affiliation">机构/公司</Label>
                  <Input
                    id="affiliation"
                    value={formData.affiliation}
                    onChange={(e) => handleInputChange("affiliation", e.target.value)}
                    placeholder="输入您的机构或公司名称"
                  />
                </div>

                <div>
                  <Label htmlFor="bio">个人简介</Label>
                  <Textarea
                    id="bio"
                    value={formData.bio}
                    onChange={(e) => handleInputChange("bio", e.target.value)}
                    placeholder="介绍一下您自己、研究兴趣或创业想法..."
                    rows={4}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="w-4 h-4 mr-2" />
                    取消
                  </Button>
                  <Button 
                    onClick={handleSave}
                    disabled={updateProfileMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {updateProfileMutation.isPending ? "保存中..." : "保存"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">研究领域</Label>
                  <p className="mt-1">{profile.researchField || "未设置"}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">机构/公司</Label>
                  <p className="mt-1">{profile.affiliation || "未设置"}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">个人简介</Label>
                  <p className="mt-1 whitespace-pre-wrap">{profile.bio || "暂无简介"}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-500">加入时间</Label>
                  <p className="mt-1">{new Date(profile.createdAt).toLocaleDateString("zh-CN")}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}