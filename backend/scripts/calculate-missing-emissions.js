// Calculates emissions for activities that have none — e.g. activities ingested before the
// carbon engine was connected to ingestion. Idempotent: activities that already have an
// emission are skipped, so it is safe to re-run.  Usage: npm run emissions:backfill
import 'dotenv/config';
import prisma from '../src/db/db.js';
import { processActivityEmission } from '../src/services/carbon.service.js';

const BATCH_SIZE = 200;

async function main() {
  let calculated = 0;
  let cursor = 0;
  const failures = [];

  for (;;) {
    const batch = await prisma.activity.findMany({
      where: { id: { gt: cursor }, emissions: { none: {} } },
      select: { id: true },
      orderBy: { id: 'asc' },
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const { id } of batch) {
      try {
        await processActivityEmission(id);
        calculated += 1;
      } catch (error) {
        failures.push(`activity #${id}: ${error.message}`);
      }
    }
    cursor = batch[batch.length - 1].id;
  }

  console.log(`Emissions calculated: ${calculated}`);
  if (failures.length) console.error(`Not calculated (${failures.length}):\n  ${failures.join('\n  ')}`);
  return failures.length ? 1 : 0;
}

main()
  .then(async (code) => {
    await prisma.$disconnect();
    process.exit(code);
  })
  .catch(async (error) => {
    console.error('Backfill failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
