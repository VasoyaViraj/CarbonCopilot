// End-to-end golden path for EcoTrace AI:
//   LOGIN → FACTORY SETUP → ADD PROCESSES → UPLOAD CSV → ACTIVITIES → EMISSION CALCULATION →
//   CARBON DASHBOARD → HOTSPOT → AI ROOT CAUSE → CIRCULAR RECOMMENDATIONS → SELECT INTERVENTION →
//   WHAT-IF → ACTION PLAN → REPORT
//
// Drives the running stack over HTTP the way the frontend services do (frontend/src/services),
// checks every response against the fields the UI reads, and cross-checks the figures against the
// database records and against each other. Nothing is stubbed: copilot steps go Express → AI
// service → MCP tools → Express, so a contract mismatch anywhere on the path fails the run.
//
// Needs the backend running against backend/.env's DATABASE_URL (seeded with emission factors and
// circular alternatives) and, for the copilot steps, the AI service sharing its AI_SERVICE_TOKEN.
// The run registers its own user, so it works in a fresh organization, and deletes that user,
// organization and factory at the end.
//
//   npm run test:e2e
//
//   E2E_API_URL    API base URL (default http://localhost:5000/api)
//   E2E_CSV        CSV to upload (default data/demo/abc-metal-manufacturing.csv)
//   E2E_KEEP_DATA  1 keeps the user, organization and factory so the result can be opened in the UI
import 'dotenv/config';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';
import prisma from '../src/db/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const API_URL = (process.env.E2E_API_URL ?? 'http://localhost:5000/api').replace(/\/+$/, '');
const CSV_PATH = path.resolve(process.env.E2E_CSV ?? path.join(here, '../../data/demo/abc-metal-manufacturing.csv'));
const KEEP_DATA = process.env.E2E_KEEP_DATA === '1';

// Prompts the UI sends (HotspotsPage, CopilotPage suggestions, ActionPlanCard).
const hotspotPrompt = (process) => `Why is ${process} a hotspot?`;
const FIX_FIRST_PROMPT = 'What should I fix first?';
const SCENARIO_PROMPT = 'What happens if I use 30% recycled material?';
const SCENARIO_INPUT = { recycledMaterialPercent: 30, energyEfficiencyPercent: 0, fuelReplacementPercent: 0, wasteRecoveryPercent: 0 };
const ACTION_PLAN_PROMPT = 'Generate an action plan.';

// Services round tCO2e figures independently, so totals are compared within this tolerance.
const EPSILON = 1e-3;

// Fields the frontend reads from each response (types in frontend/src/services).
const SHAPES = {
  authResult: { accessToken: 'string', user: 'object' },
  authUser: { id: 'number', name: 'string', email: 'string', role: 'string', organizationId: 'number' },
  factory: {
    id: 'number',
    organization_id: 'number',
    name: 'string',
    industry_type: 'string|null',
    location: 'string|null',
    production_capacity: 'number|null',
    production_unit: 'string|null',
  },
  process: { id: 'number', factory_id: 'number', name: 'string', process_type: 'string|null' },
  csvImportSummary: {
    fileName: 'string',
    dryRun: 'boolean',
    imported: 'boolean',
    totalRows: 'number',
    validRows: 'number',
    invalidRows: 'number',
    activityCount: 'number',
    co2e: 'object|null',
    errors: 'array',
    errorsTruncated: 'boolean',
    preview: 'array',
  },
  activityPage: { items: 'array', total: 'number', limit: 'number', offset: 'number' },
  activity: {
    id: 'number',
    processId: 'number',
    processName: 'string|null',
    activityDate: 'string',
    energyType: 'string',
    category: 'string|null',
    quantity: 'number',
    unit: 'string',
    source: 'string',
    isSimulated: 'boolean',
    emission: 'object|null',
  },
  activityEmission: { id: 'number', co2eValue: 'number', co2eUnit: 'string', emissionFactorId: 'number' },
  calculation: { emissionFactorId: 'number', co2eValue: 'number', co2eUnit: 'string', calculationMethod: 'string' },
  emissionSummary: {
    factory: 'object',
    co2eUnit: 'string',
    totals: 'object',
    production: 'object',
    intensity: 'object',
    byProcess: 'array',
    bySource: 'array',
    byDataSource: 'array',
    history: 'array',
    energy: 'array',
    warnings: 'array',
  },
  summaryTotals: { co2e: 'number', simulatedCo2e: 'number', activityCount: 'number', emissionCount: 'number' },
  processShare: { processId: 'number', process: 'string', co2e: 'number', percentage: 'number', activityCount: 'number' },
  intensity: { value: 'number|null', unit: 'string|null' },
  hotspotRanking: { factory: 'object', co2eUnit: 'string', totalEmission: 'number', thresholds: 'object', hotspots: 'array', warnings: 'array' },
  hotspot: { rank: 'number', processId: 'number', process: 'string', emission: 'number', percentage: 'number', severity: 'string', activityCount: 'number' },
  hotspotDetail: {
    process: 'object',
    hotspot: 'object|null',
    factoryTotalEmission: 'number',
    emission: 'number',
    simulatedEmission: 'number',
    drivers: 'array',
    history: 'array',
    production: 'object',
    intensity: 'object',
    warnings: 'array',
  },
  copilotResponse: {
    answer: 'string',
    toolsUsed: 'array',
    recommendations: 'array',
    scenario: 'object|null',
    assumptions: 'array',
    confidence: 'string',
    intent: 'string|null',
    actionPlan: 'object|null',
    conversationId: 'number|null',
  },
  copilotTool: { name: 'string', input: 'object', outputSummary: 'string|null' },
  copilotRecommendation: {
    rank: 'number',
    name: 'string',
    reductionPercent: 'number|null',
    costLevel: 'string|null',
    paybackYears: 'number|null',
    score: 'number|null',
    reason: 'string|null',
  },
  copilotScenario: {
    baselineEmission: 'number|null',
    projectedEmission: 'number|null',
    reductionAmount: 'number|null',
    reductionPercent: 'number|null',
    estimatedCost: 'number|null',
    estimatedSavings: 'number|null',
    paybackPeriod: 'string|null',
    unit: 'string|null',
  },
  recommendationList: { factory: 'object', generatedAt: 'string|null', weights: 'object', assumptions: 'array', recommendations: 'array' },
  recommendationRun: { basis: 'object', created: 'number', keptDecided: 'number', unmatchedAlternatives: 'array', warnings: 'array', recommendations: 'array' },
  recommendation: {
    id: 'number',
    rank: 'number',
    status: 'string',
    alternativeId: 'number',
    alternative: 'string',
    currentOption: 'string',
    category: 'string',
    scope: 'string',
    processId: 'number|null',
    process: 'string|null',
    score: 'number',
    scoreBreakdown: 'object',
    estimatedReduction: 'number|null',
    reductionPercent: 'number|null',
    estimatedSavings: 'number|null',
    savingsUnit: 'string',
    estimatedCost: 'string|null',
    implementationDifficulty: 'string|null',
    paybackPeriod: 'number|null',
    reason: 'string|null',
    assumptions: 'array',
    createdAt: 'string',
  },
  scenarioResult: {
    baselineEmission: 'number',
    projectedEmission: 'number',
    reductionAmount: 'number',
    reductionPercent: 'number',
    estimatedCost: 'number',
    estimatedSavings: 'number',
    paybackPeriod: 'number|null',
    unit: 'string',
    assumptions: 'array',
  },
  savedScenario: { id: 'number', factoryId: 'number', name: 'string', description: 'string|null', createdAt: 'string' },
  history: { conversationId: 'number|null', messages: 'array' },
  chatMessage: { id: 'string', role: 'string', content: 'string' },
  actionPlan: {
    immediateInvestigation: 'array',
    shortTermActions: 'array',
    mediumTermInterventions: 'array',
    measurements: 'array',
    expectedImpact: 'array',
    risksAndLimitations: 'array',
    successMetrics: 'array',
    decisionNote: 'string',
    source: 'string',
    confidence: 'string',
  },
  planAction: { title: 'string', detail: 'string', relatedTo: 'string|null' },
  impactEstimate: {
    source: 'string',
    label: 'string',
    estimatedCo2eReduction: 'number|null',
    co2eReductionUnit: 'string|null',
    estimatedReductionPercent: 'number|null',
    estimatedCost: 'string|null',
    estimatedSavings: 'string|null',
    payback: 'string',
    projection: 'string|null',
    basis: 'string',
  },
  successMetric: { metric: 'string', baseline: 'string', target: 'string' },
  report: {
    factory: 'object',
    generatedAt: 'string',
    emissions: 'object',
    hotspots: 'array',
    recommendations: 'array',
    scenarios: 'array',
    methodology: 'array',
    assumptions: 'array',
  },
  reportFactory: { id: 'number', name: 'string', location: 'string|null', industry: 'string|null', productionUnit: 'string|null' },
  reportEmissions: { total: 'number', unit: 'string', simulatedCo2e: 'number', bySource: 'array', byProcess: 'array', intensity: 'object' },
};

const TYPES = {
  number: (value) => typeof value === 'number' && Number.isFinite(value),
  string: (value) => typeof value === 'string',
  boolean: (value) => typeof value === 'boolean',
  array: Array.isArray,
  object: (value) => value !== null && typeof value === 'object' && !Array.isArray(value),
  null: (value) => value === null,
};

class ContractError extends Error {}

function check(condition, message) {
  if (!condition) throw new ContractError(message);
}

/** Checks that `value` carries every field of `shape` ({ field: 'number|null', … }) with the right type. */
function expectShape(value, shape, where) {
  check(TYPES.object(value), `${where} should be an object, got ${JSON.stringify(value)}`);
  for (const [field, type] of Object.entries(shape)) {
    const valid = type.split('|').some((name) => TYPES[name](value[field]));
    check(valid, `Contract mismatch: ${where}.${field} should be ${type}, got ${JSON.stringify(value[field])}`);
  }
  return value;
}

const expectEach = (items, shape, where) => items.forEach((item, index) => expectShape(item, shape, `${where}[${index}]`));

const near = (a, b, epsilon = EPSILON) => Math.abs(a - b) <= epsilon;
const sum = (values) => values.reduce((total, value) => total + value, 0);
const fmt = (value) => (value == null ? 'n/a' : Number(value).toLocaleString('en-US', { maximumFractionDigits: 3 }));
const log = (line = '') => console.log(line);

function toTonnes(value, unit) {
  if (unit === 'tCO2e') return value;
  if (unit === 'kgCO2e') return value / 1000;
  throw new ContractError(`Unsupported CO2e unit "${unit}" on a stored emission`);
}

// ---------------------------------------------------------------------------
// Trace: authenticated user, factory, every API call and every AI tool sequence
// ---------------------------------------------------------------------------
const session = { email: null, password: null, token: null, user: null, factoryId: null, conversationId: null };
const apiCalls = [];
const aiCalls = [];
const ctx = {};

async function api(method, url, { body, form, status = 200, token = session.token } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  let payload = form;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  const started = performance.now();
  let res;
  try {
    res = await fetch(`${API_URL}${url}`, { method, headers, body: payload });
  } catch (err) {
    throw new Error(`Cannot reach the API at ${API_URL} (${err.cause?.code ?? err.message}). Is the backend running?`);
  }
  const json = await res.json().catch(() => null);
  const ms = Math.round(performance.now() - started);
  apiCalls.push({ method, url, status: res.status, ms });
  log(`    ${method} ${url} → ${res.status} (${ms} ms)`);

  check(res.status === status, `${method} ${url} returned ${res.status}, expected ${status}: ${JSON.stringify(json?.error ?? json)}`);
  check(json?.success === true && 'data' in json, `${method} ${url} did not use the { success, data } envelope`);
  return json.data;
}

/**
 * Asks the copilot as the UI does. `conversation: true` continues one conversation like CopilotPage;
 * otherwise each question stands alone like the Hotspots AI analysis and the action plan card.
 */
async function ask(message, { conversation = false } = {}) {
  const conversationId = conversation ? session.conversationId : null;
  const data = await api('POST', '/ai/copilot', {
    body: { factoryId: session.factoryId, message, ...(conversationId ? { conversationId } : {}) },
  });
  expectShape(data, SHAPES.copilotResponse, 'CopilotResponse');
  expectEach(data.toolsUsed, SHAPES.copilotTool, 'CopilotResponse.toolsUsed');
  check(data.answer.trim().length > 0, `The copilot returned an empty answer to "${message}"`);
  if (conversation) session.conversationId = data.conversationId;

  const tools = data.toolsUsed.map((tool) => tool.name);
  aiCalls.push({ message, intent: data.intent, confidence: data.confidence, tools, conversationId: data.conversationId });
  log(`    AI intent=${data.intent} confidence=${data.confidence} conversation=${data.conversationId}`);
  log(`    AI tools: ${tools.join(' → ') || '(none)'}`);
  return data;
}

function expectCopilot(response, { intent, tools }) {
  check(response.intent === intent, `Expected copilot intent ${intent}, got ${response.intent}`);
  const used = response.toolsUsed.map((tool) => tool.name);
  const missing = tools.filter((name) => !used.includes(name));
  check(missing.length === 0, `The ${intent} workflow did not call ${missing.join(', ')} (called ${used.join(', ') || 'nothing'})`);
  // UNAVAILABLE means the workflow had no usable tool results (a failed backend call).
  check(response.confidence !== 'UNAVAILABLE', `The ${intent} answer had no usable tool results (confidence UNAVAILABLE)`);
}

const factoryPath = (suffix = '') => `/factories/${session.factoryId}${suffix}`;
const factoryActivities = () => ({ process: { factory_id: session.factoryId } });

// ---------------------------------------------------------------------------
// Golden path
// ---------------------------------------------------------------------------
async function login() {
  // A clean session: a new user in a new organization, so no data from other runs is visible.
  session.email = `e2e-${Date.now()}-${randomBytes(3).toString('hex')}@ecotrace.test`;
  session.password = randomBytes(12).toString('base64url');
  const registered = await api('POST', '/auth/register', {
    status: 201,
    token: null,
    body: { name: 'E2E Operator', email: session.email, password: session.password, role: 'FACTORY_OPERATOR', organizationName: 'EcoTrace E2E' },
  });
  expectShape(registered, SHAPES.authResult, 'AuthResult');
  session.user = registered.user;

  const loggedIn = await api('POST', '/auth/login', { token: null, body: { email: session.email, password: session.password } });
  expectShape(loggedIn, SHAPES.authResult, 'AuthResult');
  expectShape(loggedIn.user, SHAPES.authUser, 'AuthUser');
  session.token = loggedIn.accessToken;

  const { user } = await api('GET', '/auth/me');
  expectShape(user, SHAPES.authUser, 'AuthUser');
  check(user.id === registered.user.id, '/auth/me returned a different user than the one that logged in');
  session.user = user;

  const stored = await prisma.user.findUnique({ where: { id: user.id }, select: { organization_id: true, role: true } });
  check(stored?.organization_id === user.organizationId && stored.role === user.role, 'The authenticated user does not match its database record');
  log(`    user_id=${user.id} organization_id=${user.organizationId} role=${user.role}`);
}

async function openFactory() {
  const factories = await api('GET', '/factories');
  check(Array.isArray(factories) && factories.length === 0, 'A new organization should start without factories');

  const created = await api('POST', '/factories', {
    status: 201,
    body: { name: 'ABC Metal Manufacturing (E2E)', industryType: 'Metal Components', location: 'Pune, India', productionCapacity: 10000, productionUnit: 'tonnes' },
  });
  expectShape(created, SHAPES.factory, 'Factory');
  session.factoryId = created.id;

  const opened = await api('GET', factoryPath());
  expectShape(opened, SHAPES.factory, 'Factory');
  check(opened.organization_id === session.user.organizationId, "The factory was not created in the user's organization");
  log(`    factory_id=${created.id}`);
}

async function addProcesses() {
  const names = [...new Set(ctx.csvRows.map((row) => row.process))];
  for (const name of names) {
    const process = await api('POST', factoryPath('/processes'), { status: 201, body: { name } });
    expectShape(process, SHAPES.process, 'Process');
    check(process.factory_id === session.factoryId, `Process ${name} was attached to factory ${process.factory_id}`);
  }

  const processes = await api('GET', factoryPath('/processes'));
  expectEach(processes, SHAPES.process, 'Process');
  check(processes.length === names.length, `Expected ${names.length} processes, the API lists ${processes.length}`);
  const stored = await prisma.process.count({ where: { factory_id: session.factoryId } });
  check(stored === names.length, `Expected ${names.length} process records, the database has ${stored}`);
  log(`    processes: ${names.join(', ')}`);
}

async function uploadCsv() {
  const upload = async (dryRun) => {
    const form = new FormData();
    form.append('factoryId', String(session.factoryId));
    form.append('dryRun', String(dryRun));
    form.append('skipInvalidRows', 'false');
    form.append('file', new Blob([ctx.csvText], { type: 'text/csv' }), path.basename(CSV_PATH));
    const summary = await api('POST', '/activities/upload', { form, status: dryRun ? 200 : 201 });
    return expectShape(summary, SHAPES.csvImportSummary, 'CsvImportSummary');
  };

  // CsvImportPanel validates with a dry run before importing.
  const preview = await upload(true);
  check(preview.invalidRows === 0, `The CSV has invalid rows: ${JSON.stringify(preview.errors.slice(0, 3))}`);
  check(preview.totalRows === ctx.csvRows.length, `The dry run saw ${preview.totalRows} rows, the file has ${ctx.csvRows.length}`);
  check(!preview.imported && (await prisma.activity.count({ where: factoryActivities() })) === 0, 'A dry run must not store activities');

  const imported = await upload(false);
  check(imported.imported, 'The import reported that nothing was imported');
  check(imported.activityCount === preview.activityCount, 'The import stored a different number of activities than the dry run validated');
  check(imported.co2e !== null, 'The import has no CO2e estimate');
  ctx.imported = imported;
  log(`    rows=${imported.totalRows} activities=${imported.activityCount} estimate=${fmt(imported.co2e.value)} ${imported.co2e.unit}`);
}

async function persistActivities() {
  const page = await api('GET', `${factoryPath('/activities')}?limit=200`);
  expectShape(page, SHAPES.activityPage, 'ActivityPage');
  expectEach(page.items, SHAPES.activity, 'Activity');
  check(page.total === ctx.imported.activityCount, `The API lists ${page.total} activities, the import stored ${ctx.imported.activityCount}`);
  check(page.items.length === Math.min(page.total, 200), 'The activity page is incomplete');
  check(page.items.every((activity) => activity.source === 'CSV' && !activity.isSimulated), 'CSV activities must be labelled source=CSV, not simulated');
  check(page.items.every((activity) => activity.emission), 'Every imported activity should carry its calculated emission');
  expectEach(page.items.map((activity) => activity.emission), SHAPES.activityEmission, 'Activity.emission');

  const stored = await prisma.activity.count({ where: factoryActivities() });
  check(stored === ctx.imported.activityCount, `The database holds ${stored} activities, the import reported ${ctx.imported.activityCount}`);
  ctx.activities = page.items;
  log(`    activity records=${stored} (source=CSV)`);
}

async function calculateEmissions() {
  const emissions = await prisma.emission.findMany({
    where: { activity: factoryActivities() },
    select: { activity_id: true, co2e_value: true, co2e_unit: true },
  });
  check(new Set(emissions.map((emission) => emission.activity_id)).size === ctx.imported.activityCount, 'Every activity should have a stored emission');
  check(emissions.length === ctx.imported.activityCount, 'An activity has more than one stored emission');
  ctx.dbTotal = sum(emissions.map((emission) => toTonnes(emission.co2e_value, emission.co2e_unit)));
  check(near(toTonnes(ctx.imported.co2e.value, ctx.imported.co2e.unit), ctx.dbTotal), 'The import estimate differs from the stored emissions');

  // The stored emission is exactly what the carbon engine calculates for the same input.
  const sample = ctx.activities[0];
  const calculation = await api('POST', '/emissions/calculate', {
    body: { activityType: sample.energyType, quantity: sample.quantity, unit: sample.unit },
  });
  expectShape(calculation, SHAPES.calculation, 'EmissionCalculation');
  check(
    near(calculation.co2eValue, sample.emission.co2eValue, 1e-9) && calculation.co2eUnit === sample.emission.co2eUnit,
    `Carbon engine gives ${calculation.co2eValue} ${calculation.co2eUnit} for activity #${sample.id}, stored ${sample.emission.co2eValue} ${sample.emission.co2eUnit}`
  );
  check(calculation.emissionFactorId === sample.emission.emissionFactorId, 'The stored emission used a different emission factor');
  log(`    emission records=${emissions.length} total=${fmt(ctx.dbTotal)} tCO2e (database)`);
}

async function displayDashboard() {
  const summary = await api('GET', factoryPath('/emissions/summary'));
  expectShape(summary, SHAPES.emissionSummary, 'EmissionSummary');
  expectShape(summary.totals, SHAPES.summaryTotals, 'EmissionSummary.totals');
  expectShape(summary.intensity, SHAPES.intensity, 'EmissionSummary.intensity');
  expectEach(summary.byProcess, SHAPES.processShare, 'EmissionSummary.byProcess');

  check(summary.co2eUnit === 'tCO2e', `The dashboard reports ${summary.co2eUnit}, expected tCO2e`);
  check(near(summary.totals.co2e, ctx.dbTotal), `Dashboard total ${summary.totals.co2e} tCO2e ≠ database total ${ctx.dbTotal} tCO2e`);
  check(summary.totals.activityCount === ctx.imported.activityCount, 'The dashboard counts a different number of activities');
  check(near(sum(summary.byProcess.map((entry) => entry.co2e)), summary.totals.co2e), 'Process breakdown does not add up to the total');
  check(near(sum(summary.bySource.map((entry) => entry.co2e)), summary.totals.co2e), 'Source breakdown does not add up to the total');
  ctx.summary = summary;
  log(`    total=${fmt(summary.totals.co2e)} tCO2e intensity=${fmt(summary.intensity.value)} ${summary.intensity.unit ?? ''}`);
  log(`    by process: ${summary.byProcess.map((entry) => `${entry.process} ${fmt(entry.percentage)}%`).join(', ')}`);
}

async function identifyHotspot() {
  const ranking = await api('GET', factoryPath('/hotspots'));
  expectShape(ranking, SHAPES.hotspotRanking, 'HotspotRanking');
  expectEach(ranking.hotspots, SHAPES.hotspot, 'Hotspot');
  check(near(ranking.totalEmission, ctx.summary.totals.co2e), 'The hotspot total differs from the dashboard total');

  const top = ranking.hotspots[0];
  check(top?.rank === 1, 'The ranking has no #1 hotspot');
  check(top.processId === ctx.summary.byProcess[0].processId, "The #1 hotspot is not the dashboard's largest process");

  const detail = await api('GET', factoryPath(`/hotspots/${top.processId}`));
  expectShape(detail, SHAPES.hotspotDetail, 'HotspotDetail');
  check(detail.hotspot?.processId === top.processId && near(detail.emission, top.emission), 'The hotspot detail disagrees with the ranking');
  check(near(sum(detail.drivers.map((driver) => driver.co2e)), detail.emission), 'Hotspot drivers do not add up to the process emission');
  ctx.ranking = ranking;
  ctx.top = top;
  log(`    #1 ${top.process} (process_id=${top.processId}) ${fmt(top.emission)} tCO2e = ${fmt(top.percentage)}% ${top.severity}`);
}

async function askWhy() {
  const response = await ask(hotspotPrompt(ctx.top.process));
  expectCopilot(response, { intent: 'HOTSPOT_ANALYSIS', tools: ['get_hotspot_ranking', 'get_hotspot_detail'] });
  check(response.answer.toLowerCase().includes(ctx.top.process.toLowerCase()), `The root-cause answer never names ${ctx.top.process}`);
  log(`    answer: ${response.answer.split('\n').find((line) => line.trim())?.slice(0, 140)}`);
}

async function retrieveAlternatives() {
  const { alternatives } = await api('GET', '/circular/alternatives');
  check(Array.isArray(alternatives) && alternatives.length > 0, 'The circular knowledge base is empty — run npm run db:seed');

  const run = await api('POST', factoryPath('/recommendations/generate'), { status: 201, body: {} });
  expectShape(run, SHAPES.recommendationRun, 'RecommendationRun');
  expectEach(run.recommendations, SHAPES.recommendation, 'Recommendation');
  check(run.recommendations.length > 0, `No circular alternative matched the factory's emissions: ${JSON.stringify(run.warnings)}`);
  check(
    run.recommendations.every((item) => alternatives.some((alternative) => alternative.id === item.alternativeId)),
    'A recommendation refers to an alternative outside the knowledge base'
  );
  // The basis is the trailing 12 months, which can exclude older demo rows.
  check(run.basis.factoryEmission <= ctx.summary.totals.co2e + EPSILON, 'Recommendations are based on more emissions than the factory has');

  const stored = await prisma.recommendation.count({ where: { factory_id: session.factoryId } });
  check(stored === run.recommendations.length, `The database holds ${stored} recommendations, the API returned ${run.recommendations.length}`);
  log(`    knowledge base=${alternatives.length} alternatives, matched=${run.recommendations.length} (records=${stored})`);
}

async function rankInterventions() {
  const list = await api('GET', factoryPath('/recommendations'));
  expectShape(list, SHAPES.recommendationList, 'RecommendationList');
  expectEach(list.recommendations, SHAPES.recommendation, 'Recommendation');
  list.recommendations.forEach((item, index) => {
    check(item.rank === index + 1, `Recommendation ranks are not consecutive at position ${index + 1}`);
    if (index > 0) check(item.score <= list.recommendations[index - 1].score, 'Recommendations are not ranked by score');
  });

  const response = await ask(FIX_FIRST_PROMPT, { conversation: true });
  expectCopilot(response, { intent: 'RECOMMENDATION', tools: ['get_hotspot_ranking', 'get_recommendations'] });
  expectEach(response.recommendations, SHAPES.copilotRecommendation, 'CopilotResponse.recommendations');
  check(response.recommendations.length > 0, 'The copilot returned no ranked interventions');

  // The AI explains the backend ranking; it never re-scores it.
  const best = list.recommendations[0];
  const [first] = response.recommendations;
  check(first.score === best.score, `The copilot's #1 scores ${first.score}, the backend's #1 scores ${best.score}`);
  check(
    list.recommendations.some((item) => item.score === first.score && item.alternative === first.name),
    `The copilot's #1 "${first.name}" is not a top-scored backend recommendation`
  );
  ctx.recommendations = list.recommendations;
  ctx.selected = best;
  log(`    selected intervention: #1 ${best.alternative} (score ${fmt(best.score)}, ${best.scope === 'FACTORY' ? 'factory-wide' : best.process})`);
}

async function runScenario() {
  const baseline = await prisma.emission.aggregate({ where: { activity: factoryActivities() }, _count: true });

  const result = await api('POST', factoryPath('/scenarios/calculate'), { body: SCENARIO_INPUT });
  expectShape(result, SHAPES.scenarioResult, 'ScenarioResult');
  check(near(result.baselineEmission, ctx.summary.totals.co2e), 'The scenario baseline differs from the dashboard total');
  check(near(result.projectedEmission, result.baselineEmission - result.reductionAmount), 'Projected ≠ baseline − reduction');
  const materialEmission = sum(ctx.summary.bySource.filter((source) => source.category === 'MATERIAL').map((source) => source.co2e));
  check(near(result.reductionAmount, materialEmission * 0.3), `30% recycled material should cut 30% of ${materialEmission} tCO2e of material emissions`);

  const saved = await api('POST', factoryPath('/scenarios'), {
    status: 201,
    body: { ...SCENARIO_INPUT, name: `30% recycled material (after selecting ${ctx.selected.alternative})` },
  });
  expectShape(saved, { ...SHAPES.scenarioResult, ...SHAPES.savedScenario }, 'SavedScenario');
  check(saved.factoryId === session.factoryId && near(saved.projectedEmission, result.projectedEmission), 'The saved scenario differs from the calculation');
  const savedList = await api('GET', factoryPath('/scenarios'));
  check(savedList.some((scenario) => scenario.id === saved.id), 'The saved scenario is not listed');

  // Scenarios never modify baseline data (BR-07).
  const after = await prisma.emission.aggregate({ where: { activity: factoryActivities() }, _count: true });
  check(after._count === baseline._count, 'Running a scenario changed the stored emissions');
  check((await prisma.scenario.count({ where: { factory_id: session.factoryId } })) === 1, 'Expected exactly one stored scenario');

  // The copilot's what-if answer comes from the same deterministic engine.
  const response = await ask(SCENARIO_PROMPT, { conversation: true });
  expectCopilot(response, { intent: 'SCENARIO', tools: ['calculate_scenario'] });
  expectShape(response.scenario, SHAPES.copilotScenario, 'CopilotResponse.scenario');
  for (const field of ['baselineEmission', 'projectedEmission', 'reductionAmount', 'reductionPercent']) {
    check(near(response.scenario[field], result[field]), `Copilot scenario ${field}=${response.scenario[field]}, engine=${result[field]}`);
  }
  ctx.savedScenario = saved;
  log(`    scenario_id=${saved.id}: ${fmt(result.baselineEmission)} → ${fmt(result.projectedEmission)} tCO2e (−${fmt(result.reductionPercent)}%)`);

  // CopilotPage restores this conversation from history in the same contract.
  const history = await api('GET', factoryPath('/ai/history'));
  expectShape(history, SHAPES.history, 'CopilotHistory');
  check(history.conversationId === session.conversationId, 'History restored a different conversation');
  expectEach(history.messages, SHAPES.chatMessage, 'ChatMessage');
  check(history.messages.length === 4, `Expected 4 messages in the conversation, history has ${history.messages.length}`);
  history.messages
    .filter((message) => message.role === 'assistant')
    .forEach((message, index) => expectShape(message.response, SHAPES.copilotResponse, `ChatMessage[${index}].response`));
  const storedMessages = await prisma.aiMessage.count({ where: { conversation_id: session.conversationId } });
  check(storedMessages === 4, `The database holds ${storedMessages} messages for conversation ${session.conversationId}`);
}

async function generateActionPlan() {
  const response = await ask(ACTION_PLAN_PROMPT);
  expectCopilot(response, {
    intent: 'ACTION_PLAN',
    tools: ['get_hotspot_ranking', 'get_recommendations', 'list_scenarios', 'generate_action_plan'],
  });
  const plan = expectShape(response.actionPlan, SHAPES.actionPlan, 'ActionPlan');
  for (const section of ['immediateInvestigation', 'shortTermActions', 'mediumTermInterventions', 'measurements']) {
    expectEach(plan[section], SHAPES.planAction, `ActionPlan.${section}`);
  }
  expectEach(plan.expectedImpact, SHAPES.impactEstimate, 'ActionPlan.expectedImpact');
  expectEach(plan.successMetrics, SHAPES.successMetric, 'ActionPlan.successMetrics');
  check(plan.immediateInvestigation.length > 0, 'The action plan has no immediate investigation');
  check(plan.expectedImpact.some((impact) => impact.source === 'recommendation'), 'The action plan ignores the ranked recommendations');
  check(plan.expectedImpact.some((impact) => impact.source === 'scenario'), 'The action plan ignores the saved scenario');
  log(`    plan source=${plan.source} confidence=${plan.confidence}: ${plan.immediateInvestigation[0].title}`);
}

async function openReport() {
  const report = await api('GET', factoryPath('/report'));
  expectShape(report, SHAPES.report, 'FactoryReport');
  expectShape(report.factory, SHAPES.reportFactory, 'FactoryReport.factory');
  expectShape(report.emissions, SHAPES.reportEmissions, 'FactoryReport.emissions');
  expectEach(report.hotspots, SHAPES.hotspot, 'FactoryReport.hotspots');
  expectEach(report.recommendations, SHAPES.recommendation, 'FactoryReport.recommendations');
  expectEach(report.scenarios, { ...SHAPES.scenarioResult, ...SHAPES.savedScenario }, 'FactoryReport.scenarios');

  check(report.factory.id === session.factoryId, 'The report is for a different factory');
  check(near(report.emissions.total, ctx.summary.totals.co2e), 'The report total differs from the dashboard total');
  check(
    report.hotspots.map((hotspot) => hotspot.processId).join() === ctx.ranking.hotspots.map((hotspot) => hotspot.processId).join(),
    'The report hotspots differ from the hotspot ranking'
  );
  check(
    report.recommendations.map((item) => item.id).join() === ctx.recommendations.map((item) => item.id).join(),
    'The report recommendations differ from the ranked list'
  );
  check(report.scenarios.some((scenario) => scenario.id === ctx.savedScenario.id), 'The report omits the saved scenario');
  check(report.methodology.length > 0 && report.assumptions.length > 0, 'The report has no methodology or assumptions');

  // What ReportsPage renders.
  log(`    ${report.factory.name} — ${report.factory.industry}, ${report.factory.location}`);
  log(`    total ${fmt(report.emissions.total)} ${report.emissions.unit}, intensity ${fmt(report.emissions.intensity.value)} ${report.emissions.intensity.unit ?? ''}`);
  log(`    top hotspot ${report.hotspots[0].process} (${fmt(report.hotspots[0].percentage)}%, ${report.hotspots[0].severity})`);
  log(`    top recommendation ${report.recommendations[0].alternative} (score ${fmt(report.recommendations[0].score)})`);
  log(`    scenario "${report.scenarios[0].name}": −${fmt(report.scenarios[0].reductionPercent)}%`);
}

const STEPS = [
  ['1. Login', login],
  ['2. Open factory', openFactory],
  ['3. Add processes', addProcesses],
  ['4. Upload demo CSV', uploadCsv],
  ['5. Persist activities', persistActivities],
  ['6. Calculate emissions', calculateEmissions],
  ['7. Display dashboard', displayDashboard],
  ['8. Identify hotspot', identifyHotspot],
  ['9. Ask AI why', askWhy],
  ['10. Retrieve circular alternatives', retrieveAlternatives],
  ['11. Rank interventions', rankInterventions],
  ['12. Run scenario', runScenario],
  ['13. Generate action plan', generateActionPlan],
  ['14. Open report', openReport],
];

async function cleanUp() {
  if (!session.user) return;
  if (KEEP_DATA) {
    log(`\nKept for inspection: ${session.email} / ${session.password} (factory_id=${session.factoryId})`);
    return;
  }
  if (session.factoryId && session.token) await api('DELETE', factoryPath()).catch((err) => log(`    ${err.message}`));
  // Cascades remove processes, activities, emissions, recommendations, scenarios and conversations.
  await prisma.factory.deleteMany({ where: { organization_id: session.user.organizationId } });
  await prisma.user.delete({ where: { id: session.user.id } });
  await prisma.organization.delete({ where: { id: session.user.organizationId } });
  log(`\nRemoved the test user ${session.user.id}, organization ${session.user.organizationId} and their data.`);
}

async function main() {
  ctx.csvText = await readFile(CSV_PATH, 'utf8');
  ctx.csvRows = parse(ctx.csvText, { columns: true, skip_empty_lines: true, trim: true });
  log(`EcoTrace golden path — API ${API_URL}, CSV ${path.relative(process.cwd(), CSV_PATH)}`);

  const passed = [];
  let failure = null;
  try {
    for (const [name, run] of STEPS) {
      log(`\n${name}`);
      await run();
      passed.push(name);
    }
  } catch (err) {
    failure = err;
  } finally {
    await cleanUp().catch((err) => log(`\nCleanup failed: ${err.message}`));
    await prisma.$disconnect();
  }

  log('\n--- Trace ---');
  log(`user_id=${session.user?.id ?? '-'} organization_id=${session.user?.organizationId ?? '-'} factory_id=${session.factoryId ?? '-'}`);
  log(`API calls: ${apiCalls.length}, AI calls: ${aiCalls.length}`);
  for (const call of aiCalls) log(`  "${call.message}" → ${call.intent} [${call.tools.join(', ')}]`);

  if (failure) {
    log(`\nFAILED at ${STEPS[passed.length][0]}: ${failure.message}`);
    process.exitCode = 1;
  } else {
    log(`\nPASSED all ${STEPS.length} steps.`);
  }
}

main();
