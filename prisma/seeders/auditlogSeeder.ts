import { PrismaClient } from '@prisma/client';

export async function seedAuditLog(prisma: PrismaClient) {
  console.log('Seeding AuditLog...');
  const users = await prisma.user.findMany({ take: 10 });
  if (users.length === 0) return;
  const data = Array.from({ length: 10 }).map((_, i) => ({
    userId: users[i % users.length].id,
    userName: users[i % users.length].name || 'Unknown',
    action: i % 2 === 0 ? 'CREATE' : 'UPDATE',
    entity: 'TaskItem',
    entityId: 'task-' + i,
    details: JSON.stringify({ field: 'value' + i }),
  }));
  for (const item of data) {
    await prisma.auditLog.create({ data: item });
  }
  console.log('AuditLog seeded successfully.');
}
