import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema } from "@shared/schema";
import { z } from "zod";
import { Redirect } from "wouter";
import { Atom, Calendar, Users, Handshake } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "用户名不能为空"),
  password: z.string().min(1, "密码不能为空"),
});

const registerSchema = insertUserSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "密码不匹配",
  path: ["confirmPassword"],
});

type LoginForm = z.infer<typeof loginSchema>;
type RegisterForm = z.infer<typeof registerSchema>;

export default function AuthPage() {
  const { user, loginMutation, registerMutation } = useAuth();
  const [isLogin, setIsLogin] = useState(true);

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      researchField: "",
      affiliation: "",
      bio: "",
      role: "user",
    },
  });

  // Redirect if already logged in
  if (user) {
    return <Redirect to="/" />;
  }

  const onLogin = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegister = (data: RegisterForm) => {
    const { confirmPassword, ...registerData } = data;
    registerMutation.mutate(registerData);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex">
      {/* Left side - Auth forms */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Atom className="w-8 h-8 text-primary-blue" />
              <h1 className="text-2xl font-bold text-gray-900">潜空间</h1>
            </div>
            <p className="text-gray-600">连接科研与创业的桥梁</p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                {isLogin ? "登录账户" : "创建账户"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLogin ? (
                <form onSubmit={loginForm.handleSubmit(onLogin)} className="space-y-4">
                  <div>
                    <Label htmlFor="username">用户名</Label>
                    <Input
                      id="username"
                      {...loginForm.register("username")}
                      placeholder="请输入用户名"
                    />
                    {loginForm.formState.errors.username && (
                      <p className="text-sm text-red-500 mt-1">
                        {loginForm.formState.errors.username.message}
                      </p>
                    )}
                  </div>
                  
                  <div>
                    <Label htmlFor="password">密码</Label>
                    <Input
                      id="password"
                      type="password"
                      {...loginForm.register("password")}
                      placeholder="请输入密码"
                    />
                    {loginForm.formState.errors.password && (
                      <p className="text-sm text-red-500 mt-1">
                        {loginForm.formState.errors.password.message}
                      </p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary-blue hover:bg-primary-dark"
                    disabled={loginMutation.isPending}
                  >
                    {loginMutation.isPending ? "登录中..." : "登录"}
                  </Button>
                </form>
              ) : (
                <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="fullName">姓名</Label>
                      <Input
                        id="fullName"
                        {...registerForm.register("fullName")}
                        placeholder="请输入姓名"
                      />
                      {registerForm.formState.errors.fullName && (
                        <p className="text-sm text-red-500 mt-1">
                          {registerForm.formState.errors.fullName.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="username">用户名</Label>
                      <Input
                        id="username"
                        {...registerForm.register("username")}
                        placeholder="请输入用户名"
                      />
                      {registerForm.formState.errors.username && (
                        <p className="text-sm text-red-500 mt-1">
                          {registerForm.formState.errors.username.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="email">邮箱</Label>
                    <Input
                      id="email"
                      type="email"
                      {...registerForm.register("email")}
                      placeholder="your.email@example.com"
                    />
                    {registerForm.formState.errors.email && (
                      <p className="text-sm text-red-500 mt-1">
                        {registerForm.formState.errors.email.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="researchField">研究领域</Label>
                    <Select onValueChange={(value) => registerForm.setValue("researchField", value)}>
                      <SelectTrigger 
                        id="researchField"
                        aria-label="选择研究领域"
                        aria-describedby={registerForm.formState.errors.researchField ? "researchField-error" : undefined}
                      >
                        <SelectValue placeholder="请选择研究领域" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ai">人工智能</SelectItem>
                        <SelectItem value="biotech">生物技术</SelectItem>
                        <SelectItem value="materials">材料科学</SelectItem>
                        <SelectItem value="cs">计算机科学</SelectItem>
                        <SelectItem value="other">其他</SelectItem>
                      </SelectContent>
                    </Select>
                    {registerForm.formState.errors.researchField && (
                      <p id="researchField-error" className="text-sm text-red-500 mt-1" role="alert">
                        {registerForm.formState.errors.researchField.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="affiliation">所属机构</Label>
                    <Input
                      id="affiliation"
                      {...registerForm.register("affiliation")}
                      placeholder="请输入所属机构"
                    />
                  </div>

                  <div>
                    <Label htmlFor="bio">个人简介</Label>
                    <Textarea
                      id="bio"
                      {...registerForm.register("bio")}
                      placeholder="请简述您的研究背景和兴趣方向"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="password">密码</Label>
                      <Input
                        id="password"
                        type="password"
                        {...registerForm.register("password")}
                        placeholder="请输入密码"
                      />
                      {registerForm.formState.errors.password && (
                        <p className="text-sm text-red-500 mt-1">
                          {registerForm.formState.errors.password.message}
                        </p>
                      )}
                    </div>
                    
                    <div>
                      <Label htmlFor="confirmPassword">确认密码</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        {...registerForm.register("confirmPassword")}
                        placeholder="请再次输入密码"
                      />
                      {registerForm.formState.errors.confirmPassword && (
                        <p className="text-sm text-red-500 mt-1">
                          {registerForm.formState.errors.confirmPassword.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-primary-blue hover:bg-primary-dark"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? "注册中..." : "注册"}
                  </Button>
                </form>
              )}

              <div className="mt-4 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-primary-blue"
                >
                  {isLogin ? "还没有账户？立即注册" : "已有账户？立即登录"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Right side - Hero content */}
      <div className="flex-1 bg-primary-blue text-white p-12 flex items-center">
        <div>
          <h2 className="text-4xl font-bold mb-6">欢迎来到潜空间</h2>
          <p className="text-xl text-blue-100 mb-8">
            在GenAI时代，为优秀的研究者提供创业伙伴匹配、前沿技术分享和创业活动参与的综合平台
          </p>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <Calendar className="w-6 h-6 text-blue-200" />
              <span className="text-blue-100">参与前沿技术分享和创业活动</span>
            </div>
            <div className="flex items-center space-x-3">
              <Users className="w-6 h-6 text-blue-200" />
              <span className="text-blue-100">发现最新AI Agent产品和研究成果</span>
            </div>
            <div className="flex items-center space-x-3">
              <Handshake className="w-6 h-6 text-blue-200" />
              <span className="text-blue-100">找到最合适的创业伙伴</span>
            </div>
          </div>

          <div className="mt-8 p-4 bg-blue-600 rounded-lg">
            <h3 className="font-semibold mb-2">平台优势</h3>
            <ul className="text-sm text-blue-100 space-y-1">
              <li>• 奇绩创造生态资源支持</li>
              <li>• 专业的人工审核匹配</li>
              <li>• 定期的主题活动和交流</li>
              <li>• 完善的创业服务体系</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
