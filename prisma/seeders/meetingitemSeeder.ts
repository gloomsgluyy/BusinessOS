import { PrismaClient } from '@prisma/client';

export async function seedMeetingItem(prisma: PrismaClient) {
  console.log('Seeding MeetingItem...');
  const data = Array.from({ length: 10 }).map((_, i) => ({
    title: 'Meeting ' + (i + 1),
    date: new Date(Date.now() + 1000 * 60 * 60 * 24 * i),
    status: 'scheduled',
    createdBy: 'user1',
  }));
  for (const item of data) {
    await prisma.meetingItem.create({ data: item });
  }
  console.log('MeetingItem seeded successfully.');
}
