// CSV ingestion pipeline: parse → header check → row-level validation → process resolution
// → duplicate protection → transactional persistence. A row is either imported whole or not
// at all, and invalid rows are never written: they are reported back with row-level errors.
import { parse } from 'csv-parse/sync';
import prisma from '../db/db.js';
import { ApiError } from '../utils/ApiError.js';
import { ACTIVITY_SOURCES } from '../constants.js';
import { ACTIVITY_TYPES } from '../config/activityCatalog.js';
import {
  checkActivityQuantity,
  checkProductionQuantity,
  parseActivityDate,
  parseStrictNumber,
  resolveProductionUnitOrError,
  resolveTypeOrError,
  resolveUnitOrError,
} from '../validators/activity.rules.js';

export const MAX_CSV_ROWS = 5000;
const MAX_REPORTED_ERRORS = 500;
const PREVIEW_SIZE = 10;
// Keeps each INSERT well below PostgreSQL's 65,535 bind-parameter limit.
const INSERT_CHUNK_SIZE = 1000;

// Each consumption column becomes one activity; its type/unit companions are optional
// (unit defaults to the type's canonical unit, energy defaults to ELECTRICITY).
const CATEGORY_COLUMNS = [
  { column: 'energy', typeColumn: 'energy_type', unitColumn: 'energy_unit', category: 'ENERGY', defaultType: 'ELECTRICITY' },
  { column: 'fuel', typeColumn: 'fuel_type', unitColumn: 'fuel_unit', category: 'FUEL' },
  { column: 'material', typeColumn: 'material_type', unitColumn: 'material_unit', category: 'MATERIAL' },
  { column: 'waste', typeColumn: 'waste_type', unitColumn: 'waste_unit', category: 'WASTE' },
];
const COLUMN_BY_CATEGORY = Object.fromEntries(CATEGORY_COLUMNS.map((spec) => [spec.category, spec.column]));

export const REQUIRED_COLUMNS = Object.freeze(['date', 'process', 'energy', 'fuel', 'material', 'production', 'waste']);
export const TEMPLATE_COLUMNS = Object.freeze([
  'date',
  'process',
  ...CATEGORY_COLUMNS.flatMap((spec) => [spec.column, spec.typeColumn, spec.unitColumn]),
  'production',
  'production_unit',
]);
export const OPTIONAL_COLUMNS = Object.freeze(TEMPLATE_COLUMNS.filter((column) => !REQUIRED_COLUMNS.includes(column)));
const KNOWN_COLUMNS = new Set(TEMPLATE_COLUMNS);

const TEMPLATE_ROWS = [
  ['2026-09-01', 'Furnace', '1200', 'ELECTRICITY', 'kWh', '300', 'NATURAL_GAS', 'm3', '2', 'VIRGIN_ALUMINUM', 'tonne', '', '', '', '8', 'tonnes'],
  ['2026-09-01', 'Transport', '', '', '', '40', 'DIESEL', 'L', '', '', '', '', '', '', '', ''],
  ['2026-09-01', 'Waste', '', '', '', '', '', '', '', '', '', '0.5', 'WASTE_LANDFILL', 'tonne', '', ''],
];

/** Downloadable upload template: header plus example rows for the demo processes. */
export function buildCsvTemplate() {
  return `${[TEMPLATE_COLUMNS, ...TEMPLATE_ROWS].map((row) => row.join(',')).join('\n')}\n`;
}

export function describeCsvFormat() {
  return { requiredColumns: REQUIRED_COLUMNS, optionalColumns: OPTIONAL_COLUMNS, maxRows: MAX_CSV_ROWS };
}

const normalizeHeader = (value) => value.trim().toLowerCase().replace(/[\s-]+/g, '_');

/** Parses the upload into { header, rows } or throws a file-level VALIDATION_ERROR. */
export function parseCsvFile(buffer) {
  if (buffer.includes(0)) throw ApiError.badRequest('The file is not a text CSV', [{ field: 'file', message: 'Binary content detected' }]);
  const text = buffer.toString('utf8');
  if (text.includes('�')) {
    throw ApiError.badRequest('The file must be UTF-8 encoded', [{ field: 'file', message: 'Save the CSV as UTF-8 and try again' }]);
  }

  let records;
  try {
    records = parse(text, { bom: true, skip_empty_lines: true, relax_column_count: true, trim: true, info: true });
  } catch (error) {
    throw ApiError.badRequest('The CSV could not be parsed', [{ field: 'file', message: error.message }]);
  }
  if (records.length === 0) throw ApiError.badRequest('The CSV file is empty', [{ field: 'file', message: 'No header row found' }]);

  const [{ record: rawHeader }, ...dataRecords] = records;
  const header = rawHeader.map(normalizeHeader);
  const details = [];
  header.forEach((column, index) => {
    if (!KNOWN_COLUMNS.has(column)) {
      details.push({ field: column || `column ${index + 1}`, message: `Unknown column "${rawHeader[index]}"` });
    } else if (header.indexOf(column) !== index) {
      details.push({ field: column, message: 'Column appears more than once' });
    }
  });
  for (const column of REQUIRED_COLUMNS) {
    if (!header.includes(column)) details.push({ field: column, message: 'Required column is missing' });
  }
  if (details.length) throw ApiError.badRequest('The CSV header is invalid', details);

  if (dataRecords.length > MAX_CSV_ROWS) {
    throw ApiError.badRequest(`The CSV has ${dataRecords.length} rows; the limit is ${MAX_CSV_ROWS} per upload`, [
      { field: 'file', message: 'Split the file into smaller uploads' },
    ]);
  }

  // info.lines is the physical line number, so it matches what users see in a spreadsheet.
  return { header, rows: dataRecords.map(({ record, info }) => ({ rowNumber: info.lines, cells: record })) };
}

/** Case-insensitive name → processes index; more than one match means the name is ambiguous. */
function indexProcesses(processes) {
  const index = new Map();
  for (const process of processes) {
    const key = process.name.trim().toLowerCase();
    index.set(key, [...(index.get(key) ?? []), process]);
  }
  return index;
}

/**
 * Validates one row. Returns null for blank rows, otherwise { rowNumber, errors, records }
 * where records are ready-to-insert activities (empty when the row has any error).
 */
function evaluateRow({ rowNumber, cells }, header, processIndex, now) {
  if (cells.every((cell) => cell === '')) return null;

  const errors = [];
  const addError = (field, message) => errors.push({ row: rowNumber, field, message });
  if (cells.length !== header.length) {
    addError('row', `Has ${cells.length} columns but the header has ${header.length}`);
    return { rowNumber, errors, records: [] };
  }
  const get = (column) => {
    const index = header.indexOf(column);
    return index === -1 ? '' : cells[index];
  };

  const date = get('date') === '' ? { error: 'Is required' } : parseActivityDate(get('date'), now);
  if (date.error) addError('date', date.error);

  let process = null;
  const processName = get('process');
  if (!processName) {
    addError('process', 'Is required');
  } else {
    const matches = processIndex.get(processName.toLowerCase()) ?? [];
    if (matches.length === 0) addError('process', `Unknown process "${processName}" — add it in Factory Setup first`);
    else if (matches.length > 1) addError('process', `"${processName}" matches more than one process`);
    else [process] = matches;
  }

  const activities = [];
  for (const spec of CATEGORY_COLUMNS) {
    const rawQuantity = get(spec.column);
    const rawType = get(spec.typeColumn);
    const rawUnit = get(spec.unitColumn);
    if (rawQuantity === '') {
      if (rawType !== '' || rawUnit !== '') addError(spec.column, `Is blank but ${spec.typeColumn} or ${spec.unitColumn} is filled in`);
      continue;
    }

    const quantity = parseStrictNumber(rawQuantity);
    if (quantity.error) addError(spec.column, quantity.error);

    let type;
    if (rawType !== '') type = resolveTypeOrError(rawType, spec.category);
    else if (spec.defaultType) type = { key: spec.defaultType };
    else type = { error: `Is required when ${spec.column} has a value` };
    if (type.error) {
      addError(spec.typeColumn, type.error);
      continue;
    }

    const unit = resolveUnitOrError(type.key, rawUnit);
    if (unit.error) addError(spec.unitColumn, unit.error);
    if (quantity.error) continue;

    const quantityError = checkActivityQuantity(type.key, quantity.value);
    if (quantityError) addError(spec.column, quantityError);
    if (!unit.error && !quantityError) activities.push({ energyType: type.key, quantity: quantity.value, unit: unit.unit });
  }

  let production = null;
  const rawProduction = get('production');
  const rawProductionUnit = get('production_unit');
  if (rawProduction !== '') {
    const parsed = parseStrictNumber(rawProduction);
    const quantityError = parsed.error ?? checkProductionQuantity(parsed.value);
    if (quantityError) addError('production', quantityError);
    const unit = resolveProductionUnitOrError(rawProductionUnit);
    if (unit.error) addError('production_unit', unit.error);
    if (!quantityError && !unit.error) production = { quantity: parsed.value, unit: unit.unit };
  } else if (rawProductionUnit !== '') {
    addError('production', 'Is blank but production_unit is filled in');
  }

  if (errors.length === 0 && activities.length === 0) {
    addError('row', 'Has no energy, fuel, material or waste quantity');
  }
  if (errors.length) return { rowNumber, errors, records: [] };

  // Production belongs to the row, not to each consumption line: it is stored once (on the
  // row's first activity) so summing production across activities never double counts it.
  const records = activities.map((activity, index) => ({
    process_id: process.id,
    processName: process.name,
    activity_date: date.date,
    energy_type: activity.energyType,
    quantity: activity.quantity,
    unit: activity.unit,
    production_quantity: index === 0 && production ? production.quantity : null,
    production_unit: index === 0 && production ? production.unit : null,
    source: ACTIVITY_SOURCES.CSV,
  }));
  return { rowNumber, errors, records };
}

const activityKey = (activity) =>
  `${activity.process_id}|${activity.activity_date.toISOString()}|${activity.energy_type}|${activity.quantity}`;

/** Existing activities that exactly match an incoming record, keyed like activityKey. */
async function findExistingActivities(db, rows) {
  const records = rows.flatMap((row) => row.records);
  if (records.length === 0) return new Map();
  const times = records.map((record) => record.activity_date.getTime());
  const existing = await db.activity.findMany({
    where: {
      process_id: { in: [...new Set(records.map((record) => record.process_id))] },
      energy_type: { in: [...new Set(records.map((record) => record.energy_type))] },
      activity_date: { gte: new Date(times.reduce((a, b) => Math.min(a, b))), lte: new Date(times.reduce((a, b) => Math.max(a, b))) },
    },
    select: { id: true, process_id: true, activity_date: true, energy_type: true, quantity: true },
  });
  return new Map(existing.map((activity) => [activityKey(activity), activity.id]));
}

/**
 * Re-uploading a file must not double the factory's emissions, so a record identical to an
 * existing activity (or to an earlier row in the same file) invalidates its row.
 */
function flagDuplicates(rows, existing) {
  const seen = new Map();
  for (const row of rows) {
    if (row.errors.length) continue;
    const keys = row.records.map(activityKey);
    row.records.forEach((record, index) => {
      const field = COLUMN_BY_CATEGORY[ACTIVITY_TYPES[record.energy_type].category];
      const existingId = existing.get(keys[index]);
      const earlierRow = seen.get(keys[index]);
      if (existingId) {
        row.errors.push({ row: row.rowNumber, field, message: `Already imported: matches existing activity #${existingId}` });
      } else if (earlierRow) {
        row.errors.push({ row: row.rowNumber, field, message: `Duplicates row ${earlierRow} (same date, process, type and quantity)` });
      }
    });
    if (row.errors.length) row.records = [];
    else keys.forEach((key) => seen.set(key, row.rowNumber));
  }
}

function summarize(rows, { fileName, dryRun, imported }) {
  const validRows = rows.filter((row) => row.errors.length === 0);
  const errors = rows.flatMap((row) => row.errors);
  return {
    fileName,
    dryRun,
    imported,
    totalRows: rows.length,
    validRows: validRows.length,
    invalidRows: rows.length - validRows.length,
    activityCount: validRows.reduce((count, row) => count + row.records.length, 0),
    errors: errors.slice(0, MAX_REPORTED_ERRORS),
    errorsTruncated: errors.length > MAX_REPORTED_ERRORS,
    preview: validRows
      .flatMap((row) =>
        row.records.map((record) => ({
          row: row.rowNumber,
          processName: record.processName,
          activityDate: record.activity_date.toISOString(),
          energyType: record.energy_type,
          quantity: record.quantity,
          unit: record.unit,
          productionQuantity: record.production_quantity,
          productionUnit: record.production_unit,
        }))
      )
      .slice(0, PREVIEW_SIZE),
  };
}

/**
 * Validates (dryRun) or imports a CSV for an already-authorized factory.
 * Without skipInvalidRows, any invalid row aborts the import and nothing is written.
 */
export async function importActivitiesCsv({ factory, file, dryRun = false, skipInvalidRows = false, now = new Date() }) {
  const { header, rows } = parseCsvFile(file.buffer);
  const fileName = file.originalname.slice(0, 255);

  const evaluate = async (db) => {
    const processes = await db.process.findMany({ where: { factory_id: factory.id }, select: { id: true, name: true } });
    const processIndex = indexProcesses(processes);
    const evaluated = rows.map((row) => evaluateRow(row, header, processIndex, now)).filter(Boolean);
    if (evaluated.length === 0) throw ApiError.badRequest('The CSV has no data rows', [{ field: 'file', message: 'Add at least one row below the header' }]);
    flagDuplicates(evaluated, await findExistingActivities(db, evaluated));
    return evaluated;
  };

  if (dryRun) return summarize(await evaluate(prisma), { fileName, dryRun: true, imported: false });

  // Validation and the duplicate check run inside the same transaction as the insert.
  return prisma.$transaction(
    async (tx) => {
      const evaluated = await evaluate(tx);
      const summary = summarize(evaluated, { fileName, dryRun: false, imported: true });
      if (summary.invalidRows > 0 && !skipInvalidRows) {
        throw ApiError.badRequest(
          `${summary.invalidRows} of ${summary.totalRows} rows are invalid, so nothing was imported. Fix them, or re-submit with skipInvalidRows=true to import only the valid rows.`,
          summary.errors
        );
      }
      if (summary.validRows === 0) throw ApiError.badRequest('No valid rows to import', summary.errors);

      const data = evaluated.flatMap((row) => row.records).map(({ processName: _processName, ...record }) => record);
      for (let start = 0; start < data.length; start += INSERT_CHUNK_SIZE) {
        await tx.activity.createMany({ data: data.slice(start, start + INSERT_CHUNK_SIZE) });
      }
      return summary;
    },
    { maxWait: 10_000, timeout: 60_000 }
  );
}
