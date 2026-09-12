import { beforeEach, describe, it, expect, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({ current: null }));
vi.mock('../src/db/db.js', async () => {
  const { createPrismaMock } = await import('./helpers/prismaMock.js');
  prismaMock.current = createPrismaMock();
  return { default: prismaMock.current };
});

const {
  CALCULATION_METHOD,
  calculateEmissionValue,
  calculateEmissions,
  findEmissionFactor,
  processActivityEmission,
  resolveEmissionFactors,
} = await import('../src/services/carbon.service.js');
const prisma = prismaMock.current;

const gas2025 = {
  id: 4,
  category: 'FUEL',
  fuel_type: 'NATURAL_GAS',
  unit: 'm3',
  factor: 1.85,
  co2e_unit: 'kgCO2e',
  region: 'GLOBAL-DEMO',
  year: 2025,
  reference: 'Illustrative demo factor',
};
const gas2026 = { ...gas2025, id: 5, factor: 1.9, year: 2026 };
const electricity = { ...gas2025, id: 1, category: 'ENERGY', fuel_type: 'ELECTRICITY', unit: 'kWh', factor: 0.7, year: 2026 };

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
});

describe('Carbon Engine - Deterministic Calculations', () => {
  describe('calculateEmissionValue', () => {
    it('should correctly multiply integers', () => {
      expect(calculateEmissionValue(10, 2, 'kWh', 'kWh')).toBe(20);
    });

    it('should correctly multiply decimals', () => {
      expect(calculateEmissionValue(10.5, 0.7, 'kWh', 'kWh')).toBeCloseTo(7.35);
    });

    it('should handle zero quantity', () => {
      expect(calculateEmissionValue(0, 0.7, 'kWh', 'kWh')).toBe(0);
    });

    it('should throw error on invalid negative values', () => {
      expect(() => calculateEmissionValue(-10, 0.7, 'kWh', 'kWh')).toThrowError('Quantity cannot be negative');
    });

    it('should throw error on non-finite quantities or factors', () => {
      expect(() => calculateEmissionValue(Number.NaN, 0.7, 'kWh', 'kWh')).toThrowError('finite');
      expect(() => calculateEmissionValue(10, Number.POSITIVE_INFINITY, 'kWh', 'kWh')).toThrowError('non-negative number');
    });

    it('should throw error on unsupported/mismatched units', () => {
      expect(() => calculateEmissionValue(10, 0.7, 'm3', 'kWh')).toThrowError('Incompatible units');
    });

    it('should be deterministic and repeatable', () => {
      expect(calculateEmissionValue(123.45, 0.678, 'L', 'L')).toBe(calculateEmissionValue(123.45, 0.678, 'L', 'L'));
    });
  });

  describe('findEmissionFactor', () => {
    it('looks up by catalog category, type and unit — newest year first, id as tie-break', async () => {
      prisma.emissionFactor.findFirst.mockResolvedValue(gas2026);
      await expect(findEmissionFactor({ activityType: 'NATURAL_GAS', unit: 'm3' })).resolves.toBe(gas2026);

      expect(prisma.emissionFactor.findFirst).toHaveBeenCalledWith({
        where: { category: 'FUEL', fuel_type: 'NATURAL_GAS', unit: 'm3' },
        orderBy: [{ year: { sort: 'desc', nulls: 'last' } }, { id: 'desc' }],
      });
    });

    it('fails with VALIDATION_ERROR when no factor is configured (missing factor)', async () => {
      prisma.emissionFactor.findFirst.mockResolvedValue(null);
      await expect(findEmissionFactor({ activityType: 'NATURAL_GAS', unit: 'm3' })).rejects.toMatchObject({
        status: 400,
        code: 'VALIDATION_ERROR',
        message: 'No emission factor is configured for NATURAL_GAS in m3',
      });
    });

    it('rejects unsupported activity types without querying', async () => {
      await expect(findEmissionFactor({ activityType: 'COAL', unit: 'tonne' })).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(prisma.emissionFactor.findFirst).not.toHaveBeenCalled();
    });

    it('accepts an explicitly chosen factor only if it matches the type and unit', async () => {
      prisma.emissionFactor.findUnique.mockResolvedValueOnce(gas2025).mockResolvedValueOnce(electricity);
      await expect(findEmissionFactor({ activityType: 'NATURAL_GAS', unit: 'm3', emissionFactorId: 4 })).resolves.toBe(gas2025);
      await expect(findEmissionFactor({ activityType: 'NATURAL_GAS', unit: 'm3', emissionFactorId: 1 })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('calculateEmissions (MCP-ready, no persistence)', () => {
    it('returns the activity, factor, quantity, unit, CO2e and method', async () => {
      prisma.emissionFactor.findFirst.mockResolvedValue(gas2026);
      const result = await calculateEmissions({ activityType: 'NATURAL_GAS', quantity: 300, unit: 'm3' });

      expect(result).toEqual({
        activityType: 'NATURAL_GAS',
        quantity: 300,
        unit: 'm3',
        emissionFactorId: 5,
        factor: 1.9,
        factorUnit: 'kgCO2e/m3',
        factorSource: { region: 'GLOBAL-DEMO', year: 2026, reference: 'Illustrative demo factor' },
        co2eValue: 570,
        co2eUnit: 'kgCO2e',
        calculationMethod: CALCULATION_METHOD,
      });
      expect(await calculateEmissions({ activityType: 'NATURAL_GAS', quantity: 300, unit: 'm3' })).toEqual(result);
      expect(prisma.emission.create).not.toHaveBeenCalled();
    });

    it('rejects a unit that has no factor for the activity type', async () => {
      prisma.emissionFactor.findFirst.mockResolvedValue(null);
      await expect(calculateEmissions({ activityType: 'NATURAL_GAS', quantity: 300, unit: 'kWh' })).rejects.toMatchObject({
        code: 'VALIDATION_ERROR',
      });
    });
  });

  describe('processActivityEmission', () => {
    it('stores the emission with its factor and method, replacing any earlier result', async () => {
      prisma.activity.findUnique.mockResolvedValue({ id: 101, energy_type: 'NATURAL_GAS', unit: 'm3', quantity: 300 });
      prisma.emissionFactor.findFirst.mockResolvedValue(gas2026);
      prisma.emission.create.mockImplementation(async ({ data }) => ({ id: 9, ...data }));

      const emission = await processActivityEmission(101);

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.emission.deleteMany).toHaveBeenCalledWith({ where: { activity_id: 101 } });
      expect(prisma.emission.create).toHaveBeenCalledWith({
        data: { activity_id: 101, emission_factor_id: 5, co2e_value: 570, co2e_unit: 'kgCO2e', calculation_method: CALCULATION_METHOD },
      });
      expect(prisma.emission.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(prisma.emission.create.mock.invocationCallOrder[0]);
      expect(emission.co2e_value).toBe(570);
    });

    it('reports a missing activity as NOT_FOUND', async () => {
      prisma.activity.findUnique.mockResolvedValue(null);
      await expect(processActivityEmission(404)).rejects.toMatchObject({ status: 404, code: 'NOT_FOUND' });
      expect(prisma.emission.create).not.toHaveBeenCalled();
    });
  });

  describe('resolveEmissionFactors', () => {
    it('resolves many pairs in one query, keeping the newest factor per pair', async () => {
      prisma.emissionFactor.findMany.mockResolvedValue([gas2026, electricity, gas2025]);
      const factors = await resolveEmissionFactors([
        { activityType: 'NATURAL_GAS', unit: 'm3' },
        { activityType: 'ELECTRICITY', unit: 'kWh' },
        { activityType: 'NATURAL_GAS', unit: 'm3' },
      ]);

      expect(prisma.emissionFactor.findMany).toHaveBeenCalledTimes(1);
      expect(factors.get('NATURAL_GAS|m3')).toBe(gas2026);
      expect(factors.get('ELECTRICITY|kWh')).toBe(electricity);
    });
  });
});
