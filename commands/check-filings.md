# /portfolio-analyzer:check-filings

Check SEC EDGAR for new 10-K and 10-Q filings for all tickers in your portfolios.

## Usage

```
/portfolio-analyzer:check-filings [--ticker TICKER]
```

Without arguments, checks all tickers across all portfolios. With `--ticker`, checks only that ticker.

## Implementation

```bash
npx tsx scripts/check-new-filings.ts --all
# or
npx tsx scripts/check-new-filings.ts --ticker "CRM"
```

## Output

Returns JSON with:
- `checked`: number of tickers checked
- `new_filings`: array of newly discovered filings
- `up_to_date`: tickers with no new filings
- `errors`: any tickers that failed

## After finding new filings

If new filings are found, suggest running `/portfolio-analyzer:assess` to re-download financials and reassess:

```bash
npx tsx scripts/fetch-financials.ts --ticker "<TICKER>" --force
```

Then run the assessment for updated analysis.
