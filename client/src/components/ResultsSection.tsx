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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine
} from 'recharts';

interface ResultsSectionProps {
  data: CalculateBetaResponse;
}

const MetricTooltip = ({ title, definition }: { title: string; definition: string }) => (
  <TooltipProvider>
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>
        <button className="inline-flex items-center ml-1 text-muted-foreground hover:text-foreground transition-colors">
          <Info className="w-3.5 h-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs p-3 bg-popover text-popover-foreground border border-border shadow-xl">
        <p className="text-[11px] font-bold uppercase mb-1 tracking-wider text-primary">{title}</p>
        <p className="text-[10px] leading-relaxed text-muted-foreground">{definition}</p>
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
    if (beta === null) return { color: "text-muted-foreground", icon: <Minus className="w-4 h-4" />, hex: "#94a3b8" };
    if (beta > 1.2) return { color: "text-destructive", icon: <TrendingUp className="w-4 h-4" />, hex: "#ef4444" };
    if (beta < 0.8) return { color: "text-emerald-600 dark:text-emerald-500", icon: <TrendingDown className="w-4 h-4" />, hex: "#059669" };
    return { color: "text-primary", icon: <Minus className="w-4 h-4 rotate-45" />, hex: "#3b82f6" };
  };

  const getConfidenceStyle = (confidence?: string) => {
    switch (confidence) {
      case 'High':
        return 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-950/30 dark:border-emerald-900';
      case 'Medium':
        return 'text-blue-700 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-950/30 dark:border-blue-900';
      default:
        return 'text-muted-foreground bg-muted/30 border-border';
    }
  };

  const mainBetaStyle = getBetaStyle(data.beta);

  // Prepare chart data
  const chartData = [
    { name: data.ticker.split('.')[0], beta: data.beta, isPrimary: true },
    ...data.peers
      .filter(p => p.beta !== null)
      .map(p => ({
        name: p.ticker.split('.')[0],
        beta: p.beta as number,
        isPrimary: false
      }))
  ].sort((a, b) => b.beta - a.beta);

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
          <Card className="md:col-span-3 border border-border shadow-sm bg-card overflow-hidden group transition-colors">
            <CardHeader className="pb-2 border-b bg-muted/30 py-3 px-6">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex justify-between items-center">
                Primary Asset Analysis
                <Badge variant="secondary" className="font-mono text-[10px] bg-muted text-muted-foreground border-none px-2 h-5">
                  {data.ticker}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <h2 className="text-xl font-black text-foreground leading-tight uppercase tracking-tight">
                    {data.name || data.ticker}
                  </h2>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Benchmarked against {data.marketIndex}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-6 bg-muted/30 p-4 rounded-lg border border-border">
                  <div className={`text-5xl font-black font-mono tracking-tighter ${mainBetaStyle.color}`}>
                    {data.beta.toFixed(3)}
                  </div>
                  <div className="h-10 w-px bg-border hidden md:block" />
                  <div className="flex flex-col">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest flex items-center">
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
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest flex items-center mb-1">
                    Volatility
                    <MetricTooltip title="Annualized Volatility" definition="Standard deviation of daily returns multiplied by √252. Represents the asset's annualized price movement risk." />
                  </div>
                  <div className="text-xl font-mono font-black text-foreground">
                    {data.volatility ? `${(data.volatility * 100).toFixed(2)}%` : "N/A"}
                  </div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest flex items-center mb-1">
                    Alpha
                    <MetricTooltip title="Jensen's Alpha" definition="Excess return of the asset relative to the return predicted by CAPM. Positive alpha indicates outperformance." />
                  </div>
                  <div className="text-xl font-mono font-black text-foreground">
                    {data.alpha !== undefined && data.alpha !== null ? data.alpha.toFixed(6) : "N/A"}
                  </div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest flex items-center mb-1">
                    Correlation
                    <MetricTooltip title="Correlation" definition="Statistical measure (from -1 to 1) of how closely the asset price moves in relation to the benchmark index." />
                  </div>
                  <div className="text-xl font-mono font-black text-foreground">
                    {data.correlation ? data.correlation.toFixed(3) : "N/A"}
                  </div>
                </div>
                <div className="p-4 bg-muted/30 rounded-lg border border-border">
                  <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest flex items-center mb-1">
                    R^2
                    <MetricTooltip title="R² Coefficient" definition="Proportion of the asset's movement that can be explained by the benchmark index's movement." />
                  </div>
                  <div className="text-xl font-mono font-black text-foreground">
                    {data.rSquared ? data.rSquared.toFixed(3) : "N/A"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-sm border-border bg-card flex flex-col transition-colors">
             <CardHeader className="pb-2 border-b bg-muted/30 py-3 px-6">
              <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                Data Integrity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4 flex-1 flex flex-col justify-center">
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Index</span>
                <span className="font-bold text-xs text-foreground">{data.marketIndex}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-border/50">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Horizon</span>
                <span className="font-bold text-xs text-foreground">{data.period || "5Y"} Daily</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">Rating</span>
                <Badge className={`h-5 text-[9px] font-black uppercase tracking-tighter ${mainBetaStyle.color} bg-background border-current`}>
                  {data.beta > 1.2 ? "Aggressive" : data.beta < 0.8 ? "Stable" : "Market"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </motion.div>

      {/* Beta Comparison Chart */}
      <motion.div variants={item}>
        <Card className="border border-border shadow-sm bg-card overflow-hidden transition-colors">
          <CardHeader className="pb-2 border-b bg-muted/30 py-3 px-6">
            <CardTitle className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex justify-between items-center">
              Beta Sensitivity Comparison
              <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground bg-background border-border">
                {data.period || "5Y"} Horizon
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    angle={-45} 
                    textAnchor="end" 
                    interval={0} 
                    height={70}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }}
                  />
                  <YAxis 
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700 }}
                    label={{ value: 'Beta Coefficient', angle: -90, position: 'insideLeft', style: { fill: 'hsl(var(--muted-foreground))', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' } }}
                  />
                  <ChartTooltip 
                    cursor={{ fill: 'hsl(var(--muted) / 0.2)' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-popover border border-border p-2 shadow-xl rounded-md">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">{d.name}</p>
                            <p className="text-xs font-mono font-bold text-foreground">Beta: {d.beta.toFixed(3)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine y={1} stroke="hsl(var(--destructive) / 0.5)" strokeDasharray="3 3" label={{ position: 'right', value: 'Market', fill: 'hsl(var(--destructive))', fontSize: 10, fontWeight: 700 }} />
                  <Bar dataKey="beta" radius={[4, 4, 0, 0]} barSize={40}>
                    {chartData.map((entry, index) => {
                      const style = getBetaStyle(entry.beta);
                      return (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.isPrimary ? 'hsl(var(--primary))' : style.hex} 
                          fillOpacity={entry.isPrimary ? 1 : 0.6}
                          stroke={entry.isPrimary ? 'hsl(var(--primary))' : style.hex}
                          strokeWidth={entry.isPrimary ? 2 : 0}
                        />
                      );
                    })}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-sm" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Subject Asset</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-destructive/60 rounded-sm" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">High Volatility (&gt;1.2)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-emerald-600/60 rounded-sm" />
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Defensive (&lt;0.8)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Peer Company Analysis Table */}
      <motion.div variants={item}>
        <Card className="overflow-hidden shadow-sm border-border bg-card transition-colors">
          <CardHeader className="bg-muted/30 border-b py-3 px-6">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Peer Company Analysis</CardTitle>
              <Badge variant="outline" className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground bg-background border-border">
                Peer Relative Ranking
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent bg-muted/20">
                    <TableHead className="w-[30%] pl-6 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Asset Name</TableHead>
                    <TableHead className="w-[20%] py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Industry</TableHead>
                    <TableHead className="w-[12%] text-right py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Beta</TableHead>
                    <TableHead className="w-[12%] text-right py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Volatility</TableHead>
                    <TableHead className="w-[12%] text-right py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">R^2</TableHead>
                    <TableHead className="w-[14%] text-right pr-6 py-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Metric</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.peers.map((peer) => {
                    const style = getBetaStyle(peer.beta);
                    const [sector, industry] = (peer.sector || "").split(" > ");
                    return (
                      <TableRow key={peer.ticker} className="group hover:bg-muted/20 transition-colors border-b last:border-0">
                        <TableCell className="pl-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-bold text-foreground leading-none">{peer.name}</span>
                            <code className="text-[9px] font-mono text-muted-foreground uppercase tracking-tighter">
                              {peer.ticker}
                            </code>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="flex flex-col gap-1.5">
                            <div className="flex flex-col">
                              <span className="text-[10px] text-foreground font-black uppercase tracking-tight truncate max-w-[150px]">
                                {industry || sector || "Unknown"}
                              </span>
                              <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-tighter">
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
                          <span className="text-xs font-mono font-bold text-muted-foreground">
                            {peer.volatility !== null ? `${(peer.volatility * 100).toFixed(1)}%` : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right py-4">
                          <span className="text-xs font-mono font-bold text-muted-foreground">
                            {peer.rSquared !== null ? peer.rSquared.toFixed(3) : "-"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right pr-6 py-4">
                          {peer.error ? (
                            <div className="flex items-center justify-end gap-1 text-destructive font-bold text-[9px] uppercase tracking-tighter">
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
