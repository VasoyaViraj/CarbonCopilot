import prisma from '../db/db.js';

/**
 * Find circular alternatives matching process, material, waste, or energy inputs.
 * This is designed to be easily wrapped as an MCP tool later.
 * 
 * @param {Object} params
 * @param {number} params.factoryId 
 * @param {number} params.processId 
 * @param {string} [params.material] 
 * @param {string} [params.waste] 
 * @param {string} [params.energy] 
 * @returns {Promise<Array>} List of matching circular alternatives
 */
export async function findCircularAlternatives({ factoryId, processId, material, waste, energy }) {
  if (!factoryId) {
    throw new Error('factoryId is required to find circular alternatives.');
  }

  // We build a list of conditions to match against the 'current_option'
  const searchOptions = [];

  if (material) {
    searchOptions.push(material);
  }
  if (waste) {
    searchOptions.push(waste);
  }
  if (energy) {
    searchOptions.push(energy);
  }

  // If specific parameters are provided, find matching alternatives
  if (searchOptions.length > 0) {
    const alternatives = await prisma.circularAlternative.findMany({
      where: {
        current_option: {
          in: searchOptions
        }
      },
      orderBy: {
        circularity_score: 'desc'
      }
    });

    return alternatives;
  }

  // Fallback: If no specific search terms are provided, but factory/process are,
  // we could theoretically look up factory materials/wastes/activities and match them.
  // For now, we will return top generic alternatives for the factory.
  const genericAlternatives = await prisma.circularAlternative.findMany({
    take: 5,
    orderBy: {
      circularity_score: 'desc'
    }
  });

  return genericAlternatives;
}
