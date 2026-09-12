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

/**
 * 2. Validate compatible unit & Multiply quantity by factor.
 * @param {number} quantity 
 * @param {number} factorValue 
 * @param {string} inputUnit 
 * @param {string} factorUnit 
 * @returns {number} The calculated CO2e value
 */
export function calculateEmissionValue(quantity, factorValue, inputUnit, factorUnit) {
  if (quantity < 0) {
    throw new Error('Quantity cannot be negative.');
  }
  
  if (inputUnit !== factorUnit) {
    throw new Error(`Incompatible units. Input unit: ${inputUnit}, Factor unit: ${factorUnit}`);
  }

  // Deterministic math
  return quantity * factorValue;
}
