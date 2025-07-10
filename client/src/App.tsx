import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";
import HomePage from "@/pages/home-page";
import AuthPage from "@/pages/auth-page";
import EventsPage from "@/pages/events-page";
import CommunityPage from "@/pages/community-page";
import MatchingPage from "@/pages/matching-page";
import AdminPage from "@/pages/admin-page";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/platform" component={HomePage} />
      <Route path="/platform/" component={HomePage} />
      <Route path="/platform/auth" component={AuthPage} />
      <ProtectedRoute path="/platform/events" component={EventsPage} />
      <ProtectedRoute path="/platform/community" component={CommunityPage} />
      <ProtectedRoute path="/platform/matching" component={MatchingPage} />
      <ProtectedRoute path="/platform/admin" component={AdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
