# Google Sheets Column Mapping - P&L Forecast

## Sheet Structure

**Tab Name:** `P&L Forecast`

**Column Headers (Row 1):**

| Column | Header Name           | Database Field    | Data Type | Description                |
|--------|-----------------------|-------------------|-----------|----------------------------|
| A      | ID                    | id                | String    | Unique identifier          |
| B      | Project / Buyer       | buyer             | String    | Buyer/project name         |
| C      | Quantity              | quantity          | Number    | Quantity in MT             |
| D      | Selling Price         | sellingPrice      | Number    | Price per MT (USD)         |
| E      | Buying Price          | buyingPrice       | Number    | Cost per MT (USD)          |
| F      | Freight Cost          | freightCost       | Number    | Freight per MT (USD)       |
| G      | Other Cost            | otherCost         | Number    | Other costs per MT (USD)   |
| H      | Gross Profit / MT     | grossProfitMt     | Number    | Profit per MT (calculated) |
| I      | Total Gross Profit    | totalGrossProfit  | Number    | Total profit (calculated)  |
| J      | Updated At            | updatedAt         | DateTime  | Last update timestamp      |

## Example Data Row

```
A: plf-1234567890-abc123
B: KEPCO (Korea)
C: 50000
D: 75.50
E: 65.00
F: 3.50
G: 1.00
H: 6.00
I: 300000
J: 2026-03-26T05:53:52.000Z
```

## Calculated Fields

### Gross Profit / MT (Column H)
```
grossProfitMt = sellingPrice - buyingPrice - freightCost - otherCost
```

### Total Gross Profit (Column I)
```
totalGrossProfit = grossProfitMt * quantity
```

## Header Normalization

The sync system normalizes headers by:
1. Trimming whitespace
2. Converting to UPPERCASE
3. Collapsing multiple spaces to single space

So these headers are equivalent:
- `Project / Buyer`
- `PROJECT / BUYER`
- `project / buyer`
- `Project  /  Buyer` (extra spaces)

## Sync Behavior

### From Sheets → Database (Pull)
- Runs every 30 seconds (configurable via `SYNC_INTERVAL_MS`)
- Reads all rows from "P&L Forecast" tab
- Updates database with Sheet values (Sheet always wins)
- Missing records in Sheet are marked as deleted in DB

### From UI → Sheets → Database (Push)
- User creates/updates via UI
- Writes to Google Sheets first (primary)
- Then writes to database (cache)
- Returns error if Sheet write fails

## Troubleshooting

### Data not syncing from Sheets?

1. **Check tab name**: Must be exactly `P&L Forecast`
2. **Check headers**: Row 1 must have correct headers
3. **Check column order**: Must match the table above
4. **Check ID format**: Each row must have unique ID in column A
5. **Run manual sync**: `node test-manual-sync.js`

### Data not appearing in Sheets after UI create?

1. **Check Sheet permissions**: Service account needs edit access
2. **Check .env**: `GOOGLE_SHEETS_ID` and `GOOGLE_SHEETS_CREDENTIALS` must be set
3. **Check logs**: Look for `[SheetsFirstService]` messages in console
4. **Verify range**: Ensure range is `A:J` (10 columns)

### Column mismatch errors?

The sync will skip rows with missing/invalid data but continue processing other rows. Check console logs for detailed error messages.

## Testing

### Test Pull (Sheets → DB)
```bash
node test-manual-sync.js
```

### Test Push (UI → Sheets → DB)
```bash
node test-sheets-first.js
```

## Migration

If you have existing data:

1. **In Database but not in Sheets:**
   - Run: `node push-to-sheets-standalone.js`
   - This will push all DB data to Sheets

2. **In Sheets but not in Database:**
   - Run: `node test-manual-sync.js`
   - This will pull all Sheet data to DB

3. **Both have data:**
   - Sheets will be the source of truth
   - Run manual sync to update DB with Sheet values
   - Any conflicts will be resolved in favor of Sheet data

## Example Sheet Formula

To calculate Gross Profit / MT automatically in Sheet:
```
=D2-E2-F2-G2
```
(Where D=Selling Price, E=Buying Price, F=Freight Cost, G=Other Cost)

To calculate Total Gross Profit:
```
=H2*C2
```
(Where H=Gross Profit/MT, C=Quantity)
