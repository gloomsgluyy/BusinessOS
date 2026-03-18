import { PrismaClient } from '@prisma/client';

export async function seedChatHistory(prisma: PrismaClient) {
  console.log('Seeding ChatHistory...');
  const users = await prisma.user.findMany({ take: 10 });
  if (users.length === 0) return;
  const data = Array.from({ length: 10 }).map((_, i) => ({
    userId: users[i % users.length].id,
    role: i % 2 === 0 ? 'user' : 'assistant',
    content: 'This is a sample chat message ' + (i + 1),
  }));
  for (const item of data) {
    await prisma.chatHistory.create({ data: item });
  }
  console.log('ChatHistory seeded successfully.');
}
