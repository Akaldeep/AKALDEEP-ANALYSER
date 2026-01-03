import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import yahooFinance from 'yahoo-finance2';
import * as cheerio from 'cheerio';

// Helper to calculate Beta
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
      period1: startDate,
      period2: endDate,
      interval: '1d' as const // Daily returns
    };
    const result = await yahooFinance.historical(ticker, queryOptions);
    return result;
  } catch (error) {
    console.error(`Error fetching data for ${ticker}:`, error);
    return null;
  }
}

async function getPeersFromScreener(ticker: string): Promise<string[]> {
  try {
    // Screener uses the symbol without extension (usually).
    // e.g. RELIANCE.NS -> RELIANCE
    const symbol = ticker.split('.')[0];
    const url = `https://www.screener.in/company/${symbol}/consolidated/`;
    
    // We need to fetch the HTML. Yahoo finance lib doesn't do this.
    // We'll use the native fetch if available (Node 18+) or axios if installed.
    // I'll rely on global fetch which is available in Node 20.
    const response = await fetch(url);
    if (!response.ok) {
       // Try standalone URL if consolidated fails
       const url2 = `https://www.screener.in/company/${symbol}/`;
       const response2 = await fetch(url2);
       if (!response2.ok) return [];
       const text = await response2.text();
       return parsePeers(text);
    }
    const text = await response.text();
    return parsePeers(text);

  } catch (error) {
    console.error("Error fetching peers:", error);
    return [];
  }
}

function parsePeers(html: string): string[] {
    const $ = cheerio.load(html);
    const peers: string[] = [];
    // Screener Peer comparison table
    // Usually in a section with id 'peers' or class 'peer-table'
    // Looking for links to other companies
    
    // Specific selector for Screener's peer table
    $('#peers-table-placeholder .data-table tbody tr').each((_, el) => {
        const anchor = $(el).find('td a[href^="/company/"]');
        if (anchor.length) {
            const href = anchor.attr('href');
            if (href) {
                // href is like /company/TCS/
                const parts = href.split('/');
                if (parts.length >= 3) {
                    peers.push(parts[2]);
                }
            }
        }
    });

    return peers.slice(0, 5); // Limit to 5 peers
}


export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post(api.beta.calculate.path, async (req, res) => {
    try {
      const { ticker, exchange, startDate, endDate } = api.beta.calculate.input.parse(req.body);

      // Determine Market Index and Suffix
      let marketTicker = "";
      let suffix = "";
      if (exchange === "NSE") {
        marketTicker = "^NSEI"; // NIFTY 50
        suffix = ".NS";
      } else {
        marketTicker = "^BSESN"; // SENSEX
        suffix = ".BO";
      }

      const fullTicker = ticker.endsWith(suffix) ? ticker : `${ticker}${suffix}`;

      // 1. Fetch Market Data
      const marketData = await fetchHistoricalData(marketTicker, startDate, endDate);
      if (!marketData || marketData.length === 0) {
        return res.status(500).json({ message: "Failed to fetch market index data" });
      }

      // 2. Fetch Stock Data
      const stockData = await fetchHistoricalData(fullTicker, startDate, endDate);
      if (!stockData || stockData.length === 0) {
        return res.status(404).json({ message: `Failed to fetch data for ${fullTicker}. Check ticker or date range.` });
      }

      // Sync Dates (Yahoo Finance might return different sets of dates due to holidays)
      // We need aligned arrays.
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

      // 3. Calculate Beta for Stock
      const beta = calculateBetaValue(alignedStockPrices, alignedMarketPrices);
      if (beta === null) {
        return res.status(400).json({ message: "Insufficient data points to calculate beta" });
      }

      // 4. Identify Peers
      const peerSymbols = await getPeersFromScreener(fullTicker);
      
      const peerBetas = [];

      // 5. Calculate Beta for Peers
      for (const peerSymbol of peerSymbols) {
          const peerFullTicker = `${peerSymbol}${suffix}`; // Assume peers are on same exchange
          const peerData = await fetchHistoricalData(peerFullTicker, startDate, endDate);
          
          if (!peerData) {
              peerBetas.push({ ticker: peerSymbol, name: peerSymbol, beta: null, error: "Failed to fetch data" });
              continue;
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

          const pBeta = calculateBetaValue(pPrices, mPrices);
          peerBetas.push({ ticker: peerSymbol, name: peerSymbol, beta: pBeta });
      }

      // Save search to DB (fire and forget or await)
      await storage.createSearch({
          ticker: fullTicker,
          exchange,
          startDate,
          endDate,
          beta,
          peers: peerBetas
      });

      const response = {
          ticker: fullTicker,
          marketIndex: marketTicker === "^NSEI" ? "NIFTY 50" : "SENSEX",
          beta,
          peers: peerBetas
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
