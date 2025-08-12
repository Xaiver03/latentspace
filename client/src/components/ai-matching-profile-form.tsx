import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { LuX } from "react-icons/lu";

const profileSchema = z.object({
  roleIntent: z.enum(["CEO", "CTO", "CPO", "CMO", "COO", "CFO", "Technical", "Business"]),
  seniority: z.enum(["student", "junior", "mid", "senior"]),
  timezone: z.string().min(1, "请选择时区"),
  weeklyHours: z.number().min(5).max(80),
  locationCity: z.string().min(1, "请输入城市"),
  remotePref: z.enum(["remote_first", "hybrid", "onsite_first"]),
  equityExpectation: z.number().min(0).max(100).optional(),
  salaryExpectation: z.number().min(0).optional(),
  visaConstraint: z.boolean(),
  skills: z.array(z.string()),
  industries: z.array(z.string()),
  techStack: z.array(z.string()),
  riskTolerance: z.number().min(1).max(10).optional(),
  bio: z.string().optional(),
});

type ProfileFormData = z.infer<typeof profileSchema>;

export function AiMatchingProfileForm() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [skillInput, setSkillInput] = useState("");
  const [industryInput, setIndustryInput] = useState("");
  const [techInput, setTechInput] = useState("");

  // Fetch existing profile
  const { data: profile } = useQuery({
    queryKey: ["/api/matching/profile"],
  });

  const form = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: profile || {
      roleIntent: "Technical",
      seniority: "mid",
      timezone: "UTC+8",
      weeklyHours: 40,
      locationCity: "",
      remotePref: "hybrid",
      equityExpectation: undefined,
      salaryExpectation: undefined,
      visaConstraint: false,
      skills: [],
      industries: [],
      techStack: [],
      riskTolerance: 5,
      bio: "",
    },
  });

  const updateProfile = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      const response = await fetch("/api/matching/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update profile");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "资料已更新",
        description: "您的匹配画像已成功保存",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/matching/profile"] });
      queryClient.invalidateQueries({ queryKey: ["/api/matching/insights"] });
    },
  });

  const onSubmit = (data: ProfileFormData) => {
    updateProfile.mutate(data);
  };

  const addSkill = () => {
    if (skillInput.trim()) {
      const currentSkills = form.getValues("skills");
      if (!currentSkills.includes(skillInput.trim())) {
        form.setValue("skills", [...currentSkills, skillInput.trim()]);
      }
      setSkillInput("");
    }
  };

  const addIndustry = () => {
    if (industryInput.trim()) {
      const currentIndustries = form.getValues("industries");
      if (!currentIndustries.includes(industryInput.trim())) {
        form.setValue("industries", [...currentIndustries, industryInput.trim()]);
      }
      setIndustryInput("");
    }
  };

  const addTech = () => {
    if (techInput.trim()) {
      const currentTech = form.getValues("techStack");
      if (!currentTech.includes(techInput.trim())) {
        form.setValue("techStack", [...currentTech, techInput.trim()]);
      }
      setTechInput("");
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>您的角色定位和基本情况</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="roleIntent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>期望角色</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择您的期望角色" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="CEO">CEO - 首席执行官</SelectItem>
                      <SelectItem value="CTO">CTO - 首席技术官</SelectItem>
                      <SelectItem value="CPO">CPO - 首席产品官</SelectItem>
                      <SelectItem value="CMO">CMO - 首席营销官</SelectItem>
                      <SelectItem value="COO">COO - 首席运营官</SelectItem>
                      <SelectItem value="CFO">CFO - 首席财务官</SelectItem>
                      <SelectItem value="Technical">技术合伙人</SelectItem>
                      <SelectItem value="Business">商业合伙人</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="seniority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>经验水平</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择您的经验水平" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="student">学生</SelectItem>
                      <SelectItem value="junior">初级 (1-3年)</SelectItem>
                      <SelectItem value="mid">中级 (3-7年)</SelectItem>
                      <SelectItem value="senior">高级 (7年+)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="locationCity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>所在城市</FormLabel>
                  <FormControl>
                    <Input placeholder="例如：北京、上海、深圳" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>时区</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择您的时区" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="UTC+8">UTC+8 (北京时间)</SelectItem>
                      <SelectItem value="UTC+9">UTC+9 (东京/首尔)</SelectItem>
                      <SelectItem value="UTC+0">UTC+0 (伦敦)</SelectItem>
                      <SelectItem value="UTC-5">UTC-5 (纽约)</SelectItem>
                      <SelectItem value="UTC-8">UTC-8 (洛杉矶)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Work Preferences */}
        <Card>
          <CardHeader>
            <CardTitle>工作偏好</CardTitle>
            <CardDescription>您的工作方式和时间安排</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="weeklyHours"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>每周可投入时间 ({field.value} 小时)</FormLabel>
                  <FormControl>
                    <Slider
                      min={5}
                      max={80}
                      step={5}
                      value={[field.value]}
                      onValueChange={(value) => field.onChange(value[0])}
                    />
                  </FormControl>
                  <FormDescription>
                    您每周可以投入到创业项目的时间
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="remotePref"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>工作地点偏好</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="选择工作地点偏好" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="remote_first">远程优先</SelectItem>
                      <SelectItem value="hybrid">混合办公</SelectItem>
                      <SelectItem value="onsite_first">线下优先</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="riskTolerance"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>风险承受度 ({field.value || 5}/10)</FormLabel>
                  <FormControl>
                    <Slider
                      min={1}
                      max={10}
                      step={1}
                      value={[field.value || 5]}
                      onValueChange={(value) => field.onChange(value[0])}
                    />
                  </FormControl>
                  <FormDescription>
                    1 = 保守稳健，10 = 激进冒险
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Skills & Experience */}
        <Card>
          <CardHeader>
            <CardTitle>技能与经验</CardTitle>
            <CardDescription>您的专业技能和行业背景</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Skills */}
            <FormField
              control={form.control}
              name="skills"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>核心技能</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="输入技能，按回车添加"
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addSkill();
                        }
                      }}
                    />
                    <Button type="button" onClick={addSkill}>
                      添加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value.map((skill, idx) => (
                      <Badge key={idx} variant="secondary" className="pl-2 pr-1">
                        {skill}
                        <button
                          type="button"
                          className="ml-1 hover:text-destructive"
                          onClick={() => {
                            const newSkills = field.value.filter((_, i) => i !== idx);
                            field.onChange(newSkills);
                          }}
                        >
                          <LuX className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Industries */}
            <FormField
              control={form.control}
              name="industries"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>感兴趣的行业</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="输入行业，按回车添加"
                      value={industryInput}
                      onChange={(e) => setIndustryInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addIndustry();
                        }
                      }}
                    />
                    <Button type="button" onClick={addIndustry}>
                      添加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value.map((industry, idx) => (
                      <Badge key={idx} variant="secondary" className="pl-2 pr-1">
                        {industry}
                        <button
                          type="button"
                          className="ml-1 hover:text-destructive"
                          onClick={() => {
                            const newIndustries = field.value.filter((_, i) => i !== idx);
                            field.onChange(newIndustries);
                          }}
                        >
                          <LuX className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tech Stack */}
            <FormField
              control={form.control}
              name="techStack"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>技术栈</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      placeholder="输入技术，按回车添加"
                      value={techInput}
                      onChange={(e) => setTechInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addTech();
                        }
                      }}
                    />
                    <Button type="button" onClick={addTech}>
                      添加
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {field.value.map((tech, idx) => (
                      <Badge key={idx} variant="secondary" className="pl-2 pr-1">
                        {tech}
                        <button
                          type="button"
                          className="ml-1 hover:text-destructive"
                          onClick={() => {
                            const newTech = field.value.filter((_, i) => i !== idx);
                            field.onChange(newTech);
                          }}
                        >
                          <LuX className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Financial Expectations */}
        <Card>
          <CardHeader>
            <CardTitle>财务期望</CardTitle>
            <CardDescription>您的股权和薪资期望（选填）</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="equityExpectation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>股权期望 (%)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="例如：5"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormDescription>
                    您期望的股权比例
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="salaryExpectation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>年薪期望 (USD)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="例如：100000"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormDescription>
                    您期望的年薪水平
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Bio */}
        <Card>
          <CardHeader>
            <CardTitle>个人简介</CardTitle>
            <CardDescription>让潜在合伙人更好地了解您</CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      placeholder="介绍一下您的背景、经历、创业愿景..."
                      className="min-h-[120px]"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    这将用于生成您的匹配向量
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
          {updateProfile.isPending ? "保存中..." : "保存画像"}
        </Button>
      </form>
    </Form>
  );
}