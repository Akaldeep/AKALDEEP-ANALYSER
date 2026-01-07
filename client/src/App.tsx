import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/hooks/use-theme";
import { ThemeToggle } from "@/components/ThemeToggle";
import Home from "@/pages/Home";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="akaldeep-theme">
        <TooltipProvider>
          <div className="flex flex-col min-h-screen w-full bg-background transition-colors duration-300">
            <header className="h-14 flex items-center justify-between px-8 border-b bg-card z-10 shrink-0 shadow-sm transition-colors duration-300">
              <div className="flex items-center gap-4">
                <h1 className="text-base font-black tracking-tighter text-foreground uppercase">
                  Akaldeep Financial Analyser
                </h1>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:inline">
                  Institutional Terminal v1.0
                </span>
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1 overflow-y-auto">
              <Router />
            </main>
            <Toaster />
          </div>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
