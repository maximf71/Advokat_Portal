import { recalculateAllLawyerRatings } from "../src/lib/rating/calculator";

async function main() {
  const updated = await recalculateAllLawyerRatings();
  console.log(`Recalculated ratings for ${updated} lawyers`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    const { prisma } = await import("../src/lib/db/prisma");
    await prisma.$disconnect();
  });
