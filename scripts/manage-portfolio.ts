import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { PATHS } from "./lib/paths.js";
import { lookupCIK } from "./lib/sec-edgar.js";

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

function loadPortfolios(): PortfoliosData {
  if (!existsSync(PATHS.portfolios)) {
    return { portfolios: [] };
  }
  return JSON.parse(readFileSync(PATHS.portfolios, "utf-8"));
}

function savePortfolios(data: PortfoliosData): void {
  const dir = dirname(PATHS.portfolios);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(PATHS.portfolios, JSON.stringify(data, null, 2));
}

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--")) {
      const key = args[i].slice(2);
      result[key] = args[i + 1] || "";
      i++;
    }
  }
  return result;
}

async function create(name: string): Promise<void> {
  const data = loadPortfolios();
  if (data.portfolios.find((p) => p.name === name)) {
    console.log(JSON.stringify({ error: `Portfolio "${name}" already exists` }));
    process.exit(1);
  }
  data.portfolios.push({
    name,
    created_date: new Date().toISOString().slice(0, 10),
    tickers: [],
  });
  savePortfolios(data);
  console.log(
    JSON.stringify({ status: "success", message: `Portfolio "${name}" created` })
  );
}

async function add(portfolioName: string, ticker: string): Promise<void> {
  const data = loadPortfolios();
  const portfolio = data.portfolios.find((p) => p.name === portfolioName);
  if (!portfolio) {
    console.log(
      JSON.stringify({ error: `Portfolio "${portfolioName}" not found` })
    );
    process.exit(1);
  }
  const upper = ticker.toUpperCase();
  if (portfolio.tickers.find((t) => t.ticker === upper)) {
    console.log(
      JSON.stringify({
        error: `${upper} already in portfolio "${portfolioName}"`,
      })
    );
    process.exit(1);
  }

  const info = await lookupCIK(upper);
  portfolio.tickers.push({
    ticker: info.ticker,
    cik: info.cik,
    company_name: info.company_name,
    added_date: new Date().toISOString().slice(0, 10),
  });
  savePortfolios(data);
  console.log(
    JSON.stringify({
      status: "success",
      message: `Added ${info.ticker} (${info.company_name}) to "${portfolioName}"`,
    })
  );
}

async function remove(portfolioName: string, ticker: string): Promise<void> {
  const data = loadPortfolios();
  const portfolio = data.portfolios.find((p) => p.name === portfolioName);
  if (!portfolio) {
    console.log(
      JSON.stringify({ error: `Portfolio "${portfolioName}" not found` })
    );
    process.exit(1);
  }
  const upper = ticker.toUpperCase();
  const idx = portfolio.tickers.findIndex((t) => t.ticker === upper);
  if (idx === -1) {
    console.log(
      JSON.stringify({
        error: `${upper} not found in portfolio "${portfolioName}"`,
      })
    );
    process.exit(1);
  }
  portfolio.tickers.splice(idx, 1);
  savePortfolios(data);
  console.log(
    JSON.stringify({
      status: "success",
      message: `Removed ${upper} from "${portfolioName}"`,
    })
  );
}

function list(portfolioName?: string): void {
  const data = loadPortfolios();
  if (portfolioName) {
    const portfolio = data.portfolios.find((p) => p.name === portfolioName);
    if (!portfolio) {
      console.log(
        JSON.stringify({ error: `Portfolio "${portfolioName}" not found` })
      );
      process.exit(1);
    }
    console.log(JSON.stringify(portfolio, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

async function deletePortfolio(name: string): Promise<void> {
  const data = loadPortfolios();
  const idx = data.portfolios.findIndex((p) => p.name === name);
  if (idx === -1) {
    console.log(JSON.stringify({ error: `Portfolio "${name}" not found` }));
    process.exit(1);
  }
  data.portfolios.splice(idx, 1);
  savePortfolios(data);
  console.log(
    JSON.stringify({ status: "success", message: `Portfolio "${name}" deleted` })
  );
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const action = args.action;

  switch (action) {
    case "create":
      await create(args.name);
      break;
    case "add":
      await add(args.portfolio, args.ticker);
      break;
    case "remove":
      await remove(args.portfolio, args.ticker);
      break;
    case "list":
      list(args.portfolio);
      break;
    case "delete":
      await deletePortfolio(args.name);
      break;
    default:
      console.log(
        JSON.stringify({
          error: `Unknown action: ${action}. Use: create, add, remove, list, delete`,
        })
      );
      process.exit(1);
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ error: e.message }));
  process.exit(1);
});
