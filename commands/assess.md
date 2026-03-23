# /portfolio-analyzer:assess

Run a full investment assessment: financial analysis, DCF valuation, 3 scenarios with fair value.

## Usage

```
/portfolio-analyzer:assess <TICKER>
/portfolio-analyzer:assess portfolio:<name>
/portfolio-analyzer:assess --all
```

## Implementation

For each ticker to assess:

### 1. Ensure financial data exists

```bash
npx tsx scripts/fetch-financials.ts --ticker "<TICKER>"
```

### 2. Get current price

```bash
npx tsx scripts/fetch-price.ts --ticker "<TICKER>"
```

### 3. Get previous assessment (if any)

```bash
npx tsx scripts/store-assessment.ts --ticker "<TICKER>"
```

### 4. Read financial data files

Read from `data/financials/<TICKER>/`:
- `filings.json` — index of available filings
- Most recent `10-K_*.json` — annual data
- Most recent `10-Q_*.json` — quarterly data (if available)

### 5. Launch analyst agent

```bash
claude -p "<FULL PROMPT WITH ALL DATA>" \
  --model opus \
  --append-system-prompt "$(cat agents/analyst.md)" \
  --output-format json \
  --allowedTools "Bash" "Read" "Write" "Edit" \
  --dangerously-skip-permissions \
  --max-turns 25 \
  --max-budget-usd 1.50 \
  --no-session-persistence
```

The prompt must include:
- All financial data (income statement, balance sheet, cash flow) from the most recent filings
- Current price and market data
- Previous assessment (if any) for comparison
- Instruction to read `methodology.md`
- Today's date

### 6. Parse result

Read `output/last-assessment.json` written by the agent. Parse the JSON assessment.

### 7. Validate assessment

```bash
npx tsx scripts/validate-assessment.ts --last
```

**If validation fails:** Do NOT store the assessment. Show the errors to the user and explain what needs to be corrected. Re-run the analyst agent with corrected parameters, or ask the user whether to proceed despite validation failures.

**If validation passes:** Proceed to store.

### 8. Store assessment

```bash
npx tsx scripts/store-assessment.ts --ticker "<TICKER>" --data '<JSON>'
```

### 9. Generate chart

```bash
npx tsx scripts/generate-chart.ts --ticker "<TICKER>"
```

## For portfolio assessment

When assessing a whole portfolio, process tickers sequentially. Show progress after each ticker. At the end, show a summary table:

| Ticker | Price | Base FV | Upside | Verdict |
|--------|-------|---------|--------|---------|
| CRM    | $285  | $310    | +8.6%  | HOLD    |
| GOOGL  | $178  | $220    | +23.6% | BUY     |
