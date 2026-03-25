/**
 * compute-dcf.ts
 *
 * Pure DCF math. Takes LLM-chosen parameters, computes year-by-year projections,
 * terminal value, fair value per share for all 3 scenarios + multiple cross-check.
 *
 * Usage: npx tsx scripts/compute-dcf.ts --params '<JSON>'
 * Output: JSON to stdout
 */

// --- Input types ---

interface GrowthRates {
  years_1_3: number;
  years_4_7: number;
  years_8_10: number;
}

interface ScenarioParams {
  growth_rates: GrowthRates;
  wacc: number;
  terminal_growth: number;
}

interface MultipleCrosscheck {
  method: "pe" | "ev_revenue";
  // For P/E method
  eps_ttm?: number;
  applied_multiple?: number;
  // For EV/Revenue method
  ntm_revenue?: number;
  ev_multiple?: number;
  // Common
  net_debt?: number;
  diluted_shares?: number;
}

interface DCFParams {
  base_fcf: number;
  base_fcf_method: string;
  wacc: number;
  terminal_growth_rate: number;
  projection_years: number;
  net_debt: number;
  diluted_shares: number;
  current_price: number;
  scenarios: {
    bull: ScenarioParams;
    base: ScenarioParams;
    bear: ScenarioParams;
  };
  multiple_crosscheck: MultipleCrosscheck;
}

// --- Helpers ---

function getGrowthRate(year: number, rates: GrowthRates): number {
  if (year <= 3) return rates.years_1_3;
  if (year <= 7) return rates.years_4_7;
  return rates.years_8_10;
}

function computeScenarioDCF(
  baseFCF: number,
  scenario: ScenarioParams,
  projectionYears: number,
  netDebt: number,
  dilutedShares: number,
  currentPrice: number
) {
  const yearByYear: Array<{
    year: number;
    growth: number;
    fcf_m: number;
    df: number;
    pv_m: number;
  }> = [];

  let fcf = baseFCF;
  let pvTotal = 0;

  for (let y = 1; y <= projectionYears; y++) {
    const growth = getGrowthRate(y, scenario.growth_rates);
    fcf = fcf * (1 + growth);
    const df = 1 / Math.pow(1 + scenario.wacc, y);
    const pv = fcf * df;
    pvTotal += pv;

    yearByYear.push({
      year: y,
      growth: Math.round(growth * 1000) / 1000,
      fcf_m: Math.round(fcf / 1_000_000),
      df: Math.round(df * 10000) / 10000,
      pv_m: Math.round(pv / 1_000_000),
    });
  }

  // Terminal value
  const lastFCF = fcf;
  const terminalValue = (lastFCF * (1 + scenario.terminal_growth)) / (scenario.wacc - scenario.terminal_growth);
  const pvTerminalValue = terminalValue / Math.pow(1 + scenario.wacc, projectionYears);

  const totalEnterpriseValue = pvTotal + pvTerminalValue;
  const tvPctOfTotal = pvTerminalValue / totalEnterpriseValue;

  const equityValue = totalEnterpriseValue - netDebt;
  const fairValuePerShare = equityValue / dilutedShares;
  const upsidePct = ((fairValuePerShare - currentPrice) / currentPrice) * 100;

  return {
    wacc: scenario.wacc,
    terminal_growth_rate: scenario.terminal_growth,
    dcf_year_by_year: yearByYear,
    pv_years_1_10: Math.round(pvTotal),
    terminal_value_undiscounted: Math.round(terminalValue),
    pv_terminal_value: Math.round(pvTerminalValue),
    tv_pct_of_total: Math.round(tvPctOfTotal * 1000) / 1000,
    total_enterprise_value_dcf: Math.round(totalEnterpriseValue),
    net_debt: netDebt,
    equity_value_dcf: Math.round(equityValue),
    fair_value_per_share: Math.round(fairValuePerShare * 100) / 100,
    upside_pct: Math.round(upsidePct * 10) / 10,
  };
}

function computeMultipleCrosscheck(params: MultipleCrosscheck, currentPrice: number) {
  if (params.method === "pe") {
    if (params.eps_ttm == null || params.applied_multiple == null) {
      return { method: "pe", error: "Missing eps_ttm or applied_multiple" };
    }
    const fairValue = params.eps_ttm * params.applied_multiple;
    return {
      method: "pe",
      eps_ttm: params.eps_ttm,
      applied_multiple: params.applied_multiple,
      fair_value: Math.round(fairValue * 100) / 100,
      upside_pct: Math.round(((fairValue - currentPrice) / currentPrice) * 1000) / 10,
    };
  } else {
    // EV/Revenue
    if (params.ntm_revenue == null || params.ev_multiple == null) {
      return { method: "ev_revenue", error: "Missing ntm_revenue or ev_multiple" };
    }
    const ev = params.ntm_revenue * params.ev_multiple;
    const netDebt = params.net_debt ?? 0;
    const shares = params.diluted_shares ?? 1;
    const equityValue = ev - netDebt;
    const fairValue = equityValue / shares;
    return {
      method: "ev_revenue",
      ntm_revenue: params.ntm_revenue,
      ev_multiple: params.ev_multiple,
      implied_ev: Math.round(ev),
      net_debt: netDebt,
      equity_value: Math.round(equityValue),
      fair_value: Math.round(fairValue * 100) / 100,
      upside_pct: Math.round(((fairValue - currentPrice) / currentPrice) * 1000) / 10,
    };
  }
}

// --- Main ---

function main() {
  const paramsIdx = process.argv.indexOf("--params");
  if (paramsIdx === -1 || !process.argv[paramsIdx + 1]) {
    console.log(JSON.stringify({ status: "error", message: "Usage: --params '<JSON>'" }));
    process.exit(1);
  }

  let params: DCFParams;
  try {
    params = JSON.parse(process.argv[paramsIdx + 1]);
  } catch (e: any) {
    console.log(JSON.stringify({ status: "error", message: `Invalid JSON: ${e.message}` }));
    process.exit(1);
  }

  const {
    base_fcf,
    base_fcf_method,
    wacc,
    terminal_growth_rate,
    projection_years,
    net_debt,
    diluted_shares,
    current_price,
    scenarios,
    multiple_crosscheck,
  } = params;

  // Compute base (main) DCF
  const baseDCF = computeScenarioDCF(
    base_fcf,
    { growth_rates: scenarios.base.growth_rates, wacc, terminal_growth: terminal_growth_rate },
    projection_years,
    net_debt,
    diluted_shares,
    current_price
  );

  // Compute all 3 scenarios
  const scenarioResults: Record<string, any> = {};
  for (const [name, scenarioParams] of Object.entries(scenarios)) {
    const result = computeScenarioDCF(
      base_fcf,
      scenarioParams,
      projection_years,
      net_debt,
      diluted_shares,
      current_price
    );
    scenarioResults[name] = {
      fair_value: result.fair_value_per_share,
      upside_pct: result.upside_pct,
      dcf_detail: result,
    };
  }

  // Multiple cross-check
  const crosscheck = computeMultipleCrosscheck(multiple_crosscheck, current_price);

  // Divergence detection: if DCF base > multiple-based by 50%, flag it
  let overrideTriggered = false;
  const dcfFairValue = scenarioResults.base.fair_value;
  const multipleFairValue = (crosscheck as any).fair_value;
  if (dcfFairValue != null && multipleFairValue != null && multipleFairValue > 0) {
    const divergence = (dcfFairValue - multipleFairValue) / multipleFairValue;
    if (divergence > 0.5) {
      overrideTriggered = true;
    }
    (crosscheck as any).dcf_vs_multiple_divergence_pct = Math.round(divergence * 1000) / 10;
    (crosscheck as any).override_triggered = overrideTriggered;
  }

  // Weighted fair value: 25% bull + 50% base + 25% bear
  const weightedFairValue =
    scenarioResults.bull.fair_value * 0.25 +
    scenarioResults.base.fair_value * 0.5 +
    scenarioResults.bear.fair_value * 0.25;

  const output = {
    status: "ok",
    dcf_model: {
      wacc: baseDCF.wacc,
      terminal_growth_rate: baseDCF.terminal_growth_rate,
      projection_years,
      base_fcf,
      base_fcf_method,
      fcf_growth_assumptions: scenarios.base.growth_rates,
      dcf_year_by_year: baseDCF.dcf_year_by_year,
      pv_years_1_10: baseDCF.pv_years_1_10,
      terminal_value_undiscounted: baseDCF.terminal_value_undiscounted,
      pv_terminal_value: baseDCF.pv_terminal_value,
      tv_pct_of_total: baseDCF.tv_pct_of_total,
      total_enterprise_value_dcf: baseDCF.total_enterprise_value_dcf,
      net_debt,
      equity_value_dcf: baseDCF.equity_value_dcf,
      intrinsic_value_per_share_dcf: baseDCF.fair_value_per_share,
    },
    scenarios: scenarioResults,
    multiple_crosscheck: crosscheck,
    weighted_fair_value: Math.round(weightedFairValue * 100) / 100,
  };

  console.log(JSON.stringify(output, null, 2));
}

main();
