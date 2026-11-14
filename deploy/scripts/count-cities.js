const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
prisma.city
  .count()
  .then((c) => {
    process.stdout.write(String(c));
    return prisma.$disconnect();
  })
  .catch(async () => {
    process.stdout.write("0");
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
    process.exit(0);
  });
