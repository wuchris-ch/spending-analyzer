# Spending Ledger

A browser-based personal spending analyzer. Imports CSV exports from your credit card or bank account, categorizes every transaction, and renders it as an editorial accounting ledger: warm paper palette, Fraunces typography, hairline rules, oxblood debit figures.

Runs entirely in the browser. No backend, no tracking, your data never leaves the tab.

Live site: https://wuchris-ch.github.io/spending-analyzer/

## Features

### Front Page
- Tombstone figures for total debited, this-month total, active categories, and entries on file
- Recurring Charges section with a monthly timeline and top subscription breakdown
- Expenditure by Section: every category ranked, with a rolling 6-month mini-series and top merchants per category
- Latest Entries feed

### Monthly
- Rolling bar chart of month-over-month spending with average, high, and low markers
- Each month itemized by category, with expandable sub-category breakdown and per-transaction detail

### The Ledger
- Search by description or category
- Filter by category
- Sort by date, description, or amount
- CSV export of the current view

### Imports
- Drag-and-drop CSV upload
- Auto-discovery of CSVs in `accountactivity-gitignored/`
- One-click load all entries from the masthead

### Automatic Categorization
Built-in rules cover food delivery (Uber Eats, DoorDash, Skip, Fantuan, Hungry Panda), rideshare (Uber, Lyft), groceries (Costco, Instacart, local markets), Amazon and general retail, subscriptions (Netflix, Spotify, ChatGPT, iCloud, etc.), gas, restaurants, recreation, and fees & interest. See `categories/categories.js` for the full schema, and `categories/spec.md` for the classification spec.

## Getting Started

1. Start a local server in the project directory:
   ```bash
   ./start-server.sh
   ```
   or
   ```bash
   python3 -m http.server 8888
   ```

2. Open `http://localhost:8888`.

3. Either drag CSVs onto the Imports page, or drop them into `accountactivity-gitignored/` and click "Load all entries" in the masthead.

## CSV Format

Expected format, no header row:

```
MM/DD/YYYY,Description,Debit Amount,Credit Amount
```

Only debits are tracked; credits (payments and refunds) are ignored.

If auto-discovery in `accountactivity-gitignored/` is needed, list the files in `accountactivity-gitignored/files.json` as a JSON array of filenames.

## Tech Stack

- Plain HTML, CSS, JavaScript, no framework, no build step
- Chart.js for the monthly bar chart
- Fraunces, Instrument Sans, JetBrains Mono via Google Fonts
- Light (paper) and dark (after-hours) themes, persisted to `localStorage`

## File Structure

```
spending-analyzer/
├── index.html
├── styles.css
├── app.js
├── start-server.sh
├── categories/
│   ├── categories.js
│   └── spec.md
└── accountactivity-gitignored/
    └── *.csv         (your exports, ignored by git)
```
