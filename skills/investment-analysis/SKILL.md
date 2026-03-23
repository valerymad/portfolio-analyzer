# Investment Analysis Skill

This skill is automatically activated when the user mentions investment analysis, portfolio assessment, stock valuation, or related topics.

## Triggers

Activate when the user mentions:
- Assessing/evaluating/analyzing a stock or company
- Portfolio review or monitoring
- Fair value, DCF, valuation
- SEC filings, quarterly/annual reports
- Investment decisions (buy/hold/sell)

## Routing

Based on the user's intent, route to the appropriate command:

| Intent | Command |
|--------|---------|
| Assess a specific ticker | `/portfolio-analyzer:assess <TICKER>` |
| Assess all tickers in a portfolio | `/portfolio-analyzer:assess portfolio:<name>` |
| Check for new SEC filings | `/portfolio-analyzer:check-filings` |
| Manage portfolios (add/remove tickers) | `/portfolio-analyzer:portfolio <action>` |
| View charts or trends | `/portfolio-analyzer:chart <TICKER>` |
| Initial setup | Run `npx tsx scripts/setup.ts` |

## Context

This plugin provides:
- Local storage of financial data from SEC EDGAR
- DCF-based valuation with 3 scenarios (bull/base/bear)
- Historical assessment tracking with trend charts
- Automatic detection of new quarterly/annual reports

All scripts are in the `scripts/` directory and run via `npx tsx`.
All data is stored locally in `data/` (financials, assessments, portfolios).
Charts are generated as interactive HTML files in `output/charts/`.
