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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="border-l-4 border-l-primary shadow-lg bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Target Stock Beta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline space-x-4">
                <span className={`text-6xl font-bold font-mono-numbers tracking-tight ${mainBetaStyle.color}`}>
                  {data.beta.toFixed(3)}
                </span>
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-foreground">{data.ticker}</span>
                  <Badge variant="outline" className="mt-1 w-fit">
                    vs {data.marketIndex}
                  </Badge>
                </div>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">
                Beta measures the volatility of the stock relative to the overall market.
                A beta {data.beta > 1 ? "greater than 1.0" : "less than 1.0"} indicates that the stock is
                {data.beta > 1 ? " more volatile " : " less volatile "} than the market index.
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-lg bg-primary/5 border-primary/20">
             <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary/80 uppercase tracking-wider">
                Analysis Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-primary/10">
                <span className="text-sm text-muted-foreground">Market Index Used</span>
                <span className="font-semibold">{data.marketIndex}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-primary/10">
                <span className="text-sm text-muted-foreground">Peer Companies Analyzed</span>
                <span className="font-semibold">{data.peers.length}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-primary/10">
                <span className="text-sm text-muted-foreground">Risk Profile</span>
                <span className="font-semibold flex items-center gap-2">
                  {data.beta > 1.2 ? "Aggressive" : data.beta < 0.8 ? "Defensive" : "Market Neutral"}
                </span>
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
                        {peer.name}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground italic">
                        {(peer as any).sector || "Same Industry"}
                      </TableCell>
                      <TableCell className="text-right">
                        {peer.beta !== null ? (
                          <span className={`font-mono-numbers font-bold ${style.color}`}>
                            {peer.beta.toFixed(3)}
                          </span>
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
