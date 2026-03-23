import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "fs";
import { resolve } from "path";
import { PATHS } from "./lib/paths.js";
import { getCompanyFacts, getSubmissions, lookupCIK } from "./lib/sec-edgar.js";

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

interface DataQualityEntry {
  field: string;
  matched_concept: string;
  units: string;
  note?: string;
}

interface SanityWarning {
  field: string;
  message: string;
}

interface FinancialData {
  filing_type: string;
  period: string;
  filed_date: string;
  source: string;
  company_name: string;
  currency: string;
  income_statement: Record<string, number>;
  balance_sheet: Record<string, number>;
  cash_flow: Record<string, number>;
  shares: Record<string, number>;
  data_quality: DataQualityEntry[];
  warnings: SanityWarning[];
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

// XBRL concept name mappings — supports both us-gaap and ifrs-full taxonomies
const CONCEPT_MAP = {
  // --- Income Statement ---
  revenue: [
    "us-gaap:Revenues",
    "us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax",
    "us-gaap:SalesRevenueNet",
    "us-gaap:RevenueFromContractWithCustomerIncludingAssessedTax",
    "ifrs-full:Revenue",
  ],
  cost_of_revenue: [
    "us-gaap:CostOfRevenue",
    "us-gaap:CostOfGoodsAndServicesSold",
    "us-gaap:CostOfGoodsSold",
    "ifrs-full:CostOfSales",
  ],
  gross_profit: [
    "us-gaap:GrossProfit",
    "ifrs-full:GrossProfit",
  ],
  operating_expense: [
    "us-gaap:OperatingExpenses",
    "ifrs-full:OperatingExpense",
  ],
  operating_income: [
    "us-gaap:OperatingIncomeLoss",
    "ifrs-full:ProfitLossFromOperatingActivities",
  ],
  // Separate field: profit before tax (NOT operating income)
  profit_before_tax: [
    "us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
    "ifrs-full:ProfitLossBeforeTax",
  ],
  net_income: [
    "us-gaap:NetIncomeLoss",
    "us-gaap:ProfitLoss",
    "ifrs-full:ProfitLossAttributableToOwnersOfParent",
    "ifrs-full:ProfitLoss",
  ],
  eps_diluted: [
    "us-gaap:EarningsPerShareDiluted",
    "ifrs-full:DilutedEarningsLossPerShare",
  ],
  // Separate: basic EPS (only used if diluted not available, flagged in data_quality)
  eps_basic: [
    "us-gaap:EarningsPerShareBasic",
    "ifrs-full:BasicEarningsLossPerShare",
  ],
  depreciation_amortization: [
    "us-gaap:DepreciationDepletionAndAmortization",
    "us-gaap:DepreciationAndAmortization",
    "ifrs-full:DepreciationAndAmortisationExpense",
    "ifrs-full:DepreciationExpense",
  ],

  // --- Balance Sheet ---
  total_assets: [
    "us-gaap:Assets",
    "ifrs-full:Assets",
  ],
  current_assets: [
    "us-gaap:AssetsCurrent",
    "ifrs-full:CurrentAssets",
  ],
  total_liabilities: [
    "us-gaap:Liabilities",
    "ifrs-full:Liabilities",
  ],
  current_liabilities: [
    "us-gaap:LiabilitiesCurrent",
    "ifrs-full:CurrentLiabilities",
  ],
  total_equity: [
    "us-gaap:StockholdersEquity",
    "us-gaap:StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
    "ifrs-full:EquityAttributableToOwnersOfParent",
    "ifrs-full:Equity",
  ],
  cash_and_equivalents: [
    "us-gaap:CashAndCashEquivalentsAtCarryingValue",
    "us-gaap:CashCashEquivalentsAndShortTermInvestments",
    "ifrs-full:CashAndCashEquivalents",
  ],
  total_debt: [
    "us-gaap:LongTermDebt",
    "us-gaap:LongTermDebtAndCapitalLeaseObligations",
    "us-gaap:DebtAndCapitalLeaseObligations",
    "ifrs-full:NoncurrentFinancialLiabilities",
    "ifrs-full:BorrowingsNoncurrent",
    "ifrs-full:Borrowings",
  ],

  // --- Cash Flow ---
  operating_cash_flow: [
    "us-gaap:NetCashProvidedByUsedInOperatingActivities",
    "ifrs-full:CashFlowsFromUsedInOperatingActivities",
  ],
  capex: [
    "us-gaap:PaymentsToAcquirePropertyPlantAndEquipment",
    "us-gaap:PaymentsToAcquireProductiveAssets",
    "ifrs-full:PurchaseOfPropertyPlantAndEquipmentIntangibleAssetsOtherThanGoodwillInvestmentPropertyAndOtherNoncurrentAssets",
  ],
  dividends_paid: [
    "us-gaap:PaymentsOfDividends",
    "us-gaap:PaymentsOfDividendsCommonStock",
    "ifrs-full:DividendsPaidClassifiedAsFinancingActivities",
  ],
  share_repurchases: [
    "us-gaap:PaymentsForRepurchaseOfCommonStock",
    "ifrs-full:PaymentsToAcquireOrRedeemEntitysShares",
  ],

  // --- Share Data ---
  shares_outstanding: [
    "dei:EntityCommonStockSharesOutstanding",
    "us-gaap:CommonStockSharesOutstanding",
    "ifrs-full:OrdinarySharesIssued",
  ],
  shares_diluted: [
    "us-gaap:WeightedAverageNumberOfDilutedSharesOutstanding",
    "ifrs-full:WeightedAverageShares",
  ],
};

interface ExtractResult {
  value: number;
  concept: string;
  units: string;
}

function extractValueWithMeta(
  facts: any,
  conceptNames: string[],
  form: string,
  fiscalYear: number,
  fiscalPeriod: string
): ExtractResult | null {
  for (const concept of conceptNames) {
    const [taxonomy, name] = concept.split(":");
    const factData = facts?.[taxonomy]?.[name]?.units;
    if (!factData) continue;

    // Determine which units to use and track the currency
    const unitKeys = Object.keys(factData);
    let selectedUnits: string | null = null;
    let entries: any[] | null = null;

    // Priority: USD > USD/shares > shares > first available
    for (const preferred of ["USD", "USD/shares", "shares"]) {
      if (factData[preferred]) {
        selectedUnits = preferred;
        entries = factData[preferred];
        break;
      }
    }
    if (!selectedUnits && unitKeys.length > 0) {
      selectedUnits = unitKeys[0];
      entries = factData[unitKeys[0]];
    }

    if (!entries || !Array.isArray(entries)) continue;

    // Find matching filing
    for (const entry of entries) {
      if (entry.form === form && entry.fy === fiscalYear && entry.fp === fiscalPeriod) {
        return { value: entry.val, concept, units: selectedUnits! };
      }
    }
    // Try without fp filter for annual
    if (fiscalPeriod === "FY") {
      for (const entry of entries) {
        if (entry.form === form && entry.fy === fiscalYear) {
          return { value: entry.val, concept, units: selectedUnits! };
        }
      }
    }
  }
  return null;
}

// Legacy wrapper for backward compatibility
function extractValue(
  facts: any,
  conceptNames: string[],
  form: string,
  fiscalYear: number,
  fiscalPeriod: string
): number | null {
  const result = extractValueWithMeta(facts, conceptNames, form, fiscalYear, fiscalPeriod);
  return result?.value ?? null;
}

/**
 * Detect the reporting currency from the revenue fact.
 * Falls back to USD if no revenue found.
 */
function detectCurrency(
  facts: any,
  form: string,
  fiscalYear: number,
  fiscalPeriod: string
): string {
  const revenueResult = extractValueWithMeta(facts, CONCEPT_MAP.revenue, form, fiscalYear, fiscalPeriod);
  if (revenueResult) {
    // Units like "KZT", "USD", "EUR", "BRL", etc.
    const units = revenueResult.units;
    // Filter out per-share units
    if (units && !units.includes("/")) {
      return units;
    }
  }
  return "USD";
}

/**
 * Try to determine fiscal year and period from XBRL dei: facts.
 * Returns null if not found.
 */
function detectFiscalPeriodFromXBRL(
  facts: any,
  form: string,
  filedDate: string
): { fy: number; fp: string } | null {
  // Try dei:DocumentFiscalYearFocus
  const fyFacts = facts?.["dei"]?.["DocumentFiscalYearFocus"]?.units;
  const fpFacts = facts?.["dei"]?.["DocumentFiscalPeriodFocus"]?.units;

  if (!fyFacts || !fpFacts) return null;

  // These are usually in a generic unit (no currency)
  const fyEntries = Object.values(fyFacts).flat() as any[];
  const fpEntries = Object.values(fpFacts).flat() as any[];

  // Find entry matching this form and approximate filing date
  const filedYear = parseInt(filedDate.slice(0, 4));

  for (const fyEntry of fyEntries) {
    if (fyEntry.form !== form) continue;
    // Filing date should be close to our target
    if (fyEntry.filed && Math.abs(parseInt(fyEntry.filed.slice(0, 4)) - filedYear) <= 1) {
      // Find matching fp entry
      for (const fpEntry of fpEntries) {
        if (fpEntry.form === form && fpEntry.filed === fyEntry.filed) {
          return { fy: fyEntry.val, fp: fpEntry.val };
        }
      }
      // If we found fy but not fp, infer from form type
      if (form === "10-K" || form === "20-F") {
        return { fy: fyEntry.val, fp: "FY" };
      }
    }
  }

  return null;
}

function buildFinancialData(
  facts: any,
  filingType: string,
  period: string,
  filedDate: string,
  fiscalYear: number,
  fiscalPeriod: string,
  companyName: string
): FinancialData {
  const form = filingType;
  const dataQuality: DataQualityEntry[] = [];
  const warnings: SanityWarning[] = [];

  // Detect currency from revenue
  const currency = detectCurrency(facts, form, fiscalYear, fiscalPeriod);

  // Helper: extract and track data quality
  function extract(fieldName: string, concepts: string[]): number | null {
    const result = extractValueWithMeta(facts, concepts, form, fiscalYear, fiscalPeriod);
    if (result) {
      dataQuality.push({
        field: fieldName,
        matched_concept: result.concept,
        units: result.units,
      });
      return result.value;
    }
    return null;
  }

  // --- Income Statement ---
  const revenue = extract("revenue", CONCEPT_MAP.revenue);
  const costOfRevenue = extract("cost_of_revenue", CONCEPT_MAP.cost_of_revenue);
  const grossProfit = extract("gross_profit", CONCEPT_MAP.gross_profit);
  const operatingExpense = extract("operating_expense", CONCEPT_MAP.operating_expense);
  const operatingIncome = extract("operating_income", CONCEPT_MAP.operating_income);
  const profitBeforeTax = extract("profit_before_tax", CONCEPT_MAP.profit_before_tax);
  const netIncome = extract("net_income", CONCEPT_MAP.net_income);
  const da = extract("depreciation_amortization", CONCEPT_MAP.depreciation_amortization);

  // EPS: prefer diluted, flag if only basic available
  let epsDiluted = extract("eps_diluted", CONCEPT_MAP.eps_diluted);
  let epsUsedBasic = false;
  if (epsDiluted == null) {
    epsDiluted = extract("eps_basic", CONCEPT_MAP.eps_basic);
    if (epsDiluted != null) {
      epsUsedBasic = true;
      dataQuality.push({
        field: "eps_diluted",
        matched_concept: "FALLBACK_TO_BASIC",
        units: "per_share",
        note: "WARNING: Diluted EPS not available in XBRL. Using Basic EPS — dilution may be understated.",
      });
    }
  }

  // --- Balance Sheet ---
  const totalAssets = extract("total_assets", CONCEPT_MAP.total_assets);
  const currentAssets = extract("current_assets", CONCEPT_MAP.current_assets);
  const totalLiabilities = extract("total_liabilities", CONCEPT_MAP.total_liabilities);
  const currentLiabilities = extract("current_liabilities", CONCEPT_MAP.current_liabilities);
  const totalEquity = extract("total_equity", CONCEPT_MAP.total_equity);
  const cash = extract("cash_and_equivalents", CONCEPT_MAP.cash_and_equivalents);
  const totalDebt = extract("total_debt", CONCEPT_MAP.total_debt);

  // --- Cash Flow ---
  const operatingCF = extract("operating_cash_flow", CONCEPT_MAP.operating_cash_flow);
  const capex = extract("capex", CONCEPT_MAP.capex);
  const dividends = extract("dividends_paid", CONCEPT_MAP.dividends_paid);
  const repurchases = extract("share_repurchases", CONCEPT_MAP.share_repurchases);

  const fcf = operatingCF != null && capex != null ? operatingCF - Math.abs(capex) : null;

  // --- Share Data ---
  const sharesOutstanding = extract("shares_outstanding", CONCEPT_MAP.shares_outstanding);
  const sharesDiluted = extract("shares_diluted", CONCEPT_MAP.shares_diluted);

  // --- Sanity Checks ---
  if (totalEquity != null && totalEquity < 0) {
    warnings.push({ field: "total_equity", message: `Negative equity: ${totalEquity}` });
  }
  if (netIncome != null && fcf != null && netIncome !== 0 && Math.abs(fcf / netIncome) > 5) {
    warnings.push({
      field: "fcf_vs_net_income",
      message: `FCF/NI ratio is ${(fcf / netIncome).toFixed(1)}x — unusually high`,
    });
  }
  if (currency !== "USD") {
    warnings.push({
      field: "currency",
      message: `Reporting currency is ${currency}, not USD. All figures are in ${currency}. Agent must convert to USD for valuation.`,
    });
  }

  // Build result
  const result: FinancialData = {
    filing_type: filingType,
    period,
    filed_date: filedDate,
    source: "SEC EDGAR",
    company_name: companyName,
    currency,
    income_statement: {},
    balance_sheet: {},
    cash_flow: {},
    shares: {},
    data_quality: dataQuality,
    warnings,
  };

  // Income statement
  if (revenue != null) result.income_statement.revenue = revenue;
  if (costOfRevenue != null) result.income_statement.cost_of_revenue = costOfRevenue;
  if (grossProfit != null) result.income_statement.gross_profit = grossProfit;
  if (operatingExpense != null) result.income_statement.operating_expense = operatingExpense;
  if (operatingIncome != null) result.income_statement.operating_income = operatingIncome;
  if (profitBeforeTax != null) result.income_statement.profit_before_tax = profitBeforeTax;
  if (netIncome != null) result.income_statement.net_income = netIncome;
  if (epsDiluted != null) result.income_statement.eps_diluted = epsDiluted;
  if (epsUsedBasic) (result.income_statement as any).eps_is_basic = true;
  if (da != null) result.income_statement.depreciation_amortization = da;

  // Balance sheet
  if (totalAssets != null) result.balance_sheet.total_assets = totalAssets;
  if (currentAssets != null) result.balance_sheet.current_assets = currentAssets;
  if (totalLiabilities != null) result.balance_sheet.total_liabilities = totalLiabilities;
  if (currentLiabilities != null) result.balance_sheet.current_liabilities = currentLiabilities;
  if (totalEquity != null) result.balance_sheet.total_equity = totalEquity;
  if (cash != null) result.balance_sheet.cash_and_equivalents = cash;
  if (totalDebt != null) result.balance_sheet.total_debt = totalDebt;

  // Cash flow
  if (operatingCF != null) result.cash_flow.operating_cash_flow = operatingCF;
  if (capex != null) result.cash_flow.capex = -Math.abs(capex);
  if (fcf != null) result.cash_flow.free_cash_flow = fcf;
  if (dividends != null) result.cash_flow.dividends_paid = -Math.abs(dividends);
  if (repurchases != null) result.cash_flow.share_repurchases = -Math.abs(repurchases);
  if (da != null) result.cash_flow.depreciation_amortization = da;

  // Shares
  if (sharesOutstanding != null) result.shares.shares_outstanding = sharesOutstanding;
  if (sharesDiluted != null) result.shares.shares_diluted = sharesDiluted;

  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const ticker = (args.ticker as string)?.toUpperCase();
  const force = args.force === true;

  if (!ticker) {
    console.log(JSON.stringify({ status: "error", message: "Missing --ticker" }));
    process.exit(1);
  }

  const tickerDir = resolve(PATHS.financials, ticker);
  const filingsPath = resolve(tickerDir, "filings.json");

  // Check cache (unless --force)
  if (!force && existsSync(filingsPath)) {
    const index: FilingsIndex = JSON.parse(readFileSync(filingsPath, "utf-8"));
    console.log(
      JSON.stringify({
        status: "success",
        message: `Using cached data for ${ticker} (${index.filings.length} filings). Use --force to re-download.`,
        data: { ticker, filings_count: index.filings.length, cached: true },
      })
    );
    return;
  }

  // Lookup CIK
  const info = await lookupCIK(ticker);
  if (!existsSync(tickerDir)) mkdirSync(tickerDir, { recursive: true });

  // Get submissions (filing history)
  const submissions = await getSubmissions(info.cik);
  const recentFilings = submissions.filings?.recent;
  if (!recentFilings) {
    console.log(
      JSON.stringify({ status: "error", message: `No filings found for ${ticker}` })
    );
    process.exit(1);
  }

  // Find 10-K and 10-Q filings
  const forms = recentFilings.form as string[];
  const filedDates = recentFilings.filingDate as string[];
  const accessions = recentFilings.accessionNumber as string[];

  // Get company facts (structured XBRL data) — needed for fiscal period detection
  const facts = await getCompanyFacts(info.cik);

  const relevantFilings: Array<{
    type: string;
    filed_date: string;
    accession: string;
    fy: number;
    fp: string;
    period: string;
  }> = [];

  // Annual forms: 10-K (domestic), 20-F (foreign private issuers)
  // Quarterly forms: 10-Q (domestic)
  const annualForms = new Set(["10-K", "20-F"]);
  const quarterlyForms = new Set(["10-Q"]);
  const allRelevantForms = new Set([...annualForms, ...quarterlyForms]);

  for (let i = 0; i < forms.length; i++) {
    const form = forms[i];
    if (!allRelevantForms.has(form)) continue;

    const filedDate = filedDates[i];
    const year = parseInt(filedDate.slice(0, 4));

    // Try to get fiscal year/period from XBRL dei: facts first
    const xbrlPeriod = detectFiscalPeriodFromXBRL(facts.facts, form, filedDate);

    let fy: number;
    let fp: string;

    if (xbrlPeriod) {
      fy = xbrlPeriod.fy;
      fp = xbrlPeriod.fp;
    } else {
      // Fallback: derive from filing date (works for Dec year-end companies)
      if (annualForms.has(form)) {
        fy = year - 1;
        fp = "FY";
      } else {
        const month = parseInt(filedDate.slice(5, 7));
        if (month <= 3) { fp = "Q4"; fy = year - 1; }
        else if (month <= 6) { fp = "Q1"; fy = year; }
        else if (month <= 9) { fp = "Q2"; fy = year; }
        else { fp = "Q3"; fy = year; }
      }
    }

    const period = fp === "FY" ? `FY${fy}` : `${fp}-${fy}`;

    relevantFilings.push({
      type: form,
      filed_date: filedDate,
      accession: accessions[i],
      fy,
      fp,
      period,
    });

    // Limit to last 12 filings (3 years of 10-K + 10-Q)
    if (relevantFilings.length >= 12) break;
  }

  // Extract financial data for each filing
  const filingsIndex: FilingsIndex = {
    ticker: info.ticker,
    cik: info.cik,
    company_name: info.company_name,
    filings: [],
    last_checked: new Date().toISOString(),
  };

  let savedCount = 0;
  let prevRevenue: number | null = null;

  for (const filing of relevantFilings) {
    const localFile = `${filing.type}_${filing.period.replace("/", "-")}.json`;
    const financialData = buildFinancialData(
      facts.facts,
      filing.type,
      filing.period,
      filing.filed_date,
      filing.fy,
      filing.fp,
      info.company_name
    );

    // Cross-filing sanity check: revenue continuity
    const currentRevenue = financialData.income_statement.revenue;
    if (prevRevenue != null && currentRevenue != null && prevRevenue > 0) {
      const revChange = Math.abs(currentRevenue - prevRevenue) / prevRevenue;
      if (revChange > 0.90) {
        financialData.warnings.push({
          field: "revenue_continuity",
          message: `Revenue changed ${(revChange * 100).toFixed(0)}% vs prior filing (${prevRevenue} → ${currentRevenue}). Possible entity change or data issue.`,
        });
      }
    }
    if (currentRevenue != null) prevRevenue = currentRevenue;

    // Only save if we got at least some data
    const hasData =
      Object.keys(financialData.income_statement).length > 0 ||
      Object.keys(financialData.balance_sheet).length > 0;

    if (hasData) {
      writeFileSync(
        resolve(tickerDir, localFile),
        JSON.stringify(financialData, null, 2)
      );
      savedCount++;
    }

    filingsIndex.filings.push({
      type: filing.type,
      period: filing.period,
      filed_date: filing.filed_date,
      accession: filing.accession,
      downloaded: new Date().toISOString().slice(0, 10),
      local_file: hasData ? localFile : "",
    });
  }

  writeFileSync(filingsPath, JSON.stringify(filingsIndex, null, 2));

  console.log(
    JSON.stringify({
      status: "success",
      message: `Downloaded ${savedCount} filings for ${info.ticker} (${info.company_name})`,
      data: {
        ticker: info.ticker,
        company_name: info.company_name,
        cik: info.cik,
        filings_count: savedCount,
        cached: false,
      },
    })
  );
}

main().catch((e) => {
  console.log(JSON.stringify({ status: "error", message: e.message }));
  process.exit(1);
});
