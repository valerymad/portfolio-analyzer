# Investment Analysis Methodology v1.3

A systematic framework for evaluating public equities. Every criterion below is concrete and actionable. When a company fails any hard threshold, move on -- there are always other opportunities.

---

## Section 0. Data Validation (before everything else)

Before classification or any analysis, verify that real financial data exists for the company.

**Minimum required:**
- At least 2 years of income statement (revenue, net income)
- At least 1 year of cash flow statement (operating CF, capex)
- Current or recent market price (not older than 30 days)

**If data is missing or unverifiable:** Stop. Report what is missing. Ask the user whether to continue with incomplete data or wait for them to provide it. Do not substitute LLM-recalled figures for real filings. If the user confirms to proceed, mark all unverified figures explicitly and reduce confidence accordingly.

---

## Section 1. Company Type Classification

**Classify every candidate before analysis.** The methodology routes differently based on company type. Using value investing tools on a hypergrowth company produces systematically wrong answers.

| Type | Criteria | Primary Methodology |
|------|----------|-------------------|
| **Mature/Value** | >10y public history, positive FCF ≥3 consecutive years, revenue growth <20%, P/E <50x | Graham framework (Sections 1-7) |
| **Growth** | 3-10y public history, FCF-negative or breakeven, revenue growth 20-100% | Modified: skip Section 2 hard-pass, use EV/Revenue cross-check (Section 4.5), forward DCF |
| **Hypergrowth** | <5y public history OR revenue growth >100% OR contracted backlog >3x TTM revenue | Modified: EV/NTM Revenue primary, DCF secondary, Backlog/ARR methodology, comp analysis mandatory |

**Document the classification in the assessment.** All subsequent steps must reference it.

**If the company does not fit any category cleanly:** Stop analysis. Report to the user that the company cannot be reliably classified, describe why (e.g. hybrid model, unusual structure, insufficient public data), and list what additional information would be needed to proceed. Do not invent or mix methodologies to force a result. An honest "cannot assess" is more valuable than a fabricated verdict.

**For Growth and Hypergrowth companies:**
- Section 2 (Financial Health Checklist) is informational only — failing criteria 3-7 does not disqualify
- Hard disqualifiers remain: fraud signals, unverifiable accounting, negative revenue, insolvency
- Section 4.2 growth caps are modified per the Contracted Backlog Exception below
- Section 4.5 cross-check uses EV/NTM Revenue, not P/E

---

## Section 2. Financial Health Checklist

Screen every candidate against these minimum requirements before deeper analysis. All seven must pass.

| # | Criterion | Threshold | Source Data |
|---|-----------|-----------|-------------|
| 1 | **Adequate size** | Annual revenue >= $100 million | Income statement, trailing twelve months |
| 2 | **Strong financial condition** | Current ratio >= 2.0; long-term debt < net current assets (current assets minus current liabilities) | Balance sheet |
| 3 | **Earnings stability** | Positive net income in each of the last 10 fiscal years | Income statements, 10-year history |
| 4 | **Dividend record** | Uninterrupted dividend payments for at least 20 consecutive years | Dividend history |
| 5 | **Earnings growth** | Per-share earnings increased by at least one-third over the past 10 years, comparing 3-year averages at beginning and end | EPS history |
| 6 | **Moderate P/E ratio** | Current price no more than 15x average earnings of the past 3 years | Price, 3-year average EPS |
| 7 | **Moderate price-to-assets** | P/E multiplied by price-to-book value must not exceed 22.5 (e.g., 15x earnings at 1.5x book, or 9x earnings at 2.5x book) | Price, book value per share |

**Hard pass:** Any company failing criteria 1-3 is immediately disqualified. Criteria 4-7 may be relaxed only for extraordinary quality businesses (Section 3) with documented justification.

---

## Section 3. Quality Assessment Framework

Financial health confirms a company can survive. Quality assessment determines whether it deserves your capital.

### 3.1 Durable Competitive Advantage (DCA) Test

A durable competitive advantage is a structural moat that protects profitability without requiring continuous heavy capital expenditure to maintain. Two forms exist:

**Unique product:** A brand name or patent portfolio that commands pricing power. The product itself need not change -- if it has been essentially the same for 10 years, it will likely remain the same for the next 10. Examples: branded consumer staples, dominant software platforms.

**Low-cost producer:** Structural cost advantages that competitors cannot replicate without matching scale or distribution. Examples: GEICO (direct insurance model), Costco (membership + volume).

**DCA Verification Checklist:**
- Gross margins consistently above 40% (ideally 60%+) for at least 10 years
- ROE consistently above 15% without excessive leverage (debt/equity < 0.80)
- Net margins stable or expanding over the past decade
- Minimal capital expenditure required to maintain competitive position (capex/net income < 50%)
- Earnings predictable enough to reasonably estimate 10-year forward trajectory
- Product or service fulfills a repetitive, non-discretionary need

**Sectors where DCA companies cluster:** (1) Brand-name consumer products fulfilling repetitive needs, (2) Advertising and media platforms, (3) Repetitive consumer services (tax preparation, cleaning, security), (4) Low-cost producers of common products with scale advantages.

### 3.2 Management Quality (Fisher's Framework)

Evaluate management across five dimensions:

1. **R&D effectiveness** -- Does R&D spending translate into revenue-generating products, or is it a cost center? Measure R&D-to-revenue ratio and track record of successful launches.
2. **Sales organization** -- Is the sales force effective enough to sustain above-industry growth? Look for consistent organic revenue growth exceeding peers.
3. **Cost discipline** -- Are operating margins stable or improving? Does management actively control costs without starving the business?
4. **Employee relations** -- Low turnover, competitive compensation, strong Glassdoor/internal reputation. Dysfunctional cultures eventually destroy value.
5. **Integrity and candor** -- Does management discuss failures openly in shareholder letters? Are projections realistic? Do insiders own meaningful equity?

**Critical principle:** The moat must NOT depend on having a great manager. When management with an excellent reputation meets a business with a poor reputation, it is the reputation of the business that remains intact.

### 3.3 Business Classification

Classify every candidate into one of three categories:

- **Great:** Earns high returns on tangible capital and requires minimal reinvestment to grow. These are the targets. Aim for 18%+ after-tax return on net tangible assets.
- **Good:** Earns attractive returns but requires significant capital reinvestment to grow. Acceptable at the right price, but will never compound like a great business.
- **Gruesome:** Requires large amounts of capital, grows rapidly, but earns little or nothing on that capital. Airlines, commodity manufacturers, capital-intensive tech. Avoid entirely regardless of price.

---

## Section 4. DCF Valuation Model

### 4.1 Owner Earnings Calculation

Use owner earnings, not reported EPS or EBITDA. Depreciation is a real cost -- any CEO who touts EBITDA as a valuation guide is deceiving you or themselves.

```
Owner Earnings = Net Income
               + Depreciation & Amortization
               - Maintenance Capital Expenditures
               - Changes in Working Capital (if structurally recurring)
```

Maintenance capex is the capital required to sustain current earning power, not to grow it. If a company does not disclose the split, estimate maintenance capex as depreciation expense (conservative) or use a 5-year average of total capex minus growth-driven projects.

**Investment Phase Adjustment (Growth/Hypergrowth companies only).**

If ALL of the following are true:
1. Total capex/revenue > 30%
2. Management guidance or analyst consensus projects FCF turn-positive within 2 years
3. FCF turn-positive is supported by contracted revenue or signed commitments (not projections alone)

Then build the DCF from **forward revenue × target FCF margin** instead of historical FCF:
- Sub-case A: management guidance FCF margin at maturity
- Sub-case B: comparable mature company FCF margin (sector median)
- Use the average of A and B as the base FCF
- Document explicitly that historical FCF is not used and why

This adjustment is invalid if FCF profitability depends solely on uncontracted growth projections.

### 4.2 Ten-Year Discounted Cash Flow

1. **Starting cash flow:** Average owner earnings of the past 3 years (smooths cyclicality). If only 2-3 years of data exist (e.g., recent IPO or foreign filer), use the average of available years and note reduced confidence.
2. **Growth rate:** Use the lower of (a) the company's 10-year historical owner earnings CAGR, or (b) consensus analyst estimates minus 2 percentage points. **Hard cap: never exceed 15% for any year of any projection, in any scenario.** Even if historical growth was 50%, project no more than 15%. Markets always revert to mean.

   **Contracted Backlog Exception.** If the company has disclosed signed, multi-year contracts from creditworthy counterparties (investment-grade or public companies) that mathematically imply growth exceeding the 15% cap, model contracted revenue separately:
   - Split revenue into (a) contracted/backlog-derived and (b) organic/uncontracted
   - Apply the 15% cap only to the organic portion
   - Contracted portion: ramp based on stated contract schedule, apply a 15-25% execution haircut for delays/renegotiation risk
   - Document the split and haircut explicitly
   - This exception does not apply to pipeline, LOIs, or verbal commitments — only signed contracts with disclosed terms
3. **Terminal value:** Apply a perpetual growth rate of 3% (approximate nominal GDP growth) to Year 10 cash flow, capitalized at the discount rate. For EM companies, use 2% terminal growth (higher inflation erodes real growth; currency depreciation reduces USD-denominated returns).
4. **Discount rate (WACC):** Use the current 10-year US Treasury yield plus 5 percentage points as a minimum. If the business carries above-average uncertainty, add 1-3 additional points. Floor: 10%. See Section 4.6 for mandatory EM/ADR adjustments.
5. **Intrinsic value:** Sum of discounted Year 1-10 cash flows plus discounted terminal value.
6. **Terminal value sanity check:** If the present value of terminal value exceeds 60% of total intrinsic value, your growth assumptions are too aggressive or your discount rate is too low. Reduce growth rates until terminal value is ≤60% of total.

### 4.6 Emerging Market & ADR Adjustments

Companies domiciled in emerging markets (EM) or listed as ADRs/foreign private issuers (20-F filers) carry additional structural risks that **must** be priced into the valuation. These adjustments are mandatory, not optional.

#### WACC Adjustments (additive to base WACC from 3.2)

| Country Risk Tier | Examples | Additional Premium |
|---|---|---|
| Low EM | Poland, Czech Republic, Chile, UAE | +2% |
| Medium EM | Kazakhstan, Brazil, Mexico, India, Turkey | +3-4% |
| High EM | Nigeria, Pakistan, Argentina, Egypt | +5-6% |

**Floor WACC for any EM company: 14%.** Most EM companies should use 15-18%.

#### Growth Rate Adjustments

- **Hard cap remains 15%**, but for EM companies apply an additional haircut:
  - If revenue is 80%+ from a single country: reduce projected growth by 2-3 pp (limited TAM)
  - If financials are in local currency with historical depreciation >5%/year vs USD: reduce by 1-2 pp (currency erosion)
  - If public track record < 5 years (recent IPO): reduce by 2 pp (insufficient data for confident projection)
- **Practical EM growth cap: 10-12%** for most single-country EM businesses

#### Terminal Multiple Discount

When cross-checking via multiples (Section 4.5), apply a structural discount to EM companies:

| Factor | Discount to Comparable DM Multiple |
|---|---|
| Single-country exposure | -20% |
| ADR structure (limited shareholder rights) | -10% |
| Local currency financials with FX risk | -10% |
| Thin public track record (<5 years) | -10% |

Discounts are additive. A single-country ADR with FX risk and 2-year track record gets -50% discount to the comparable developed-market multiple.

#### Why These Adjustments Exist

EM discount is not irrational. It prices in real risks:
- **Currency depreciation:** KZT, BRL, TRY have all lost 30-70% vs USD over 10-year periods
- **Regulatory/political risk:** Rule of law is weaker; expropriation, capital controls, and sudden tax changes happen
- **ADR structure:** You don't own shares — you own receipts. Voting rights and legal protections are limited
- **Liquidity risk:** EM stocks can become untradeable during crises (see Russia 2022)

### 4.5 Multiple-Based Cross-Check (Mandatory)

**Every DCF valuation must be cross-checked against a multiple-based valuation.** The correct multiple depends on company type (Section 1).

#### For Mature/Value companies (P/E method):

1. Calculate current EPS (trailing 12 months, diluted — include all in-the-money convertibles, options, warrants)
2. Apply a fair P/E multiple based on business quality and growth:
   - High-growth (>15% historical): 15-20x
   - Moderate growth (5-15%): 12-15x
   - Low/no growth (<5%): 8-12x
3. For EM companies, apply the discount from Section 4.6
4. Fair value = EPS × adjusted P/E multiple
5. **If DCF fair value > multiple-based fair value by more than 50%: use the multiple-based value as your base case.**

#### For Growth/Hypergrowth companies (EV/Revenue method):

1. Calculate NTM (next twelve months) revenue: use management guidance if disclosed, otherwise consensus analyst estimates. If neither available, extrapolate from most recent quarterly run-rate.
2. Determine sector EV/NTM Revenue benchmark:
   - Find 3-5 comparable public companies (same sector, similar stage and growth profile)
   - Calculate their median EV/NTM Revenue multiple
   - Document each comparable: name, EV, NTM revenue, multiple
3. Apply premium or discount to the benchmark multiple based on:
   - Contracted backlog visibility: +10-30% premium if >2x TTM revenue in signed contracts
   - Customer concentration risk: -10-20% discount if top 1 customer >30% of revenue
   - Path to profitability: +10-20% if FCF-positive within 12 months, -10% if >3 years away
   - Strategic investor backing (Tier-1 VC, FAANG, NVIDIA-type): +5-10%
4. Fair value = (NTM Revenue × adjusted multiple − Net Debt) / Diluted Shares
5. **Diluted shares must include in-the-money convertibles.** For convertible notes: if conversion price < current market price × 1.15, calculate implied shares (principal / conversion price) and add to base share count.
6. **If DCF and EV/Revenue diverge by more than 50%, investigate the source of divergence** — do not automatically defer to the lower value. Common causes: DCF uses stale FCF base (fix: use Investment Phase Adjustment), or EV/Revenue comps are mispriced (note and adjust).

This check prevents both runaway DCF projections and the opposite error — applying a value-investing multiple to a contracted-growth company, producing systematically undervalued results.

### 4.3 Earnings Yield Cross-Check

Calculate the earnings yield (owner earnings / market cap) and compare to the current 10-year Treasury yield. The earnings yield should exceed the bond yield by at least 4-5 percentage points. If the spread is narrower, the stock does not offer adequate compensation for equity risk.

### 4.4 Simple Payback Test

At the current price, how many years of current owner earnings does it take to recover the entire purchase price? Target: 10 years or fewer. If payback exceeds 15 years, the stock is almost certainly overpriced regardless of growth assumptions.

---

## Section 5. Three-Scenario Framework

Never rely on a single estimate. Model three scenarios for every candidate.

| Scenario | Growth Assumption | Margin Assumption | Multiple Assumption | Probability Weight |
|----------|-------------------|-------------------|--------------------|--------------------|
| **Bull** | Historical growth rate sustained (capped at 15%, EM cap 12%) | Margins expand 1-2 pp | Market awards premium P/E (18-22x; apply EM discount from 3.6) | 25% |
| **Base** | Historical growth rate minus 2 pp (capped at 12%, EM cap 10%) | Margins flat | Fair P/E (13-15x trailing 3-year avg; apply EM discount from 3.6) | 50% |
| **Bear** | Zero real growth | Margins compress 2-3 pp | Trough P/E (8-10x) | 25% |

**Calculate intrinsic value for each scenario** using the DCF model from Section 4. The probability-weighted average becomes your central estimate.

**Decision rule:** The current price must be below the Bear-case intrinsic value to proceed. This ensures you make money even if everything goes wrong -- the margin of safety is built into the worst case, not the average.

**Buying opportunity timing:** The best prices occur during (1) broad bear markets, (2) market corrections or panics, (3) industry-specific recessions, (4) individual company calamities that do not damage the moat, and (5) structural changes or geopolitical crises. Be fearful when others are greedy, greedy when others are fearful.

---

## Section 6. Margin of Safety Rules

The margin of safety is the central concept of sound investment. Its function is to render unnecessary an accurate estimate of the future.

### 5.1 Required Discounts

| Business Quality | Minimum Discount to Intrinsic Value (Base Case) |
|-----------------|------------------------------------------------|
| Great (DCA confirmed, 18%+ ROTC) | 25% |
| Good (solid but capital-intensive) | 35% |
| Turnaround / uncertain moat | 50% |

### 5.2 Aggregate Excess Earnings Test

For any stock purchased, the expected earnings yield excess over the risk-free rate should accumulate to at least 50% of the purchase price over the first 10 years of ownership. Example: if the 10-year Treasury yields 4%, the stock must yield at least 9% in owner earnings (a 5% annual excess), generating a 50% aggregate cushion over a decade. If this condition is not met, the price is too high.

### 5.3 Concentration and Position Sizing

- Maximum 8-12 positions in the portfolio. Diversification beyond this dilutes conviction and returns.
- Maximum 25% of portfolio in any single position at cost basis.
- Maximum 40% of portfolio in any single sector.
- Never add to a losing position unless the original thesis is fully intact AND the valuation has become more compelling (lower price, same or better fundamentals).

### 5.4 Non-Negotiable Safety Rules

- **Never use borrowed money.** Leverage has no place in an investor's toolkit. Anything can happen at any time in markets, and margin calls force selling at the worst moments.
- **Never risk permanent loss of capital.** A single catastrophic loss can destroy decades of compounding. When in doubt, pass.
- **Volatility is not risk.** A 50% price decline in a business with an intact moat is an opportunity, not a danger. Real risk is the permanent impairment of earning power.

---

## Section 7. Red Flags & Disqualifiers

Any single item below is sufficient grounds to reject a candidate. No exceptions.

### 6.1 Immediate Disqualifiers

- **Price-competitive business with no moat:** If the company competes primarily on price and has no structural cost advantage, reject. These businesses carry enormous long-term debt, erratic profits, and require constant capex just to stay competitive.
- **Negative or erratic earnings:** If net income has been negative in more than 2 of the past 10 years, reject.
- **Excessive leverage:** Long-term debt exceeding 3x average owner earnings of the past 5 years. Exception: regulated utilities and financials evaluated on different metrics.
- **Earnings depend on EBITDA storytelling:** If the company's investor presentations emphasize EBITDA or "adjusted" metrics while GAAP earnings tell a different story, treat with extreme suspicion.
- **Chronic share dilution:** Outstanding share count increased more than 2% annually over the past 5 years without proportional earnings growth.
- **Related-party transactions or complex structures:** Off-balance-sheet entities, excessive executive compensation relative to earnings, frequent "one-time" charges that recur annually.
- **Unverifiable accounting:** Receivables growing materially faster than revenue, inventory building without sales growth, frequent auditor changes, or restated financials.

### 6.2 Warning Signs (Two or More = Disqualify)

- Management compensation not aligned with shareholder returns (high pay, low performance)
- Acquisitions funded primarily by debt with no clear integration track record
- Capital expenditures consistently exceeding depreciation by 50%+ without corresponding revenue growth
- Free cash flow conversion (FCF / net income) consistently below 80%
- Insider selling during periods of public optimism about the company
- Customer concentration: top 3 customers represent more than 40% of revenue
- Goodwill exceeding 50% of total assets (signals overpayment for past acquisitions)

### 6.3 The Cockroach Principle

When management discloses one problem, assume there are more. A single earnings miss explained by "unusual circumstances" may be forgivable if the moat is intact. Two consecutive misses or misleading disclosures mean exit immediately. There is seldom just one cockroach in the kitchen.

---

## Section 8. Verdict Criteria

After completing Sections 1-6, score the candidate and reach a binary verdict: **BUY** or **PASS**. There is no "hold" at the point of initial purchase -- either it meets every standard or it does not.

### 7.1 Scoring Matrix

| Category | Weight | Criteria for Full Score |
|----------|--------|----------------------|
| Financial Health (Section 2) | 20% | All 7 criteria met |
| Quality / Moat (Section 3) | 30% | DCA confirmed, Great classification, management passes Fisher test |
| Valuation (Section 4) | 25% | Earnings yield exceeds bond rate by 5%+, payback under 10 years |
| Margin of Safety (Section 6) | 25% | Price below Bear-case value, aggregate excess test passed |

**Minimum passing score: 85%.** Quality and Margin of Safety are the two heaviest-weighted categories intentionally -- overpaying slightly for a wonderful business is far less dangerous than getting a "bargain" on a mediocre one. The chief losses in investing come from buying low-quality securities during times of favorable business conditions.

### 7.2 Final Decision Rules

**BUY** when ALL of the following are true:
1. Financial Health Checklist: all hard criteria passed (Section 2)
2. Business classified as Great or Good with confirmed DCA (Section 3)
3. Current price at or below Bear-case intrinsic value (Section 5)
4. Margin of safety meets the minimum discount for the quality tier (Section 6)
5. Zero disqualifiers triggered (Section 7)
6. Composite score >= 85%

**PASS** when ANY of the following are true:
1. One or more disqualifiers triggered
2. Price above Base-case intrinsic value
3. Margin of safety below minimum for quality tier
4. Business classified as Gruesome
5. Cannot estimate owner earnings with reasonable confidence
6. Composite score < 85%

### 7.3 Post-Purchase Monitoring

Once a position is established:
- Re-evaluate the full framework annually using updated financials
- The only reasons to sell: (a) the moat is permanently impaired, (b) the stock reaches 150%+ of Base-case intrinsic value, or (c) a clearly superior opportunity requires capital reallocation
- Never sell solely because the price dropped -- if the moat is intact and fundamentals unchanged, a lower price is a gift
- Patience is the active ingredient. The best investments compound for decades. Time is the friend of the wonderful business.

---

*This methodology synthesizes defensive value investing principles with competitive advantage analysis. It is designed to produce a small number of high-conviction positions in exceptional businesses purchased at rational prices. The framework deliberately errs on the side of rejection -- missing a good opportunity costs nothing, but a permanent loss of capital can never be recovered.*

---

## Changelog

### v1.3 (2026-03-22)
- Fixed section numbering: headings now match internal cross-references (Section 0-8)
- Separated `profit_before_tax` from `operating_income` in data pipeline
- Added `owner_earnings_ttm` and `current_ratio` to assessment output schema
- Added `data_sources` tracking (from_files / from_web / from_llm_knowledge)
- Added post-assessment validation step (`validate-assessment.ts`)

### v1.2
- Added Section 1: Company Type Classification (Mature/Value / Growth / Hypergrowth routing)
- Added Investment Phase Adjustment in Section 4.1 for companies with capex-heavy growth cycles
- Added Contracted Backlog Exception in Section 4.2 for signed multi-year contracts
- Expanded Section 4.5 with EV/NTM Revenue method for Growth/Hypergrowth companies, including comparable company procedure
- Added mandatory diluted share count calculation (including in-the-money convertibles) throughout Section 4.5

### v1.1
- Added Section 4.6: Emerging Market & ADR Adjustments (mandatory WACC floors, growth haircuts, terminal multiple discounts)
