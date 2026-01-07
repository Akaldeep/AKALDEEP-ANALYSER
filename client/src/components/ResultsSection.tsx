import { motion } from "framer-motion";
import { type CalculateBetaResponse } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { AlertCircle, TrendingUp, TrendingDown, Minus, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ResultsSectionProps {
  data: CalculateBetaResponse;
}

const MetricTooltip = ({ title, definition }: { title: string; definition: string }) => (
  <TooltipProvider>
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center ml-1 text-slate-400 hover:text-slate-600 transition-colors">
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-3 bg-slate-900 text-white border-none shadow-xl">
        <p className="text-[11px] font-bold uppercase mb-1 tracking-wider text-blue-400">{title}</p>
        <p className="text-[10px] leading-relaxed text-slate-300">{definition}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

export function ResultsSection({ data }: ResultsSectionProps) {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 10 },
    show: { opacity: 1, y: 0 }
  };

  const getBetaStyle = (beta: number | null) => {
    if (beta === null) return { color: "text-muted-foreground", icon: <Minus className="w-4 h-4" /> };
    if (beta > 1.2) return { color: "text-red-600", icon: <TrendingUp className="w-4 h-4" /> };
    if (beta < 0.8) return { color: "text-emerald-600", icon: <TrendingDown className="w-4 h-4" /> };
    return { color: "text-blue-600", icon: <Minus className="w-4 h-4 rotate-45" /> };
  };

  const getConfidenceStyle = (confidence?: string) => {
    switch (confidence) {
      case 'High':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200';
      case 'Medium':
        return 'text-blue-700 bg-blue-50 border-blue-200';
      default:
        return 'text-slate-600 bg-slate-50 border-slate-200';
    }
  };

  const mainBetaStyle = getBetaStyle(data.beta);

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 w-full"
    >
      {/* Primary Result Card */}
      <motion.div variants={item}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="md:col-span-3 border border-slate-200 shadow-sm bg-white overflow-hidden group">
            <CardHeader className="pb-2 border-b bg-slate-50/50 py-3 px-6">
              <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest flex justify-between items-center">
                Primary Asset Analysis
                <Badge variant="secondary" className="font-mono text-[10px] bg-slate-100 text-slate-600 border-none px-2 h-5">
                  {data.ticker}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-slate-900 leading-tight uppercase tracking-tight">
                    {data.name || data.ticker}
                  </h2>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Benchmarked against {data.marketIndex}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 bg-slate-50 p-4 rounded-lg border border-slate-100">
                  <div className={`text-5xl font-black font-mono tracking-tighter ${mainBetaStyle.color}`}>
                    {data.beta.toFixed(3)}
                  </div>
                  <div className="h-10 w-px bg-slate-200 hidden md:block" />
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest flex items-center">
                      {data.period || "5Y"} Daily Beta
                      <MetricTooltip title="Beta" definition="Measures stock volatility relative to the market. Beta > 1 is more volatile than market; Beta < 1 is less volatile." />
                    </span>
                    <span className={`text-sm font-black uppercase tracking-tight ${mainBetaStyle.color} flex items-center gap-1`}>
                      {data.beta > 1.2 ? "High Aggression" : data.beta < 0.8 ? "Defensive" : "Market Neutral"}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Secondary Metrics Grid */}
              <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest flex items-center mb-1">
                    Volatility
                    <MetricTooltip title="Annualized Volatility" definition="Standard deviation of daily returns multiplied by √252. Represents the asset's annualized price movement risk." />
                  </div>
                  <div className="text-xl font-mono font-black text-slate-800">
                    {data.volatility ? `${(data.volatility * 100).toFixed(2)}%` : "N/A"}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest flex items-center mb-1">
                    Alpha
                    <MetricTooltip title="Jensen's Alpha" definition="Excess return of the asset relative to the return predicted by CAPM. Positive alpha indicates outperformance." />
                  </div>
                  <div className="text-xl font-mono font-black text-slate-800">
                    {data.alpha ? data.alpha.toFixed(6) : "N/A"}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest flex items-center mb-1">
                    Correlation
                    <MetricTooltip title="Correlation" definition="Statistical measure (from -1 to 1) of how closely the asset price moves in relation to the benchmark index." />
                  </div>
                  <div className="text-xl font-mono font-black text-slate-800">
                    {data.correlation ? data.correlation.toFixed(3) : "N/A"}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="text-[9px] uppercase font-bold text-slate-400 tracking-widest flex items-center mb-1">
                    R^2
                    <MetricTooltip title="R² Coefficient" definition="Proportion of the asset's movement that can be explained by the benchmark index's movement." />
                  </div>
                  <div className="text-xl font-mono font-black text-slate-800">
                    {data.rSquared ? data.rSquared.toFixed(3) : "N/A"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 bg-white flex flex-col">
             <CardHeader className="pb-2 border-b bg-slate-50/50 py-3 px-6">
              <CardTitle className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Data Integrity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Index</span>
                <span className="font-bold text-xs text-slate-700">{data.marketIndex}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-slate-50">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Horizon</span>
                <span className="font-bold text-xs text-slate-700">{data.period || "5Y"} Daily</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Rating</span>
                <Badge className={`h-5 text-[9px] font-black uppercase tracking-tighter ${mainBetaStyle.color} bg-white border-current`}>
                  {data.beta > 1.2 ? "Aggressive" : data.beta < 0.8 ? "Stable" : "Market"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Peer Comparison Table */}
      <motion.div variants={item}>
        <Card className="overflow-hidden shadow-sm border-slate-200 bg-white">
          <CardHeader className="bg-slate-50/50 border-b py-3 px-6">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-slate-500">Comparable Asset Universe</CardTitle>
              <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-bold text-slate-400 bg-white border-slate-200">
                Peer Relative Ranking
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-slate-50/30">
                    <TableHead className="w-[30%] pl-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Asset Name</TableHead>
                    <TableHead className="w-[20%] py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Industry</TableHead>
                    <TableHead className="w-[12%] text-right py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Beta</TableHead>
                    <TableHead className="w-[12%] text-right py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Volatility</TableHead>
                    <TableHead className="w-[12%] text-right py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">R^2</TableHead>
                    <TableHead className="w-[14%] text-right pr-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Metric</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.peers.map((peer) => {
                    const style = getBetaStyle(peer.beta);
                    const [sector, industry] = (peer.sector || "").split(" > ");
                    return (
                      <TableRow key={peer.ticker} className="group hover:bg-slate-50 transition-colors border-b last:border-0">
                        <TableCell className="pl-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-slate-700 leading-none">{peer.name}</span>
                            <code className="text-[9px] font-mono text-slate-400 uppercase tracking-tighter">
                              {peer.ticker}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-slate-900 font-black uppercase tracking-tight truncate max-w-[150px]">
                                {industry || sector || "Unknown"}
                              </span>
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                                {industry ? sector : "Institutional"}
                              </span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <span className={`text-sm font-mono font-black ${style.color}`}>
                            {peer.beta !== null ? peer.beta.toFixed(3) : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <span className="text-xs font-mono font-bold text-slate-600">
                            {peer.volatility !== null ? `${(peer.volatility * 100).toFixed(1)}%` : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <span className="text-xs font-mono font-bold text-slate-600">
                            {peer.rSquared !== null ? peer.rSquared.toFixed(3) : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6 py-4">
                          {peer.error ? (
                            <div className="flex items-center justify-end gap-1 text-amber-500 font-bold text-[9px] uppercase tracking-tighter">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span>ERR</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                               {style.icon}
                               <span className={`text-[9px] font-black uppercase tracking-tighter ${style.color}`}>
                                 {peer.beta! > 1.2 ? "Aggressive" : peer.beta! < 0.8 ? "Stable" : "Balanced"}
                               </span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
