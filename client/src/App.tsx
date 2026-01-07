import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
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
      <TooltipProvider>
        <div className="flex flex-col h-screen w-full bg-[#f8f9fa]">
          <header className="h-14 flex items-center justify-between px-8 border-b bg-white z-10 shrink-0 shadow-sm">
            <div className="flex items-center gap-4">
              <h1 className="text-base font-black tracking-tighter text-slate-900 uppercase">
                Akaldeep Financial Analyser
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Institutional Terminal v1.0
              </span>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <Router />
          </main>
          <Toaster />
        </div>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
