/**
 * compute-ratios.ts
 *
 * Reads financial data files for a ticker and computes all deterministic metrics.
 * No LLM needed — pure arithmetic.
 *
 * Usage: npx tsx scripts/compute-ratios.ts --ticker XXXX
 * Output: JSON to stdout
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { PATHS } from "./lib/paths.js";

// --- Types ---

interface Filing {
  type: string;
  period: string;
  filed_date: string;
  local_file: string;
}

interface FilingsIndex {
  ticker: string;
  cik: string;
  company_name: string;
  filings: Filing[];
}

interface FinancialData {
  filing_type: string;
  period: string;
  filed_date: string;
  source: string;
  company_name: string;
  currency: string;
  income_statement: {
    revenue?: number;
    cost_of_revenue?: number;
    operating_income?: number;
    operating_expense?: number;
    profit_before_tax?: number;
    net_income?: number;
    eps_diluted?: number;
    depreciation_amortization?: number;
  };
  balance_sheet: {
    total_assets?: number;
    current_assets?: number;
    total_liabilities?: number;
    current_liabilities?: number;
    total_equity?: number;
    cash_and_equivalents?: number;
  };
  cash_flow: {
    operating_cash_flow?: number;
    capex?: number;
    free_cash_flow?: number;
    dividends_paid?: number;
    share_repurchases?: number;
    depreciation_amortization?: number;
  };
  shares: {
    shares_outstanding?: number;
    shares_diluted?: number;
  };
  data_quality?: Array<{ field: string; matched_concept: string; units: string }>;
  warnings?: Array<{ field: string; message: string }>;
}

interface PriceData {
  ticker: string;
  prices: Array<{ date: string; close: number; source: string }>;
}

// --- Helpers ---

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith("--") && args[i + 1] && !args[i + 1].startsWith("--")) {
      result[args[i].slice(2)] = args[i + 1];
      i++;
    }
  }
  return result;
}

function safeDiv(a: number | undefined, b: number | undefined): number | null {
  if (a == null || b == null || b === 0) return null;
  return a / b;
}

function getOperatingIncome(is: FinancialData["income_statement"]): number | null {
  if (is.operating_income != null) return is.operating_income;
  // IFRS: operating_expense is total operating expenses
  if (is.revenue != null && is.operating_expense != null) {
    return is.revenue - is.operating_expense;
  }
  return null;
}

function getOwnerEarnings(data: FinancialData): number | null {
  const ni = data.income_statement.net_income;
  const da = data.cash_flow.depreciation_amortization ?? data.income_statement.depreciation_amortization;
  const capex = data.cash_flow.capex;
  if (ni == null || da == null || capex == null) return null;
  // Owner Earnings = NI + D&A - |Capex| (conservative: full capex as maintenance)
  return ni + da - Math.abs(capex);
}

// --- Main ---

function computeRatios(ticker: string) {
  const tickerDir = resolve(PATHS.financials, ticker);

  // Load filings index
  const filingsPath = resolve(tickerDir, "filings.json");
  if (!existsSync(filingsPath)) {
    return { status: "error", message: `No filings.json found for ${ticker}` };
  }
  const filingsIndex: FilingsIndex = JSON.parse(readFileSync(filingsPath, "utf-8"));

  // Load prices
  const pricesPath = resolve(tickerDir, "prices.json");
  let currentPrice: number | null = null;
  let priceDate: string | null = null;
  if (existsSync(pricesPath)) {
    const priceData: PriceData = JSON.parse(readFileSync(pricesPath, "utf-8"));
    if (priceData.prices.length > 0) {
      const latest = priceData.prices[0];
      currentPrice = latest.close;
      priceDate = latest.date;
    }
  }

  // Separate annual filings (10-K, 20-F) and sort by period descending
  const annualFilings = filingsIndex.filings
    .filter((f) => f.type === "10-K" || f.type === "20-F")
    .sort((a, b) => b.period.localeCompare(a.period));

  if (annualFilings.length < 2) {
    return {
      status: "insufficient_data",
      message: `Only ${annualFilings.length} annual filing(s) found for ${ticker}. Need at least 2 for growth calculation.`,
      data_files_used: annualFilings.map((f) => f.local_file),
    };
  }

  // Load annual filing data
  const annualData: Array<{ filing: Filing; data: FinancialData }> = [];
  const dataFilesUsed: string[] = [];

  for (const filing of annualFilings) {
    const filePath = resolve(tickerDir, filing.local_file);
    if (!existsSync(filePath)) continue;
    const data: FinancialData = JSON.parse(readFileSync(filePath, "utf-8"));
    annualData.push({ filing, data });
    dataFilesUsed.push(filing.local_file);
  }

  if (annualData.length < 2) {
    return {
      status: "insufficient_data",
      message: `Could not load at least 2 annual filings for ${ticker}`,
      data_files_used: dataFilesUsed,
    };
  }

  const latest = annualData[0].data;
  const prior = annualData[1].data;
  const latestFiling = annualData[0].filing;

  // --- Computed ratios ---

  const is = latest.income_statement;
  const bs = latest.balance_sheet;
  const cf = latest.cash_flow;
  const sh = latest.shares;

  const revenue = is.revenue ?? null;
  const priorRevenue = prior.income_statement.revenue ?? null;
  const revenueGrowthYoy = safeDiv(
    revenue != null && priorRevenue != null ? revenue - priorRevenue : undefined,
    priorRevenue ?? undefined
  );

  // Revenue growth history (all consecutive pairs)
  const revenueGrowthHistory: Array<{ period: string; revenue: number; growth_yoy: number | null }> = [];
  for (let i = 0; i < annualData.length; i++) {
    const rev = annualData[i].data.income_statement.revenue;
    const prevRev = i + 1 < annualData.length ? annualData[i + 1].data.income_statement.revenue : null;
    if (rev != null) {
      revenueGrowthHistory.push({
        period: annualData[i].filing.period,
        revenue: rev,
        growth_yoy: prevRev != null && prevRev !== 0 ? (rev - prevRev) / prevRev : null,
      });
    }
  }

  const netIncome = is.net_income ?? null;
  const operatingIncome = getOperatingIncome(is);
  const grossProfit = revenue != null && is.cost_of_revenue != null ? revenue - is.cost_of_revenue : null;

  const operatingMargin = safeDiv(operatingIncome ?? undefined, revenue ?? undefined);
  const netMargin = safeDiv(netIncome ?? undefined, revenue ?? undefined);
  const grossMargin = safeDiv(grossProfit ?? undefined, revenue ?? undefined);

  const totalEquity = bs.total_equity ?? null;
  const roe = safeDiv(netIncome ?? undefined, totalEquity ?? undefined);
  const totalLiabilities = bs.total_liabilities ?? null;
  const debtToEquity = safeDiv(totalLiabilities ?? undefined, totalEquity ?? undefined);

  const currentRatio = safeDiv(bs.current_assets ?? undefined, bs.current_liabilities ?? undefined);

  const fcf = cf.free_cash_flow ?? null;
  const fcfToNetIncome = safeDiv(fcf ?? undefined, netIncome ?? undefined);
  const capexToRevenue = safeDiv(cf.capex != null ? Math.abs(cf.capex) : undefined, revenue ?? undefined);

  const ownerEarnings = getOwnerEarnings(latest);

  // Owner earnings average (all available years)
  const ownerEarningsByYear: number[] = [];
  for (const ad of annualData) {
    const oe = getOwnerEarnings(ad.data);
    if (oe != null) ownerEarningsByYear.push(oe);
  }
  const ownerEarnings3yrAvg =
    ownerEarningsByYear.length >= 2
      ? ownerEarningsByYear.slice(0, 3).reduce((a, b) => a + b, 0) / Math.min(ownerEarningsByYear.length, 3)
      : ownerEarnings;

  // Per-share metrics
  const sharesOutstanding = sh.shares_outstanding ?? null;
  const sharesDiluted = sh.shares_diluted ?? null;
  const epsDiluted = is.eps_diluted ?? null;

  // For non-USD filers: price is in USD, EPS/financials are in local currency.
  // Cross-currency ratios (P/E, market cap, EV) are invalid without FX conversion.
  // We compute them only for USD filers; LLM handles FX conversion for non-USD.
  const isUSD = latest.currency === "USD";

  const peRatio =
    isUSD && currentPrice != null && epsDiluted != null && epsDiluted > 0
      ? currentPrice / epsDiluted
      : null;
  const earningsYield = peRatio != null && peRatio > 0 ? 1 / peRatio : null;

  // Market cap (USD) — valid for all since price is always USD
  const marketCap =
    currentPrice != null && sharesOutstanding != null ? currentPrice * sharesOutstanding : null;

  // Net debt — only meaningful within same currency as financials
  const cash = bs.cash_and_equivalents ?? 0;
  const netDebtLocal = totalLiabilities != null ? totalLiabilities - cash : null;

  // EV and EV/Revenue — only valid for USD filers (otherwise mixing currencies)
  const enterpriseValue = isUSD && marketCap != null && netDebtLocal != null ? marketCap + netDebtLocal : null;
  const evNtmRevenue = safeDiv(enterpriseValue ?? undefined, revenue ?? undefined);

  // --- Multi-year data ---

  const multiYearData = annualData.map((ad) => {
    const d = ad.data;
    return {
      period: ad.filing.period,
      filed_date: ad.filing.filed_date,
      revenue: d.income_statement.revenue ?? null,
      net_income: d.income_statement.net_income ?? null,
      operating_income: getOperatingIncome(d.income_statement),
      fcf: d.cash_flow.free_cash_flow ?? null,
      eps_diluted: d.income_statement.eps_diluted ?? null,
      owner_earnings: getOwnerEarnings(d),
      shares_diluted: d.shares.shares_diluted ?? null,
      shares_outstanding: d.shares.shares_outstanding ?? null,
    };
  });

  // --- Auto-detect EM/ADR flags ---

  const filingType20f = latestFiling.type === "20-F";
  const currencyNonUsd = latest.currency !== "USD";

  // --- Data quality notes ---

  const dataQualityNotes: string[] = [];
  if (latest.warnings) {
    for (const w of latest.warnings) {
      dataQualityNotes.push(`[${w.field}] ${w.message}`);
    }
  }
  // Check for missing fields
  if (bs.current_assets == null || bs.current_liabilities == null) {
    dataQualityNotes.push("current_assets or current_liabilities missing — current_ratio unavailable");
  }
  if (operatingIncome == null) {
    dataQualityNotes.push("operating_income not available — operating_margin unavailable");
  }
  if (!isUSD) {
    dataQualityNotes.push(
      `Currency is ${latest.currency}. P/E, EV, EV/Revenue set to null — LLM must convert to USD for cross-currency metrics.`
    );
  }

  return {
    status: "ok",
    ticker,
    company_name: filingsIndex.company_name,
    exchange: null, // not in EDGAR data; LLM will fill
    current_price: currentPrice,
    price_date: priceDate,
    currency: latest.currency,
    report_period: `${latestFiling.period} (${latestFiling.type})`,
    report_filed_date: latestFiling.filed_date,
    computed_ratios: {
      revenue_ttm: revenue,
      revenue_growth_yoy: revenueGrowthYoy,
      revenue_growth_history: revenueGrowthHistory,
      net_income_ttm: netIncome,
      operating_income_ttm: operatingIncome,
      gross_profit_ttm: grossProfit,
      operating_margin: operatingMargin,
      net_margin: netMargin,
      gross_margin: grossMargin,
      roe,
      debt_to_equity: debtToEquity,
      current_ratio: currentRatio,
      pe_ratio: peRatio,
      fcf_ttm: fcf,
      fcf_to_net_income: fcfToNetIncome,
      owner_earnings_ttm: ownerEarnings,
      owner_earnings_3yr_avg: ownerEarnings3yrAvg,
      capex_to_revenue: capexToRevenue,
      earnings_yield: earningsYield,
      market_cap: marketCap,
      enterprise_value: enterpriseValue,
      ev_ntm_revenue: evNtmRevenue,
      net_debt_local_currency: netDebtLocal,
      eps_diluted: epsDiluted,
    },
    multi_year_data: multiYearData,
    shares_latest: {
      shares_outstanding: sharesOutstanding,
      shares_diluted: sharesDiluted,
    },
    filing_type_20f: filingType20f,
    currency_non_usd: currencyNonUsd,
    data_quality_notes: dataQualityNotes,
    data_files_used: dataFilesUsed,
    // Pass through raw latest filing data for the LLM context
    raw_latest_filing: latest,
    raw_prior_filing: prior,
  };
}

// --- CLI ---

const args = parseArgs(process.argv.slice(2));
if (!args.ticker) {
  console.log(JSON.stringify({ status: "error", message: "Usage: --ticker XXXX" }));
  process.exit(1);
}

const result = computeRatios(args.ticker.toUpperCase());
console.log(JSON.stringify(result, null, 2));

if (result.status === "error" || result.status === "insufficient_data") {
  process.exit(1);
}
