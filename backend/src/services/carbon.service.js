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

/**
 * 3. Process activity and store emission result.
 * @param {number} activityId 
 * @returns {Promise<object>} The created Emission record
 */
export async function processActivityEmission(activityId) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      process: true
    }
  });

  if (!activity) {
    throw new Error(`Activity with id ${activityId} not found.`);
  }

  let factor;
  try {
    factor = await findEmissionFactor('Energy', activity.energy_type, activity.unit);
  } catch (err) {
    // Try finding where category is the energy_type directly
    try {
      factor = await findEmissionFactor(activity.energy_type, null, activity.unit);
    } catch (innerErr) {
      throw new Error(`Could not find emission factor for activity ${activityId}: ${err.message}`);
    }
  }

  const co2eValue = calculateEmissionValue(
    activity.quantity,
    factor.factor,
    activity.unit,
    factor.unit
  );

  const calculationMethod = 'Deterministic: Quantity * Factor';

  const emission = await prisma.emission.create({
    data: {
      activity_id: activity.id,
      emission_factor_id: factor.id,
      co2e_value: co2eValue,
      co2e_unit: factor.co2e_unit || 'kgCO2e',
      calculation_method: calculationMethod
    }
  });

  return emission;
}
