# Transaction Performance Dashboard

An interactive executive dashboard for a retail bank in India, built for a CEO and CFO who want to know: how big are we, are we growing, where is the risk, where does the money come from, and what should we act on.

It analyses **5,50,000 transactions (1 Jan 2019 to 1 Jan 2024)** and runs entirely in the browser. There is no backend and no database. The data is packed into a single HTML file, and every number is computed live from the raw rows.

## What it shows

| Section | Questions it answers |
|---|---|
| **Executive summary** | Six KPI cards with year-on-year change and sparklines, plus a ranked "Key insights" panel |
| **Growth & money flow** | Value and count trend, credits vs debits with net flow, payment rails, rail mix over time, channels, states, account types, merchant treemap |
| **Risk & fraud** | Four tested hypotheses, fraud by ticket size and rail, fraud heatmap (hour × weekday), failed, reversed and pending by channel, full insight engine |
| **Customers & lending** | EMI book by loan type, EMI-to-balance stress, credit-score bands, KYC exposure, top 10 customers with flags |

## Features

- Filters on period, state, account type, transaction type, channel, merchant category, loan type, KYC status, transaction status, credit-score band, amount bucket and fraud flag
- Click any bar, slice, tile or heatmap cell to cross-filter every other chart
- Drill-down Year → Quarter → Month → Day
- Compare against the same period last year, or the previous period
- Switch charts between Value, Count and Average ticket
- Auto-written insights tagged Risk, Watch or Opportunity, each with evidence, "so what" and a suggested action
- Chi-square and z-tests for four hypotheses, with a confirmed or rejected verdict
- Table view on every chart, light and dark themes, works on phones
- Reconciliation checks run after every filter change and show in the footer

## Headline findings (2019 to 2023)

- Value is flat at about ₹325 to 335 Cr a year. The business is not growing, and the payment mix is stable.
- Fraud is a high-ticket problem. Transactions above ₹10L are 0.3% of volume but about a third of fraud value, with a fraud rate roughly 6 to 9 times higher.
- RTGS and Cheque have about twice the fraud rate of digital rails.
- About 6% of transactions fail or reverse, and the rate is the same in every channel. This points to shared infrastructure, not one weak channel.
- Credit score and time of day do not predict fraud.
- About 12.8% of value moves through accounts whose KYC is pending or expired.

## Repository layout

```
docs/            the built site: index.html (with data embedded) and d3.min.js
src/             page source: style.css, body.html and the JavaScript modules
scripts/         pack.py (CSV to packed data), build.py (assemble the page), reference.py (independent check)
tests/           verify.js, a headless browser check
data/            put transactions.csv here (not committed)
netlify.toml     Netlify settings, publishes docs/
```

## Run it

Open `docs/index.html` in a browser. Keep `d3.min.js` in the same folder.

## Rebuild with your own data

Requires Python 3 with `pandas` and `numpy`.

```bash
# 1. put your CSV at data/transactions.csv (sorted by transaction_date)
python3 scripts/pack.py      # writes build/data.b64 and build/meta.json
python3 scripts/build.py     # writes docs/index.html
```

The CSV needs these columns: transaction_id, customer_id, transaction_date, transaction_time, account_type, transaction_type, transaction_amount, transaction_direction, account_balance, merchant_category, state, credit_score, has_loan, loan_type, emi_amount, transaction_status, channel, kyc_status, is_fraud, transaction_hour.

The code assumes the first transaction date is 1 Jan 2019 and treats the 1 Jan 2024 stub day as a partial period. A different date range needs small edits to `src/core.js` (`EPOCH`, `NDAYS`, `LAST_FULL_DAY`, `STUB_DAY`) and the default period in `src/ui.js`.

## Check it

```bash
python3 scripts/reference.py           # independent pandas figures -> build/reference.json
npm i playwright && npx playwright install chromium
node tests/verify.js                   # loads the page, confirms reconciliation checks pass
```

## Deploy

**GitHub Pages:** Settings → Pages → Deploy from a branch → `main` and `/docs`.
**Netlify:** drag the `docs` folder onto app.netlify.com, or connect this repository. `netlify.toml` already sets the publish folder.

> **Privacy:** the built page contains every transaction. If the data is real customer data, host it behind a login or on your intranet, and do not publish it to a public repository or a public Pages site.

## Data notes

- The data has no revenue, cost or profit column, so none is shown. Every money figure is a transaction-value proxy.
- 2024 holds one day of data. Default views stop at 31 Dec 2023, and any range that reaches 2024 is flagged as partial.
- Some rows carry a loan flag and an EMI but no loan type. They are shown as "Loan, type not recorded".
- Customer attributes (state, KYC, loan type, credit score) change between transactions in this extract, so segment views count transactions.
- "EMI book" is the sum of EMIs on loan transactions. It measures instalment exposure, not outstanding principal.
- Totals are in ₹ Cr. Medians are read from a histogram and are accurate to about 2.5%. Everything else is exact.

## Tech

Plain HTML, CSS and JavaScript with [D3](https://d3js.org) for charts. Data is stored as byte-shuffled, deflate-compressed columns and unpacked in the browser.

## License

MIT. See `LICENSE`. Third-party notices are in `THIRD_PARTY.md`.
