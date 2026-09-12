import prisma from '../db/db.js';

/**
 * 1. Find valid emission factor.
 * @param {string} category 
 * @param {string} fuelType 
 * @param {string} unit 
 * @returns {Promise<object>} The matching EmissionFactor record
 */
export async function findEmissionFactor(category, fuelType, unit) {
  if (!category || !unit) {
    throw new Error('Category and unit are required to find an emission factor.');
  }

  const factor = await prisma.emissionFactor.findFirst({
    where: {
      category,
      fuel_type: fuelType || null,
      unit,
    },
    orderBy: {
      year: 'desc' // get the most recent factor if multiple exist
    }
  });

  if (!factor) {
    throw new Error(`No emission factor found for category: ${category}, fuel_type: ${fuelType}, unit: ${unit}`);
  }

  return factor;
}
