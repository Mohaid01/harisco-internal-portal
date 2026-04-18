import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function checkLogs() {
  const logs = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log(JSON.stringify(logs, null, 2));
}

checkLogs().catch(console.error).finally(() => prisma.$disconnect());
