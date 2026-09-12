import prisma from '../db/db.js';

export async function createFactory(user, data) {
  return prisma.factory.create({
    data: {
      ...data,
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
    data,
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
      ...data,
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
    data,
  });
}

export async function deleteProcess(processId) {
  return prisma.process.delete({
    where: { id: processId },
  });
}
