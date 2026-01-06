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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface ResultsSectionProps {
  data: CalculateBetaResponse & {
    peers: Array<{
      ticker: string;
      name: string;
      beta: number | null;
      sector?: string;
      similarityScore?: number;
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
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  // Helper to determine beta color/icon
  const getBetaStyle = (beta: number | null) => {
    if (beta === null) return { color: "text-muted-foreground", icon: <Minus className="w-4 h-4" /> };
    if (beta > 1.2) return { color: "text-red-500", icon: <TrendingUp className="w-4 h-4" /> }; // High volatility
    if (beta < 0.8) return { color: "text-emerald-500", icon: <TrendingDown className="w-4 h-4" /> }; // Low volatility
    return { color: "text-blue-500", icon: <Minus className="w-4 h-4 rotate-45" /> }; // Correlation
  };

  const mainBetaStyle = getBetaStyle(data.beta);

  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 w-full max-w-5xl mx-auto"
    >
      {/* Primary Result Card */}
      <motion.div variants={item}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 border-l-4 border-l-primary shadow-lg bg-card/50 backdrop-blur-sm overflow-hidden group">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-widest flex justify-between items-center">
                Target Stock Analysis
                <Badge variant="secondary" className="font-mono text-[10px] tracking-normal">
                  {data.ticker}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-foreground leading-tight group-hover:text-primary transition-colors">
                    {(data as any).name || data.ticker}
                  </h2>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Beta vs {data.marketIndex}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 bg-primary/5 p-4 rounded-xl border border-primary/10">
                  <div className={`text-6xl font-black font-mono-numbers tracking-tighter ${mainBetaStyle.color}`}>
                    {data.beta.toFixed(3)}
                  </div>
                  <div className="h-12 w-px bg-primary/10 mx-2 hidden md:block" />
                  <div className="flex flex-col">
                    <span className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Volatility</span>
                    <span className={`font-bold ${mainBetaStyle.color} flex items-center gap-1`}>
                      {mainBetaStyle.icon}
                      {data.beta > 1.2 ? "Aggressive" : data.beta < 0.8 ? "Defensive" : "Moderate"}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex flex-col gap-3">
                <div className="p-3 bg-muted/30 rounded-lg text-sm text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground">Interpretation:</span> A beta of <span className="font-bold text-foreground">{data.beta.toFixed(3)}</span> means this stock is expected to move {data.beta > 1 ? "more" : "less"} than the market. 
                  For every 1% change in the <span className="font-bold text-foreground">{data.marketIndex}</span>, this stock is expected to change by approximately <span className="font-bold text-foreground">{data.beta.toFixed(3)}%</span>.
                </div>
                <div className="flex items-center gap-2 px-1">
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider font-semibold opacity-70">
                    Source: Yahoo Finance
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg bg-primary/5 border-primary/20 flex flex-col justify-center">
             <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold text-primary/80 uppercase tracking-widest">
                Quick Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-primary/10">
                <span className="text-xs text-muted-foreground uppercase font-medium">Index</span>
                <span className="font-bold text-sm">{data.marketIndex}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-primary/10">
                <span className="text-xs text-muted-foreground uppercase font-medium">Peers</span>
                <span className="font-bold text-sm">{data.peers.length}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-xs text-muted-foreground uppercase font-medium">Profile</span>
                <Badge className={`${mainBetaStyle.color} bg-white dark:bg-slate-900 border-current font-bold`}>
                  {data.beta > 1.2 ? "High Risk" : data.beta < 0.8 ? "Low Risk" : "Market Risk"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Peer Comparison Table */}
      <motion.div variants={item}>
        <Card className="overflow-hidden shadow-xl border-t-0">
          <CardHeader className="bg-muted/30 border-b">
            <CardTitle>Comparable Companies Analysis</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[40%] pl-6">Company Name</TableHead>
                  <TableHead>Sector/Industry</TableHead>
                  <TableHead className="text-right">Beta (5Y)</TableHead>
                  <TableHead className="text-right pr-6">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.peers.map((peer, idx) => {
                  const style = getBetaStyle(peer.beta);
                  return (
                    <TableRow key={peer.ticker} className="group hover:bg-muted/50 transition-colors">
                      <TableCell className="font-medium pl-6 text-foreground/90">
                        <div className="flex flex-col">
                          <span>{peer.name}</span>
                          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold block md:hidden">
                            {(peer as any).sector}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground italic">
                        <div className="flex flex-col gap-1">
                          <div className="max-w-[250px] truncate" title={(peer as any).sector}>
                            {(peer as any).sector || "Same Industry"}
                          </div>
                          {(peer as any).confidence && (
                            <Badge variant="outline" className={`w-fit text-[9px] h-4 px-1.5 uppercase font-bold tracking-tighter ${
                              (peer as any).confidence === 'High' ? 'text-emerald-500 border-emerald-500/30 bg-emerald-500/5' : 
                              (peer as any).confidence === 'Medium' ? 'text-blue-500 border-blue-500/30 bg-blue-500/5' : 
                              'text-amber-500 border-amber-500/30 bg-amber-500/5'
                            }`}>
                              {(peer as any).confidence} Match
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {peer.beta !== null ? (
                          <div className="flex flex-col items-end">
                            <span className={`font-mono-numbers font-bold ${style.color}`}>
                              {peer.beta.toFixed(3)}
                            </span>
                            {peer.similarityScore !== undefined && (
                              <span className="text-[10px] text-muted-foreground font-medium">
                                Similarity: {peer.similarityScore}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        {peer.error ? (
                          <div className="flex items-center justify-end gap-2 text-amber-600 text-xs">
                            <AlertCircle className="w-3 h-3" />
                            <span>Data Unavailable</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-end gap-2">
                             {style.icon}
                             <span className="text-xs text-muted-foreground font-medium">
                               {peer.beta! > 1 ? "High Volatility" : "Low Volatility"}
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
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
