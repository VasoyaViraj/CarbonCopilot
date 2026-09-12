// Development / demo seed. Idempotent: safe to run repeatedly.
// All factors and alternatives below are ILLUSTRATIVE DEMO VALUES, clearly labelled as such.
import 'dotenv/config';
import bcrypt from 'bcrypt';
import prisma from '../src/db/db.js';

const DEFAULT_DEMO_PASSWORD = 'EcoTrace@Demo1';
const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || DEFAULT_DEMO_PASSWORD;

// The default password is published in .env.example and the demo docs; seeding it into a
// production database would create publicly known ADMIN credentials.
if (process.env.NODE_ENV === 'production' && DEMO_PASSWORD === DEFAULT_DEMO_PASSWORD) {
  console.error('Refusing to seed demo accounts in production with the published default password. Set DEMO_USER_PASSWORD.');
  process.exit(1);
}

const FACTOR_REFERENCE =
  'Illustrative demo factor — replace with an authoritative regional source (e.g. national grid, IPCC, DEFRA) before real-world use.';

// factor = kgCO2e per activity unit
const EMISSION_FACTORS = [
  { category: 'ENERGY', fuel_type: 'ELECTRICITY', unit: 'kWh', factor: 0.7 },
  { category: 'FUEL', fuel_type: 'NATURAL_GAS', unit: 'm3', factor: 1.9 },
  { category: 'FUEL', fuel_type: 'DIESEL', unit: 'L', factor: 2.68 },
  { category: 'FUEL', fuel_type: 'LPG', unit: 'kg', factor: 2.94 },
  { category: 'MATERIAL', fuel_type: 'VIRGIN_ALUMINUM', unit: 'tonne', factor: 11500 },
  { category: 'MATERIAL', fuel_type: 'RECYCLED_ALUMINUM', unit: 'tonne', factor: 700 },
  { category: 'MATERIAL', fuel_type: 'STEEL', unit: 'tonne', factor: 1850 },
  { category: 'WASTE', fuel_type: 'WASTE_LANDFILL', unit: 'tonne', factor: 470 },
  { category: 'WASTE', fuel_type: 'WASTE_RECYCLED', unit: 'tonne', factor: 21 },
].map((f) => ({
  ...f,
  co2e_unit: 'kgCO2e',
  source: 'EcoTrace demo dataset',
  region: 'GLOBAL-DEMO',
  year: 2026,
  reference: FACTOR_REFERENCE,
}));

// reduction_percent: estimated % reduction of the targeted emissions; circularity_score: 0–100.
const CIRCULAR_ALTERNATIVES = [
  {
    category: 'material',
    current_option: 'virgin_aluminum',
    alternative_option: 'recycled_aluminum',
    description: 'Replace a share of virgin aluminum with recycled aluminum feedstock.',
    reduction_percent: 15,
    cost_level: 'MEDIUM',
    implementation_difficulty: 'MEDIUM',
    estimated_payback_years: 2.5,
    circularity_score: 90,
  },
  {
    category: 'energy efficiency',
    current_option: 'furnace_exhaust_heat',
    alternative_option: 'waste_heat_recovery',
    description: 'Recover furnace exhaust heat to preheat combustion air or process water.',
    reduction_percent: 12,
    cost_level: 'MEDIUM',
    implementation_difficulty: 'MEDIUM',
    estimated_payback_years: 2.4,
    circularity_score: 70,
  },
  {
    category: 'process optimization',
    current_option: 'furnace_operation',
    alternative_option: 'furnace_efficiency_upgrade',
    description: 'Burner tuning, improved insulation and load scheduling to reduce fuel per tonne.',
    reduction_percent: 8,
    cost_level: 'MEDIUM',
    implementation_difficulty: 'LOW',
    estimated_payback_years: 3.1,
    circularity_score: 50,
  },
  {
    category: 'fuel substitution',
    current_option: 'natural_gas',
    alternative_option: 'biomethane',
    description: 'Substitute a share of fossil natural gas with certified biomethane.',
    reduction_percent: 20,
    cost_level: 'HIGH',
    implementation_difficulty: 'HIGH',
    estimated_payback_years: 5,
    circularity_score: 60,
  },
  {
    category: 'recycling',
    current_option: 'aluminum_scrap_disposal',
    alternative_option: 'closed_loop_scrap_recycling',
    description: 'Segregate and remelt in-house aluminum scrap instead of selling or discarding it.',
    reduction_percent: 6,
    cost_level: 'LOW',
    implementation_difficulty: 'LOW',
    estimated_payback_years: 1.5,
    circularity_score: 85,
  },
  {
    category: 'reuse',
    current_option: 'single_use_packaging',
    alternative_option: 'reusable_packaging',
    description: 'Switch outbound single-use packaging to returnable crates and pallets.',
    reduction_percent: 3,
    cost_level: 'LOW',
    implementation_difficulty: 'LOW',
    estimated_payback_years: 1.2,
    circularity_score: 80,
  },
  {
    category: 'waste recovery',
    current_option: 'process_waste_landfill',
    alternative_option: 'waste_to_resource_recovery',
    description: 'Divert process waste from landfill to material or energy recovery.',
    reduction_percent: 5,
    cost_level: 'MEDIUM',
    implementation_difficulty: 'MEDIUM',
    estimated_payback_years: 3.5,
    circularity_score: 75,
  },
  {
    category: 'energy efficiency',
    current_option: 'grid_electricity',
    alternative_option: 'rooftop_solar',
    description: 'Install on-site rooftop solar to offset grid electricity.',
    reduction_percent: 10,
    cost_level: 'HIGH',
    implementation_difficulty: 'MEDIUM',
    estimated_payback_years: 6,
    circularity_score: 40,
  },
  {
    category: 'energy efficiency',
    current_option: 'standard_motors',
    alternative_option: 'high_efficiency_motors_vfd',
    description: 'Replace standard motors with high-efficiency motors and variable-frequency drives.',
    reduction_percent: 4,
    cost_level: 'MEDIUM',
    implementation_difficulty: 'LOW',
    estimated_payback_years: 2.8,
    circularity_score: 30,
  },
];

const DEMO_ORGANIZATION = { name: 'ABC Metal Manufacturing (Demo)', industry_type: 'Metal Components' };

const DEMO_USERS = [
  { name: 'Demo Admin', email: 'admin@ecotrace.demo', role: 'ADMIN' },
  { name: 'Demo Operator', email: 'operator@ecotrace.demo', role: 'FACTORY_OPERATOR' },
  { name: 'Demo Consultant', email: 'consultant@ecotrace.demo', role: 'CONSULTANT' },
  { name: 'Demo Regulator', email: 'regulator@ecotrace.demo', role: 'REGULATOR' },
];

const DEMO_FACTORY = {
  name: 'ABC Metal Manufacturing',
  industry_type: 'Metal Components',
  location: 'Demo Location',
  production_capacity: 10000,
  production_unit: 'tonnes/year',
};

const DEMO_PROCESSES = [
  { name: 'Furnace', process_type: 'THERMAL', description: 'Main melting and heat treatment furnace.' },
  { name: 'Electricity', process_type: 'ELECTRICAL', description: 'Plant electricity for machining, assembly and utilities.' },
  { name: 'Boiler', process_type: 'THERMAL', description: 'Steam and process hot water.' },
  { name: 'Transport', process_type: 'LOGISTICS', description: 'On-site and inbound diesel transport.' },
  { name: 'Waste', process_type: 'WASTE', description: 'Process waste handling and disposal.' },
];

async function seedEmissionFactors() {
  let created = 0;
  for (const factor of EMISSION_FACTORS) {
    const existing = await prisma.emissionFactor.findFirst({
      where: { fuel_type: factor.fuel_type, unit: factor.unit, region: factor.region, year: factor.year },
    });
    // Existing factors are never updated in place: historical emissions reference them (BR-02).
    if (!existing) {
      await prisma.emissionFactor.create({ data: factor });
      created += 1;
    }
  }
  return created;
}

async function seedCircularAlternatives() {
  let created = 0;
  for (const alt of CIRCULAR_ALTERNATIVES) {
    const existing = await prisma.circularAlternative.findUnique({
      where: {
        current_option_alternative_option: {
          current_option: alt.current_option,
          alternative_option: alt.alternative_option,
        },
      },
    });
    if (!existing) {
      await prisma.circularAlternative.create({ data: alt });
      created += 1;
    }
  }
  return created;
}

async function seedDemoTenant() {
  const organization =
    (await prisma.organization.findFirst({ where: { name: DEMO_ORGANIZATION.name } })) ??
    (await prisma.organization.create({ data: DEMO_ORGANIZATION }));

  const password_hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const user of DEMO_USERS) {
    const data = { ...user, password_hash, organization_id: organization.id };
    await prisma.user.upsert({ where: { email: user.email }, update: data, create: data });
  }

  const factory =
    (await prisma.factory.findFirst({ where: { organization_id: organization.id, name: DEMO_FACTORY.name } })) ??
    (await prisma.factory.create({ data: { ...DEMO_FACTORY, organization_id: organization.id } }));

  for (const process of DEMO_PROCESSES) {
    await prisma.process.upsert({
      where: { factory_id_name: { factory_id: factory.id, name: process.name } },
      update: {},
      create: { ...process, factory_id: factory.id },
    });
  }

  return { organization, factory };
}

async function main() {
  const factorsCreated = await seedEmissionFactors();
  const alternativesCreated = await seedCircularAlternatives();
  const { organization, factory } = await seedDemoTenant();

  console.log(`Emission factors created: ${factorsCreated} (of ${EMISSION_FACTORS.length})`);
  console.log(`Circular alternatives created: ${alternativesCreated} (of ${CIRCULAR_ALTERNATIVES.length})`);
  console.log(`Demo organization #${organization.id}, factory #${factory.id} with ${DEMO_PROCESSES.length} processes`);
  console.log(`Demo users: ${DEMO_USERS.map((u) => `${u.email} (${u.role})`).join(', ')}`);
  console.log('Demo password: value of DEMO_USER_PASSWORD (see .env.example).');
}

main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error('Seed failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
