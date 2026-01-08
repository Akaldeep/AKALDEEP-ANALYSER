import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import YahooFinance from 'yahoo-finance2';
import * as cheerio from 'cheerio';
import OpenAI from "openai";
import * as xlsx from 'xlsx/xlsx.mjs';
import * as fs from 'fs';
import path from 'path';

// Use a dynamic import or require style for xlsx if ESM issues persist, 
// but try standard named imports first as xlsx has mixed support.
import pkg from 'xlsx';
const { readFile, utils } = pkg;

const yahooFinance = new YahooFinance();
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Load and parse the Excel file
let industryList: { symbol: string; name: string; industry: string }[] = [];

try {
  const filePath = path.resolve(process.cwd(), 'attached_assets', 'INDIAN_COMPANIES_LIST_INDUSTRY_WISE_1767863645829.xlsx');
  if (fs.existsSync(filePath)) {
    const workbook = readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // Set header: 1 to get raw array of arrays
    const rawData: any[][] = utils.sheet_to_json(sheet, { header: 1 });
    
    if (rawData.length > 0) {
      // Print first row to debug
      console.log('Excel Headers:', JSON.stringify(rawData[0]));
      const headers = rawData[0].map(h => String(h || '').trim().toLowerCase());
      
      // Map based on: ["Company Name","Exchange:Ticker","Industry Group","Primary Sector","SIC Code","Country","Broad Group","Sub Group"]
      const nameIdx = headers.findIndex(h => h.includes('company') || h === 'name');
      const tickerIdx = headers.findIndex(h => h.includes('ticker') || h === 'symbol');
      const industryIdx = headers.findIndex(h => h === 'industry group' || h === 'industry' || h === 'sector');
      
      console.log(`Indices - Symbol: ${tickerIdx}, Name: ${nameIdx}, Industry: ${industryIdx}`);
      
      if (tickerIdx !== -1) {
        industryList = rawData.slice(1).map(row => {
          const rawTicker = String(row[tickerIdx] || '').trim();
          // Extract symbol from "Exchange:Ticker" format like "NSE:TCS"
          const symbol = rawTicker.includes(':') ? rawTicker.split(':')[1] : rawTicker;
          
          return {
            symbol: symbol,
            name: nameIdx !== -1 ? String(row[nameIdx] || '').trim() : '',
            industry: industryIdx !== -1 ? String(row[industryIdx] || '').trim() : ''
          };
        }).filter(item => item.symbol);
      }
    }
    console.log(`Loaded ${industryList.length} companies from Excel list using detected headers`);
  }
} catch (error) {
  console.error("Error loading Excel file:", error);
}

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

// Helper to calculate financial metrics
function calculateFinancialMetrics(stockPrices: number[], marketPrices: number[]) {
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
  let varianceStock = 0;

  for (let i = 0; i < n; i++) {
    const diffS = stockReturns[i] - meanStock;
    const diffM = marketReturns[i] - meanMarket;
    covariance += diffS * diffM;
    varianceMarket += diffM ** 2;
    varianceStock += diffS ** 2;
  }

  if (varianceMarket === 0 || varianceStock === 0) return null;

  const beta = covariance / varianceMarket;
  const alpha = meanStock - (beta * meanMarket);
  const correlation = covariance / (Math.sqrt(varianceStock) * Math.sqrt(varianceMarket));
  const rSquared = correlation ** 2;
  const standardDeviation = Math.sqrt(varianceStock / (n - 1));
  const volatility = standardDeviation * Math.sqrt(252);

  return {
    beta,
    alpha,
    correlation,
    rSquared,
    volatility
  };
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
    if (!summary?.assetProfile) return [];

    const targetIndustry = summary.assetProfile.industry || "";
    const targetSector = summary.assetProfile.sector || "";
    const targetMarketCap = summary.summaryDetail?.marketCap || 0;
    
    const tickerBase = ticker.split('.')[0];
    const excelMatch = industryList.find(i => i.symbol === tickerBase);
    const excelIndustry = excelMatch?.industry;

    let candidateSymbols: string[] = [];

    // 1. Get initial recommendations from Yahoo
    const recommendations = await yahooFinance.recommendationsBySymbol(ticker);
    candidateSymbols = recommendations?.recommendedSymbols?.map(r => r.symbol) || [];

    // 2. Add candidates from Excel list matching industry
    if (excelIndustry) {
      const industryPeers = industryList
        .filter(item => item.industry === excelIndustry && item.symbol !== tickerBase)
        .map(item => {
          // Add suffix based on target ticker
          const suffix = ticker.includes('.') ? ticker.split('.')[1] : 'NS';
          return `${item.symbol}.${suffix}`;
        });
      candidateSymbols = Array.from(new Set([...candidateSymbols, ...industryPeers]));
    }

    // 3. Search Yahoo if we still have few candidates
    if (candidateSymbols.length < 10 && targetIndustry) {
      const searchResults = await yahooFinance.search(targetIndustry, { 
        quotesCount: 20
      });
      
      const additionalSymbols = searchResults.quotes
        .filter(q => {
          const s = (q as any).symbol;
          return s && (s.endsWith('.NS') || s.endsWith('.BO'));
        })
        .map(q => (q as any).symbol);
      candidateSymbols = Array.from(new Set([...candidateSymbols, ...additionalSymbols]));
    }

    // 4. Batch fetch summaries to verify industry and get Market Cap
    const peerSummaries = await Promise.all(
      candidateSymbols.map(s => 
        yahooFinance.quoteSummary(s, { modules: ['assetProfile', 'summaryDetail'] })
          .catch(() => null)
      )
    );

    const verifiedPeers = candidateSymbols.map((symbol, i) => {
      const s = peerSummaries[i];
      if (!s?.assetProfile || symbol === ticker) return null;
      
      const isSameIndustry = (targetIndustry && s.assetProfile.industry === targetIndustry) || 
                            (excelIndustry && industryList.find(item => item.symbol === symbol.split('.')[0])?.industry === excelIndustry);
      
      if (!isSameIndustry) return null;

      const peerMarketCap = s.summaryDetail?.marketCap || 0;
      // Calculate closeness to target market cap
      const capDiff = targetMarketCap > 0 ? Math.abs(peerMarketCap - targetMarketCap) / targetMarketCap : 0;

      return {
        slug: symbol,
        sector: `${s.assetProfile.sector || 'Unknown'} > ${s.assetProfile.industry || 'Unknown'}`,
        marketCap: peerMarketCap,
        capDiff: capDiff,
        similarityScore: isSameIndustry ? 100 : 70
      };
    }).filter((p): p is any => p !== null);

    // Sort by Market Cap proximity and return top 10
    return verifiedPeers
      .sort((a, b) => a.capDiff - b.capDiff)
      .slice(0, 10);

  } catch (error) {
    console.error("Error fetching live industry peers:", error);
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

      const metrics = calculateFinancialMetrics(alignedStockPrices, alignedMarketPrices);
      if (!metrics) {
        return res.status(400).json({ message: "Insufficient data points to calculate metrics" });
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

            const pMetrics = calculateFinancialMetrics(pPrices, mPrices);
            return { 
              ticker: peerSymbol, 
              name: pName, 
              beta: pMetrics?.beta ?? null,
              volatility: pMetrics?.volatility ?? null,
              alpha: pMetrics?.alpha ?? null,
              correlation: pMetrics?.correlation ?? null,
              rSquared: pMetrics?.rSquared ?? null,
              marketCap: peer.marketCap,
              sector: peer.sector 
            };
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
          beta: metrics.beta,
          peers: finalPeers
      });

      const response = {
          ticker: fullTicker,
          name: companyName,
          marketIndex: marketTicker === "^NSEI" ? "NIFTY 50" : "BSE SENSEX",
          beta: metrics.beta,
          volatility: metrics.volatility,
          alpha: metrics.alpha,
          correlation: metrics.correlation,
          rSquared: metrics.rSquared,
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
