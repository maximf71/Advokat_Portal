/**
 * Upsert courts needed for Tolyatti GAS + KAD case import.
 */
import { PrismaClient, CourtType } from "@prisma/client";

const prisma = new PrismaClient();

const COURTS: Array<{
  slug: string;
  courtCode: string;
  name: string;
  courtType: CourtType;
  citySlug: string;
  website?: string;
}> = [
  {
    slug: "as-samara",
    courtCode: "A55", // номерной префикс дел АС Самарской области в КАД
    name: "Арбитражный суд Самарской области",
    courtType: CourtType.ARBITRATION,
    citySlug: "tolyatti",
    website: "https://samara.arbitr.ru",
  },
  {
    slug: "avtozavodsky-tolyatti",
    courtCode: "SOYU-TLT-AVT",
    name: "Автозаводский районный суд г. Тольятти",
    courtType: CourtType.GENERAL,
    citySlug: "tolyatti",
    website: "https://avtozavodsky.sam.sudrf.ru",
  },
  {
    slug: "centralny-tolyatti",
    courtCode: "SOYU-TLT-CEN",
    name: "Центральный районный суд г. Тольятти",
    courtType: CourtType.GENERAL,
    citySlug: "tolyatti",
    website: "https://centralny.sam.sudrf.ru",
  },
  {
    slug: "komsomolsky-tolyatti",
    courtCode: "SOYU-TLT-KOM",
    name: "Комсомольский районный суд г. Тольятти",
    courtType: CourtType.GENERAL,
    citySlug: "tolyatti",
    website: "https://komsomolsky.sam.sudrf.ru",
  },
  {
    slug: "samara-oblastnoj",
    courtCode: "SOYU-SAM-OBL",
    name: "Самарский областной суд",
    courtType: CourtType.GENERAL,
    citySlug: "tolyatti",
    website: "https://oblsud.sam.sudrf.ru",
  },
];

export async function ensureTolyattiCourts() {
  const cities = await prisma.city.findMany({ select: { id: true, slug: true } });
  const cityBySlug = new Map(cities.map((c) => [c.slug, c.id]));

  let upserted = 0;
  for (const c of COURTS) {
    const cityId = cityBySlug.get(c.citySlug);
    if (!cityId) {
      console.warn(`City ${c.citySlug} missing — skip court ${c.slug}`);
      continue;
    }
    await prisma.court.upsert({
      where: { slug: c.slug },
      create: {
        slug: c.slug,
        courtCode: c.courtCode,
        name: c.name,
        courtType: c.courtType,
        website: c.website,
        cityId,
      },
      update: {
        courtCode: c.courtCode,
        name: c.name,
        courtType: c.courtType,
        website: c.website,
        cityId,
      },
    });
    upserted += 1;
  }
  return upserted;
}

async function main() {
  const n = await ensureTolyattiCourts();
  console.log(`Courts upserted: ${n}`);
}

const entry = process.argv[1]?.replace(/\\/g, "/") ?? "";
if (entry.endsWith("ensure-courts.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
