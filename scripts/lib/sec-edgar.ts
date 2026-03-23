import { loadConfig } from "./config.js";

const SEC_BASE = "https://efts.sec.gov/LATEST";
const SEC_DATA = "https://data.sec.gov";

let rateLimitLastCall = 0;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const elapsed = now - rateLimitLastCall;
  if (elapsed < 120) {
    await new Promise((r) => setTimeout(r, 120 - elapsed));
  }
  rateLimitLastCall = Date.now();

  const config = loadConfig();
  const res = await fetch(url, {
    headers: {
      "User-Agent": config.sec_edgar.user_agent,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`SEC EDGAR ${res.status}: ${url}`);
  }
  return res;
}

export interface TickerCIK {
  cik: string;
  company_name: string;
  ticker: string;
}

export async function lookupCIK(ticker: string): Promise<TickerCIK> {
  const tickerRes = await rateLimitedFetch(
    "https://www.sec.gov/files/company_tickers.json"
  );
  const tickers: Record<
    string,
    { cik_str: number; ticker: string; title: string }
  > = await tickerRes.json() as Record<string, { cik_str: number; ticker: string; title: string }>;

  const upper = ticker.toUpperCase();
  for (const entry of Object.values(tickers)) {
    if (entry.ticker === upper) {
      return {
        cik: String(entry.cik_str).padStart(10, "0"),
        company_name: entry.title,
        ticker: entry.ticker,
      };
    }
  }
  throw new Error(`Ticker "${ticker}" not found in SEC EDGAR`);
}

export async function getSubmissions(cik: string): Promise<any> {
  const res = await rateLimitedFetch(
    `${SEC_DATA}/submissions/CIK${cik}.json`
  );
  return res.json();
}

export async function getCompanyFacts(cik: string): Promise<any> {
  const res = await rateLimitedFetch(
    `${SEC_DATA}/api/xbrl/companyfacts/CIK${cik}.json`
  );
  return res.json();
}
