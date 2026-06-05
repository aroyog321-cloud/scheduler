const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const posts = await prisma.scheduledPost.findMany({ orderBy: { createdAt: 'desc' }, take: 5 });
  console.log(JSON.stringify(posts, null, 2));
}
main().finally(() => prisma.$disconnect());
