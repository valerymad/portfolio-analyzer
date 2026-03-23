import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "fs";
import { resolve } from "path";
import { PATHS, PLUGIN_ROOT } from "./lib/paths.js";

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

function formatNum(n: number | null | undefined, decimals = 0): string {
  if (n == null) return "N/A";
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return n.toFixed(decimals);
}

function loadAssessments(ticker: string): any[] {
  const dir = resolve(PATHS.assessments, ticker);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => JSON.parse(readFileSync(resolve(dir, f), "utf-8")));
}

function generateTickerChart(ticker: string): string {
  const assessments = loadAssessments(ticker.toUpperCase());
  if (assessments.length === 0) {
    return JSON.stringify({
      status: "error",
      message: `No assessments found for ${ticker}`,
    });
  }

  const latest = assessments[assessments.length - 1];
  const template = readFileSync(
    resolve(PLUGIN_ROOT, "templates/chart-ticker.html"),
    "utf-8"
  );

  const chartData = {
    dates: assessments.map((a) => a.assessment_date),
    prices: assessments.map((a) => a.current_price),
    bull: assessments.map((a) => a.scenarios?.bull?.fair_value ?? null),
    base: assessments.map((a) => a.scenarios?.base?.fair_value ?? null),
    bear: assessments.map((a) => a.scenarios?.bear?.fair_value ?? null),
    verdicts: assessments.map((a) => a.verdict),
  };

  const upside = latest.scenarios?.base?.upside_pct ?? 0;

  const html = template
    .replace(/\{\{TICKER\}\}/g, latest.ticker || ticker.toUpperCase())
    .replace(/\{\{COMPANY_NAME\}\}/g, latest.company_name || "")
    .replace(/\{\{EXCHANGE\}\}/g, latest.exchange || "")
    .replace(/\{\{ASSESSMENT_DATE\}\}/g, latest.assessment_date || "")
    .replace(/\{\{VERDICT\}\}/g, latest.verdict || "HOLD")
    .replace(/\{\{CURRENT_PRICE\}\}/g, (latest.current_price ?? 0).toFixed(2))
    .replace(
      /\{\{BASE_FV\}\}/g,
      (latest.scenarios?.base?.fair_value ?? 0).toFixed(2)
    )
    .replace(/\{\{UPSIDE_PCT\}\}/g, (upside > 0 ? "+" : "") + upside.toFixed(1))
    .replace(
      /\{\{UPSIDE_CLASS\}\}/g,
      upside > 0 ? "positive" : upside < 0 ? "negative" : ""
    )
    .replace(
      /\{\{QUALITY_OVERALL\}\}/g,
      (latest.quality_score?.overall ?? 0).toFixed(1)
    )
    .replace(
      /\{\{PE_RATIO\}\}/g,
      latest.financial_summary?.pe_ratio?.toFixed(1) ?? "N/A"
    )
    .replace(
      /\{\{FCF_TTM\}\}/g,
      formatNum(latest.financial_summary?.free_cash_flow_ttm)
    )
    .replace(/\{\{SUMMARY\}\}/g, latest.summary || "")
    .replace(
      /\{\{Q_FINANCIAL\}\}/g,
      String(latest.quality_score?.financial_health ?? "—")
    )
    .replace(
      /\{\{Q_GROWTH\}\}/g,
      String(latest.quality_score?.growth_quality ?? "—")
    )
    .replace(
      /\{\{Q_MOAT\}\}/g,
      String(latest.quality_score?.competitive_moat ?? "—")
    )
    .replace(
      /\{\{Q_MGMT\}\}/g,
      String(latest.quality_score?.management ?? "—")
    )
    .replace(/\{\{CHART_DATA_JSON\}\}/g, JSON.stringify(chartData));

  // Save
  if (!existsSync(PATHS.charts)) mkdirSync(PATHS.charts, { recursive: true });
  const outPath = resolve(PATHS.charts, `${ticker.toUpperCase()}.html`);
  writeFileSync(outPath, html);
  return JSON.stringify({
    status: "success",
    message: `Chart saved: ${outPath}`,
    data: { file: outPath },
  });
}

function generateDashboard(portfolioName: string): string {
  const portfoliosPath = PATHS.portfolios;
  if (!existsSync(portfoliosPath)) {
    return JSON.stringify({
      status: "error",
      message: "No portfolios found. Run setup first.",
    });
  }

  const portfolios = JSON.parse(readFileSync(portfoliosPath, "utf-8"));
  const portfolio = portfolios.portfolios.find(
    (p: any) => p.name === portfolioName
  );
  if (!portfolio) {
    return JSON.stringify({
      status: "error",
      message: `Portfolio "${portfolioName}" not found`,
    });
  }

  const template = readFileSync(
    resolve(PLUGIN_ROOT, "templates/chart-dashboard.html"),
    "utf-8"
  );

  const rows: string[] = [];
  const chartTickers: string[] = [];
  const chartUpsides: number[] = [];
  const chartVerdicts: string[] = [];

  for (const t of portfolio.tickers) {
    const assessments = loadAssessments(t.ticker);
    if (assessments.length === 0) continue;

    const latest = assessments[assessments.length - 1];
    const upside = latest.scenarios?.base?.upside_pct ?? 0;
    const upsideClass = upside > 0 ? "positive" : upside < 0 ? "negative" : "neutral";
    const verdict = latest.verdict || "HOLD";

    chartTickers.push(t.ticker);
    chartUpsides.push(upside);
    chartVerdicts.push(verdict);

    rows.push(`
      <tr>
        <td>
          <a class="ticker-link" href="${t.ticker}.html">${t.ticker}</a>
          <div class="company">${latest.company_name || t.company_name}</div>
        </td>
        <td>$${(latest.current_price ?? 0).toFixed(2)}</td>
        <td>$${(latest.scenarios?.base?.fair_value ?? 0).toFixed(2)}</td>
        <td class="${upsideClass}">${upside > 0 ? "+" : ""}${upside.toFixed(1)}%</td>
        <td>${(latest.quality_score?.overall ?? 0).toFixed(1)}/10</td>
        <td><span class="verdict-badge verdict-${verdict}">${verdict}</span></td>
        <td>${latest.assessment_date || "—"}</td>
      </tr>
    `);
  }

  const chartData = {
    tickers: chartTickers,
    upsides: chartUpsides,
    verdicts: chartVerdicts,
  };

  const html = template
    .replace(/\{\{PORTFOLIO_NAME\}\}/g, portfolioName)
    .replace(/\{\{TICKER_COUNT\}\}/g, String(portfolio.tickers.length))
    .replace(/\{\{UPDATE_DATE\}\}/g, new Date().toISOString().slice(0, 10))
    .replace(/\{\{TABLE_ROWS\}\}/g, rows.join("\n"))
    .replace(/\{\{CHART_DATA_JSON\}\}/g, JSON.stringify(chartData));

  if (!existsSync(PATHS.charts)) mkdirSync(PATHS.charts, { recursive: true });
  const outPath = resolve(PATHS.charts, `dashboard-${portfolioName}.html`);
  writeFileSync(outPath, html);
  return JSON.stringify({
    status: "success",
    message: `Dashboard saved: ${outPath}`,
    data: { file: outPath },
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.ticker) {
    console.log(generateTickerChart(args.ticker as string));
  } else if (args.portfolio) {
    console.log(generateDashboard(args.portfolio as string));
  } else {
    console.log(
      JSON.stringify({
        status: "error",
        message: "Use --ticker <TICKER> or --portfolio <name>",
      })
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ status: "error", message: e.message }));
  process.exit(1);
});
