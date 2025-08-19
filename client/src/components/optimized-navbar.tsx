import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Menu, 
  X, 
  User, 
  Settings, 
  LogOut, 
  Calendar,
  Search,
  Users,
  Rocket,
  MessageSquare,
  Github,
  ChevronDown
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import QijiLogo from "@/components/qiji-logo";

export default function OptimizedNavbar() {
  const { user, logoutMutation } = useAuth();
  const { isAdmin } = usePermissions();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isActive = (path: string) => {
    return location.startsWith(path);
  };

  // 核心导航项（精简到6个）
  const mainNavItems = [
    { 
      href: "/platform/events", 
      label: "活动", 
      icon: Calendar,
      description: "技术分享与创业活动"
    },
    { 
      href: "/platform/search", 
      label: "探索", 
      icon: Search,
      description: "智能搜索与发现"
    },
    { 
      href: "/platform/community", 
      label: "社区", 
      icon: Users,
      description: "内容分享与讨论",
      subItems: [
        { href: "/platform/marketplace", label: "AI工具市场" },
        { href: "/platform/success-stories", label: "成功案例" },
      ]
    },
    { 
      href: "/platform/matching", 
      label: "匹配", 
      icon: Rocket,
      description: "寻找创业伙伴",
      subItems: [
        { href: "/platform/ai-matching", label: "AI智能匹配" },
        { href: "/platform/tinder-matching", label: "快速匹配" },
      ]
    },
    { 
      href: "/platform/workspace", 
      label: "协作", 
      icon: MessageSquare,
      description: "团队协作空间"
    },
  ];

  // 社区链接
  const communityLinks = [
    { icon: Github, label: "GitHub", href: "https://github.com/latentspace" },
    { icon: MessageSquare, label: "Discord", href: "https://discord.gg/latentspace" },
    { icon: User, label: "Twitter", href: "https://twitter.com/latentspace" },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-100 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/platform">
            <div className="flex items-center space-x-3 cursor-pointer group">
              <QijiLogo size={32} className="transition-transform group-hover:scale-105" />
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-gray-900">潜空间</h1>
                <span className="text-xs text-gray-500 hidden sm:inline">Latent Space</span>
              </div>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            {mainNavItems.map((item) => (
              <div key={item.href} className="relative group">
                {item.subItems ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        className={cn(
                          "flex items-center space-x-1 px-3 py-2 text-sm font-medium transition-colors",
                          isActive(item.href)
                            ? "text-primary-blue bg-blue-50"
                            : "text-gray-700 hover:text-primary-blue hover:bg-gray-50"
                        )}
                      >
                        <item.icon className="w-4 h-4" />
                        <span>{item.label}</span>
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56">
                      <DropdownMenuLabel>{item.description}</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {item.subItems.map((subItem) => (
                        <DropdownMenuItem key={subItem.href} asChild>
                          <Link href={subItem.href} className="cursor-pointer">
                            {subItem.label}
                          </Link>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                ) : (
                  <Link href={item.href}>
                    <Button
                      variant="ghost"
                      className={cn(
                        "flex items-center space-x-1 px-3 py-2 text-sm font-medium transition-colors",
                        isActive(item.href)
                          ? "text-primary-blue bg-blue-50"
                          : "text-gray-700 hover:text-primary-blue hover:bg-gray-50"
                      )}
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.label}</span>
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-4">
            {/* Community Links */}
            <div className="hidden lg:flex items-center space-x-2 border-r pr-4 mr-4">
              {communityLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 hover:text-primary-blue transition-colors"
                  title={link.label}
                >
                  <link.icon className="w-5 h-5" />
                </a>
              ))}
            </div>

            {/* User Actions */}
            {user ? (
              <div className="flex items-center space-x-3">
                {isAdmin && (
                  <Link href="/platform/admin">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hidden md:flex items-center space-x-1"
                    >
                      <Settings className="w-4 h-4" />
                      <span>管理</span>
                    </Button>
                  </Link>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-9 w-9 rounded-full">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-gradient-to-br from-primary-blue to-blue-600 text-white">
                          {user.fullName?.charAt(0) || user.username.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex items-center justify-start gap-2 p-2">
                      <div className="flex flex-col space-y-1 leading-none">
                        <p className="font-medium">{user.fullName || user.username}</p>
                        <p className="w-[200px] truncate text-sm text-muted-foreground">
                          {user.email}
                        </p>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/platform/profile" className="flex items-center cursor-pointer">
                        <User className="mr-2 h-4 w-4" />
                        <span>个人资料</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/platform/messages" className="flex items-center cursor-pointer">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        <span>消息中心</span>
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      className="cursor-pointer text-red-600 focus:text-red-600" 
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>退出登录</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-3">
                <Link href="/platform/auth">
                  <Button variant="ghost" size="sm">
                    登录
                  </Button>
                </Link>
                <Link href="/platform/auth">
                  <Button size="sm" className="bg-primary-blue hover:bg-primary-dark">
                    开始使用
                  </Button>
                </Link>
              </div>
            )}
            
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="lg:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="lg:hidden py-4 border-t">
            <div className="space-y-1">
              {mainNavItems.map((item) => (
                <div key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className={cn(
                      "flex items-center space-x-3 px-3 py-2 rounded-md text-base font-medium",
                      isActive(item.href)
                        ? "bg-blue-50 text-primary-blue"
                        : "text-gray-700 hover:bg-gray-50"
                    )}>
                      <item.icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </div>
                  </Link>
                  {item.subItems && (
                    <div className="ml-8 mt-1 space-y-1">
                      {item.subItems.map((subItem) => (
                        <Link
                          key={subItem.href}
                          href={subItem.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                        >
                          <div className="px-3 py-2 text-sm text-gray-600 hover:text-primary-blue">
                            {subItem.label}
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              
              {/* Mobile Community Links */}
              <div className="pt-4 mt-4 border-t">
                <div className="flex items-center justify-center space-x-4">
                  {communityLinks.map((link) => (
                    <a
                      key={link.label}
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-primary-blue"
                    >
                      <link.icon className="w-6 h-6" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Mobile Auth */}
              {!user && (
                <div className="pt-4 mt-4 border-t space-y-2">
                  <Link href="/platform/auth" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button variant="outline" className="w-full">
                      登录
                    </Button>
                  </Link>
                  <Link href="/platform/auth" onClick={() => setIsMobileMenuOpen(false)}>
                    <Button className="w-full bg-primary-blue hover:bg-primary-dark">
                      开始使用
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}