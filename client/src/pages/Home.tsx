import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, subYears, startOfDay } from "date-fns";
import { CalendarIcon, Loader2, Search, TrendingUp } from "lucide-react";

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
  FormDescription,
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
import { cn } from "@/lib/utils";

// Schema for the form
const formSchema = z.object({
  ticker: z.string().min(1, "Stock ticker is required"),
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
    <div className="min-h-screen bg-background font-sans text-foreground selection:bg-primary/10">
      
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-slate-900 text-white pb-24 pt-16 lg:pt-24">
        <div className="absolute inset-0 z-0 opacity-20">
          <div className="absolute inset-0 bg-[url('https://pixabay.com/get/gc7b372f00125d58617ed793a49c14890790b7351f2d5530017184873c93238d1831d80fb5470b1c7a59fe8a3c8b77dbf7da578271186ee8ff3b04ef893b268b5_1280.png')] bg-cover bg-center mix-blend-overlay" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900" />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col items-center text-center">
          <h1 className="text-4xl md:text-6xl font-display font-bold tracking-tight mb-6">
            Market Beta <span className="text-primary-foreground/80">Analyzer</span>
          </h1>
          <p className="max-w-2xl text-lg md:text-xl text-slate-300 mb-10 leading-relaxed">
            Professional-grade risk assessment for Indian equity markets. 
            Calculate accurate 5-year betas against NIFTY 50 and SENSEX 
            benchmarks with automatic peer comparison.
          </p>

          {/* Search Card */}
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl shadow-black/20 p-2 md:p-8 text-slate-900">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-0 md:flex md:items-start md:gap-4">
                
                {/* Ticker Input */}
                <FormField
                  control={form.control}
                  name="ticker"
                  render={({ field }) => (
                    <FormItem className="flex-1 text-left space-y-1.5">
                      <FormLabel className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Stock Ticker</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Search className="absolute left-3 top-2.5 h-5 w-5 text-slate-400" />
                          <Input 
                            placeholder="e.g. RELIANCE" 
                            className="pl-10 h-12 text-lg font-medium bg-slate-50 border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all uppercase placeholder:normal-case"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Exchange Select */}
                <FormField
                  control={form.control}
                  name="exchange"
                  render={({ field }) => (
                    <FormItem className="w-full md:w-[140px] text-left space-y-1.5">
                      <FormLabel className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Exchange</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 text-base font-medium bg-slate-50 border-slate-200">
                            <SelectValue placeholder="Select" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="NSE">NSE</SelectItem>
                          <SelectItem value="BSE">BSE</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* End Date Picker */}
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className="flex-1 text-left space-y-1.5">
                      <FormLabel className="text-xs font-semibold uppercase text-slate-500 tracking-wider">End Date</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full h-12 justify-start text-left font-normal bg-slate-50 border-slate-200 hover:bg-slate-100",
                                !field.value && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="center">
                          <Calendar
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) =>
                              date > new Date() || date < new Date("1900-01-01")
                            }
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription className="text-[10px] leading-tight">
                        Beta will be calculated for the 5 years preceding this date.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Submit Button */}
                <div className="pt-7 w-full md:w-auto">
                  <Button 
                    type="submit" 
                    size="lg" 
                    className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Calculating...
                      </>
                    ) : (
                      "Calculate Beta"
                    )}
                  </Button>
                </div>

              </form>
            </Form>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {error && (
          <div className="max-w-2xl mx-auto mb-10 text-center p-6 bg-red-50 border border-red-100 rounded-xl text-red-600">
            <h3 className="font-semibold mb-2">Calculation Error</h3>
            <p>{error.message}</p>
          </div>
        )}

        {showResults && data && (
          <ResultsSection data={data} />
        )}

        {!showResults && !isPending && !data && (
          <div className="text-center py-20 opacity-40">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 mb-4">
              <TrendingUp className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-medium text-slate-900">Ready for Analysis</h3>
            <p className="text-slate-500 max-w-sm mx-auto mt-2">
              Enter a stock ticker above to calculate its beta coefficient and identify comparable peers.
            </p>
          </div>
        )}
      </div>
      
    </div>
  );
}
