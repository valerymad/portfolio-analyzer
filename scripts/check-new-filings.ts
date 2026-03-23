import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PATHS } from "./lib/paths.js";
import { getSubmissions } from "./lib/sec-edgar.js";

interface FilingRecord {
  type: string;
  period: string;
  filed_date: string;
  accession: string;
  downloaded: string;
  local_file: string;
}

interface FilingsIndex {
  ticker: string;
  cik: string;
  company_name: string;
  filings: FilingRecord[];
  last_checked: string;
}

interface PortfolioTicker {
  ticker: string;
  cik: string;
  company_name: string;
  added_date: string;
}

interface Portfolio {
  name: string;
  created_date: string;
  tickers: PortfolioTicker[];
}

interface PortfoliosData {
  portfolios: Portfolio[];
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

function getAllTickers(): PortfolioTicker[] {
  if (!existsSync(PATHS.portfolios)) return [];
  const data: PortfoliosData = JSON.parse(readFileSync(PATHS.portfolios, "utf-8"));
  const seen = new Set<string>();
  const result: PortfolioTicker[] = [];
  for (const p of data.portfolios) {
    for (const t of p.tickers) {
      if (!seen.has(t.ticker)) {
        seen.add(t.ticker);
        result.push(t);
      }
    }
  }
  return result;
}

async function checkTicker(
  ticker: string,
  cik: string
): Promise<{
  ticker: string;
  new_filings: Array<{ type: string; period: string; filed_date: string; accession: string }>;
  error?: string;
}> {
  const tickerDir = resolve(PATHS.financials, ticker);
  const filingsPath = resolve(tickerDir, "filings.json");

  let existingAccessions = new Set<string>();
  if (existsSync(filingsPath)) {
    const index: FilingsIndex = JSON.parse(readFileSync(filingsPath, "utf-8"));
    existingAccessions = new Set(index.filings.map((f) => f.accession));
  }

  const submissions = await getSubmissions(cik);
  const recent = submissions.filings?.recent;
  if (!recent) return { ticker, new_filings: [] };

  const forms = recent.form as string[];
  const filedDates = recent.filingDate as string[];
  const accessions = recent.accessionNumber as string[];

  const newFilings: Array<{
    type: string;
    period: string;
    filed_date: string;
    accession: string;
  }> = [];

  for (let i = 0; i < forms.length; i++) {
    if (forms[i] !== "10-K" && forms[i] !== "10-Q") continue;
    if (existingAccessions.has(accessions[i])) continue;

    const filedDate = filedDates[i];
    const year = parseInt(filedDate.slice(0, 4));

    let period: string;
    if (forms[i] === "10-K") {
      period = `FY${year - 1}`;
    } else {
      const month = parseInt(filedDate.slice(5, 7));
      let quarter: string;
      if (month <= 3) quarter = "Q4";
      else if (month <= 6) quarter = "Q1";
      else if (month <= 9) quarter = "Q2";
      else quarter = "Q3";
      const fy = quarter === "Q4" ? year - 1 : year;
      period = `${quarter}-${fy}`;
    }

    newFilings.push({
      type: forms[i],
      period,
      filed_date: filedDate,
      accession: accessions[i],
    });
  }

  // Update last_checked in filings.json
  if (existsSync(filingsPath)) {
    const index: FilingsIndex = JSON.parse(readFileSync(filingsPath, "utf-8"));
    index.last_checked = new Date().toISOString();
    writeFileSync(filingsPath, JSON.stringify(index, null, 2));
  }

  return { ticker, new_filings: newFilings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const singleTicker = args.ticker as string | undefined;
  const all = args.all === true;

  let tickersToCheck: PortfolioTicker[];

  if (singleTicker) {
    // Check single ticker — need CIK from portfolios
    const allTickers = getAllTickers();
    const found = allTickers.find((t) => t.ticker === singleTicker.toUpperCase());
    if (!found) {
      console.log(
        JSON.stringify({
          status: "error",
          message: `Ticker ${singleTicker} not found in any portfolio`,
        })
      );
      process.exit(1);
    }
    tickersToCheck = [found];
  } else if (all) {
    tickersToCheck = getAllTickers();
  } else {
    console.log(
      JSON.stringify({
        status: "error",
        message: "Use --ticker <TICKER> or --all",
      })
    );
    process.exit(1);
  }

  const results = [];
  const newFilingsAll: Array<{
    ticker: string;
    type: string;
    period: string;
    filed_date: string;
  }> = [];
  const upToDate: string[] = [];
  const errors: Array<{ ticker: string; error: string }> = [];

  for (const t of tickersToCheck) {
    try {
      const result = await checkTicker(t.ticker, t.cik);
      if (result.new_filings.length > 0) {
        for (const f of result.new_filings) {
          newFilingsAll.push({
            ticker: t.ticker,
            type: f.type,
            period: f.period,
            filed_date: f.filed_date,
          });
        }
      } else {
        upToDate.push(t.ticker);
      }
    } catch (e: any) {
      errors.push({ ticker: t.ticker, error: e.message });
    }
  }

  console.log(
    JSON.stringify({
      status: "success",
      checked: tickersToCheck.length,
      new_filings: newFilingsAll,
      up_to_date: upToDate,
      errors,
    })
  );
}

main().catch((e) => {
  console.log(JSON.stringify({ status: "error", message: e.message }));
  process.exit(1);
});
