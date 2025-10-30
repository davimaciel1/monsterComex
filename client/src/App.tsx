import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/Home";
import SearchResults from "@/pages/SearchResults";
import CompanyProfile from "@/pages/CompanyProfile";
import AdminUpload from "@/pages/AdminUpload";
import Login from "@/pages/Login";
import Plans from "@/pages/Plans";
import NcmProfile from "@/pages/NcmProfile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/search" component={SearchResults} />
      <Route path="/company/:id" component={CompanyProfile} />
      <Route path="/ncm/:code" component={NcmProfile} />
      <Route path="/admin/upload" component={AdminUpload} />
      <Route path="/planos" component={Plans} />
      <Route path="/login" component={Login} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
