# 🚀 Quick Start: Run Migration in 3 Commands

## Prerequisites Check ✓
```bash
# 1. Verify Excel files exist
dir "*.xlsx"

# Should show:
# - 10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx
# - 00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx
```

---

## Run Migration

### Command 1: Execute Migration (2-3 minutes)
```bash
node scripts\migrate-historical-data.js
```

**Expected result:**
```
✅ MIGRATION COMPLETE
   TOTAL MIGRATED: 2,090+ records
   Partners: 45 | ShipmentDetail: 950 | DailyDelivery: 1,140
```

---

### Command 2: Verify Results (5-10 seconds)
```bash
node scripts\verify-migration.js
```

**Expected result:**
```
✅ VERIFICATION PASSED - Migration successful!
   All critical checks passed.
```

---

### Command 3: Check UI

Open browser and verify:
- http://localhost:3000/shipment-monitor
- http://localhost:3000/partners

---

## Alternative: Using NPM Scripts

```bash
npm run migrate:historical
npm run verify:migration
```

---

## If Something Goes Wrong

**View detailed logs:**
```bash
node scripts\migrate-historical-data.js > migration.log 2>&1
```

**Check troubleshooting:**
See `MIGRATION_GUIDE.md` section "🔧 Troubleshooting"

---

## What Gets Migrated?

| Source | Target Table | Records |
|--------|-------------|---------|
| MV_Barge 2024-2026 | ShipmentDetail | ~950 |
| Daily Delivery 2020-2026 | DailyDelivery | ~1,140 |
| GAR Quality Data | QualityResult | ~780 |
| Buyers & Suppliers | Partner | ~45 |

**Total:** 2,090+ historical records

---

## Success Criteria

✅ No error messages in console  
✅ "MIGRATION COMPLETE" appears  
✅ Verification passes  
✅ UI shows historical data  

**That's it!** 🎉

For detailed information, read `MIGRATION_GUIDE.md`
