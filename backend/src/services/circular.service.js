import prisma from '../db/db.js';

/**
 * Structured retrieval from the circular alternatives knowledge base (no RAG).
 *
 * `material`, `waste` and `energy` name the current option to replace (e.g. `virgin_aluminum`,
 * `NATURAL_GAS`); alternatives whose current option matches any of them are returned. Without
 * filters the whole knowledge base is listed. Results are ordered by circularity score.
 */
export async function listAlternatives({ category, material, waste, energy } = {}) {
  const currentOptions = [material, waste, energy].filter(Boolean);
  return prisma.circularAlternative.findMany({
    where: {
      ...(category ? { category } : {}),
      ...(currentOptions.length ? { current_option: { in: currentOptions } } : {}),
    },
    orderBy: [{ circularity_score: 'desc' }, { id: 'asc' }],
  });
}
