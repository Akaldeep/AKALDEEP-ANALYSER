import { pgTable, text, serial, timestamp, jsonb, doublePrecision } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const searches = pgTable("searches", {
  id: serial("id").primaryKey(),
  ticker: text("ticker").notNull(),
  exchange: text("exchange").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  beta: doublePrecision("beta"),
  peers: jsonb("peers").$type<{ 
    ticker: string; 
    name: string; 
    beta: number | null; 
    sector: string;
    similarityScore?: number;
    keywords?: string[];
  }[]>().notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertSearchSchema = createInsertSchema(searches).omit({ id: true, createdAt: true });

export type Search = typeof searches.$inferSelect;
export type InsertSearch = z.infer<typeof insertSearchSchema>;

// API Request/Response Types
export const calculateBetaSchema = z.object({
    ticker: z.string().min(1),
    exchange: z.enum(["NSE", "BSE"]),
    startDate: z.string(), // ISO Date string
    endDate: z.string(),   // ISO Date string
});

export type CalculateBetaRequest = z.infer<typeof calculateBetaSchema>;

export const peerBetaSchema = z.object({
    ticker: z.string(),
    name: z.string(),
    beta: z.number().nullable(),
    error: z.string().optional()
});

export type PeerBeta = z.infer<typeof peerBetaSchema>;

export const calculateBetaResponseSchema = z.object({
    ticker: z.string(),
    marketIndex: z.string(),
    beta: z.number(),
    peers: z.array(peerBetaSchema)
});

export type CalculateBetaResponse = z.infer<typeof calculateBetaResponseSchema>;
