// Domain rules shared by every ingestion path (manual API, CSV import, simulation), so a
// record is judged the same way regardless of how it arrived.
import {
  ACTIVITY_TYPES,
  DEFAULT_PRODUCTION_UNIT,
  MAX_PRODUCTION_QUANTITY,
  MIN_ACTIVITY_DATE,
  resolveActivityType,
  resolveActivityUnit,
  resolveProductionUnit,
} from '../config/activityCatalog.js';

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
const PLAIN_NUMBER = /^[+-]?(\d+(\.\d*)?|\.\d+)$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const formatNumber = (value) => new Intl.NumberFormat('en-US').format(value);

function isRealCalendarDate(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Parses YYYY-MM-DD (stored as UTC midnight) or a full ISO-8601 timestamp with timezone. */
export function parseIsoDate(value) {
  const text = String(value ?? '').trim();
  const match = DATE_ONLY.exec(text) ?? DATE_TIME.exec(text);
  if (!match) return { error: 'Must be a date in YYYY-MM-DD format' };
  const [, year, month, day] = match.map(Number);
  if (!isRealCalendarDate(year, month, day)) return { error: 'Is not a real calendar date' };
  const date = DATE_ONLY.test(text) ? new Date(Date.UTC(year, month - 1, day)) : new Date(text);
  if (Number.isNaN(date.getTime())) return { error: 'Is not a valid date' };
  return { date };
}

/** Activity dates must be plausible: not before MIN_ACTIVITY_DATE and not in the future (1 day timezone grace). */
export function parseActivityDate(value, now = new Date()) {
  const { date, error } = parseIsoDate(value);
  if (error) return { error };
  if (date < new Date(`${MIN_ACTIVITY_DATE}T00:00:00Z`)) return { error: `Must not be before ${MIN_ACTIVITY_DATE}` };
  if (date.getTime() > now.getTime() + DAY_MS) return { error: 'Must not be in the future' };
  return { date };
}

/**
 * Strictly parses a numeric cell. Thousands separators and units are rejected rather than
 * guessed at, because "1,200" and "1,5" mean different things in different locales.
 */
export function parseStrictNumber(value) {
  const text = String(value ?? '').trim();
  if (text === '') return { error: 'Is required' };
  if (/^[+-]?[\d.]+,[\d.,]*$/.test(text)) return { error: 'Must be a plain number without thousands separators (e.g. 1200)' };
  if (!PLAIN_NUMBER.test(text)) return { error: 'Must be a number' };
  return { value: Number(text) };
}

export function checkActivityQuantity(typeKey, quantity) {
  if (!Number.isFinite(quantity)) return 'Must be a finite number';
  if (quantity <= 0) return 'Must be greater than 0';
  const { maxQuantity, unit } = ACTIVITY_TYPES[typeKey];
  if (quantity > maxQuantity) {
    return `Exceeds the plausible maximum of ${formatNumber(maxQuantity)} ${unit} per record — check the unit`;
  }
  return null;
}

export function checkProductionQuantity(quantity) {
  if (!Number.isFinite(quantity)) return 'Must be a finite number';
  if (quantity < 0) return 'Must not be negative';
  if (quantity > MAX_PRODUCTION_QUANTITY) return `Exceeds the plausible maximum of ${formatNumber(MAX_PRODUCTION_QUANTITY)}`;
  return null;
}

const supportedTypesHint = (types) => types.map((type) => type.key).join(', ');

/**
 * Resolves a type label to a catalog key, optionally restricted to one category.
 * Returns { key } or { error }.
 */
export function resolveTypeOrError(value, category) {
  const candidates = Object.values(ACTIVITY_TYPES).filter((type) => !category || type.category === category);
  const key = resolveActivityType(value);
  if (!key) return { error: `Unsupported activity type "${String(value).trim()}". Supported: ${supportedTypesHint(candidates)}` };
  if (category && ACTIVITY_TYPES[key].category !== category) {
    return { error: `${key} is not a ${category.toLowerCase()} type. Supported: ${supportedTypesHint(candidates)}` };
  }
  return { key };
}

/** Blank unit → the type's canonical unit; any other unit must be a spelling of it. */
export function resolveUnitOrError(typeKey, value) {
  const { unit } = ACTIVITY_TYPES[typeKey];
  if (value == null || String(value).trim() === '') return { unit };
  const resolved = resolveActivityUnit(typeKey, value);
  return resolved ? { unit: resolved } : { error: `Unit for ${typeKey} must be ${unit}` };
}

export function resolveProductionUnitOrError(value) {
  if (value == null || String(value).trim() === '') return { unit: DEFAULT_PRODUCTION_UNIT };
  const unit = resolveProductionUnit(value);
  return unit ? { unit } : { error: 'Production unit must be one of: tonnes, kg, units' };
}
