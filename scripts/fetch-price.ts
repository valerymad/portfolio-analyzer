import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PATHS } from "./lib/paths.js";
import { loadConfig } from "./lib/config.js";

const config = loadConfig();

interface PriceEntry {
  date: string;
  close: number;
  source: string;
}

interface PricesFile {
  ticker: string;
  prices: PriceEntry[];
}

function parseArgs(args: string[]): Record<string, string | boolean> {
  const result: Record<string, string | boolean> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      if (args[i + 1] && !args[i + 1].startsWith("--")) {
        result[key] = args[i + 1];
        i++;
      } else {
        result[key] = true;
      }
    }
  }
  return result;
}

async function fetchYahooPrice(ticker: string): Promise<{
  price: number;
  currency: string;
  exchange: string;
  company_name: string;
  market_cap: number | null;
  pe_ratio: number | null;
}> {
  // Yahoo Finance v8 quote endpoint
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1d&interval=1d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance ${res.status} for ${ticker}`);
  }

  const data: any = await res.json();
  const meta = data?.chart?.result?.[0]?.meta;
  if (!meta) {
    throw new Error(`No data from Yahoo Finance for ${ticker}`);
  }

  return {
    price: meta.regularMarketPrice,
    currency: meta.currency || "USD",
    exchange: meta.exchangeName || "",
    company_name: meta.shortName || meta.longName || ticker,
    market_cap: null, // v8 chart doesn't include this
    pe_ratio: null,
  };
}

async function fetchYahooQuote(ticker: string): Promise<{
  market_cap: number | null;
  pe_ratio: number | null;
  shares_outstanding: number | null;
}> {
  const empty = { market_cap: null, pe_ratio: null, shares_outstanding: null };

  // Method 1: Yahoo v6 quote endpoint (most reliable for fundamentals)
  try {
    const url = `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(ticker)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (res.ok) {
      const data: any = await res.json();
      const q = data?.quoteResponse?.result?.[0];
      if (q) {
        const result = {
          market_cap: q.marketCap || null,
          pe_ratio: q.trailingPE || q.forwardPE || null,
          shares_outstanding: q.sharesOutstanding || null,
        };
        if (result.shares_outstanding) return result;
      }
    }
  } catch {}

  // Method 2: Yahoo v10 quoteSummary (often blocked, but try)
  try {
    const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=defaultKeyStatistics,financialData,price`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (res.ok) {
      const data: any = await res.json();
      const stats = data?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
      const priceModule = data?.quoteSummary?.result?.[0]?.price;

      const result = {
        market_cap: priceModule?.marketCap?.raw || null,
        pe_ratio: stats?.trailingPE?.raw || stats?.forwardPE?.raw || null,
        shares_outstanding: stats?.sharesOutstanding?.raw || null,
      };
      if (result.shares_outstanding) return result;
    }
  } catch {}

  return empty;
}

async function fetchSharesFromEdgar(ticker: string): Promise<number | null> {
  // Fallback: get shares outstanding from SEC EDGAR XBRL companyfacts
  try {
    // First, look up CIK from local filings.json
    const filingsPath = resolve(PATHS.financials, ticker, "filings.json");
    let cik: string | null = null;
    if (existsSync(filingsPath)) {
      const filings = JSON.parse(readFileSync(filingsPath, "utf-8"));
      cik = filings.cik;
    }
    if (!cik) return null;

    const paddedCik = cik.replace(/^0+/, "").padStart(10, "0");
    const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${paddedCik}.json`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": config.sec_edgar.user_agent,
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;

    const data: any = await res.json();

    // Try multiple XBRL concepts for shares outstanding
    const concepts = [
      data?.facts?.dei?.EntityCommonStockSharesOutstanding,
      data?.facts?.["us-gaap"]?.CommonStockSharesOutstanding,
      data?.facts?.["ifrs-full"]?.NumberOfSharesOutstanding,
    ];

    for (const concept of concepts) {
      if (!concept?.units) continue;
      const units = Object.values(concept.units) as any[];
      if (!units.length) continue;
      const entries = units[0] as any[];
      if (!entries?.length) continue;

      // Get the most recent entry
      const sorted = entries
        .filter((e: any) => e.val && e.end)
        .sort((a: any, b: any) => b.end.localeCompare(a.end));

      if (sorted.length > 0) {
        return sorted[0].val;
      }
    }
    return null;
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ticker = (args.ticker as string)?.toUpperCase();

  if (!ticker) {
    console.log(JSON.stringify({ status: "error", message: "Missing --ticker" }));
    process.exit(1);
  }

  const tickerDir = resolve(PATHS.financials, ticker);
  if (!existsSync(tickerDir)) mkdirSync(tickerDir, { recursive: true });

  const pricesPath = resolve(tickerDir, "prices.json");

  // Fetch current price
  const priceData = await fetchYahooPrice(ticker);
  const yahooFundamentals = await fetchYahooQuote(ticker);

  let shares = yahooFundamentals.shares_outstanding;
  let sharesSource = "yahoo_finance";

  // Fallback: SEC EDGAR for shares outstanding
  if (!shares) {
    shares = await fetchSharesFromEdgar(ticker);
    sharesSource = shares ? "sec_edgar" : "unavailable";
  }

  // Compute market_cap: prefer Yahoo's value, fallback to price × shares
  let marketCap = yahooFundamentals.market_cap;
  if (!marketCap && shares && priceData.price) {
    marketCap = Math.round(shares * priceData.price);
  }

  const today = new Date().toISOString().slice(0, 10);

  // Append to prices.json (append-only)
  let pricesFile: PricesFile;
  if (existsSync(pricesPath)) {
    pricesFile = JSON.parse(readFileSync(pricesPath, "utf-8"));
    const existingToday = pricesFile.prices.find((p) => p.date === today);
    if (existingToday) {
      existingToday.close = priceData.price;
    } else {
      pricesFile.prices.push({
        date: today,
        close: priceData.price,
        source: "yahoo_finance",
      });
    }
  } else {
    pricesFile = {
      ticker,
      prices: [{ date: today, close: priceData.price, source: "yahoo_finance" }],
    };
  }

  writeFileSync(pricesPath, JSON.stringify(pricesFile, null, 2));

  // Warn if shares_outstanding is still null
  const warnings: string[] = [];
  if (!shares) {
    warnings.push("shares_outstanding unavailable from all sources — market_cap may be unreliable. Do NOT compute shares from net_income/EPS (gives diluted count, not basic).");
  }

  console.log(
    JSON.stringify({
      status: "success",
      data: {
        ticker,
        price: priceData.price,
        currency: priceData.currency,
        exchange: priceData.exchange,
        company_name: priceData.company_name,
        market_cap: marketCap,
        pe_ratio: yahooFundamentals.pe_ratio,
        shares_outstanding: shares,
        shares_source: sharesSource,
        date: today,
      },
      ...(warnings.length > 0 ? { warnings } : {}),
    })
  );
}

main().catch((e) => {
  console.log(JSON.stringify({ status: "error", message: e.message }));
  process.exit(1);
});
