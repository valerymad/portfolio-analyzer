# Portfolio Analyzer — Claude Code Plugin

Investment portfolio monitoring with DCF analysis, fair value scenarios, and trend charts. Automatically tracks SEC filings and reassesses companies.

## Installation

### As Claude Code Plugin

```
/plugin marketplace add valerymad/portfolio-analyzer
/plugin install portfolio-analyzer
```

### Manual

```bash
git clone https://github.com/valerymad/portfolio-analyzer.git
cd portfolio-analyzer
npm install
npx tsx scripts/setup.ts --email "you@email.com" --portfolio "growth" --tickers "CRM,GOOGL"
```

## Features

- **Multi-portfolio management** — create and manage multiple portfolios with US-listed tickers
- **SEC EDGAR integration** — automatically downloads financial data (10-K, 10-Q) from XBRL
- **3-step assessment** — financial analysis → DCF valuation → 3 scenarios (bull/base/bear)
- **New filing detection** — checks SEC for new quarterly/annual reports
- **Interactive charts** — Chart.js-powered HTML dashboards with assessment history
- **Local data storage** — financials downloaded once, updated only when new filings appear

## Quick Start

### 1. Setup

```bash
npx tsx scripts/setup.ts --email "you@email.com" --portfolio "growth" --tickers "CRM,GOOGL,AAPL"
```

This creates your config, first portfolio, and looks up CIK numbers via SEC.

### 2. Download Financial Data

```bash
npx tsx scripts/fetch-financials.ts --ticker "CRM"
```

### 3. Assess a Company

Use the `/portfolio-analyzer:assess CRM` command, or run the full pipeline through the plugin's slash commands.

### 4. View Charts

```bash
npx tsx scripts/generate-chart.ts --ticker "CRM"
open output/charts/CRM.html
```

## Commands

| Command | Description |
|---------|-------------|
| `/portfolio-analyzer:assess <TICKER>` | Full DCF assessment with 3 scenarios |
| `/portfolio-analyzer:portfolio <action>` | Create, add, remove, list, delete portfolios |
| `/portfolio-analyzer:check-filings` | Check SEC for new 10-K/10-Q filings |
| `/portfolio-analyzer:chart <TICKER>` | Generate interactive HTML chart |

## Scripts

All scripts run via `npx tsx scripts/<name>.ts`:

| Script | Purpose |
|--------|---------|
| `setup.ts` | Initial setup (email, first portfolio) |
| `manage-portfolio.ts` | CRUD operations for portfolios |
| `fetch-financials.ts` | Download financials from SEC EDGAR XBRL |
| `fetch-price.ts` | Get current stock price (Yahoo Finance) |
| `check-new-filings.ts` | Detect new SEC filings |
| `store-assessment.ts` | Save/retrieve assessment JSON |
| `generate-chart.ts` | Generate Chart.js HTML files |

## Data Structure

```
data/
├── portfolios.json          # Your portfolios and tickers
├── financials/{TICKER}/     # Cached SEC financial data
│   ├── filings.json         # Filing index
│   ├── 10-K_FY2025.json    # Annual report data
│   └── prices.json          # Price history
└── assessments/{TICKER}/    # Historical assessments
    └── 2026-03-20.json      # Assessment by date
```

## Assessment Output

Each assessment produces a structured JSON with:
- Financial summary (revenue, margins, FCF, ratios)
- DCF model (WACC, growth assumptions, projections)
- Three scenarios with fair value and upside %
- Quality scores (financial health, growth, moat, management)
- Verdict: BUY / HOLD / SELL

## Methodology

The plugin includes `methodology.md` — a condensed investment framework synthesized from:
- Benjamin Graham's *The Intelligent Investor* and *Security Analysis*
- Warren Buffett's shareholder letters (2004-2024)
- Philip Fisher's *Common Stocks and Uncommon Profits*
- Mary Buffett's *The New Buffettology*
- Joel Greenblatt's *You Can Be a Stock Market Genius*

## Requirements

- Node.js 18+
- `tsx` (installed via package.json)
- Internet access for SEC EDGAR and Yahoo Finance APIs

## License

MIT
