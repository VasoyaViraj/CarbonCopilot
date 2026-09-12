import prisma from '../db/db.js';

// Request bodies are camelCase (API contract) while the Prisma models use snake_case columns.
// Undefined values are ignored by Prisma, so partial updates leave omitted fields untouched.
const toFactoryData = (data) => ({
  name: data.name,
  industry_type: data.industryType,
  location: data.location,
  production_capacity: data.productionCapacity,
  production_unit: data.productionUnit,
});

const toProcessData = (data) => ({
  name: data.name,
  process_type: data.processType,
  description: data.description,
});

export async function createFactory(user, data) {
  return prisma.factory.create({
    data: {
      ...toFactoryData(data),
      organization_id: user.organizationId,
    },
  });
}

export async function getFactories(user) {
  return prisma.factory.findMany({
    where: { organization_id: user.organizationId },
    orderBy: { created_at: 'desc' }
  });
}

export async function getFactoryById(factoryId) {
  return prisma.factory.findUnique({
    where: { id: factoryId },
  });
}

export async function updateFactory(factoryId, data) {
  return prisma.factory.update({
    where: { id: factoryId },
    data: toFactoryData(data),
  });
}

export async function deleteFactory(factoryId) {
  return prisma.factory.delete({
    where: { id: factoryId },
  });
}

export async function createProcess(factoryId, data) {
  return prisma.process.create({
    data: {
      ...toProcessData(data),
      factory_id: factoryId,
    },
  });
}

export async function getProcesses(factoryId) {
  return prisma.process.findMany({
    where: { factory_id: factoryId },
    orderBy: { created_at: 'desc' }
  });
}

export async function getProcessById(processId) {
  return prisma.process.findUnique({
    where: { id: processId },
  });
}

export async function updateProcess(processId, data) {
  return prisma.process.update({
    where: { id: processId },
    data: toProcessData(data),
  });
}

export async function deleteProcess(processId) {
  return prisma.process.delete({
    where: { id: processId },
  });
}
