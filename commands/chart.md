# /portfolio-analyzer:chart

Generate interactive HTML charts for a ticker or portfolio dashboard.

## Usage

```
/portfolio-analyzer:chart <TICKER>
/portfolio-analyzer:chart portfolio:<name>
```

## Implementation

### Ticker chart
```bash
npx tsx scripts/generate-chart.ts --ticker "<TICKER>"
```

Generates an interactive Chart.js HTML showing:
- Assessment history: actual price vs bull/base/bear fair values over time
- Current metrics: price, fair value, upside, quality score, P/E, FCF
- Quality score breakdown
- Verdict badge

### Portfolio dashboard
```bash
npx tsx scripts/generate-chart.ts --portfolio "<name>"
```

Generates a dashboard HTML showing:
- Horizontal bar chart: all tickers sorted by upside %, colored by verdict
- Table: ticker, price, base FV, upside, quality, verdict, assessment date
- Links to individual ticker charts

## Output

Charts are saved to `output/charts/`:
- Ticker: `output/charts/<TICKER>.html`
- Dashboard: `output/charts/dashboard-<name>.html`

After generating, open the file in the browser:
```bash
open output/charts/<TICKER>.html
```
