# Migration Scripts - Node.js Executable Versions

These compiled JavaScript versions of the TypeScript migration scripts can be executed directly with Node.js without needing ts-node or TypeScript compilation.

## Files

- **`migrate-historical-data.js`** - Executes the 6-phase historical data migration
- **`verify-migration.js`** - Verifies migration integrity and reports statistics

## Prerequisites

- Node.js (v14 or higher)
- npm dependencies installed (`npm install`)
- `.env` configured with `DATABASE_URL`
- Excel data files in the project root:
  - `00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx`
  - `10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx`

## Running the Scripts

### Option 1: Using Node.js directly

```bash
# Run migration
node scripts/migrate-historical-data.js

# Verify migration
node scripts/verify-migration.js
```

### Option 2: Using npm scripts (if configured)

```bash
# Add these to package.json if desired:
npm run migrate:historical
npm run verify:migration
```

### Option 3: Using ts-node (original TypeScript method)

```bash
# Still works with ts-node
npm run migrate:historical
npm run verify:migration
```

## Migration Phases

The migration script runs 6 sequential phases:

1. **Extract Partners** - Identifies all unique buyers/vendors from Excel files
2. **Seed Partners** - Creates or reuses partner records in the database
3. **Clean Dummy Data** - Removes existing ShipmentDetail, DailyDelivery, QualityResult records
4. **Load ShipmentDetail** - Imports records from MV Barge file (2024-2026)
5. **Load DailyDelivery** - Imports records from Daily Delivery file (2020-2026)
6. **Create QualityResults** - Links quality results from ShipmentDetail GAR data

## Verification Checks

The verification script checks:

- ✓ Record counts (targets 2,157+ records)
- ✓ Data integrity (critical fields present)
- ✓ Partner relationships
- ✓ Date validity and ranges
- ✓ Quality result linkage

## Example Output

```
╔═══════════════════════════════════════════════════════════╗
║  HISTORICAL DATA MIGRATION (Excel → Production DB)       ║
║  Strategy: Clean & Load | Date Format: DD/MM/YYYY        ║
╚═══════════════════════════════════════════════════════════╝

📊 PHASE 1: Extracting Partners from Excel...
✓ Processed MV Barge 2024: 150 rows
✓ Processed MV Barge 2025: 145 rows
✓ Processed MV Barge 2026: 110 rows
✓ Processed Daily Delivery 2020: 340 rows
...
✅ Found 45 unique partners

🌱 PHASE 2: Seeding Partners to Database...
  ✓ PT Manambang Muara Enim (created)
  • PT Bumi Merapi Energi (existing)
...

[continues with phases 3-6 and summary]

✅ Target of 2,157+ records achieved!
```

## Troubleshooting

### "File not found" errors
- Ensure Excel files are in the project root directory
- Check file names match exactly (case-sensitive on Unix systems)
- Verify sheet names in the source Excel files

### "Module not found" errors
- Run `npm install` to install dependencies
- Ensure Prisma client is generated: `npm run prisma generate` or included in `npm run build`

### Database connection errors
- Verify `.env` file has valid `DATABASE_URL`
- Test connection: `node -e "require('@prisma/client').PrismaClient()"`

### Encoding issues
- Excel files must be in standard format (XLSX)
- Ensure terminal supports UTF-8 for emoji output

## Notes

- These .js files are transpiled from TypeScript with CommonJS modules
- All TypeScript interfaces are removed (JavaScript doesn't need type definitions)
- async/await pattern preserved for proper error handling
- Prisma client instantiation works identically in both TS and JS versions
- No build step needed - just run with `node` directly

## Comparison: TS vs JS

| Aspect | TypeScript | JavaScript |
|--------|-----------|-----------|
| File | `migrate-historical-data.ts` | `migrate-historical-data.js` |
| Command | `ts-node migrate-historical-data.ts` | `node migrate-historical-data.js` |
| Execution | Via ts-node | Direct Node.js |
| Module system | ES modules (import) | CommonJS (require) |
| Type checking | At compile time | None |
| Dependencies | TypeScript + ts-node | Just Node.js |

Both versions perform identically - the JS versions are just faster to execute without compilation overhead.
