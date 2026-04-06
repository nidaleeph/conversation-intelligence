import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ErrorBoundary from "./components/ErrorBoundary";
import ProtectedRoute from "./components/ProtectedRoute";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider } from "./contexts/AuthContext";
import { WebSocketProvider } from "./contexts/WebSocketContext";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
});
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Parser from "./pages/Parser";
import LiveFeed from "./pages/LiveFeed";
import Agents from "./pages/Agents";
import AgentProfile from "./pages/AgentProfile";
import Alerts from "./pages/Alerts";
import Signals from "./pages/Signals";
import Areas from "./pages/Areas";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Login from "./pages/Login";
import VerifyLogin from "./pages/VerifyLogin";

function ProtectedRouter() {
  return (
    <ProtectedRoute>
      <DashboardLayout>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/parser" component={Parser} />
          <Route path="/live" component={LiveFeed} />
          <Route path="/agents" component={Agents} />
          <Route path="/agents/:name" component={AgentProfile} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/signals" component={Signals} />
          <Route path="/areas" component={Areas} />
          <Route path="/settings" component={Settings} />
          <Route path="/admin" component={Admin} />
          <Route component={NotFound} />
        </Switch>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <WebSocketProvider>
              <TooltipProvider>
                <Toaster />
                <Switch>
                  <Route path="/login" component={Login} />
                  <Route path="/verify-login" component={VerifyLogin} />
                  <Route component={ProtectedRouter} />
                </Switch>
              </TooltipProvider>
            </WebSocketProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
