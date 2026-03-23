import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  copyFileSync,
} from "fs";
import { PATHS, PLUGIN_ROOT } from "./lib/paths.js";
import { resolve } from "path";

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

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const email = args.email;
  const portfolioName = args.portfolio;
  const tickersRaw = args.tickers;

  if (!email) {
    console.log(
      JSON.stringify({
        status: "error",
        message: "Missing --email. Required for SEC EDGAR User-Agent.",
      })
    );
    process.exit(1);
  }

  // 1. Create directories
  const dirs = [
    resolve(PLUGIN_ROOT, "data"),
    resolve(PLUGIN_ROOT, "data/financials"),
    resolve(PLUGIN_ROOT, "data/assessments"),
    resolve(PLUGIN_ROOT, "output"),
    resolve(PLUGIN_ROOT, "output/charts"),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  // 2. Create config.json
  const config = {
    sec_edgar: {
      user_agent: `PortfolioAnalyzer/1.0 (${email})`,
    },
    assessment: {
      model: "opus",
      max_budget_usd: 1.5,
      max_turns: 25,
    },
    charts: {
      output_dir: "output/charts",
      auto_open: true,
    },
  };
  writeFileSync(PATHS.config, JSON.stringify(config, null, 2));

  // 3. Create initial portfolio if provided
  if (portfolioName && tickersRaw) {
    const tickers = tickersRaw
      .split(",")
      .map((t: string) => t.trim().toUpperCase())
      .filter(Boolean);

    // Import SEC lookup dynamically (needs config to exist first)
    const { lookupCIK } = await import("./lib/sec-edgar.js");

    const portfolioTickers = [];
    const errors = [];

    for (const ticker of tickers) {
      try {
        const info = await lookupCIK(ticker);
        portfolioTickers.push({
          ticker: info.ticker,
          cik: info.cik,
          company_name: info.company_name,
          added_date: new Date().toISOString().slice(0, 10),
        });
      } catch (e: any) {
        errors.push({ ticker, error: e.message });
      }
    }

    const portfoliosData = {
      portfolios: [
        {
          name: portfolioName,
          created_date: new Date().toISOString().slice(0, 10),
          tickers: portfolioTickers,
        },
      ],
    };
    writeFileSync(PATHS.portfolios, JSON.stringify(portfoliosData, null, 2));

    console.log(
      JSON.stringify({
        status: "success",
        message: `Setup complete. Portfolio "${portfolioName}" created with ${portfolioTickers.length} tickers.`,
        data: {
          config_created: true,
          portfolio: portfolioName,
          tickers_added: portfolioTickers.map((t) => ({
            ticker: t.ticker,
            company: t.company_name,
          })),
          errors,
        },
      })
    );
  } else {
    // Just setup config without portfolio
    console.log(
      JSON.stringify({
        status: "success",
        message:
          "Setup complete. Config created. Use manage-portfolio.ts to create portfolios.",
        data: {
          config_created: true,
        },
      })
    );
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ status: "error", message: e.message }));
  process.exit(1);
});
