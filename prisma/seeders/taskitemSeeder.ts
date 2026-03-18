import { PrismaClient } from '@prisma/client';

export async function seedTaskItem(prisma: PrismaClient) {
  console.log('Seeding TaskItem...');
  const users = await prisma.user.findMany({ take: 10 });
  if (users.length === 0) return;
  const data = Array.from({ length: 10 }).map((_, i) => ({
    title: 'Task ' + (i + 1),
    description: 'Description for task ' + (i + 1),
    status: i % 3 === 0 ? 'todo' : i % 3 === 1 ? 'in_progress' : 'done',
    priority: i % 2 === 0 ? 'medium' : 'high',
    assigneeId: users[i % users.length].id,
    assigneeName: users[i % users.length].name,
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * (i + 1)),
    createdBy: users[0].id,
  }));
  for (const item of data) {
    await prisma.taskItem.create({ data: item });
  }
  console.log('TaskItem seeded successfully.');
}
