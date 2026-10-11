import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Profile from "@/pages/profile";
import DonorAnalytics from "@/pages/donor-analytics";
import AdminAnalytics from "@/pages/admin-analytics";
import { startTracking } from "@/lib/tracker";
import { SigninErrorToast } from "@/components/signin-error-toast";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/profile" component={Profile} />
      <Route path="/donor-analytics" component={DonorAnalytics} />
      <Route path="/admin" component={AdminAnalytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  useEffect(() => {
    startTracking();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter hook={useHashLocation}>
        <TooltipProvider>
          <Toaster />
          <SigninErrorToast />
          <AppRouter />
        </TooltipProvider>
      </WouterRouter>
    </QueryClientProvider>
  );
}

export default App;