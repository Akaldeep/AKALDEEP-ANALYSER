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

async function getPeersFromScreener(ticker: string): Promise<string[]> {
  try {
    const symbol = ticker.split('.')[0];
    const url = `https://www.screener.in/company/${symbol}/consolidated/`;
    
    const response = await fetch(url);
    if (!response.ok) {
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
    
    $('.data-table tbody tr').each((_, el) => {
        const anchor = $(el).find('td a[href^="/company/"]');
        if (anchor.length) {
            const href = anchor.attr('href');
            if (href) {
                const parts = href.split('/');
                const symbol = parts[2];
                if (symbol && !peers.includes(symbol)) {
                    peers.push(symbol);
                }
            }
        }
    });

    return peers.slice(0, 5);
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

      const peerSymbols = await getPeersFromScreener(fullTicker);
      
      const peerBetas = await Promise.all(peerSymbols.map(async (peerSymbol) => {
          const peerFullTicker = `${peerSymbol}${suffix}`;
          const peerData = await fetchHistoricalData(peerFullTicker, startDate, endDate);
          
          if (!peerData) {
              return { ticker: peerSymbol, name: peerSymbol, beta: null, error: "Failed to fetch data" };
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
          return { ticker: peerSymbol, name: peerSymbol, beta: pBeta };
      }));

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
