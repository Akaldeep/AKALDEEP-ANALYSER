import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, subYears, startOfDay } from "date-fns";
import { CalendarIcon, Loader2, Search, TrendingUp, Lightbulb } from "lucide-react";

import { useCalculateBeta } from "@/hooks/use-beta";
import { ResultsSection } from "@/components/ResultsSection";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const financeFacts = [
  "Beta measures a stock's volatility relative to the overall market.",
  "A beta of 1.0 means the stock moves exactly with the market.",
  "High-beta stocks (beta > 1.0) tend to be more volatile.",
  "NIFTY 50 is the benchmark index for the National Stock Exchange (NSE).",
  "SENSEX is the benchmark index for the Bombay Stock Exchange (BSE)."
];

function FinanceFactCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % financeFacts.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 rounded-lg border border-slate-200 max-w-lg mx-auto mb-10">
      <div className="flex items-center gap-2 mb-3 text-blue-600">
        <Lightbulb className="w-4 h-4" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Market Insights</span>
      </div>
      <div className="h-16 flex items-center text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={index}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-sm text-slate-600 font-medium"
          >
            {financeFacts[index]}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}

const formSchema = z.object({
  ticker: z.string().min(1, "Ticker is required"),
  exchange: z.enum(["NSE", "BSE"]),
  endDate: z.date(),
});

type FormValues = z.infer<typeof formSchema>;

export default function Home() {
  const [showResults, setShowResults] = useState(false);
  const { mutate, isPending, data, error, reset: resetMutation } = useCalculateBeta();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      ticker: "",
      exchange: "NSE",
      endDate: new Date(),
    },
  });

  const onSubmit = (values: FormValues) => {
    setShowResults(false);
    resetMutation();
    const end = startOfDay(values.endDate);
    const start = subYears(end, 5);
    mutate({
      ticker: values.ticker.toUpperCase(),
      exchange: values.exchange,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    }, {
      onSuccess: () => setShowResults(true)
    });
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">
          Beta Coefficient Terminal
        </h1>
        <p className="text-sm text-slate-500 font-medium max-w-2xl">
          Institutional-grade risk analytics for Indian equities. Input a ticker to calculate 5-year historical beta relative to national benchmarks.
        </p>
      </div>

      {/* Control Panel */}
      <Card className="shadow-sm border-slate-200 bg-white overflow-hidden">
        <CardHeader className="border-b bg-slate-50/50 py-4 px-6">
          <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
            Analysis Parameters
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-4 gap-6 items-end">
              <FormField
                control={form.control}
                name="ticker"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Stock Ticker</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input 
                          placeholder="RELIANCE" 
                          className="pl-9 h-10 text-sm font-semibold border-slate-200 uppercase focus:ring-0 focus:border-blue-500 transition-colors"
                          {...field} 
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="exchange"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Exchange</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="h-10 text-sm font-semibold border-slate-200">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="NSE">NSE (NIFTY 50)</SelectItem>
                        <SelectItem value="BSE">BSE (SENSEX)</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Analysis End Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant={"outline"}
                            className={cn(
                              "w-full h-10 justify-start text-left text-sm font-semibold border-slate-200 hover:bg-slate-50",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4 text-slate-400" />
                            {field.value ? format(field.value, "PPP") : "Select date"}
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date > new Date()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button 
                type="submit" 
                className="h-10 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-widest transition-all active:scale-[0.98]"
                disabled={isPending}
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Run Analysis"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="space-y-8">
        {isPending && <FinanceFactCarousel />}

        {error && (
          <div className="p-4 bg-red-50 border border-red-100 rounded text-red-600 text-sm font-medium">
            Error: {error.message}
          </div>
        )}

        {showResults && data && (
          <ResultsSection data={data} />
        )}

        {!showResults && !isPending && !data && (
          <div className="h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/30">
            <TrendingUp className="h-12 w-12 text-slate-200 mb-4" />
            <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">
              Awaiting Terminal Input
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
