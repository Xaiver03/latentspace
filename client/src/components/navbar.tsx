import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, X, User, Settings, LogOut } from "lucide-react";
import { useState } from "react";
import QijiLogo from "@/components/qiji-logo";

export default function Navbar() {
  const { user, logoutMutation } = useAuth();
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logoutMutation.mutate();
  };

  const isActive = (path: string) => {
    return location === path;
  };

  const navLinks = [
    { href: "/events", label: "活动中心" },
    { href: "/community", label: "内容社区" },
    { href: "/matching", label: "创始人匹配" },
  ];

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center space-x-3 cursor-pointer">
              <QijiLogo size={32} />
              <div className="flex flex-col">
                <h1 className="text-xl font-bold text-gray-900">潜空间</h1>
                <span className="text-xs text-gray-500 hidden sm:inline">Researcher Founder Platform</span>
              </div>
            </div>
          </Link>
          
          {/* Desktop Navigation */}
          <nav className="hidden md:flex space-x-8">
            {navLinks.map((link) => (
              <Link key={link.href} href={link.href}>
                <span className={`transition-colors cursor-pointer ${
                  isActive(link.href)
                    ? "text-primary-blue font-medium"
                    : "text-gray-700 hover:text-primary-blue"
                }`}>
                  {link.label}
                </span>
              </Link>
            ))}
          </nav>
          
          {/* User Actions */}
          <div className="flex items-center space-x-4">
            {user ? (
              <div className="flex items-center space-x-4">
                {user.role === "admin" && (
                  <Link href="/admin">
                    <Button
                      variant="ghost"
                      size="sm"
                      className={isActive("/admin") ? "text-primary-blue" : "text-gray-700"}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      管理
                    </Button>
                  </Link>
                )}
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-primary-blue text-white">
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
                    <DropdownMenuItem className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>个人资料</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>退出登录</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ) : (
              <div className="hidden md:flex items-center space-x-4">
                <Link href="/auth">
                  <Button variant="ghost" className="text-gray-700 hover:text-primary-blue">
                    登录
                  </Button>
                </Link>
                <Link href="/auth">
                  <Button className="bg-primary-blue text-white hover:bg-primary-dark">
                    注册
                  </Button>
                </Link>
              </div>
            )}
            
            {/* Mobile menu button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            <div className="flex flex-col space-y-3">
              {navLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <span
                    className={`block px-3 py-2 text-base transition-colors cursor-pointer ${
                      isActive(link.href)
                        ? "text-primary-blue font-medium"
                        : "text-gray-700 hover:text-primary-blue"
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    {link.label}
                  </span>
                </Link>
              ))}
              
              {!user && (
                <div className="flex flex-col space-y-2 px-3 pt-4 border-t border-gray-200">
                  <Link href="/auth">
                    <Button variant="ghost" className="w-full justify-start" onClick={() => setIsMobileMenuOpen(false)}>
                      登录
                    </Button>
                  </Link>
                  <Link href="/auth">
                    <Button className="w-full bg-primary-blue hover:bg-primary-dark" onClick={() => setIsMobileMenuOpen(false)}>
                      注册
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
