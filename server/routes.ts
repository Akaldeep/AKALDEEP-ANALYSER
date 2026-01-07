import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import YahooFinance from 'yahoo-finance2';
import * as cheerio from 'cheerio';
import OpenAI from "openai";

const yahooFinance = new YahooFinance();
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Helper to compute cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  let dotProduct = 0;
  let mA = 0;
  let mB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    mA += vecA[i] * vecA[i];
    mB += vecB[i] * vecB[i];
  }
  return dotProduct / (Math.sqrt(mA) * Math.sqrt(mB));
}

async function getEmbedding(text: string): Promise<number[]> {
  // Replit AI Integrations doesn't support embeddings API via OpenAI SDK at the moment.
  // We will use a keyword-only approach for similarity or a mock embedding for now.
  // Since we need to calculate similarity, we'll return a zero vector and rely on keywords.
  return new Array(1536).fill(0);
}

async function generateKeywords(text: string): Promise<string[]> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: "Extract exactly 5 core business keywords from the following business summary. Return them as a comma-separated list of single words or short phrases.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      max_completion_tokens: 50,
    });
    const content = response.choices[0].message.content || "";
    return content.split(",").map(k => k.trim().toLowerCase()).slice(0, 5);
  } catch (error) {
    console.error("Error generating keywords:", error);
    return [];
  }
}

function calculateKeywordOverlap(keywordsA: string[], keywordsB: string[]): number {
  if (keywordsA.length === 0 || keywordsB.length === 0) return 0;
  const setA = new Set(keywordsA);
  const intersection = keywordsB.filter(k => setA.has(k));
  // Jaccard-like or simple overlap percentage
  // Since we always have 5 keywords, we can just do (intersection / 5) * 100
  return (intersection.length / 5) * 100;
}

// Helper to calculate Beta using return regression
function calculateBetaValue(stockPrices: number[], marketPrices: number[]): number | null {
  if (stockPrices.length !== marketPrices.length || stockPrices.length < 2) return null;

  const stockReturns: number[] = [];
  const marketReturns: number[] = [];

  for (let i = 1; i < stockPrices.length; i++) {
    const sRet = (stockPrices[i] - stockPrices[i - 1]) / stockPrices[i - 1];
    const mRet = (marketPrices[i] - marketPrices[i - 1]) / marketPrices[i - 1];
    stockReturns.push(sRet);
    marketReturns.push(mRet);
  }

  const n = stockReturns.length;
  if (n < 2) return null;

  const meanStock = stockReturns.reduce((a, b) => a + b, 0) / n;
  const meanMarket = marketReturns.reduce((a, b) => a + b, 0) / n;

  let covariance = 0;
  let varianceMarket = 0;

  for (let i = 0; i < n; i++) {
    covariance += (stockReturns[i] - meanStock) * (marketReturns[i] - meanMarket);
    varianceMarket += (marketReturns[i] - meanMarket) ** 2;
  }

  if (varianceMarket === 0) return null;
  return covariance / varianceMarket;
}

async function fetchHistoricalData(ticker: string, startDate: string, endDate: string) {
  try {
    const queryOptions = {
      period1: new Date(startDate),
      period2: new Date(endDate),
      interval: '1d' as const
    };
    const result = await yahooFinance.historical(ticker, queryOptions);
    return result;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return null;
  }
}

async function getPeers(ticker: string): Promise<{ slug: string; sector: string; marketCap: number; similarityScore?: number; keywords?: string[] }[]> {
  try {
    const summary = await yahooFinance.quoteSummary(ticker, { modules: ['assetProfile', 'summaryDetail'] }).catch(() => null);
    if (!summary) return [];

    const targetSector = summary.assetProfile?.sector;
    const targetIndustry = summary.assetProfile?.industry;
    const targetSummary = summary.assetProfile?.longBusinessSummary || "";
    const useAI = targetSummary.length >= 200;

    let baseProfile = await storage.getCompanyProfile(ticker);
    if (useAI && !baseProfile) {
      const [embedding, keywords] = await Promise.all([
        getEmbedding(targetSummary),
        generateKeywords(targetSummary)
      ]);
      baseProfile = await storage.upsertCompanyProfile({ ticker, keywords, embedding });
    }

    const recommendations = await yahooFinance.recommendationsBySymbol(ticker);
    const recSymbols = recommendations?.recommendedSymbols?.map(r => r.symbol) || [];
    
    // Tiered Candidate Universe Logic
    const fetchRecs = async (symbols: string[]) => {
      return Promise.all(
        symbols.map(s => yahooFinance.quoteSummary(s, { modules: ['assetProfile', 'summaryDetail'] }).catch(() => null))
      );
    };

    const recSummaries = await fetchRecs(recSymbols);
    
    const evaluatePeers = async (summaries: any[], currentSymbols: string[], minThreshold: number) => {
      const scored = await Promise.all(summaries.map(async (s, index) => {
        const peerTicker = currentSymbols[index];
        if (!s?.assetProfile || peerTicker === ticker) return null;

        const isSameSector = s.assetProfile.sector === targetSector;
        const isSameIndustry = s.assetProfile.industry === targetIndustry;
        
        // Strictness based on tiers will be handled by the caller filtering recSummaries
        const peerSummary = s.assetProfile.longBusinessSummary || "";
        const peerUseAI = useAI && peerSummary.length >= 200;

        let combinedScore = 0;
        let keywords: string[] = [];

        if (peerUseAI && baseProfile) {
          let peerProfile = await storage.getCompanyProfile(peerTicker);
          if (!peerProfile) {
            keywords = await generateKeywords(peerSummary);
            peerProfile = await storage.upsertCompanyProfile({ 
              ticker: peerTicker, 
              keywords, 
              embedding: new Array(1536).fill(0) 
            });
          } else {
            keywords = peerProfile.keywords;
          }
          const keywordOverlap = calculateKeywordOverlap(baseProfile.keywords, peerProfile.keywords);
          combinedScore = keywordOverlap > 0 ? (30 + (keywordOverlap * 0.7)) : 10;
        } else {
          // Fallback scoring for weak summaries
          combinedScore = isSameIndustry ? 45 : (isSameSector ? 25 : 10);
        }

        if (combinedScore < minThreshold) return null;

        return {
          slug: peerTicker,
          sector: `${s.assetProfile.sector || 'Unknown'} > ${s.assetProfile.industry || 'Unknown'}`,
          marketCap: s.summaryDetail?.marketCap || 0,
          similarityScore: Math.round(combinedScore),
          keywords: keywords,
          confidence: combinedScore >= 50 ? "High" : combinedScore >= 30 ? "Medium" : "Fallback"
        };
      }));
      return scored.filter((p): p is any => p !== null);
    };

    // Tiers and Dynamic Thresholds
    const thresholds = [50, 40, 30];
    for (const threshold of thresholds) {
      // Tier 1: Same Industry
      const industryPeers = await evaluatePeers(
        recSummaries.filter(s => s?.assetProfile?.industry === targetIndustry),
        recSymbols.filter((_, i) => recSummaries[i]?.assetProfile?.industry === targetIndustry),
        threshold
      );
      if (industryPeers.length >= 3) return industryPeers.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);

      // Tier 2: Same Sector
      const sectorPeers = await evaluatePeers(
        recSummaries.filter(s => s?.assetProfile?.sector === targetSector),
        recSymbols.filter((_, i) => recSummaries[i]?.assetProfile?.sector === targetSector),
        threshold
      );
      if (sectorPeers.length >= 3) return sectorPeers.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);
    }

    // Final Fallback: Best available from all recs at lowest threshold
    const finalFallback = await evaluatePeers(recSummaries, recSymbols, 0);
    return finalFallback.sort((a, b) => b.similarityScore - a.similarityScore).slice(0, 5);

  } catch (error) {
    console.error("Error fetching similarity-based peers:", error);
    return [];
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.beta.calculate.path, async (req, res) => {
    try {
      const { ticker, exchange, startDate, endDate, period } = api.beta.calculate.input.parse(req.body);

      let marketTicker = "";
      let suffix = "";
      if (exchange === "NSE") {
        marketTicker = "^NSEI"; 
        suffix = ".NS";
      } else {
        marketTicker = "^BSESN"; 
        suffix = ".BO";
      }

      const fullTicker = ticker.endsWith(suffix) ? ticker : `${ticker}${suffix}`;

    const [marketDataInitial, stockDataInitial, quoteInitial] = await Promise.all([
        fetchHistoricalData(marketTicker, startDate, endDate),
        fetchHistoricalData(fullTicker, startDate, endDate),
        yahooFinance.quote(fullTicker).catch(() => null)
    ]);

    let marketData = marketDataInitial;
    let stockData = stockDataInitial;
    let companyName = quoteInitial?.longName || quoteInitial?.shortName || ticker;

    if (!marketData || marketData.length === 0) {
      // Fallback index...
    }

    if (!stockData || stockData.length === 0) {
        const altSuffix = suffix === ".NS" ? ".BO" : ".NS";
        const altTicker = ticker.endsWith(altSuffix) ? ticker : `${ticker}${altSuffix}`;
        const [altData, altQuote] = await Promise.all([
            fetchHistoricalData(altTicker, startDate, endDate),
            yahooFinance.quote(altTicker).catch(() => null)
        ]);
        
        if (!altData || altData.length === 0) {
            return res.status(404).json({ message: `Failed to fetch data for ${fullTicker}. Check ticker or date range.` });
        }
        
        stockData = altData;
        suffix = altSuffix;
        companyName = altQuote?.longName || altQuote?.shortName || ticker;
    }

      if (!marketData || marketData.length === 0) {
        return res.status(500).json({ message: "Failed to fetch market index data" });
      }

      const dateMap = new Map<string, number>();
      marketData.forEach(d => {
        if (d && d.close) dateMap.set(d.date.toISOString().split('T')[0], d.close);
      });

      const alignedStockPrices: number[] = [];
      const alignedMarketPrices: number[] = [];

      stockData.forEach(d => {
        const dateStr = d.date.toISOString().split('T')[0];
        const marketPrice = dateMap.get(dateStr);
        if (marketPrice && d.close) {
          alignedStockPrices.push(d.close);
          alignedMarketPrices.push(marketPrice);
        }
      });

      const beta = calculateBetaValue(alignedStockPrices, alignedMarketPrices);
      if (beta === null) {
        return res.status(400).json({ message: "Insufficient data points to calculate beta" });
      }

      const peerSymbols = await getPeers(fullTicker);
      console.log(`Found ${peerSymbols.length} total potential peers`);
      
      const peerBetas = await Promise.all(peerSymbols.map(async (peer) => {
          try {
            const peerSymbol = peer.slug;
            // Normalize ticker for Yahoo Finance
            let peerFullTicker = peerSymbol;
            if (!peerSymbol.includes('.')) {
              peerFullTicker = `${peerSymbol}${suffix}`;
            }
            
            console.log(`Processing peer: ${peerFullTicker}`);
            const [peerDataInitial, peerQuote] = await Promise.all([
                fetchHistoricalData(peerFullTicker, startDate, endDate),
                yahooFinance.quote(peerFullTicker).catch(() => null)
            ]);
            let peerData = peerDataInitial;
            let pName = peerQuote?.shortName || peerQuote?.longName || peerSymbol;
            
            // Fallback for peers if first attempt fails
            if (!peerData || peerData.length < 2) {
              const altSuffix = suffix === ".NS" ? ".BO" : ".NS";
              const altTicker = peerSymbol.endsWith(altSuffix) ? peerSymbol : `${peerSymbol}${altSuffix}`;
              console.log(`Peer ticker ${peerFullTicker} failed, trying alternative ${altTicker}`);
              const [pAltData, pAltQuote] = await Promise.all([
                  fetchHistoricalData(altTicker, startDate, endDate),
                  yahooFinance.quote(altTicker).catch(() => null)
              ]);
              peerData = pAltData;
              if (pAltQuote) pName = pAltQuote.shortName || pAltQuote.longName || peerSymbol;
            }

            if (!peerData || peerData.length < 2) {
                console.log(`No data for peer: ${peerFullTicker} after fallback`);
                return null;
            }

            const pPrices: number[] = [];
            const mPrices: number[] = [];

            peerData.forEach(d => {
              const dateStr = d.date.toISOString().split('T')[0];
              const marketPrice = dateMap.get(dateStr);
              if (marketPrice && d.close) {
                pPrices.push(d.close);
                mPrices.push(marketPrice);
              }
            });

            if (pPrices.length < 2) {
              console.log(`Insufficient aligned data for peer: ${peerFullTicker}`);
              return null;
            }

            const pBeta = calculateBetaValue(pPrices, mPrices);
            return { ticker: peerSymbol, name: pName, beta: pBeta, sector: peer.sector };
          } catch (e) {
            console.error(`Error calculating beta for peer ${peer.slug}:`, e);
            return null;
          }
      }));

      const finalPeers = peerBetas.filter((p): p is any => p !== null);
      console.log(`Returning ${finalPeers.length} valid peer results`);

      await storage.createSearch({
          ticker: fullTicker,
          exchange,
          startDate,
          endDate,
          beta,
          peers: finalPeers
      });

      const response = {
          ticker: fullTicker,
          name: companyName,
          marketIndex: marketTicker === "^NSEI" ? "NIFTY 50" : "BSE SENSEX",
          beta,
          period: period || "5Y",
          peers: finalPeers
      };

      res.json(response);

    } catch (err) {
      console.error(err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  return httpServer;
}
