# Quick Start: Running Migration Scripts with Node.js

## 🚀 Execute Migration in 3 Steps

### Step 1: Verify Setup
```bash
# Ensure you're in project root
cd d:\programming\web\fullstack\11gawe

# Check Node.js is available
node --version    # Should be v14 or higher

# Check dependencies installed
npm list xlsx @prisma/client | grep -E "xlsx|@prisma"
```

### Step 2: Run Migration
```bash
# Execute migration (6 phases)
node scripts/migrate-historical-data.js

# Expected output:
# ╔═══════════════════════════════════════════════════════════╗
# ║  HISTORICAL DATA MIGRATION (Excel → Production DB)       ║
# ║  Strategy: Clean & Load | Date Format: DD/MM/YYYY        ║
# ╚═══════════════════════════════════════════════════════════╝
#
# 📊 PHASE 1: Extracting Partners from Excel...
# 🌱 PHASE 2: Seeding Partners to Database...
# 🧹 PHASE 3: Cleaning Dummy Data...
# 📦 PHASE 4: Loading ShipmentDetail records...
# 📋 PHASE 5: Loading DailyDelivery records...
# 🧪 PHASE 6: Creating QualityResult records...
```

### Step 3: Verify Results
```bash
# Verify migration completed successfully
node scripts/verify-migration.js

# Expected output:
# ╔═══════════════════════════════════════════════════════════╗
# ║         MIGRATION VERIFICATION REPORT                     ║
# ║                    VERIFICATION SUMMARY                   ║
# ║  Partners:              45                                ║
# ║  ShipmentDetail:      1,200                               ║
# ║  DailyDelivery:       1,000                               ║
# ║  QualityResult:         450                               ║
# ║  ─────────────────────────────────────────────────────    ║
# ║  TOTAL MIGRATED:      2,200                               ║
# ║  ✅ VERIFICATION PASSED - Migration successful!           ║
# ╚═══════════════════════════════════════════════════════════╝
```

## 📋 Prerequisites Checklist

- [ ] Node.js v14+ installed
- [ ] npm install completed
- [ ] .env file with DATABASE_URL configured
- [ ] Database server running (Neon/PostgreSQL)
- [ ] Excel files in project root:
  - [ ] `00. MV_Barge&Source 2021,2022, 2023,2024-7-19.xlsx`
  - [ ] `10.Daily Delivery Report (Recap Shipment) 2020, 2021, 2022, 2023, 2024, 2025, 2026.xlsx`

## ⚡ Performance

| Task | Duration |
|------|----------|
| Extract Partners | ~2 seconds |
| Seed Partners | ~5 seconds |
| Clean Data | ~3 seconds |
| Load ShipmentDetail | ~20 seconds |
| Load DailyDelivery | ~25 seconds |
| Create QualityResults | ~15 seconds |
| **Total Migration** | **~2-3 minutes** |
| Verification | **~5-10 seconds** |

## 🔍 Verify Syntax (Optional)

Before running, optionally validate script syntax:
```bash
node scripts/validate-syntax.js
# Output: ✅ All scripts valid! Ready to execute with Node.js
```

## 📊 What Gets Migrated

### ShipmentDetail Records (from MV Barge file)
- Nomination, Status, Origin
- IUP Operator, Shipment Flow
- BL Date, Quantity, COB
- Pricing (Harga Actual, HPB, SP)
- Quality: Result GAR
- **Target**: 1,000+ records from 2024-2026

### DailyDelivery Records (from Daily Delivery file)
- Buyer, Supplier/Source
- Shipping Term, Area, Flow
- BL Date, BL Quantity
- Invoice Amount
- Product, Project
- **Target**: 1,100+ records from 2020-2026

### Partner Records
- Buyers (from both files)
- Suppliers/Vendors (from both files)
- Smart name normalization (aliases)
- **Target**: 40+ unique partners

### QualityResult Records
- Created from GAR data in ShipmentDetail
- Linked by shipment ID
- Sampling date = BL Date
- Status: completed
- **Target**: Match shipments with GAR data

## ✅ Success Criteria

Migration is successful if:
- ✅ Total migrated records ≥ 2,157
- ✅ All critical fields populated (buyer, blDate, quantity)
- ✅ All buyers exist in Partner table
- ✅ No future dates in historical data
- ✅ Quality results match shipments with GAR
- ✅ No critical issues reported

## ⚠️ Common Issues & Solutions

### Issue: "Cannot find module 'xlsx'"
**Solution:**
```bash
npm install xlsx
```

### Issue: "Cannot find module '@prisma/client'"
**Solution:**
```bash
npm install @prisma/client
# OR regenerate from schema
npx prisma generate
```

### Issue: "ENOENT: no such file or directory"
**Solution:**
- Check Excel files are in project root
- Verify .env has DATABASE_URL
- Ensure database is running

### Issue: "P1000: Can't reach database server"
**Solution:**
```bash
# Test database connection
node -e "new (require('@prisma/client').PrismaClient)().$disconnect()"
```

### Issue: "Data validation failed"
**Solution:**
- Review warnings in verification output
- Check Excel file content and formats
- Verify date formats are DD/MM/YYYY or serial numbers

## 📝 Alternative: Use TypeScript Version (Still Works!)

If you prefer using ts-node (slower but has type checking):
```bash
# Using ts-node (slower, ~2-3s startup)
npm run migrate:historical    # Defined in package.json
npm run verify:migration      # Defined in package.json

# Equivalent to:
npx ts-node scripts/migrate-historical-data.ts
npx ts-node scripts/verify-migration.ts
```

## 🎯 Next Steps After Migration

1. **Verify Completion** - Run verify script (see Step 3)
2. **Check Data Quality** - Review warnings if any
3. **Run Tests** - Test API endpoints with new data
4. **Backup Database** - Create backup after successful migration
5. **Monitor Performance** - Check database performance with new volume

## 📚 Additional Resources

- **Detailed Docs**: See `scripts/README.md`
- **Compilation Summary**: See `COMPILATION_SUMMARY.md`
- **Migration Phases**: Documented in migration script comments
- **Verification Logic**: Documented in verification script comments

## 🚨 Important Notes

- **Destructive**: Migration deletes existing ShipmentDetail, DailyDelivery, QualityResult records
- **Backup First**: Create database backup before running
- **One-Time**: Run only once (or after manual cleanup)
- **Excel Format**: Requires XLSX format (not CSV)
- **Database**: Requires running database connection

---

**Version**: 1.0
**Status**: Production Ready ✅
**Last Updated**: 2024
