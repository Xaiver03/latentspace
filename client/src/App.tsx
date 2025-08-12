import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { WebSocketProvider } from "@/hooks/use-websocket";
import { ProtectedRoute } from "./lib/protected-route";
import HomePage from "@/pages/home-page";
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
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/platform" component={HomePage} />
      <Route path="/platform/" component={HomePage} />
      <Route path="/platform/auth" component={AuthPage} />
      <ProtectedRoute path="/platform/events" component={EventsPage} />
      <ProtectedRoute path="/platform/events/:id" component={EventDetailPage} />
      <ProtectedRoute path="/platform/community" component={CommunityPage} />
      <ProtectedRoute path="/platform/matching" component={EnhancedMatchingPage} />
      <ProtectedRoute path="/platform/profile" component={ProfilePage} />
      <ProtectedRoute path="/platform/messages" component={MessagesPage} />
      <ProtectedRoute path="/platform/analytics" component={MatchingAnalyticsPage} />
      <ProtectedRoute path="/platform/discovery" component={ContentDiscoveryPage} />
      <ProtectedRoute path="/platform/admin" component={AdvancedAdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WebSocketProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </WebSocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
