/**
 * Ensure geo/chambers for registry import and remove fictional seed lawyers
 * (rows without Minjust externalId).
 *
 * Usage:
 *   npx tsx scripts/prepare-registry-import.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CITIES = [
  {
    slug: "moscow",
    name: "Москва",
    nameGenitive: "Москвы",
    namePrepositional: "Москве",
    nameDative: "Москве",
    regionName: "г. Москва",
    regionCode: "77",
    population: 12_600_000,
    isMajor: true,
    latitude: 55.7558,
    longitude: 37.6173,
  },
  {
    slug: "tolyatti",
    name: "Тольятти",
    nameGenitive: "Тольятти",
    namePrepositional: "Тольятти",
    nameDative: "Тольятти",
    regionName: "Самарская область",
    regionCode: "63",
    population: 684_000,
    isMajor: true,
    latitude: 53.5303,
    longitude: 49.3461,
  },
] as const;

const CHAMBERS = [
  {
    slug: "ap-moscow",
    name: "Адвокатская палата города Москвы",
    regionCode: "77",
    address: "ул. Дмитровка Б., 32, стр. 1, Москва",
    website: "https://ap.moscow.ru",
  },
  {
    slug: "ap-samara",
    name: "Палата адвокатов Самарской области",
    regionCode: "63",
    address: "ул. Ленинградская, 75, Самара",
    website: "https://paso.ru",
  },
] as const;

async function main() {
  for (const city of CITIES) {
    await prisma.city.upsert({
      where: { slug: city.slug },
      create: { ...city },
      update: {
        name: city.name,
        nameGenitive: city.nameGenitive,
        namePrepositional: city.namePrepositional,
        nameDative: city.nameDative,
        regionName: city.regionName,
        regionCode: city.regionCode,
        population: city.population,
        isMajor: city.isMajor,
        latitude: city.latitude,
        longitude: city.longitude,
      },
    });
  }

  for (const chamber of CHAMBERS) {
    await prisma.advocateChamber.upsert({
      where: { regionCode: chamber.regionCode },
      create: { ...chamber },
      update: {
        slug: chamber.slug,
        name: chamber.name,
        address: chamber.address,
        website: chamber.website,
      },
    });
  }

  const demo = await prisma.lawyer.findMany({
    where: { externalId: null },
    select: { id: true, registryNumber: true, fullName: true },
  });

  if (demo.length > 0) {
    // Unlink demo lawyer users so delete does not violate unique userId
    await prisma.lawyer.updateMany({
      where: { externalId: null, userId: { not: null } },
      data: { userId: null, isClaimed: false, claimedAt: null },
    });
    const deleted = await prisma.lawyer.deleteMany({ where: { externalId: null } });
    console.log(`Removed ${deleted.count} demo lawyers (no EGRA externalId)`);
  } else {
    console.log("No demo lawyers to remove");
  }

  const cities = await prisma.city.findMany({ select: { id: true, slug: true } });
  for (const city of cities) {
    const active = await prisma.lawyer.count({
      where: {
        cityId: city.id,
        registryStatus: { in: ["ACTIVE", "UNKNOWN"] },
      },
    });
    await prisma.city.update({
      where: { id: city.id },
      data: { activeLawyersCount: active },
    });
  }

  console.log("Geo ready: moscow, tolyatti + chambers 77/63");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
