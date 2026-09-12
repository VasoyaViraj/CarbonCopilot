// Supported operational activity types for ingestion (manual, CSV, simulation).
//
// Each type maps 1:1 to an emission factor `fuel_type` + `unit` in the seed data, so every
// ingested activity can later be resolved to a factor by the deterministic carbon engine.
// Units are normalised to the factor's canonical unit; conversions are never inferred.

export const ACTIVITY_CATEGORIES = Object.freeze(['ENERGY', 'FUEL', 'MATERIAL', 'WASTE']);

// maxQuantity: plausibility ceiling for a single record — values above it almost always mean
// a unit or decimal mistake, so they are rejected rather than stored.
const TYPES = [
  { key: 'ELECTRICITY', category: 'ENERGY', label: 'Electricity', unit: 'kWh', unitAliases: ['kwh'], maxQuantity: 10_000_000 },
  { key: 'NATURAL_GAS', category: 'FUEL', label: 'Natural gas', unit: 'm3', unitAliases: ['m3', 'm³', 'cubic_meter', 'cubic_metre'], maxQuantity: 5_000_000 },
  { key: 'DIESEL', category: 'FUEL', label: 'Diesel', unit: 'L', unitAliases: ['l', 'litre', 'litres', 'liter', 'liters'], maxQuantity: 2_000_000 },
  { key: 'LPG', category: 'FUEL', label: 'LPG', unit: 'kg', unitAliases: ['kg', 'kgs'], maxQuantity: 2_000_000 },
  { key: 'VIRGIN_ALUMINUM', category: 'MATERIAL', label: 'Virgin aluminium', unit: 'tonne', aliases: ['VIRGIN_ALUMINIUM'], maxQuantity: 100_000 },
  { key: 'RECYCLED_ALUMINUM', category: 'MATERIAL', label: 'Recycled aluminium', unit: 'tonne', aliases: ['RECYCLED_ALUMINIUM'], maxQuantity: 100_000 },
  { key: 'STEEL', category: 'MATERIAL', label: 'Steel', unit: 'tonne', maxQuantity: 100_000 },
  { key: 'WASTE_LANDFILL', category: 'WASTE', label: 'Waste to landfill', unit: 'tonne', maxQuantity: 100_000 },
  { key: 'WASTE_RECYCLED', category: 'WASTE', label: 'Waste recycled', unit: 'tonne', maxQuantity: 100_000 },
];

const TONNE_ALIASES = ['t', 'tonne', 'tonnes'];

export const ACTIVITY_TYPES = Object.freeze(
  Object.fromEntries(
    TYPES.map(({ unitAliases, aliases, ...type }) => [
      type.key,
      Object.freeze({
        ...type,
        unitAliases: Object.freeze(unitAliases ?? (type.unit === 'tonne' ? TONNE_ALIASES : [type.unit.toLowerCase()])),
        aliases: Object.freeze(aliases ?? []),
      }),
    ])
  )
);

export const PRODUCTION_UNITS = Object.freeze({
  tonnes: ['t', 'tonne', 'tonnes'],
  kg: ['kg', 'kgs'],
  units: ['unit', 'units', 'pcs', 'pieces'],
});

/** Used when a production quantity is supplied without a unit (documented in the CSV template). */
export const DEFAULT_PRODUCTION_UNIT = 'tonnes';

export const MAX_PRODUCTION_QUANTITY = 10_000_000;

/** Earliest accepted activity date; anything older is almost certainly a typo. */
export const MIN_ACTIVITY_DATE = '2000-01-01';

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, '_');

const normalizeUnitToken = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');

/** "Natural gas", "natural-gas", "NATURAL_GAS" → "NATURAL_GAS"; unknown → null. */
export function resolveActivityType(value) {
  const key = normalizeKey(value);
  if (!key) return null;
  if (ACTIVITY_TYPES[key]) return key;
  return Object.values(ACTIVITY_TYPES).find((type) => type.aliases.includes(key))?.key ?? null;
}

/** Returns the canonical unit for the type if `value` is an accepted spelling of it, else null. */
export function resolveActivityUnit(typeKey, value) {
  const type = ACTIVITY_TYPES[typeKey];
  if (!type) return null;
  return type.unitAliases.includes(normalizeUnitToken(value)) ? type.unit : null;
}

export function resolveProductionUnit(value) {
  const token = normalizeUnitToken(value);
  return Object.entries(PRODUCTION_UNITS).find(([, aliases]) => aliases.includes(token))?.[0] ?? null;
}

export const typesInCategory = (category) => Object.values(ACTIVITY_TYPES).filter((type) => type.category === category);

/** Public, serialisable view of the catalog for clients (forms, CSV help). */
export function describeCatalog() {
  return {
    categories: ACTIVITY_CATEGORIES,
    types: Object.values(ACTIVITY_TYPES).map(({ key, category, label, unit, maxQuantity }) => ({
      key,
      category,
      label,
      unit,
      maxQuantity,
    })),
    productionUnits: Object.keys(PRODUCTION_UNITS),
    defaultProductionUnit: DEFAULT_PRODUCTION_UNIT,
    maxProductionQuantity: MAX_PRODUCTION_QUANTITY,
  };
}
