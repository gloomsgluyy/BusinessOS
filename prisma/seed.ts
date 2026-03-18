import { PrismaClient } from '@prisma/client';
import { seedUser } from './seeders/userSeeder';
import { seedAccount } from './seeders/accountSeeder';
import { seedSession } from './seeders/sessionSeeder';
import { seedVerificationToken } from './seeders/verificationtokenSeeder';
import { seedChatHistory } from './seeders/chathistorySeeder';
import { seedMeetingMedia } from './seeders/meetingmediaSeeder';
import { seedShipmentDetail } from './seeders/shipmentdetailSeeder';
import { seedTimelineMilestone } from './seeders/timelinemilestoneSeeder';
import { seedSyncState } from './seeders/syncstateSeeder';
import { seedAuditLog } from './seeders/auditlogSeeder';
import { seedTaskItem } from './seeders/taskitemSeeder';
import { seedSalesOrder } from './seeders/salesorderSeeder';
import { seedPurchaseRequest } from './seeders/purchaserequestSeeder';
import { seedSourceSupplier } from './seeders/sourcesupplierSeeder';
import { seedQualityResult } from './seeders/qualityresultSeeder';
import { seedMarketPrice } from './seeders/marketpriceSeeder';
import { seedMeetingItem } from './seeders/meetingitemSeeder';
import { seedPLForecast } from './seeders/plforecastSeeder';
import { seedSalesDeal } from './seeders/salesdealSeeder';
import { seedPartner } from './seeders/partnerSeeder';
import { seedBlendingSimulation } from './seeders/blendingsimulationSeeder';

const prisma = new PrismaClient();

// We handle the order carefully due to foreign key relations
async function main() {
  console.log('Starting execution of all seeders...');

  await seedUser(prisma);
  await seedAccount(prisma);
  await seedSession(prisma);
  await seedVerificationToken(prisma);
  await seedChatHistory(prisma);
  await seedMeetingMedia(prisma);
  await seedShipmentDetail(prisma);
  await seedTimelineMilestone(prisma);
  await seedSyncState(prisma);
  await seedAuditLog(prisma);
  await seedTaskItem(prisma);
  await seedSalesOrder(prisma);
  await seedPurchaseRequest(prisma);
  await seedSourceSupplier(prisma);
  await seedQualityResult(prisma);
  await seedMarketPrice(prisma);
  await seedMeetingItem(prisma);
  await seedPLForecast(prisma);
  await seedSalesDeal(prisma);
  await seedPartner(prisma);
  await seedBlendingSimulation(prisma);

  console.log('All seeders executed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
