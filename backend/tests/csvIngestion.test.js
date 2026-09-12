import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const prismaMock = vi.hoisted(() => ({ current: null }));
vi.mock('../src/db/db.js', async () => {
  const { createPrismaMock } = await import('./helpers/prismaMock.js');
  prismaMock.current = createPrismaMock();
  return { default: prismaMock.current };
});

const { default: app } = await import('../src/app.js');
const { REQUIRED_COLUMNS } = await import('../src/services/csvIngestion.service.js');
const { CALCULATION_METHOD } = await import('../src/services/carbon.service.js');
const prisma = prismaMock.current;

const bearer = `Bearer ${jwt.sign({}, process.env.JWT_SECRET, { subject: '5', algorithm: 'HS256' })}`;
const asUser = (role = 'FACTORY_OPERATOR', organizationId = 1) =>
  prisma.user.findUnique.mockResolvedValue({ id: 5, name: 'U', email: 'u@example.com', role, organization_id: organizationId });

const factor = (id, category, fuel_type, unit, value) => ({ id, category, fuel_type, unit, factor: value, co2e_unit: 'kgCO2e', year: 2026 });
const SEED_FACTORS = [
  factor(1, 'ENERGY', 'ELECTRICITY', 'kWh', 0.7),
  factor(2, 'FUEL', 'NATURAL_GAS', 'm3', 1.9),
  factor(3, 'FUEL', 'DIESEL', 'L', 2.68),
  factor(5, 'MATERIAL', 'VIRGIN_ALUMINUM', 'tonne', 11500),
  factor(8, 'WASTE', 'WASTE_LANDFILL', 'tonne', 470),
];

const FULL_HEADER =
  'date,process,energy,energy_type,energy_unit,fuel,fuel_type,fuel_unit,material,material_type,material_unit,waste,waste_type,waste_unit,production,production_unit';
const HEADER = 'date,process,energy,fuel,fuel_type,material,production,waste';
const csv = (...lines) => `${lines.join('\n')}\n`;

const upload = ({ body, filename = 'activities.csv', contentType = 'text/csv', fields = {} }) => {
  let req = request(app).post('/api/activities/upload').set('Authorization', bearer);
  for (const [key, value] of Object.entries({ factoryId: '3', ...fields })) req = req.field(key, String(value));
  if (body !== undefined) req = req.attach('file', Buffer.from(body), { filename, contentType });
  return req;
};

const detail = (row, field) => expect.objectContaining({ row, field });

beforeEach(() => {
  vi.clearAllMocks();
  asUser();
  prisma.$transaction.mockImplementation(async (fn) => fn(prisma));
  prisma.factory.findFirst.mockResolvedValue({ id: 3, organization_id: 1 });
  prisma.process.findMany.mockResolvedValue([
    { id: 9, name: 'Furnace' },
    { id: 10, name: 'Boiler' },
    { id: 11, name: 'Transport' },
    { id: 12, name: 'Waste' },
  ]);
  prisma.activity.findMany.mockResolvedValue([]);
  prisma.emissionFactor.findMany.mockResolvedValue(SEED_FACTORS);
  prisma.activity.createManyAndReturn.mockImplementation(async ({ data }) => data.map((row, index) => ({ id: 500 + index, ...row })));
  prisma.emission.createMany.mockImplementation(async ({ data }) => ({ count: data.length }));
});

describe('POST /api/activities/upload — valid files', () => {
  const file = csv(
    FULL_HEADER,
    '2026-09-01,Furnace,1200,ELECTRICITY,kWh,300,NATURAL_GAS,m3,,,,,,,8,tonnes',
    '2026-09-01,transport,,,,40,Diesel,litres,,,,,,,,'
  );

  it('validates without writing on a dry run and estimates CO2e with the carbon engine', async () => {
    const res = await upload({ body: file, fields: { dryRun: 'true' } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      fileName: 'activities.csv',
      dryRun: true,
      imported: false,
      totalRows: 2,
      validRows: 2,
      invalidRows: 0,
      activityCount: 3,
      errors: [],
    });
    expect(res.body.data.co2e.unit).toBe('kgCO2e');
    expect(res.body.data.co2e.value).toBeCloseTo(840 + 570 + 107.2);
    expect(res.body.data.preview[0]).toMatchObject({
      row: 2,
      processName: 'Furnace',
      energyType: 'ELECTRICITY',
      productionQuantity: 8,
      co2eValue: 840,
      co2eUnit: 'kgCO2e',
    });
    expect(prisma.factory.findFirst).toHaveBeenCalledWith({ where: { id: 3, organization_id: 1 } });
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.activity.createManyAndReturn).not.toHaveBeenCalled();
    expect(prisma.emission.createMany).not.toHaveBeenCalled();
  });

  it('imports activities and their emissions in one transaction, recording production once per row', async () => {
    const res = await upload({ body: file });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ imported: true, validRows: 2, activityCount: 3 });
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(prisma.activity.createManyAndReturn).toHaveBeenCalledTimes(1);
    const day = new Date('2026-09-01T00:00:00.000Z');
    expect(prisma.activity.createManyAndReturn.mock.calls[0][0].data).toEqual([
      { process_id: 9, activity_date: day, energy_type: 'ELECTRICITY', quantity: 1200, unit: 'kWh', production_quantity: 8, production_unit: 'tonnes', source: 'CSV' },
      { process_id: 9, activity_date: day, energy_type: 'NATURAL_GAS', quantity: 300, unit: 'm3', production_quantity: null, production_unit: null, source: 'CSV' },
      { process_id: 11, activity_date: day, energy_type: 'DIESEL', quantity: 40, unit: 'L', production_quantity: null, production_unit: null, source: 'CSV' },
    ]);
    const method = { co2e_unit: 'kgCO2e', calculation_method: CALCULATION_METHOD };
    expect(prisma.emission.createMany.mock.calls[0][0].data).toEqual([
      { activity_id: 500, emission_factor_id: 1, co2e_value: 840, ...method },
      { activity_id: 501, emission_factor_id: 2, co2e_value: 570, ...method },
      { activity_id: 502, emission_factor_id: 3, co2e_value: expect.closeTo(107.2), ...method },
    ]);
  });

  it('accepts the minimal contract header and ignores blank lines', async () => {
    const res = await upload({
      body: csv('Date, Process ,Energy,Fuel,Material,Production,Waste', '2026-09-01,Boiler,500,,,,', ',,,,,,', ''),
      fields: { dryRun: 'true' },
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ totalRows: 1, validRows: 1 });
    expect(res.body.data.preview[0]).toMatchObject({ energyType: 'ELECTRICITY', unit: 'kWh' });
  });

  it('imports the downloadable template as-is for the demo processes', async () => {
    const template = await readFile(new URL('../../data/templates/activities-template.csv', import.meta.url));
    const res = await upload({ body: template, fields: { dryRun: 'true' } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ totalRows: 3, invalidRows: 0 });
  });
});

describe('POST /api/activities/upload — row-level validation', () => {
  const mixed = csv(
    HEADER,
    '2026-09-01,Furnace,1200,300,NATURAL_GAS,,8,',
    '2026-09-01,Kiln,100,,,,,',
    '2026-09-02,Furnace,-5,,,,,',
    '2026-13-01,Furnace,100,,,,,',
    '2026-09-03,Furnace,"1,200",,,,,',
    '2026-09-04,Boiler,,50,,,,',
    '2026-09-05,Boiler,,50,ELECTRICITY,,,',
    '2026-09-06,Boiler,,,,,5,',
    '2026-09-07,Boiler,10'
  );

  it('rejects the whole file with row-level errors when any row is invalid', async () => {
    const res = await upload({ body: mixed });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toMatch(/8 of 9 rows are invalid/);
    const { details } = res.body.error;
    expect(details).toEqual(
      expect.arrayContaining([
        detail(3, 'process'),
        detail(4, 'energy'),
        detail(5, 'date'),
        expect.objectContaining({ row: 6, field: 'energy', message: expect.stringMatching(/thousands separators/) }),
        detail(7, 'fuel_type'),
        detail(8, 'fuel_type'),
        detail(9, 'row'),
        detail(10, 'row'),
      ])
    );
    expect(details.some((d) => d.row === 2)).toBe(false);
    expect(prisma.activity.createManyAndReturn).not.toHaveBeenCalled();
    expect(prisma.emission.createMany).not.toHaveBeenCalled();
  });

  it('reports the same errors on a dry run', async () => {
    const res = await upload({ body: mixed, fields: { dryRun: 'true' } });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ totalRows: 9, validRows: 1, invalidRows: 8, activityCount: 2 });
    expect(res.body.data.errors).toEqual(expect.arrayContaining([detail(3, 'process'), detail(9, 'row')]));
  });

  it('imports only the valid rows when skipInvalidRows is set', async () => {
    const res = await upload({ body: mixed, fields: { skipInvalidRows: 'true' } });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ imported: true, validRows: 1, invalidRows: 8, activityCount: 2 });
    expect(prisma.activity.createManyAndReturn.mock.calls[0][0].data.map((a) => a.energy_type)).toEqual(['ELECTRICITY', 'NATURAL_GAS']);
    expect(prisma.emission.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it('refuses rows that duplicate existing activities or earlier rows', async () => {
    prisma.activity.findMany.mockResolvedValue([
      { id: 55, process_id: 9, activity_date: new Date('2026-09-01T00:00:00Z'), energy_type: 'ELECTRICITY', quantity: 1200 },
    ]);
    const res = await upload({
      body: csv(HEADER, '2026-09-01,Furnace,1200,,,,,', '2026-09-02,Furnace,500,,,,,', '2026-09-02,Furnace,500,,,,,'),
      fields: { dryRun: 'true' },
    });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ validRows: 1, invalidRows: 2 });
    expect(res.body.data.errors).toEqual([
      { row: 2, field: 'energy', message: 'Already imported: matches existing activity #55' },
      { row: 4, field: 'energy', message: 'Duplicates row 3 (same date, process, type and quantity)' },
    ]);
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ process_id: { in: [9] } }) })
    );
  });

  it('rejects rows whose activity type has no emission factor configured', async () => {
    prisma.emissionFactor.findMany.mockResolvedValue(SEED_FACTORS.filter((f) => f.fuel_type !== 'DIESEL'));
    const res = await upload({
      body: csv(HEADER, '2026-09-01,Transport,,40,DIESEL,,,', '2026-09-01,Furnace,100,,,,,'),
      fields: { dryRun: 'true' },
    });

    expect(res.body.data).toMatchObject({ validRows: 1, invalidRows: 1 });
    expect(res.body.data.errors).toEqual([{ row: 2, field: 'fuel', message: 'No emission factor is configured for DIESEL in L' }]);
  });

  it('rejects process names that match more than one process', async () => {
    prisma.process.findMany.mockResolvedValue([
      { id: 9, name: 'Furnace' },
      { id: 13, name: 'furnace' },
    ]);
    const res = await upload({ body: csv(HEADER, '2026-09-01,FURNACE,100,,,,,'), fields: { dryRun: 'true' } });

    expect(res.body.data.errors).toEqual([detail(2, 'process')]);
  });

  it('rejects units that do not match the activity type', async () => {
    const res = await upload({
      body: csv(FULL_HEADER, '2026-09-01,Furnace,5,ELECTRICITY,MWh,,,,,,,,,,,'),
      fields: { dryRun: 'true' },
    });

    expect(res.body.data.errors).toEqual([expect.objectContaining({ row: 2, field: 'energy_unit', message: 'Unit for ELECTRICITY must be kWh' })]);
  });
});

describe('POST /api/activities/upload — file-level validation', () => {
  it.each([
    ['a missing required column', csv('date,process,energy,fuel,material,production', '2026-09-01,Furnace,1,,,'), 'waste'],
    ['an unknown (misspelt) column', csv(`${HEADER},fule`, '2026-09-01,Furnace,1,,,,,,'), 'fule'],
  ])('rejects %s before reading rows', async (_label, body, field) => {
    const res = await upload({ body });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('The CSV header is invalid');
    expect(res.body.error.details).toEqual(expect.arrayContaining([expect.objectContaining({ field })]));
    expect(prisma.process.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['a header-only file', csv(HEADER), /no data rows/],
    ['an empty file', '', /empty/],
    ['an unclosed quote', csv(HEADER, '2026-09-01,"Furnace,1,,,,,'), /could not be parsed/],
    ['binary content', ' PK', /not a text CSV/],
  ])('rejects %s', async (_label, body, message) => {
    const res = await upload({ body });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(message);
    expect(prisma.activity.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects files over the row limit', async () => {
    const rows = Array.from({ length: 5001 }, (_, i) => `2026-09-01,Furnace,${i + 1},,,,,`);
    const res = await upload({ body: csv(HEADER, ...rows) });

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/limit is 5000/);
  });

  it('rejects non-CSV files', async () => {
    const res = await upload({ body: 'x', filename: 'activities.xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toBe('Only .csv files are accepted');
  });

  it('requires a file', async () => {
    const res = await upload({});
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'file', message: 'Attach a .csv file' }]);
  });

  it('rejects oversized uploads with PAYLOAD_TOO_LARGE', async () => {
    const res = await upload({ body: 'a'.repeat(5 * 1024 * 1024 + 1) });
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects invalid form fields', async () => {
    const res = await upload({ body: csv(HEADER, '2026-09-01,Furnace,1,,,,,'), fields: { dryRun: 'yes' } });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: 'dryRun' })]);
  });
});

describe('POST /api/activities/upload — authorization', () => {
  it.each(['CONSULTANT', 'REGULATOR'])('forbids %s', async (role) => {
    asUser(role);
    const res = await upload({ body: csv(HEADER, '2026-09-01,Furnace,1,,,,,') });

    expect(res.status).toBe(403);
    expect(prisma.process.findMany).not.toHaveBeenCalled();
  });

  it('treats another organization’s factory as NOT_FOUND', async () => {
    prisma.factory.findFirst.mockResolvedValue(null);
    const res = await upload({ body: csv(HEADER, '2026-09-01,Furnace,1,,,,,'), fields: { factoryId: '20' } });

    expect(res.status).toBe(404);
    expect(prisma.process.findMany).not.toHaveBeenCalled();
    expect(prisma.activity.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('requires a factory ID', async () => {
    const res = await request(app)
      .post('/api/activities/upload')
      .set('Authorization', bearer)
      .attach('file', Buffer.from(csv(HEADER)), { filename: 'a.csv', contentType: 'text/csv' });
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ field: 'factoryId' })]);
  });
});

describe('CSV template and format', () => {
  it('serves the same template that is committed under data/templates', async () => {
    const committed = await readFile(new URL('../../data/templates/activities-template.csv', import.meta.url), 'utf8');
    const res = await request(app).get('/api/activities/template').set('Authorization', bearer);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="ecotrace-activities-template.csv"/);
    expect(res.text).toBe(committed);
  });

  it('describes the CSV format in the activity catalog', async () => {
    const res = await request(app).get('/api/activities/types').set('Authorization', bearer);
    expect(res.body.data.csv).toMatchObject({ requiredColumns: REQUIRED_COLUMNS, maxRows: 5000, maxFileSizeMb: 5 });
  });
});
