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

async function getPeersFromScreener(ticker: string): Promise<{ slug: string; sector: string; marketCap: number }[]> {
  try {
    const symbol = ticker.split('.')[0];
    const url = `https://www.screener.in/company/${symbol}/`;
    
    console.log(`Fetching peers from Screener for: ${symbol}`);
    const response = await fetch(url);
    if (!response.ok) {
      const searchUrl = `https://www.screener.in/api/company/search/?q=${symbol}`;
      const searchRes = await fetch(searchUrl);
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData && searchData.length > 0) {
          const firstSlug = searchData[0].url.split('/')[2];
          const res2 = await fetch(`https://www.screener.in/company/${firstSlug}/`);
          if (res2.ok) return parsePeers(await res2.text());
        }
      }
      return [];
    }

    return parsePeers(await response.text());
  } catch (error) {
    console.error("Error fetching peers from Screener:", error);
    return [];
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

function parseSectorHierarchy($: any): string {
    const hierarchy: string[] = [];
    // Screener.in's industry classification is typically in a p tag with specific text
    // Example: "Sector: Information Technology | Industry: IT - Software"
    // Or in breadcrumbs
    $('.company-links a, .breadcrumb-item a').each((_i: any, el: any) => {
        const text = $(el).text().trim();
        if (text && !hierarchy.includes(text)) {
            hierarchy.push(text);
        }
    });

    if (hierarchy.length === 0) {
        // Fallback: look for "Sector" or "Industry" text in the page
        const sectorText = $('p:contains("Sector")').text() || $('p:contains("Industry")').text();
        if (sectorText) {
            return sectorText.replace(/Sector:|Industry:/g, '').replace(/\|/g, '>').trim();
        }
    }

    return hierarchy.join(' > ') || 'Industry';
}

function parsePeers(html: string): { slug: string; sector: string; marketCap: number }[] {
    const $ = cheerio.load(html);
    const peers: { slug: string; sector: string; marketCap: number }[] = [];
    const sector = parseSectorHierarchy($);
    
    // Simplest approach: Look for any table rows with company links
    // The "Peer Comparison" table is usually the only one with these types of links
    const peerTable = $('#peers table, .peer-comparison table, .data-table').first();
    const rows = peerTable.find('tbody tr');

    rows.each((_i: any, el: any) => {
        const cells = $(el).find('td');
        const anchor = $(el).find('a[href^="/company/"]');
        
        if (anchor.length) {
            const href = anchor.attr('href');
            const slug = href?.split('/')[2];
            
            // Market Cap is usually in a column with "Mar Cap" header
            // Typically index 4 or 5. Let's look for the largest number in the row
            let mCap = 0;
            cells.each((_j: any, td: any) => {
                const val = parseFloat($(td).text().replace(/,/g, ''));
                if (!isNaN(val) && val > mCap) mCap = val;
            });

            if (slug && !peers.some(p => p.slug === slug)) {
                peers.push({ slug, sector, marketCap: mCap });
            }
        }
    });

    return peers
        .sort((a, b) => b.marketCap - a.marketCap)
        .slice(0, 5);
}

async function getPeers(ticker: string): Promise<{ slug: string; sector: string; marketCap: number }[]> {
  const symbol = ticker.split('.')[0];
  // Strictly use Screener.in for peers to ensure they are from the same industry
  let peers = await getPeersFromScreener(ticker);
  
  peers = peers.filter(p => p.slug.toLowerCase() !== symbol.toLowerCase());
  
  // No fallback to Yahoo recommendations as they can cross industries.
  // We strictly stick to Screener's industry peers.
  return peers;
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
