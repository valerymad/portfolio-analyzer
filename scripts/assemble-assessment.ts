/**
 * assemble-assessment.ts
 *
 * Merges 3 sources (ratios, judgment, dcf) into the final assessment JSON
 * compatible with validate-assessment.ts and store-assessment.ts.
 *
 * Usage: npx tsx scripts/assemble-assessment.ts --ratios <path> --judgment <path> --dcf <path>
 * Output: Writes output/last-assessment.json and prints JSON to stdout
 */

import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { resolve } from "path";
import { PLUGIN_ROOT } from "./lib/paths.js";

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

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.ratios || !args.judgment || !args.dcf) {
    console.log(
      JSON.stringify({ status: "error", message: "Usage: --ratios <path> --judgment <path> --dcf <path>" })
    );
    process.exit(1);
  }

  const ratios = JSON.parse(readFileSync(resolve(args.ratios), "utf-8"));
  const judgment = JSON.parse(readFileSync(resolve(args.judgment), "utf-8"));
  const dcf = JSON.parse(readFileSync(resolve(args.dcf), "utf-8"));

  const cr = ratios.computed_ratios;
  const today = new Date().toISOString().slice(0, 10);

  // Build financial_summary
  const financialSummary: Record<string, any> = {
    revenue_ttm: cr.revenue_ttm,
    revenue_growth_yoy: cr.revenue_growth_yoy != null ? Math.round(cr.revenue_growth_yoy * 1000) / 1000 : null,
    net_income_ttm: cr.net_income_ttm,
    free_cash_flow_ttm: cr.fcf_ttm,
    owner_earnings_ttm: judgment.owner_earnings_override ?? cr.owner_earnings_ttm,
    debt_to_equity: cr.debt_to_equity != null ? Math.round(cr.debt_to_equity * 100) / 100 : null,
    current_ratio: cr.current_ratio != null ? Math.round(cr.current_ratio * 10) / 10 : null,
    pe_ratio: cr.pe_ratio != null ? Math.round(cr.pe_ratio * 100) / 100 : null,
    roe: cr.roe != null ? Math.round(cr.roe * 1000) / 1000 : null,
    operating_margin: cr.operating_margin != null ? Math.round(cr.operating_margin * 1000) / 1000 : null,
    net_margin: cr.net_margin != null ? Math.round(cr.net_margin * 1000) / 1000 : null,
    fcf_to_net_income: cr.fcf_to_net_income != null ? Math.round(cr.fcf_to_net_income * 100) / 100 : null,
  };

  // Add EV/NTM Revenue if available
  if (cr.ev_ntm_revenue != null) {
    financialSummary.ev_ntm_revenue = Math.round(cr.ev_ntm_revenue * 10) / 10;
  }

  // Add backlog data from judgment if present
  if (judgment.contracted_backlog != null) {
    financialSummary.contracted_backlog = judgment.contracted_backlog;
    financialSummary.backlog_to_ttm_revenue_ratio = judgment.backlog_to_ttm_revenue_ratio;
  }

  // Build dilution section
  const dilution = {
    basic_shares: ratios.shares_latest.shares_outstanding,
    options_rsus: judgment.dilution?.options_rsus ?? 0,
    convertible_implied_shares: judgment.dilution?.convertible_implied_shares ?? 0,
    diluted_shares_total:
      judgment.dilution?.diluted_shares_total ??
      ratios.shares_latest.shares_diluted ??
      ratios.shares_latest.shares_outstanding,
    dilution_pct: 0,
  };
  if (dilution.basic_shares && dilution.diluted_shares_total) {
    dilution.dilution_pct =
      Math.round(((dilution.diluted_shares_total - dilution.basic_shares) / dilution.basic_shares) * 1000) / 10;
  }

  // Build em_adr_flags
  const emAdrFlags = {
    filing_type_20f: ratios.filing_type_20f,
    currency_non_usd: ratios.currency_non_usd,
    single_country_em: judgment.em_adr_flags?.single_country_em ?? false,
    short_track_record: judgment.em_adr_flags?.short_track_record ?? false,
    em_floor_applicable: judgment.em_adr_flags?.em_floor_applicable ?? ratios.filing_type_20f,
    wacc_applied: dcf.dcf_model.wacc,
    wacc_rationale: judgment.em_adr_flags?.wacc_rationale ?? "",
    applicable_discounts: judgment.em_adr_flags?.applicable_discounts ?? {},
  };

  // Build scenarios (merge dcf fair_value + judgment assumptions)
  const scenarios: Record<string, any> = {};
  for (const name of ["bull", "base", "bear"] as const) {
    const dcfScenario = dcf.scenarios[name];
    const judgmentScenario = judgment.scenarios?.[name];
    scenarios[name] = {
      fair_value: dcfScenario.fair_value,
      upside_pct: dcfScenario.upside_pct,
      assumptions: judgmentScenario?.assumptions ?? "",
    };
  }

  // Build multiple_crosscheck
  const multipleCC: Record<string, any> = {
    method: dcf.multiple_crosscheck.method,
    ...(dcf.multiple_crosscheck.method === "pe"
      ? {
          eps_ttm: dcf.multiple_crosscheck.eps_ttm,
          applied_multiple: dcf.multiple_crosscheck.applied_multiple,
        }
      : {
          ntm_revenue: dcf.multiple_crosscheck.ntm_revenue,
          benchmark_multiple: dcf.multiple_crosscheck.ev_multiple,
          applied_multiple: dcf.multiple_crosscheck.ev_multiple,
        }),
    fair_value: dcf.multiple_crosscheck.fair_value,
    adjustments: judgment.multiple_crosscheck?.adjustments ?? "",
    comparables: judgment.multiple_crosscheck?.comparables ?? [],
  };

  // Build data_sources
  const dataSources = {
    from_files: ratios.data_files_used ?? [],
    from_web: judgment.data_sources?.from_web ?? [],
    from_llm_knowledge: judgment.data_sources?.from_llm_knowledge ?? [],
  };

  // Assemble final assessment
  const assessment = {
    ticker: ratios.ticker,
    company_name: judgment.company_name ?? ratios.company_name,
    exchange: judgment.exchange ?? ratios.exchange ?? "UNKNOWN",
    assessment_date: today,
    current_price: ratios.current_price,
    currency: "USD",
    report_period: ratios.report_period,
    report_filed_date: ratios.report_filed_date,
    company_type: judgment.company_type,
    financial_summary: financialSummary,
    dilution,
    em_adr_flags: emAdrFlags,
    dcf_model: {
      ...dcf.dcf_model,
      contracted_backlog_used: judgment.contracted_backlog_used ?? false,
    },
    multiple_crosscheck: multipleCC,
    scenarios,
    quality_score: judgment.quality_score,
    data_sources: dataSources,
    verdict: judgment.verdict,
    cannot_assess_reason: judgment.cannot_assess_reason ?? null,
    cannot_assess_missing_data: judgment.cannot_assess_missing_data ?? [],
    summary: judgment.summary,
    methodology_version: "1.3",
  };

  // Write to output/last-assessment.json
  const outputDir = resolve(PLUGIN_ROOT, "output");
  mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, "last-assessment.json");
  writeFileSync(outputPath, JSON.stringify(assessment, null, 2));

  console.log(JSON.stringify({ status: "ok", path: outputPath, assessment }, null, 2));
}

main();
