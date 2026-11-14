import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const city = await prisma.city.findUnique({ where: { slug: "tolyatti" } });
  if (!city) throw new Error("tolyatti missing");

  const lawyers = await prisma.lawyer.count({
    where: { cityId: city.id, registryStatus: { in: ["ACTIVE", "UNKNOWN"] } },
  });
  const withCases = await prisma.lawyer.count({
    where: { cityId: city.id, casesCount: { gt: 0 } },
  });
  const cases = await prisma.courtCase.count({
    where: { lawyer: { cityId: city.id } },
  });
  const courts = await prisma.court.findMany({
    where: { cityId: city.id },
    select: { slug: true, courtCode: true, name: true },
  });
  const sample = await prisma.lawyer.findMany({
    where: { cityId: city.id, casesCount: { gt: 0 } },
    select: {
      fullName: true,
      registryNumber: true,
      casesCount: true,
      totalRating: true,
      specializations: {
        select: { casesInCategory: true, isPrimary: true, category: { select: { slug: true } } },
      },
    },
    take: 5,
    orderBy: { casesCount: "desc" },
  });

  console.log(JSON.stringify({ lawyers, withCases, cases, courts, sample }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
