/**
 * Migration Verification Script
 * 
 * Verifies that historical data migration completed successfully
 * Checks:
 * 1. Record counts (2,157+ target)
 * 2. Data integrity (no missing critical fields)
 * 3. Partner relationships
 * 4. Date validity
 * 5. Quality records linkage
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface VerificationReport {
  passed: boolean;
  totalRecords: number;
  issues: string[];
  warnings: string[];
  summary: {
    partners: number;
    shipmentDetails: number;
    dailyDeliveries: number;
    qualityResults: number;
  };
}

async function verifyRecordCounts(report: VerificationReport): Promise<void> {
  console.log('\n📊 Verifying Record Counts...');
  
  // Count partners
  const partnerCount = await prisma.partner.count({
    where: { isDeleted: false },
  });
  report.summary.partners = partnerCount;
  console.log(`  ✓ Partners: ${partnerCount}`);
  
  // Count shipment details
  const shipmentCount = await prisma.shipmentDetail.count({
    where: { isDeleted: false },
  });
  report.summary.shipmentDetails = shipmentCount;
  console.log(`  ✓ ShipmentDetail: ${shipmentCount}`);
  
  // Count daily deliveries
  const deliveryCount = await prisma.dailyDelivery.count({
    where: { isDeleted: false },
  });
  report.summary.dailyDeliveries = deliveryCount;
  console.log(`  ✓ DailyDelivery: ${deliveryCount}`);
  
  // Count quality results
  const qualityCount = await prisma.qualityResult.count({
    where: { isDeleted: false },
  });
  report.summary.qualityResults = qualityCount;
  console.log(`  ✓ QualityResult: ${qualityCount}`);
  
  report.totalRecords = shipmentCount + deliveryCount;
  
  // Check target
  if (report.totalRecords < 2157) {
    report.issues.push(`Total records (${report.totalRecords}) below target of 2,157`);
  } else {
    console.log(`\n  ✅ Target achieved: ${report.totalRecords} >= 2,157`);
  }
}

async function verifyDataIntegrity(report: VerificationReport): Promise<void> {
  console.log('\n🔍 Verifying Data Integrity...');
  
  // Check ShipmentDetail with missing critical fields
  const incompletShipments = await prisma.shipmentDetail.count({
    where: {
      isDeleted: false,
      OR: [
        { buyer: null },
        { blDate: null },
        { qtyPlan: null },
      ],
    },
  });
  
  if (incompletShipments > 0) {
    report.warnings.push(`${incompletShipments} ShipmentDetail records have missing critical fields`);
    console.log(`  ⚠️  ${incompletShipments} incomplete ShipmentDetail records`);
  } else {
    console.log(`  ✓ All ShipmentDetail records are complete`);
  }
  
  // Check DailyDelivery with missing critical fields
  const incompleteDeliveries = await prisma.dailyDelivery.count({
    where: {
      isDeleted: false,
      OR: [
        { buyer: null },
        { blDate: null },
        { blQuantity: null },
      ],
    },
  });
  
  if (incompleteDeliveries > 0) {
    report.warnings.push(`${incompleteDeliveries} DailyDelivery records have missing critical fields`);
    console.log(`  ⚠️  ${incompleteDeliveries} incomplete DailyDelivery records`);
  } else {
    console.log(`  ✓ All DailyDelivery records are complete`);
  }
  
  // Check for "Incomplete" markers
  const incompleteMarkers = await prisma.shipmentDetail.count({
    where: {
      isDeleted: false,
      supplier: 'Incomplete',
    },
  });
  
  if (incompleteMarkers > 0) {
    report.warnings.push(`${incompleteMarkers} records marked as 'Incomplete'`);
    console.log(`  ℹ️  ${incompleteMarkers} records marked as 'Incomplete' (expected per strategy)`);
  }
}

async function verifyPartnerRelationships(report: VerificationReport): Promise<void> {
  console.log('\n🤝 Verifying Partner Relationships...');
  
  // Check buyer distribution
  const buyerDistribution = await prisma.shipmentDetail.groupBy({
    by: ['buyer'],
    where: {
      isDeleted: false,
      buyer: { not: null },
    },
    _count: true,
  });
  
  console.log(`  ✓ Found ${buyerDistribution.length} unique buyers in ShipmentDetail`);
  
  const topBuyers = buyerDistribution
    .sort((a, b) => b._count - a._count)
    .slice(0, 5);
  
  console.log('  Top 5 buyers:');
  topBuyers.forEach(b => {
    console.log(`    • ${b.buyer}: ${b._count} shipments`);
  });
  
  // Check supplier distribution
  const supplierDistribution = await prisma.shipmentDetail.groupBy({
    by: ['supplier'],
    where: {
      isDeleted: false,
      supplier: { not: null },
    },
    _count: true,
  });
  
  console.log(`  ✓ Found ${supplierDistribution.length} unique suppliers in ShipmentDetail`);
  
  // Verify partners exist in Partner table
  const partnersInDb = await prisma.partner.findMany({
    where: { isDeleted: false },
    select: { name: true },
  });
  const partnerNames = new Set(partnersInDb.map(p => p.name));
  
  let missingPartners = 0;
  for (const b of buyerDistribution) {
    if (b.buyer && !partnerNames.has(b.buyer)) {
      missingPartners++;
    }
  }
  
  if (missingPartners > 0) {
    report.warnings.push(`${missingPartners} buyers not found in Partner table`);
    console.log(`  ⚠️  ${missingPartners} buyers not in Partner table`);
  } else {
    console.log(`  ✓ All buyers exist in Partner table`);
  }
}

async function verifyDateValidity(report: VerificationReport): Promise<void> {
  console.log('\n📅 Verifying Date Validity...');
  
  // Check for future dates (unlikely in historical data)
  const futureShipments = await prisma.shipmentDetail.count({
    where: {
      isDeleted: false,
      blDate: { gt: new Date() },
    },
  });
  
  if (futureShipments > 0) {
    report.warnings.push(`${futureShipments} shipments have future BL dates`);
    console.log(`  ⚠️  ${futureShipments} shipments with future BL dates`);
  } else {
    console.log(`  ✓ No future dates found in ShipmentDetail`);
  }
  
  // Check date range
  const dateRange = await prisma.shipmentDetail.aggregate({
    where: {
      isDeleted: false,
      blDate: { not: null },
    },
    _min: { blDate: true },
    _max: { blDate: true },
  });
  
  if (dateRange._min.blDate && dateRange._max.blDate) {
    console.log(`  ✓ Date range: ${dateRange._min.blDate.toISOString().split('T')[0]} to ${dateRange._max.blDate.toISOString().split('T')[0]}`);
  }
  
  // Check year distribution
  const yearDistribution = await prisma.shipmentDetail.groupBy({
    by: ['year'],
    where: { isDeleted: false },
    _count: true,
  });
  
  console.log('  Year distribution in ShipmentDetail:');
  yearDistribution
    .sort((a, b) => a.year - b.year)
    .forEach(y => {
      console.log(`    • ${y.year}: ${y._count} records`);
    });
}

async function verifyQualityLinkage(report: VerificationReport): Promise<void> {
  console.log('\n🧪 Verifying Quality Result Linkage...');
  
  // Count shipments with quality data
  const shipmentsWithGar = await prisma.shipmentDetail.count({
    where: {
      isDeleted: false,
      resultGar: { not: null },
    },
  });
  
  console.log(`  ✓ ${shipmentsWithGar} shipments have GAR data`);
  
  // Check quality results
  const qualityCount = await prisma.qualityResult.count({
    where: { isDeleted: false },
  });
  
  if (qualityCount !== shipmentsWithGar) {
    report.warnings.push(`Quality result count (${qualityCount}) doesn't match shipments with GAR (${shipmentsWithGar})`);
    console.log(`  ⚠️  Mismatch: ${qualityCount} QualityResults vs ${shipmentsWithGar} shipments with GAR`);
  } else {
    console.log(`  ✓ Quality results match shipments with GAR data`);
  }
  
  // Check GAR value ranges
  const garStats = await prisma.shipmentDetail.aggregate({
    where: {
      isDeleted: false,
      resultGar: { not: null },
    },
    _min: { resultGar: true },
    _max: { resultGar: true },
    _avg: { resultGar: true },
  });
  
  if (garStats._min.resultGar && garStats._max.resultGar) {
    console.log(`  ✓ GAR range: ${garStats._min.resultGar.toFixed(0)} - ${garStats._max.resultGar.toFixed(0)} kcal/kg`);
    console.log(`    Average: ${garStats._avg.resultGar?.toFixed(0)} kcal/kg`);
    
    // Sanity check (coal GAR typically 3000-7000)
    if (garStats._min.resultGar < 2000 || garStats._max.resultGar > 8000) {
      report.warnings.push('GAR values outside typical coal range (2000-8000 kcal/kg)');
      console.log(`  ⚠️  Some GAR values outside typical range`);
    }
  }
}

async function generateReport(): Promise<VerificationReport> {
  const report: VerificationReport = {
    passed: true,
    totalRecords: 0,
    issues: [],
    warnings: [],
    summary: {
      partners: 0,
      shipmentDetails: 0,
      dailyDeliveries: 0,
      qualityResults: 0,
    },
  };
  
  await verifyRecordCounts(report);
  await verifyDataIntegrity(report);
  await verifyPartnerRelationships(report);
  await verifyDateValidity(report);
  await verifyQualityLinkage(report);
  
  // Set pass/fail
  report.passed = report.issues.length === 0;
  
  return report;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║         MIGRATION VERIFICATION REPORT                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  try {
    const report = await generateReport();
    
    // Print summary
    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║                    VERIFICATION SUMMARY                   ║');
    console.log('╠═══════════════════════════════════════════════════════════╣');
    console.log(`║  Partners:              ${String(report.summary.partners).padStart(5)}                      ║`);
    console.log(`║  ShipmentDetail:        ${String(report.summary.shipmentDetails).padStart(5)}                      ║`);
    console.log(`║  DailyDelivery:         ${String(report.summary.dailyDeliveries).padStart(5)}                      ║`);
    console.log(`║  QualityResult:         ${String(report.summary.qualityResults).padStart(5)}                      ║`);
    console.log('║  ─────────────────────────────────────────────────────    ║');
    console.log(`║  TOTAL MIGRATED:        ${String(report.totalRecords).padStart(5)}                      ║`);
    console.log('╚═══════════════════════════════════════════════════════════╝');
    
    // Print issues
    if (report.issues.length > 0) {
      console.log('\n❌ CRITICAL ISSUES:');
      report.issues.forEach(issue => console.log(`  • ${issue}`));
    }
    
    // Print warnings
    if (report.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      report.warnings.forEach(warning => console.log(`  • ${warning}`));
    }
    
    // Final verdict
    if (report.passed) {
      console.log('\n✅ VERIFICATION PASSED - Migration successful!');
      console.log('   All critical checks passed. Review warnings if any.');
    } else {
      console.log('\n❌ VERIFICATION FAILED - Critical issues found!');
      console.log('   Please review and fix issues before proceeding.');
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\n❌ Verification failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
