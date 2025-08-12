import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { 
  LuPlus, LuUsers, LuClipboardList, LuFileText, LuCalendar, LuBarChart3, 
  LuTarget, LuClock, LuCheckCircle, LuTriangleAlert, LuMessageCircle,
  LuPencil, LuTrash, LuMoreVertical, LuSend
} from "react-icons/lu";
import { motion } from "framer-motion";

interface Workspace {
  id: number;
  name: string;
  description?: string;
  stage: string;
  industry?: string;
  founder: {
    id: number;
    fullName: string;
    avatarUrl?: string;
  };
  coFounders: Array<{
    id: number;
    fullName: string;
    avatarUrl?: string;
  }>;
  memberCount: number;
  taskStats: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
  };
  lastActivity: string;
  createdAt: string;
}

interface Task {
  id: number;
  title: string;
  description?: string;
  status: string;
  priority: string;
  assignee?: {
    id: number;
    fullName: string;
    avatarUrl?: string;
  };
  creator: {
    id: number;
    fullName: string;
  };
  dueDate?: string;
  isOverdue: boolean;
  commentsCount: number;
  createdAt: string;
}

const workspaceSchema = z.object({
  name: z.string().min(1, "Workspace name is required"),
  description: z.string().optional(),
  stage: z.enum(["ideation", "planning", "development", "testing", "launch"]),
  industry: z.string().optional(),
  projectType: z.string().optional(),
});

const taskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  assignedToId: z.number().optional(),
  dueDate: z.string().optional(),
});

export function CollaborationWorkspacePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedWorkspace, setSelectedWorkspace] = useState<number | null>(null);
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);

  // Fetch user workspaces
  const { data: workspaces, isLoading } = useQuery<{ workspaces: Workspace[] }>({
    queryKey: ["/api/collaboration/workspaces"],
  });

  // Fetch workspace details when selected
  const { data: currentWorkspace } = useQuery<Workspace>({
    queryKey: ["/api/collaboration/workspaces", selectedWorkspace],
    enabled: !!selectedWorkspace,
  });

  // Fetch workspace tasks
  const { data: tasks } = useQuery<{ tasks: Task[] }>({
    queryKey: ["/api/collaboration/workspaces", selectedWorkspace, "tasks"],
    enabled: !!selectedWorkspace,
  });

  // Create workspace mutation
  const createWorkspace = useMutation({
    mutationFn: async (data: z.infer<typeof workspaceSchema>) => {
      const response = await fetch("/api/collaboration/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create workspace");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "工作空间创建成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/workspaces"] });
      setNewWorkspaceOpen(false);
    },
  });

  // Create task mutation
  const createTask = useMutation({
    mutationFn: async (data: z.infer<typeof taskSchema>) => {
      const response = await fetch(`/api/collaboration/workspaces/${selectedWorkspace}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create task");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "任务创建成功" });
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/workspaces", selectedWorkspace, "tasks"] });
      setNewTaskOpen(false);
    },
  });

  // Update task status mutation
  const updateTaskStatus = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: number; status: string }) => {
      const response = await fetch(`/api/collaboration/tasks/${taskId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update task");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/workspaces", selectedWorkspace, "tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/collaboration/workspaces", selectedWorkspace] });
    },
  });

  // Forms
  const workspaceForm = useForm<z.infer<typeof workspaceSchema>>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: "",
      description: "",
      stage: "ideation",
      industry: "",
      projectType: "",
    },
  });

  const taskForm = useForm<z.infer<typeof taskSchema>>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "medium",
    },
  });

  const onWorkspaceSubmit = (data: z.infer<typeof workspaceSchema>) => {
    createWorkspace.mutate(data);
  };

  const onTaskSubmit = (data: z.infer<typeof taskSchema>) => {
    createTask.mutate(data);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'text-green-600 bg-green-50';
      case 'in_progress': return 'text-blue-600 bg-blue-50';
      case 'review': return 'text-purple-600 bg-purple-50';
      case 'todo': return 'text-gray-600 bg-gray-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">协作工作空间</h1>
            <p className="text-muted-foreground">管理团队项目和任务协作</p>
          </div>
          <Dialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen}>
            <DialogTrigger asChild>
              <Button>
                <LuPlus className="h-4 w-4 mr-2" />
                创建工作空间
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>创建新工作空间</DialogTitle>
                <DialogDescription>
                  为您的团队项目创建一个协作工作空间
                </DialogDescription>
              </DialogHeader>
              <Form {...workspaceForm}>
                <form onSubmit={workspaceForm.handleSubmit(onWorkspaceSubmit)} className="space-y-4">
                  <FormField
                    control={workspaceForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>工作空间名称</FormLabel>
                        <FormControl>
                          <Input placeholder="我的创业项目" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={workspaceForm.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>描述</FormLabel>
                        <FormControl>
                          <Textarea placeholder="项目描述..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={workspaceForm.control}
                    name="stage"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>项目阶段</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="选择项目阶段" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ideation">想法阶段</SelectItem>
                            <SelectItem value="planning">规划阶段</SelectItem>
                            <SelectItem value="development">开发阶段</SelectItem>
                            <SelectItem value="testing">测试阶段</SelectItem>
                            <SelectItem value="launch">发布阶段</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={workspaceForm.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>行业领域</FormLabel>
                        <FormControl>
                          <Input placeholder="AI/ML, FinTech, Healthcare..." {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setNewWorkspaceOpen(false)}>
                      取消
                    </Button>
                    <Button type="submit" disabled={createWorkspace.isPending}>
                      {createWorkspace.isPending ? "创建中..." : "创建"}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {!selectedWorkspace ? (
        /* Workspace Selection */
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {workspaces?.workspaces.map((workspace, idx) => (
            <motion.div
              key={workspace.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
            >
              <Card 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => setSelectedWorkspace(workspace.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{workspace.name}</CardTitle>
                    <Badge variant="outline">{workspace.stage}</Badge>
                  </div>
                  {workspace.description && (
                    <CardDescription className="line-clamp-2">
                      {workspace.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Team members */}
                    <div className="flex items-center gap-3">
                      <LuUsers className="h-4 w-4 text-muted-foreground" />
                      <div className="flex -space-x-2">
                        <Avatar className="h-6 w-6 border-2 border-background">
                          <AvatarImage src={workspace.founder.avatarUrl} />
                          <AvatarFallback className="text-xs">
                            {workspace.founder.fullName[0]}
                          </AvatarFallback>
                        </Avatar>
                        {workspace.coFounders.slice(0, 3).map((member) => (
                          <Avatar key={member.id} className="h-6 w-6 border-2 border-background">
                            <AvatarImage src={member.avatarUrl} />
                            <AvatarFallback className="text-xs">
                              {member.fullName[0]}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {workspace.memberCount > 4 && (
                          <div className="h-6 w-6 rounded-full bg-secondary border-2 border-background flex items-center justify-center">
                            <span className="text-xs text-muted-foreground">
                              +{workspace.memberCount - 4}
                            </span>
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {workspace.memberCount} 成员
                      </span>
                    </div>

                    {/* Task progress */}
                    <div>
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">任务进度</span>
                        <span className="font-medium">
                          {workspace.taskStats.completed}/{workspace.taskStats.total}
                        </span>
                      </div>
                      <Progress 
                        value={workspace.taskStats.total > 0 ? 
                          (workspace.taskStats.completed / workspace.taskStats.total) * 100 : 0
                        } 
                        className="h-2"
                      />
                    </div>

                    {/* Quick stats */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1 text-blue-600">
                          <LuClock className="h-3 w-3" />
                          {workspace.taskStats.inProgress}
                        </span>
                        {workspace.taskStats.overdue > 0 && (
                          <span className="flex items-center gap-1 text-red-600">
                            <LuTriangleAlert className="h-3 w-3" />
                            {workspace.taskStats.overdue}
                          </span>
                        )}
                      </div>
                      <span className="text-muted-foreground">
                        {new Date(workspace.lastActivity).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}

          {/* Empty state */}
          {workspaces?.workspaces.length === 0 && (
            <div className="col-span-full">
              <Card>
                <CardContent className="py-12 text-center">
                  <LuUsers className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground mb-2">还没有工作空间</p>
                  <p className="text-sm text-muted-foreground mb-4">
                    创建第一个工作空间开始团队协作
                  </p>
                  <Button onClick={() => setNewWorkspaceOpen(true)}>
                    <LuPlus className="h-4 w-4 mr-2" />
                    创建工作空间
                  </Button>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        /* Workspace Details */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="outline" 
                onClick={() => setSelectedWorkspace(null)}
              >
                ← 返回
              </Button>
              <div>
                <h2 className="text-2xl font-bold">{currentWorkspace?.name}</h2>
                <p className="text-muted-foreground">{currentWorkspace?.description}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Dialog open={newTaskOpen} onOpenChange={setNewTaskOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <LuPlus className="h-4 w-4 mr-2" />
                    新建任务
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>创建新任务</DialogTitle>
                    <DialogDescription>
                      为工作空间添加新的任务或里程碑
                    </DialogDescription>
                  </DialogHeader>
                  <Form {...taskForm}>
                    <form onSubmit={taskForm.handleSubmit(onTaskSubmit)} className="space-y-4">
                      <FormField
                        control={taskForm.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>任务标题</FormLabel>
                            <FormControl>
                              <Input placeholder="完成产品原型设计" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={taskForm.control}
                        name="description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>任务描述</FormLabel>
                            <FormControl>
                              <Textarea placeholder="详细描述任务要求..." {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={taskForm.control}
                        name="priority"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>优先级</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="选择优先级" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="low">低</SelectItem>
                                <SelectItem value="medium">中</SelectItem>
                                <SelectItem value="high">高</SelectItem>
                                <SelectItem value="urgent">紧急</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setNewTaskOpen(false)}>
                          取消
                        </Button>
                        <Button type="submit" disabled={createTask.isPending}>
                          {createTask.isPending ? "创建中..." : "创建"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <Tabs defaultValue="tasks" className="space-y-6">
            <TabsList>
              <TabsTrigger value="tasks">任务</TabsTrigger>
              <TabsTrigger value="documents">文档</TabsTrigger>
              <TabsTrigger value="meetings">会议</TabsTrigger>
              <TabsTrigger value="analytics">分析</TabsTrigger>
            </TabsList>

            <TabsContent value="tasks">
              <div className="space-y-4">
                {/* Task filters */}
                <div className="flex gap-4">
                  <Select defaultValue="all">
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="状态筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有状态</SelectItem>
                      <SelectItem value="todo">待办</SelectItem>
                      <SelectItem value="in_progress">进行中</SelectItem>
                      <SelectItem value="review">待审核</SelectItem>
                      <SelectItem value="done">已完成</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select defaultValue="all">
                    <SelectTrigger className="w-40">
                      <SelectValue placeholder="优先级筛选" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">所有优先级</SelectItem>
                      <SelectItem value="urgent">紧急</SelectItem>
                      <SelectItem value="high">高</SelectItem>
                      <SelectItem value="medium">中</SelectItem>
                      <SelectItem value="low">低</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Task list */}
                <div className="space-y-3">
                  {tasks?.tasks.map((task) => (
                    <Card key={task.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-medium truncate">{task.title}</h3>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getPriorityColor(task.priority)}`} />
                                <Badge variant="outline" className={getStatusColor(task.status)}>
                                  {task.status}
                                </Badge>
                                {task.isOverdue && (
                                  <Badge variant="destructive" className="text-xs">
                                    逾期
                                  </Badge>
                                )}
                              </div>
                            </div>
                            {task.description && (
                              <p className="text-sm text-muted-foreground mb-2 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span>创建者: {task.creator.fullName}</span>
                              {task.assignee && (
                                <span>负责人: {task.assignee.fullName}</span>
                              )}
                              {task.dueDate && (
                                <span>截止: {new Date(task.dueDate).toLocaleDateString()}</span>
                              )}
                              {task.commentsCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <LuMessageCircle className="h-3 w-3" />
                                  {task.commentsCount}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {task.assignee && (
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={task.assignee.avatarUrl} />
                                <AvatarFallback className="text-xs">
                                  {task.assignee.fullName[0]}
                                </AvatarFallback>
                              </Avatar>
                            )}
                            <Select
                              value={task.status}
                              onValueChange={(status) => 
                                updateTaskStatus.mutate({ taskId: task.id, status })
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="todo">待办</SelectItem>
                                <SelectItem value="in_progress">进行中</SelectItem>
                                <SelectItem value="review">待审核</SelectItem>
                                <SelectItem value="done">已完成</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {tasks?.tasks.length === 0 && (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <LuClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg text-muted-foreground mb-2">还没有任务</p>
                        <p className="text-sm text-muted-foreground mb-4">
                          创建第一个任务开始工作
                        </p>
                        <Button onClick={() => setNewTaskOpen(true)}>
                          <LuPlus className="h-4 w-4 mr-2" />
                          新建任务
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardContent className="py-12 text-center">
                  <LuFileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground mb-2">文档管理</p>
                  <p className="text-sm text-muted-foreground">
                    即将上线 - 团队文档协作功能
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="meetings">
              <Card>
                <CardContent className="py-12 text-center">
                  <LuCalendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground mb-2">会议管理</p>
                  <p className="text-sm text-muted-foreground">
                    即将上线 - 团队会议安排功能
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="analytics">
              <Card>
                <CardContent className="py-12 text-center">
                  <LuBarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg text-muted-foreground mb-2">数据分析</p>
                  <p className="text-sm text-muted-foreground">
                    即将上线 - 工作空间分析功能
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}