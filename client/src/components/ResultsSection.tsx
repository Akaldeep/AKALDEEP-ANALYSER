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
import { AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ResultsSectionProps {
  data: CalculateBetaResponse & {
    peers: Array<{
      ticker: string;
      name: string;
      beta: number | null;
      sector?: string;
      similarityScore?: number;
      confidence?: string;
      error?: string;
    }>;
  };
}

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
    if (beta > 1.2) return { color: "text-red-500", icon: <TrendingUp className="w-4 h-4" /> };
    if (beta < 0.8) return { color: "text-emerald-500", icon: <TrendingDown className="w-4 h-4" /> };
    return { color: "text-blue-500", icon: <Minus className="w-4 h-4 rotate-45" /> };
  };

  const getConfidenceStyle = (confidence?: string) => {
    switch (confidence) {
      case 'High':
        return 'text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5';
      case 'Medium':
        return 'text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/5';
      default:
        return 'text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5';
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
                    {(data as any).name || data.ticker}
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
                    <span className="text-[9px] uppercase font-bold text-slate-400 tracking-widest">Risk Profile</span>
                    <span className={`text-sm font-black uppercase tracking-tight ${mainBetaStyle.color} flex items-center gap-1`}>
                      {data.beta > 1.2 ? "High Aggression" : data.beta < 0.8 ? "Defensive" : "Market Neutral"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex flex-col gap-4">
                <div className="p-4 bg-blue-50/30 border border-blue-100/50 rounded-lg text-xs text-slate-600 leading-relaxed font-medium">
                  <span className="font-bold text-slate-900 uppercase text-[10px] mr-2 tracking-wider">Market Sensitivity:</span> 
                  An analysis coefficient of <span className="font-bold text-blue-700">{data.beta.toFixed(3)}</span> indicates that for every 1.00% fluctuation in the <span className="font-bold text-slate-900">{data.marketIndex}</span>, this asset is statistically projected to move by <span className="font-bold text-blue-700">{data.beta.toFixed(3)}%</span>.
                </div>
                <div className="flex items-center gap-2 px-1">
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-bold text-slate-400 bg-white border-slate-200">
                    5Y Historical Returns
                  </Badge>
                  <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-bold text-slate-400 bg-white border-slate-200">
                    Source: Yahoo Finance Terminal
                  </Badge>
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
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Universe</span>
                <span className="font-bold text-xs text-slate-700">{data.peers.length} Peers</span>
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
                    <TableHead className="w-[35%] pl-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Asset Name</TableHead>
                    <TableHead className="py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Industry Segment</TableHead>
                    <TableHead className="text-right py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Beta (5Y)</TableHead>
                    <TableHead className="text-right pr-6 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Risk Metric</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.peers.map((peer) => {
                    const style = getBetaStyle(peer.beta);
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
                            <div className="text-[11px] text-slate-500 font-bold uppercase tracking-tight max-w-[200px] truncate" title={peer.sector}>
                              {peer.sector || "Institutional"}
                            </div>
                            {peer.confidence && (
                              <Badge variant="outline" className={`w-fit text-[8px] h-3.5 px-1 py-0 uppercase font-black tracking-tighter border-current shadow-none ${getConfidenceStyle(peer.confidence)}`}>
                                {peer.confidence} MATCH
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          {peer.beta !== null ? (
                            <div className="flex flex-col items-end gap-0.5">
                              <span className={`text-sm font-mono font-black ${style.color}`}>
                                {peer.beta.toFixed(3)}
                              </span>
                              {peer.similarityScore !== undefined && (
                                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                                  {peer.similarityScore}% SIMILAR
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-300 font-mono text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right pr-6 py-4">
                          {peer.error ? (
                            <div className="flex items-center justify-end gap-1 text-amber-500 font-bold text-[9px] uppercase tracking-tighter">
                              <AlertCircle className="w-2.5 h-2.5" />
                              <span>ERR_DATA</span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                               {style.icon}
                               <span className={`text-[9px] font-black uppercase tracking-tighter ${style.color}`}>
                                 {peer.beta! > 1.2 ? "High Risk" : peer.beta! < 0.8 ? "Stable" : "Balanced"}
                               </span>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {data.peers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="h-24 text-center">
                        No comparable peers found.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
