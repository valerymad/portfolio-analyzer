import { readFileSync } from "fs";
import { resolve } from "path";
import { PATHS, PLUGIN_ROOT } from "./lib/paths.js";

interface ValidationError {
  field: string;
  rule: string;
  expected: string;
  actual: string;
  severity: "critical" | "high" | "medium";
}

interface ValidationWarning {
  field: string;
  message: string;
}

interface ValidationResult {
  status: "pass" | "fail";
  errors: ValidationError[];
  warnings: ValidationWarning[];
  dcf_recheck?: {
    recalculated_pv: number;
    stated_pv: number;
    difference_pct: number;
    match: boolean;
  };
}

const CURRENT_METHODOLOGY_VERSION = "1.3";
const DM_WACC_FLOOR = 0.10;
const EM_WACC_FLOOR = 0.14;
const DM_GROWTH_CAP = 0.15;
const EM_GROWTH_CAP = 0.12;
const TERMINAL_VALUE_MAX_PCT = 0.60;
const UPSIDE_SANITY_CAP = 200; // %

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

function isEMFiler(assessment: any): boolean {
  // 20-F filing = foreign private issuer
  const reportPeriod = assessment.report_period || "";
  if (reportPeriod.includes("20-F")) return true;

  // Check em_adr_flags if present
  if (assessment.em_adr_flags?.filing_type_20f) return true;

  // Check filing type from financial data
  const filingType = assessment.filing_type || "";
  if (filingType === "20-F") return true;

  return false;
}

function isEMCompany(assessment: any): boolean {
  // A company might be a 20-F filer but DM-domiciled (e.g., Netherlands)
  // Check if em_adr_flags explicitly says EM floor is not applicable
  if (assessment.em_adr_flags?.em_floor_applicable === false) return false;

  // If single_country_em is flagged
  if (assessment.em_adr_flags?.single_country_em) return true;

  // Default: 20-F filers are treated as EM unless explicitly overridden
  return isEMFiler(assessment);
}

function validateAssessment(assessment: any): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // --- 1. Methodology version ---
  if (assessment.methodology_version !== CURRENT_METHODOLOGY_VERSION) {
    errors.push({
      field: "methodology_version",
      rule: "Must use current methodology version",
      expected: CURRENT_METHODOLOGY_VERSION,
      actual: assessment.methodology_version || "missing",
      severity: "critical",
    });
  }

  // --- 2. CANNOT_ASSESS is always valid ---
  if (assessment.verdict === "CANNOT_ASSESS") {
    return { status: "pass", errors: [], warnings: [] };
  }

  // --- 3. Company type must be specified ---
  if (!assessment.company_type) {
    errors.push({
      field: "company_type",
      rule: "Company type classification is mandatory",
      expected: "Mature/Value | Growth | Hypergrowth",
      actual: "missing",
      severity: "critical",
    });
  }

  // --- 4. EM/ADR checks for 20-F filers ---
  const is20F = isEMFiler(assessment);
  if (is20F && !assessment.em_adr_flags) {
    errors.push({
      field: "em_adr_flags",
      rule: "20-F filers must have em_adr_flags section (Step 1.5)",
      expected: "em_adr_flags object with all required fields",
      actual: "missing",
      severity: "critical",
    });
  }

  // --- 5. WACC floor checks ---
  const wacc = assessment.dcf_model?.wacc;
  if (wacc != null) {
    const emCompany = isEMCompany(assessment);
    const waccFloor = emCompany ? EM_WACC_FLOOR : DM_WACC_FLOOR;
    const label = emCompany ? "EM" : "DM";

    if (wacc < waccFloor) {
      errors.push({
        field: "dcf_model.wacc",
        rule: `WACC must be >= ${label} floor`,
        expected: `>= ${(waccFloor * 100).toFixed(0)}%`,
        actual: `${(wacc * 100).toFixed(1)}%`,
        severity: "critical",
      });
    }
  }

  // --- 6. Growth rate caps ---
  const growthAssumptions = assessment.dcf_model?.fcf_growth_assumptions;
  if (growthAssumptions) {
    const emCompany = isEMCompany(assessment);
    const growthCap = emCompany ? EM_GROWTH_CAP : DM_GROWTH_CAP;
    const label = emCompany ? "EM" : "DM";
    const backlogException = assessment.dcf_model?.contracted_backlog_used === true;

    for (const [phase, rate] of Object.entries(growthAssumptions)) {
      const numRate = rate as number;
      if (numRate > growthCap) {
        if (backlogException && numRate <= DM_GROWTH_CAP) {
          // Contracted backlog exception: EM company can use up to 15% for contracted portion
          warnings.push({
            field: `dcf_model.fcf_growth_assumptions.${phase}`,
            message: `Growth rate ${(numRate * 100).toFixed(0)}% exceeds ${label} cap ${(growthCap * 100).toFixed(0)}% but Contracted Backlog Exception applied. Verify contracted vs organic split.`,
          });
        } else {
          errors.push({
            field: `dcf_model.fcf_growth_assumptions.${phase}`,
            rule: `Growth rate must not exceed ${label} hard cap${backlogException ? " (even with backlog exception, organic cap is 15%)" : ""}`,
            expected: `<= ${(growthCap * 100).toFixed(0)}%`,
            actual: `${(numRate * 100).toFixed(1)}%`,
            severity: "critical",
          });
        }
      }
    }

    // Also check year-by-year if provided
    const yearByYear = assessment.dcf_model?.dcf_year_by_year;
    if (Array.isArray(yearByYear)) {
      for (const yr of yearByYear) {
        if (yr.growth > growthCap && !(backlogException && yr.growth <= DM_GROWTH_CAP)) {
          errors.push({
            field: `dcf_model.dcf_year_by_year[year ${yr.year}]`,
            rule: `Year ${yr.year} growth rate exceeds ${label} hard cap`,
            expected: `<= ${(growthCap * 100).toFixed(0)}%`,
            actual: `${(yr.growth * 100).toFixed(1)}%`,
            severity: "critical",
          });
        }
      }
    }
  }

  // --- 7. Terminal value check ---
  const tvPct = assessment.dcf_model?.tv_pct_of_total;
  if (tvPct != null && tvPct > TERMINAL_VALUE_MAX_PCT) {
    errors.push({
      field: "dcf_model.tv_pct_of_total",
      rule: "Terminal value must not exceed 60% of total intrinsic value",
      expected: `<= ${(TERMINAL_VALUE_MAX_PCT * 100).toFixed(0)}%`,
      actual: `${(tvPct * 100).toFixed(1)}%`,
      severity: "high",
    });
  }

  // --- 8. Upside sanity check ---
  const scenarios = assessment.scenarios;
  if (scenarios) {
    for (const [name, scenario] of Object.entries(scenarios) as [string, any][]) {
      if (scenario?.upside_pct != null && scenario.upside_pct > UPSIDE_SANITY_CAP) {
        errors.push({
          field: `scenarios.${name}.upside_pct`,
          rule: `Upside > ${UPSIDE_SANITY_CAP}% is almost certainly a modeling error`,
          expected: `<= ${UPSIDE_SANITY_CAP}%`,
          actual: `${scenario.upside_pct.toFixed(1)}%`,
          severity: "high",
        });
      }
    }
  }

  // --- 9. Dilution section must exist ---
  if (!assessment.dilution) {
    errors.push({
      field: "dilution",
      rule: "Dilution analysis is mandatory (Step 2, point 6)",
      expected: "dilution object with basic_shares, diluted_shares_total",
      actual: "missing",
      severity: "high",
    });
  } else {
    if (!assessment.dilution.basic_shares || !assessment.dilution.diluted_shares_total) {
      warnings.push({
        field: "dilution",
        message: "Dilution section exists but missing basic_shares or diluted_shares_total",
      });
    }
  }

  // --- 10. Financial summary required fields ---
  const fs = assessment.financial_summary;
  if (!fs) {
    errors.push({
      field: "financial_summary",
      rule: "Financial summary is mandatory",
      expected: "financial_summary object",
      actual: "missing",
      severity: "high",
    });
  } else {
    if (fs.revenue_ttm == null) {
      warnings.push({ field: "financial_summary.revenue_ttm", message: "Revenue TTM is missing" });
    }
    if (fs.net_income_ttm == null) {
      warnings.push({ field: "financial_summary.net_income_ttm", message: "Net income TTM is missing" });
    }
    if (fs.free_cash_flow_ttm == null) {
      warnings.push({ field: "financial_summary.free_cash_flow_ttm", message: "FCF TTM is missing" });
    }
  }

  // --- 11. Multiple cross-check must exist ---
  if (!assessment.multiple_crosscheck) {
    errors.push({
      field: "multiple_crosscheck",
      rule: "Multiple-based cross-check is mandatory (Step 2.5)",
      expected: "multiple_crosscheck object",
      actual: "missing",
      severity: "high",
    });
  }

  // --- 12. DCF arithmetic recheck ---
  let dcfRecheck: ValidationResult["dcf_recheck"] = undefined;
  const dcf = assessment.dcf_model;
  if (dcf?.dcf_year_by_year && Array.isArray(dcf.dcf_year_by_year) && dcf.wacc) {
    let recalcPV = 0;
    for (const yr of dcf.dcf_year_by_year) {
      const df = 1 / Math.pow(1 + dcf.wacc, yr.year);
      const fcfM = yr.fcf_m;
      recalcPV += fcfM * df;
    }
    const recalcPVFull = recalcPV * 1_000_000;

    // Terminal value recheck
    const lastYearFCF = dcf.dcf_year_by_year[dcf.dcf_year_by_year.length - 1]?.fcf_m * 1_000_000;
    const tg = dcf.terminal_growth_rate || 0.03;
    const projYears = dcf.projection_years || 10;
    const recalcTV = (lastYearFCF * (1 + tg)) / (dcf.wacc - tg);
    const recalcPVTV = recalcTV / Math.pow(1 + dcf.wacc, projYears);

    const totalRecalc = recalcPVFull + recalcPVTV;
    const statedTotal = dcf.total_enterprise_value_dcf || (dcf.pv_years_1_10 + (dcf.pv_terminal_value || 0));

    if (statedTotal > 0) {
      const diffPct = Math.abs(totalRecalc - statedTotal) / statedTotal;
      dcfRecheck = {
        recalculated_pv: Math.round(totalRecalc),
        stated_pv: statedTotal,
        difference_pct: Math.round(diffPct * 1000) / 10,
        match: diffPct < 0.05, // 5% tolerance for rounding
      };

      if (!dcfRecheck.match) {
        errors.push({
          field: "dcf_model (arithmetic)",
          rule: "DCF arithmetic must be internally consistent (within 5% tolerance)",
          expected: `~$${(statedTotal / 1e9).toFixed(2)}B`,
          actual: `recalculated $${(totalRecalc / 1e9).toFixed(2)}B (${dcfRecheck.difference_pct}% off)`,
          severity: "high",
        });
      }
    }
  }

  // --- 13. Verdict consistency ---
  if (assessment.verdict === "BUY") {
    const quality = assessment.quality_score?.overall;
    if (quality != null && quality < 7) {
      errors.push({
        field: "verdict",
        rule: "BUY requires quality score >= 7",
        expected: ">= 7",
        actual: `${quality}`,
        severity: "medium",
      });
    }

    const baseUpside = scenarios?.base?.upside_pct;
    if (baseUpside != null && baseUpside < 20) {
      warnings.push({
        field: "verdict",
        message: `BUY with only ${baseUpside.toFixed(1)}% upside to base case — verify margin of safety`,
      });
    }
  }

  // --- 14. Required fields check ---
  const requiredFields = ["ticker", "assessment_date", "current_price", "verdict", "summary"];
  for (const field of requiredFields) {
    if (assessment[field] == null) {
      errors.push({
        field,
        rule: "Required field must be present",
        expected: "non-null value",
        actual: "missing",
        severity: "high",
      });
    }
  }

  const hasCritical = errors.some((e) => e.severity === "critical");
  const hasHigh = errors.some((e) => e.severity === "high");

  return {
    status: hasCritical || hasHigh ? "fail" : "pass",
    errors,
    warnings,
    dcf_recheck: dcfRecheck,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  let assessment: any;

  if (args.file) {
    // Validate from file
    const filepath = resolve(args.file as string);
    assessment = JSON.parse(readFileSync(filepath, "utf-8"));
  } else if (args.ticker) {
    // Validate latest assessment for ticker
    const ticker = (args.ticker as string).toUpperCase();
    const assessDir = resolve(PATHS.assessments, ticker);
    const { readdirSync } = await import("fs");
    const files = readdirSync(assessDir)
      .filter((f) => f.endsWith(".json"))
      .sort()
      .reverse();
    if (files.length === 0) {
      console.log(JSON.stringify({ status: "error", message: `No assessments found for ${ticker}` }));
      process.exit(1);
    }
    assessment = JSON.parse(readFileSync(resolve(assessDir, files[0]), "utf-8"));
  } else if (args["last"]) {
    // Validate last-assessment.json
    const lastPath = resolve(PLUGIN_ROOT, "output/last-assessment.json");
    assessment = JSON.parse(readFileSync(lastPath, "utf-8"));
  } else {
    console.log(
      JSON.stringify({
        status: "error",
        message: "Usage: --file <path> | --ticker <TICKER> | --last",
      })
    );
    process.exit(1);
  }

  const result = validateAssessment(assessment);

  console.log(JSON.stringify({
    status: result.status === "pass" ? "success" : "error",
    message: result.status === "pass"
      ? `Validation passed for ${assessment.ticker} (${result.warnings.length} warnings)`
      : `Validation FAILED for ${assessment.ticker}: ${result.errors.length} errors, ${result.warnings.length} warnings`,
    data: {
      ticker: assessment.ticker,
      verdict: assessment.verdict,
      methodology_version: assessment.methodology_version,
      validation: result,
    },
  }, null, 2));

  if (result.status === "fail") {
    process.exit(1);
  }
}

main().catch((e) => {
  console.log(JSON.stringify({ status: "error", message: e.message }));
  process.exit(1);
});
