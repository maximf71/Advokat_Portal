import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const cities = await prisma.city.findMany({
    where: { slug: { in: ["moscow", "tolyatti"] } },
    select: { slug: true, name: true, activeLawyersCount: true },
  });
  console.log("cities:", cities);

  const total = await prisma.lawyer.count();
  const withExternal = await prisma.lawyer.count({ where: { externalId: { not: null } } });
  console.log({ total, withExternal });

  const moscow = await prisma.lawyer.findFirst({
    where: { city: { slug: "moscow" }, registryStatus: "ACTIVE" },
    select: { slug: true, fullName: true, registryNumber: true, externalId: true },
  });
  const tolyatti = await prisma.lawyer.findFirst({
    where: { city: { slug: "tolyatti" }, registryStatus: "ACTIVE" },
    select: {
      slug: true,
      fullName: true,
      registryNumber: true,
      officeAddress: true,
    },
  });
  console.log("moscow sample:", moscow);
  console.log("tolyatti sample:", tolyatti);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
