import { Switch, Route } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { WebSocketProvider } from "@/hooks/use-websocket";
import { ProtectedRoute } from "./lib/protected-route";
import { RoleRoute } from "@/components/auth/RoleRoute";
import { ErrorBoundary } from "@/components/error-boundary";
import { USER_ROLES, PERMISSIONS } from "@shared/types/auth";
import { usePerformanceTracking } from "@/hooks/use-performance-tracking";
import { useRoutePreload } from "@/hooks/use-route-preload";
import { useBehaviorTracking } from "@/hooks/use-behavior-tracking";
import { useRouteMiddleware } from "@/hooks/use-route-middleware";
import { SwipeNavigation } from "@/components/swipe-navigation";
import { FloatingQuickAccess } from "@/components/quick-access-menu";
import { PageTransitionWrapper } from "@/components/route-transition";
import { BreadcrumbContainer } from "@/components/breadcrumb-navigation";
import { initializeDynamicRoutes } from "@/config/routes";
import { initializePerformanceSystem, cleanupPerformanceSystem } from "@/services/performance-init";
import { SimplifiedNav } from "@/components/navigation/simplified-nav";
import { VersionSwitcher } from "@/components/version-switcher";
import { errorTracker } from "@/services/error-tracker";
import IntelligentHomePage from "@/pages/intelligent-home-page";
import UnifiedMatchingPage from "@/pages/unified-matching-page";
import IntegratedCommunityPage from "@/pages/integrated-community-page";
import HomePage from "@/pages/home-page";
import MagazineHomePage from "@/pages/magazine-home-page";
import LatentInspiredHomePage from "@/pages/latent-inspired-home";
import NewHomePage from "@/pages/new-homepage";
import AuthPage from "@/pages/auth-page";
import EventsPage from "@/pages/events-page";
import { EventDetailPage } from "@/pages/event-detail-page";
import CommunityPage from "@/pages/community-page";
import EnhancedMatchingPage from "@/pages/enhanced-matching-page";
import AdminPage from "@/pages/admin-page";
import AdvancedAdminPage from "@/pages/advanced-admin-page";
import { ProfilePage } from "@/pages/profile-page";
import { MessagesPage } from "@/pages/messages-page";
import MatchingAnalyticsPage from "@/pages/matching-analytics-page";
import ContentDiscoveryPage from "@/pages/content-discovery-page";
import { AiMatchingPage } from "@/pages/ai-matching-page";
import { TinderMatchingPage } from "@/pages/tinder-matching-page";
import { InterviewEvaluationPage } from "@/pages/interview-evaluation-page";
import { ABTestingPage } from "@/pages/ab-testing-page";
import { IntelligentSearchPage } from "@/pages/intelligent-search-page";
import { CollaborationWorkspacePage } from "@/pages/collaboration-workspace-page";
import { AiMarketplacePage } from "@/pages/ai-marketplace-page";
import { ReputationDashboardPage } from "@/pages/reputation-dashboard-page";
import SuccessStoriesPage from "@/pages/success-stories-page";
import SubmitSuccessStoryPage from "@/pages/submit-success-story-page";
import SuccessStoryDetailPage from "@/pages/success-story-detail-page";
import AdminSuccessStoriesPage from "@/pages/admin-success-stories-page";
import SuccessMetricsDashboardPage from "@/pages/success-metrics-dashboard-page";
import ForbiddenPage from "@/pages/forbidden-page";
import NotFound from "@/pages/not-found";
import PerformanceReportPage from '@/pages/performance-report-page';
import CMSManagementPage from '@/pages/cms-management-page';

function Router() {
  return (
    <Switch>
      {/* 公开路由 */}
      <Route path="/platform" component={NewHomePage} />
      <Route path="/platform/" component={NewHomePage} />
      <Route path="/platform/home-classic" component={HomePage} />
      <Route path="/platform/home-magazine" component={MagazineHomePage} />
      <Route path="/platform/home-latent" component={LatentInspiredHomePage} />
      <Route path="/platform/auth" component={AuthPage} />
      <Route path="/platform/403" component={ForbiddenPage} />
      
      {/* 成功案例相关公开路由 */}
      <Route path="/platform/success-stories" component={SuccessStoriesPage} />
      <Route path="/platform/success-stories/:id" component={SuccessStoryDetailPage} />
      <Route path="/platform/success-stories/metrics" component={SuccessMetricsDashboardPage} />
      
      {/* 需要基础登录的路由 */}
      <ProtectedRoute path="/platform/events" component={EventsPage} />
      <ProtectedRoute path="/platform/events/:id" component={EventDetailPage} />
      <ProtectedRoute path="/platform/community" component={IntegratedCommunityPage} />
      <ProtectedRoute path="/platform/matching" component={UnifiedMatchingPage} />
      <ProtectedRoute path="/platform/ai-matching" component={AiMatchingPage} />
      <ProtectedRoute path="/platform/tinder-matching" component={TinderMatchingPage} />
      <ProtectedRoute path="/platform/search" component={IntelligentSearchPage} />
      <ProtectedRoute path="/platform/workspace" component={CollaborationWorkspacePage} />
      <ProtectedRoute path="/platform/marketplace" component={AiMarketplacePage} />
      <ProtectedRoute path="/platform/reputation" component={ReputationDashboardPage} />
      <ProtectedRoute path="/platform/profile" component={ProfilePage} />
      <ProtectedRoute path="/platform/messages" component={MessagesPage} />
      
      {/* 个人中心路由 */}
      <ProtectedRoute path="/platform/me/profile" component={ProfilePage} />
      <ProtectedRoute path="/platform/me/messages" component={MessagesPage} />
      <ProtectedRoute path="/platform/me/connections" component={() => <div>人脉网络页面开发中</div>} />
      <ProtectedRoute path="/platform/me/settings" component={() => <div>账户设置页面开发中</div>} />
      <ProtectedRoute path="/platform/analytics" component={MatchingAnalyticsPage} />
      <ProtectedRoute path="/platform/discovery" component={ContentDiscoveryPage} />
      
      {/* 需要创始人权限的路由 */}
      <RoleRoute 
        path="/platform/success-stories/submit" 
        component={SubmitSuccessStoryPage}
        roles={[USER_ROLES.FOUNDER, USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]}
      />
      
      {/* 管理员路由 */}
      <RoleRoute 
        path="/platform/admin" 
        component={AdvancedAdminPage}
        roles={[USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]}
      />
      
      <RoleRoute 
        path="/platform/admin/interviews" 
        component={InterviewEvaluationPage}
        roles={[USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]}
        permissions={[PERMISSIONS.MANAGE_INTERVIEWS]}
      />
      
      <RoleRoute 
        path="/platform/admin/ab-testing" 
        component={ABTestingPage}
        roles={[USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]}
      />
      
      <RoleRoute 
        path="/platform/admin/success-stories" 
        component={AdminSuccessStoriesPage}
        roles={[USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]}
        permissions={[PERMISSIONS.MANAGE_CONTENT]}
      />
      
      <RoleRoute 
        path="/platform/admin/performance-reports" 
        component={PerformanceReportPage}
        roles={[USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]}
      />
      
      <RoleRoute 
        path="/platform/admin/cms" 
        component={CMSManagementPage}
        roles={[USER_ROLES.ADMIN, USER_ROLES.SUPERADMIN]}
      />
      
      {/* 404 页面 */}
      <Route component={NotFound} />
    </Switch>
  );
}

// 性能增强的路由组件
function EnhancedRouter() {
  // 初始化动态路由配置、性能系统和错误追踪
  useEffect(() => {
    initializeDynamicRoutes();
    initializePerformanceSystem();
    errorTracker.start();
    
    // 清理函数
    return () => {
      cleanupPerformanceSystem();
      errorTracker.stop();
    };
  }, []);
  
  // 启用性能跟踪
  usePerformanceTracking({
    enabled: true,
    trackPageLoad: true,
    trackRouteChanges: true,
    reportErrors: true,
  });
  
  // 启用路由预加载
  useRoutePreload();
  
  // 启用用户行为追踪
  useBehaviorTracking({
    enabled: true,
    trackPageViews: true,
    trackClicks: true,
    trackScroll: true,
    trackHover: false, // 默认关闭悬停追踪以提高性能
  });
  
  // 启用路由中间件
  useRouteMiddleware();
  
  return (
    <div className="app-layout">
      <SimplifiedNav />
      <main className="app-main">
        <SwipeNavigation enabled={true} showIndicator={true}>
          <PageTransitionWrapper>
            <Router />
          </PageTransitionWrapper>
        </SwipeNavigation>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <WebSocketProvider>
            <TooltipProvider>
              <Toaster />
              <EnhancedRouter />
              <FloatingQuickAccess />
              <VersionSwitcher />
            </TooltipProvider>
          </WebSocketProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
