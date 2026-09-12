import { describe, expect, it } from 'vitest';
import { percentOf, summarizeEmissions } from '../src/services/emissionAnalytics.service.js';

const processes = [
  { id: 1, name: 'Furnace' },
  { id: 2, name: 'Boiler' },
  { id: 3, name: 'Packaging' },
];

const activity = (overrides) => ({
  production_quantity: null,
  production_unit: null,
  source: 'MANUAL',
  ...overrides,
  activity_date: new Date(`${overrides.date}T00:00:00Z`),
  emissions: overrides.co2e == null ? [] : [{ co2e_value: overrides.co2e, co2e_unit: overrides.co2eUnit ?? 'kgCO2e' }],
});

const activities = [
  activity({ id: 1, process_id: 1, date: '2026-07-10', energy_type: 'NATURAL_GAS', quantity: 300, unit: 'm3', co2e: 570, production_quantity: 8, production_unit: 'tonnes' }),
  activity({ id: 2, process_id: 1, date: '2026-09-01', energy_type: 'ELECTRICITY', quantity: 1000, unit: 'kWh', co2e: 700, source: 'CSV' }),
  activity({
    id: 3,
    process_id: 2,
    date: '2026-09-02',
    energy_type: 'DIESEL',
    quantity: 100,
    unit: 'L',
    co2e: 268,
    source: 'SIMULATION',
    production_quantity: 2000,
    production_unit: 'kg',
  }),
];

describe('summarizeEmissions', () => {
  const summary = summarizeEmissions({ activities, processes });

  it('reports totals in tCO2e from stored kgCO2e emissions', () => {
    expect(summary.co2eUnit).toBe('tCO2e');
    expect(summary.totals).toEqual({ co2e: 1.538, simulatedCo2e: 0.268, activityCount: 3, emissionCount: 3 });
  });

  it('ranks processes by contribution and keeps processes without emissions at 0%', () => {
    expect(summary.byProcess).toEqual([
      { processId: 1, process: 'Furnace', co2e: 1.27, activityCount: 2, percentage: 82.57 },
      { processId: 2, process: 'Boiler', co2e: 0.268, activityCount: 1, percentage: 17.43 },
      { processId: 3, process: 'Packaging', co2e: 0, activityCount: 0, percentage: 0 },
    ]);
  });

  it('breaks emissions down by emission source and by data source', () => {
    expect(summary.bySource).toEqual([
      { activityType: 'ELECTRICITY', label: 'Electricity', category: 'ENERGY', co2e: 0.7, percentage: 45.51 },
      { activityType: 'NATURAL_GAS', label: 'Natural gas', category: 'FUEL', co2e: 0.57, percentage: 37.06 },
      { activityType: 'DIESEL', label: 'Diesel', category: 'FUEL', co2e: 0.268, percentage: 17.43 },
    ]);
    expect(summary.byDataSource).toEqual([
      { source: 'MANUAL', isSimulated: false, co2e: 0.57, activityCount: 1, percentage: 37.06 },
      { source: 'CSV', isSimulated: false, co2e: 0.7, activityCount: 1, percentage: 45.51 },
      { source: 'SIMULATION', isSimulated: true, co2e: 0.268, activityCount: 1, percentage: 17.43 },
    ]);
  });

  it('combines mass production into tonnes and derives emission intensity', () => {
    expect(summary.production).toEqual({
      quantity: 10,
      unit: 'tonnes',
      byUnit: [
        { unit: 'tonnes', quantity: 8 },
        { unit: 'kg', quantity: 2000 },
      ],
    });
    expect(summary.intensity).toEqual({ value: 0.1538, unit: 'tCO2e/tonne' });
    expect(summary.warnings).toEqual([]);
  });

  it('builds a gap-filled monthly history', () => {
    expect(summary.history).toEqual([
      { period: '2026-07', co2e: 0.57 },
      { period: '2026-08', co2e: 0 },
      { period: '2026-09', co2e: 0.968 },
    ]);
  });

  it('builds energy consumption series for energy and fuel activities only, in catalog order', () => {
    expect(summary.energy.map(({ activityType, unit, total }) => ({ activityType, unit, total }))).toEqual([
      { activityType: 'ELECTRICITY', unit: 'kWh', total: 1000 },
      { activityType: 'NATURAL_GAS', unit: 'm3', total: 300 },
      { activityType: 'DIESEL', unit: 'L', total: 100 },
    ]);
    expect(summary.energy[1].history).toEqual([
      { period: '2026-07', quantity: 300 },
      { period: '2026-08', quantity: 0 },
      { period: '2026-09', quantity: 0 },
    ]);

    const withMaterial = summarizeEmissions({
      activities: [activity({ id: 9, process_id: 1, date: '2026-09-03', energy_type: 'STEEL', quantity: 2, unit: 'tonne', co2e: 3700 })],
      processes,
    });
    expect(withMaterial.energy).toEqual([]);
  });

  it('uses the requested range and granularity for the history', () => {
    const daily = summarizeEmissions({
      activities: activities.slice(1),
      processes,
      granularity: 'day',
      from: new Date('2026-08-31T00:00:00Z'),
      to: new Date('2026-09-03T00:00:00Z'),
    });
    expect(daily.history).toEqual([
      { period: '2026-08-31', co2e: 0 },
      { period: '2026-09-01', co2e: 0.7 },
      { period: '2026-09-02', co2e: 0.268 },
      { period: '2026-09-03', co2e: 0 },
    ]);
  });

  it('crosses year boundaries when gap-filling months', () => {
    const result = summarizeEmissions({
      activities: [
        activity({ id: 1, process_id: 1, date: '2025-11-30', energy_type: 'ELECTRICITY', quantity: 1, unit: 'kWh', co2e: 1000 }),
        activity({ id: 2, process_id: 1, date: '2026-02-01', energy_type: 'ELECTRICITY', quantity: 1, unit: 'kWh', co2e: 2000 }),
      ],
      processes,
    });
    expect(result.history.map((point) => point.period)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
  });

  it('returns zeros without NaN for an empty dataset', () => {
    const empty = summarizeEmissions({ activities: [], processes });
    expect(empty.totals).toEqual({ co2e: 0, simulatedCo2e: 0, activityCount: 0, emissionCount: 0 });
    expect(empty.byProcess.every((entry) => entry.percentage === 0 && entry.co2e === 0)).toBe(true);
    expect(empty.bySource).toEqual([]);
    expect(empty.history).toEqual([]);
    expect(empty.production).toEqual({ quantity: 0, unit: null, byUnit: [] });
    expect(empty.intensity).toEqual({ value: null, unit: null });
    expect(empty.warnings).toEqual([]);
  });

  it('flags activities without a stored emission instead of counting them', () => {
    const result = summarizeEmissions({
      activities: [
        ...activities,
        activity({ id: 4, process_id: 2, date: '2026-09-03', energy_type: 'LPG', quantity: 10, unit: 'kg', co2e: null }),
      ],
      processes,
    });
    expect(result.totals).toMatchObject({ co2e: 1.538, activityCount: 4, emissionCount: 3 });
    expect(result.warnings).toEqual([
      { code: 'MISSING_EMISSIONS', message: '1 activity has no calculated emission and is excluded from the totals.' },
    ]);
  });

  it('excludes emissions in a CO2e unit it cannot convert', () => {
    const result = summarizeEmissions({
      activities: [
        activity({ id: 1, process_id: 1, date: '2026-09-01', energy_type: 'ELECTRICITY', quantity: 1, unit: 'kWh', co2e: 2, co2eUnit: 'tCO2e' }),
        activity({ id: 2, process_id: 1, date: '2026-09-01', energy_type: 'ELECTRICITY', quantity: 1, unit: 'kWh', co2e: 5, co2eUnit: 'lbCO2e' }),
      ],
      processes,
    });
    expect(result.totals.co2e).toBe(2);
    expect(result.warnings.map((warning) => warning.code)).toContain('UNSUPPORTED_CO2E_UNIT');
  });

  it('reports intensity per unit when production is counted in units', () => {
    const result = summarizeEmissions({
      activities: [
        activity({
          id: 1,
          process_id: 1,
          date: '2026-09-01',
          energy_type: 'ELECTRICITY',
          quantity: 1000,
          unit: 'kWh',
          co2e: 700,
          production_quantity: 350,
          production_unit: 'units',
        }),
      ],
      processes,
    });
    expect(result.production).toMatchObject({ quantity: 350, unit: 'units' });
    expect(result.intensity).toEqual({ value: 0.002, unit: 'tCO2e/unit' });
  });

  it('does not calculate intensity when production mixes mass and count units', () => {
    const result = summarizeEmissions({
      activities: [
        activity({ id: 1, process_id: 1, date: '2026-09-01', energy_type: 'ELECTRICITY', quantity: 1, unit: 'kWh', co2e: 1, production_quantity: 5, production_unit: 'tonnes' }),
        activity({ id: 2, process_id: 2, date: '2026-09-01', energy_type: 'ELECTRICITY', quantity: 1, unit: 'kWh', co2e: 1, production_quantity: 40, production_unit: 'units' }),
      ],
      processes,
    });
    expect(result.production.quantity).toBeNull();
    expect(result.intensity.value).toBeNull();
    expect(result.warnings.map((warning) => warning.code)).toEqual(['MIXED_PRODUCTION_UNITS']);
  });

  it('warns when no production is recorded', () => {
    const result = summarizeEmissions({ activities: activities.slice(1, 2), processes });
    expect(result.intensity.value).toBeNull();
    expect(result.warnings.map((warning) => warning.code)).toEqual(['NO_PRODUCTION']);
  });

  it('is deterministic regardless of row order', () => {
    const reversed = summarizeEmissions({ activities: [...activities].reverse(), processes });
    expect(reversed).toEqual(summary);
    expect(summarizeEmissions({ activities, processes })).toEqual(summary);
  });
});

describe('percentOf', () => {
  it('never divides by zero', () => {
    expect(percentOf(0, 0)).toBe(0);
    expect(percentOf(5, 0)).toBe(0);
  });

  it('rounds to two decimals', () => {
    expect(percentOf(1, 3)).toBe(33.33);
  });
});
