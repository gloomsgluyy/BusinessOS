import { PrismaClient } from '@prisma/client';

export async function seedMeetingMedia(prisma: PrismaClient) {
  console.log('Seeding MeetingMedia...');
  const users = await prisma.user.findMany({ take: 10 });
  if (users.length === 0) return;
  const data = Array.from({ length: 10 }).map((_, i) => ({
    meetingId: 'meet-' + (i + 1),
    uploaderId: users[i % users.length].id,
    fileName: 'recording-' + (i + 1) + '.mp4',
    fileUrl: 'https://example.com/recording-' + (i + 1) + '.mp4',
  }));
  for (const item of data) {
    await prisma.meetingMedia.create({ data: item });
  }
  console.log('MeetingMedia seeded successfully.');
}
