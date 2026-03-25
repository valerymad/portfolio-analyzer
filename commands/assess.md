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

### 1-3. Fetch data (run in parallel)

```bash
npx tsx scripts/fetch-financials.ts --ticker "<TICKER>"
```

```bash
npx tsx scripts/fetch-price.ts --ticker "<TICKER>"
```

```bash
npx tsx scripts/store-assessment.ts --ticker "<TICKER>"
```

### 4. Compute ratios

```bash
npx tsx scripts/compute-ratios.ts --ticker "<TICKER>"
```

Save JSON output to a temp file: `output/tmp-ratios.json`

If `status` is `"insufficient_data"` → report CANNOT_ASSESS to user, stop.

### 5. Launch judgment agent

Build a prompt containing:
- All computed ratios from step 4 (full JSON)
- Previous assessment (if any) for context
- Today's date
- Current price

```bash
claude -p "<PROMPT WITH RATIOS DATA>" \
  --model opus \
  --append-system-prompt "$(cat agents/analyst.md)" \
  --output-format json \
  --max-turns 3 \
  --max-budget-usd 1.00 \
  --no-session-persistence
```

**The agent receives all data in the prompt and returns pure JSON. No tools needed.**

The prompt template:

```
Today is YYYY-MM-DD.

Analyze {TICKER} ({company_name}) for investment.

Current price: ${price} (as of {price_date})

## Pre-computed Financial Ratios

{JSON from compute-ratios.ts}

## Previous Assessment

{previous assessment JSON or "No previous assessment"}

Return your judgment as JSON per your instructions.
```

Save the agent's JSON output to: `output/tmp-judgment.json`

### 6. Compute DCF

Extract DCF parameters from the judgment and pass to compute-dcf:

```bash
npx tsx scripts/compute-dcf.ts --params '{
  "base_fcf": <from judgment.dcf_params.base_fcf>,
  "base_fcf_method": "<from judgment.dcf_params.base_fcf_method>",
  "wacc": <from judgment.dcf_params.wacc>,
  "terminal_growth_rate": <from judgment.dcf_params.terminal_growth_rate>,
  "projection_years": <from judgment.dcf_params.projection_years>,
  "net_debt": <from judgment.dcf_params.net_debt>,
  "diluted_shares": <from judgment.dcf_params.diluted_shares>,
  "current_price": <current_price>,
  "scenarios": {
    "bull": <from judgment.scenarios.bull>,
    "base": <from judgment.scenarios.base>,
    "bear": <from judgment.scenarios.bear>
  },
  "multiple_crosscheck": <from judgment.multiple_crosscheck>
}'
```

Save JSON output to: `output/tmp-dcf.json`

### 7. Assemble assessment

```bash
npx tsx scripts/assemble-assessment.ts \
  --ratios output/tmp-ratios.json \
  --judgment output/tmp-judgment.json \
  --dcf output/tmp-dcf.json
```

This writes `output/last-assessment.json`.

### 8. Validate

```bash
npx tsx scripts/validate-assessment.ts --last
```

**If validation fails:** Show errors to user. Re-run judgment agent with errors in prompt (one retry). If still fails, ask user.

**If validation passes:** Proceed to store.

### 9. Store assessment

```bash
npx tsx scripts/store-assessment.ts --ticker "<TICKER>" --data '<JSON>'
```

### 10. Generate chart

```bash
npx tsx scripts/generate-chart.ts --ticker "<TICKER>"
```

### 11. Clean up temp files

Remove `output/tmp-ratios.json`, `output/tmp-judgment.json`, `output/tmp-dcf.json`.

## For portfolio assessment

Process tickers sequentially. Show progress after each ticker. At the end, show a summary table:

| Ticker | Price | Base FV | Upside | Verdict |
|--------|-------|---------|--------|---------|
| CRM    | $285  | $310    | +8.6%  | HOLD    |
| GOOGL  | $178  | $220    | +23.6% | BUY     |
