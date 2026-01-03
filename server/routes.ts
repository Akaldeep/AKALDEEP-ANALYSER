import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import YahooFinance from 'yahoo-finance2';
import * as cheerio from 'cheerio';

const yahooFinance = new YahooFinance();

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

async function getPeersFromYahoo(ticker: string): Promise<string[]> {
  try {
    const quote = await yahooFinance.quote(ticker);
    if (!quote || !quote.symbol) return [];

    // Yahoo Finance recommendations often contain related companies
    const recommendations = await yahooFinance.recommendationsBySymbol(ticker);
    if (recommendations && recommendations.recommendedSymbols) {
      return recommendations.recommendedSymbols
        .map(r => r.symbol)
        .filter(s => s !== ticker)
        .slice(0, 10);
    }
    return [];
  } catch (error) {
    console.error("Error fetching peers from Yahoo:", error);
    return [];
  }
}

async function getPeers(ticker: string): Promise<string[]> {
  // Try Screener first
  let peers = await getPeersFromScreener(ticker);
  
  // If Screener fails or returns few peers, try Yahoo
  if (peers.length < 3) {
    console.log("Screener found few peers, trying Yahoo Finance...");
    const yahooPeers = await getPeersFromYahoo(ticker);
    // Merge and unique
    peers = Array.from(new Set([...peers, ...yahooPeers]));
  }

  return peers.slice(0, 10);
}

function parsePeers(html: string): string[] {
    const $ = cheerio.load(html);
    const peers: string[] = [];
    
    // The peer comparison table is typically in a section with id "peers"
    // We look for links to other companies in that table
    $('#peers .data-table tbody tr').each((_, el) => {
        const anchor = $(el).find('td.text-left a[href^="/company/"]');
        if (anchor.length) {
            const href = anchor.attr('href');
            if (href) {
                const slug = href.split('/')[2];
                // Avoid adding the current company itself
                if (slug && !peers.includes(slug)) {
                    peers.push(slug);
                }
            }
        }
    });

    // Fallback: look for any company links in data-tables if "peers" id not found
    if (peers.length === 0) {
      $('.data-table tbody tr').each((_, el) => {
          const anchor = $(el).find('td a[href^="/company/"]');
          if (anchor.length) {
              const href = anchor.attr('href');
              if (href) {
                  const slug = href.split('/')[2];
                  if (slug && !peers.includes(slug)) {
                      peers.push(slug);
                  }
              }
          }
      });
    }

    return peers.slice(0, 10);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.beta.calculate.path, async (req, res) => {
    try {
      const { ticker, exchange, startDate, endDate } = api.beta.calculate.input.parse(req.body);

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

      const [marketData, stockData] = await Promise.all([
        fetchHistoricalData(marketTicker, startDate, endDate),
        fetchHistoricalData(fullTicker, startDate, endDate)
      ]);

      if (!marketData || marketData.length === 0) {
        return res.status(500).json({ message: "Failed to fetch market index data" });
      }

      if (!stockData || stockData.length === 0) {
        return res.status(404).json({ message: `Failed to fetch data for ${fullTicker}. Check ticker or date range.` });
      }

      const dateMap = new Map<string, number>();
      marketData.forEach(d => {
        if (d.close) dateMap.set(d.date.toISOString().split('T')[0], d.close);
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
      console.log(`Found ${peerSymbols.length} total potential peers: ${peerSymbols.join(', ')}`);
      
      const peerBetas = await Promise.all(peerSymbols.map(async (peerSymbol) => {
          try {
            // Normalize ticker for Yahoo Finance
            let peerFullTicker = peerSymbol;
            if (!peerSymbol.includes('.')) {
              peerFullTicker = `${peerSymbol}${suffix}`;
            }
            
            console.log(`Processing peer: ${peerFullTicker}`);
            const peerData = await fetchHistoricalData(peerFullTicker, startDate, endDate);
            
            if (!peerData || peerData.length < 2) {
                console.log(`No data for peer: ${peerFullTicker}`);
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
            return { ticker: peerSymbol, name: peerSymbol, beta: pBeta };
          } catch (e) {
            console.error(`Error calculating beta for peer ${peerSymbol}:`, e);
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
          marketIndex: marketTicker === "^NSEI" ? "NIFTY 50" : "BSE SENSEX",
          beta,
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
