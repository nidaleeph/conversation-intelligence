import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import Parser from "./pages/Parser";
import LiveFeed from "./pages/LiveFeed";
import Agents from "./pages/Agents";
import AgentProfile from "./pages/AgentProfile";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/parser" component={Parser} />
        <Route path="/live" component={LiveFeed} />
        <Route path="/agents" component={Agents} />
        <Route path="/agents/:name" component={AgentProfile} />
        <Route path="/alerts" component={Dashboard} />
        <Route path="/signals" component={Dashboard} />
        <Route path="/areas" component={Dashboard} />
        <Route path="/settings" component={Dashboard} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
